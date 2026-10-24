// 08 C.1 steps 5–11 with stand-in adapters: cache hit, prerequisite-failed, the no-observations
// rewrite, candidate-changed, accept always running, and the lanes of step 6.
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Listing } from '../src/candidate/digest.js';
import { CacheStore } from '../src/cache/store.js';
import { acceptOutcome } from '../src/nodes/accept.js';
import { NODE_IDS, type NodeId } from '../src/runner/edges.js';
import { exitCodeOf } from '../src/runner/gating.js';
import { plan } from '../src/runner/plan.js';
import { type NodeAdapter, type NodeOutcome, type Population, runPlan, type RunContext, type RunnerDeps } from '../src/runner/run.js';
import { SHA256, templateConfig } from './fixtures.js';

const pass = (n = 1): NodeOutcome => ({ status: 'PASS', expected: n, observed: n, evaluated: n, findings: [] });
const fail: NodeOutcome = { status: 'FAIL', expected: 1, observed: 1, evaluated: 1, findings: [{ locator: 'a.ts:1', message: 'bad', standard: 'S-33', hint: 'fix it' }] };

function setup(only: NodeId[], adapters: Partial<Record<NodeId, NodeAdapter>>, opts: { counts?: Partial<Record<NodeId, number>>; inventory?: NodeOutcome; redigest?: () => Promise<string> } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'devai-w1-run-'));
  const listing: Listing = { base: null, entries: [{ tag: 'F', mode: '100644', hash: SHA256, path: 'a.ts' }], deleted: [], untracked: [] };
  const ctx: RunContext = { root, config: templateConfig(), runtime: 'bare', cliVersion: '3.0.0', listing, base: null, head: 'b'.repeat(40), plan: plan({ packet: false, full: false, only }) };
  const populations = Object.fromEntries(NODE_IDS.map((id) => [id, { predicate: `no ${id} population`, count: opts.counts?.[id] ?? 1, skippable: id !== 'inventory' && id !== 'accept' } satisfies Population])) as Record<NodeId, Population>;
  const store = new CacheStore(root);
  const deps: RunnerDeps = {
    inventory: async () => ({ outcome: opts.inventory ?? pass(), data: { toolchainDigest: SHA256, populations, changed: [], mounts: { apps: [], controllers: [], read: [], unresolved: [] }, projects: [], packageDirs: [] } }),
    adapters,
    accept: (c, rows, timings) => acceptOutcome(c, rows, timings, null),
    redigest: opts.redigest ?? (async () => 'd0'),
    store,
    parallelism: 4,
  };
  return { ctx, deps, store };
}

const adapter = (id: NodeId, run: () => Promise<NodeOutcome>): NodeAdapter => ({ id, contract: 1, configFiles: () => [], inputs: () => ['a.ts'], run });

describe('runner (C.1 5–11)', () => {
  it('a PASS is cached and the second run re-emits it with cached: true and its key', async () => {
    let runs = 0;
    const a = { format: adapter('format', async () => (runs++, pass())) };
    const first = setup(['format'], a);
    const r1 = await runPlan(first.ctx, first.deps, 'd0');
    const f1 = r1.rows.find((r) => r.id === 'format')!;
    expect(f1).toMatchObject({ status: 'PASS', cached: false });
    expect(f1.cacheKey).toMatch(/^[0-9a-f]{64}$/);
    const { inventory: _inv, ...fresh } = first.ctx;
    const r2 = await runPlan(fresh, first.deps, 'd0');
    expect(r2.rows.find((r) => r.id === 'format')).toMatchObject({ status: 'PASS', cached: true, cacheKey: f1.cacheKey });
    expect(runs).toBe(1);
    expect(r2.rows.map((r) => r.id)).toEqual(['inventory', 'format', 'accept']);
  });

  it('a FAIL is not cached; inventory and accept are never cached', async () => {
    let runs = 0;
    const { ctx, deps } = setup(['format'], { format: adapter('format', async () => (runs++, fail)) });
    await runPlan(ctx, deps, 'd0');
    await runPlan({ ...ctx }, deps, 'd0');
    expect(runs).toBe(2);
  });

  it('a node whose prerequisite failed is UNKNOWN prerequisite-failed with the prerequisite as locator', async () => {
    let ran = false;
    const { ctx, deps } = setup(['route-contract'], {
      typecheck: adapter('typecheck', async () => fail),
      'route-contract': adapter('route-contract', async () => ((ran = true), pass())),
    });
    const out = await runPlan(ctx, deps, 'd0');
    const rc = out.rows.find((r) => r.id === 'route-contract')!;
    expect(ran).toBe(false);
    expect(rc).toMatchObject({ status: 'UNKNOWN', reason: 'prerequisite-failed', expected: 0, observed: 0 });
    expect(rc.findings[0]).toMatchObject({ locator: 'typecheck', hint: 'fix typecheck first; this node did not run' });
    const accept = out.rows.find((r) => r.id === 'accept')!;
    expect(accept.status).toBe('FAIL'); // a gating FAIL (typecheck)
    expect(exitCodeOf(out.rows, ctx.config, false)).toBe(1);
  });

  it('an inventory UNKNOWN makes every planned node prerequisite-failed; accept still runs', async () => {
    const { ctx, deps } = setup(['format'], { format: adapter('format', async () => pass()) }, {
      inventory: { status: 'UNKNOWN', reason: 'engines-mismatch', expected: 1, observed: 1, evaluated: 1, findings: [] },
    });
    const out = await runPlan(ctx, deps, 'd0');
    expect(out.rows.find((r) => r.id === 'format')).toMatchObject({ status: 'UNKNOWN', reason: 'prerequisite-failed' });
    // B.28 (D-084 item 3): accept carries the first gating UNKNOWN's reason in DAG order, here inventory's.
    expect(out.rows.find((r) => r.id === 'accept')).toMatchObject({ status: 'UNKNOWN', reason: 'engines-mismatch' });
    expect(exitCodeOf(out.rows, ctx.config, false)).toBe(2);
  });

  it('a PASS with observed = 0 is rewritten to UNKNOWN no-observations and not cached', async () => {
    const { ctx, deps, store } = setup(['format'], { format: adapter('format', async () => ({ status: 'PASS', expected: 0, observed: 0, evaluated: 0, findings: [] })) });
    const out = await runPlan(ctx, deps, 'd0');
    const f = out.rows.find((r) => r.id === 'format')!;
    expect(f).toMatchObject({ status: 'UNKNOWN', reason: 'no-observations' });
    expect(store.lookup('format', f.cacheKey!)).toBeNull();
  });

  it('inventory SKIPPED marks a node with an empty population; it does not run', async () => {
    let ran = false;
    const { ctx, deps } = setup(['format'], { format: adapter('format', async () => ((ran = true), pass())) }, { counts: { format: 0 } });
    const out = await runPlan(ctx, deps, 'd0');
    expect(ran).toBe(false);
    expect(out.rows.find((r) => r.id === 'format')).toMatchObject({ status: 'SKIPPED', evidence: 'no format population', expected: 0, observed: 0 });
    expect(out.rows.find((r) => r.id === 'accept')!.status).toBe('PASS');
  });

  it('candidate-changed: the re-digest differs, the run\'s cache writes are discarded, exit 2', async () => {
    const { ctx, deps, store } = setup(['format'], { format: adapter('format', async () => pass()) }, { redigest: async () => 'd1' });
    const out = await runPlan(ctx, deps, 'd0');
    expect(out.candidateChanged).toBe(true);
    expect(store.lookup('format', out.rows.find((r) => r.id === 'format')!.cacheKey!)).toBeNull();
    expect(exitCodeOf(out.rows, ctx.config, out.candidateChanged)).toBe(2);
    expect(out.rows.map((r) => r.id)).toContain('accept');
  });

  it('a crashing adapter is UNKNOWN runner-crashed, never a thrown command', async () => {
    const { ctx, deps } = setup(['format'], { format: adapter('format', async () => { throw new Error('boom'); }) });
    const out = await runPlan(ctx, deps, 'd0');
    expect(out.rows.find((r) => r.id === 'format')).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed' });
  });

  it('accept records the deferred nodes and editLoopMs, and counts every other planned node', async () => {
    const { ctx, deps } = setup(['format'], { format: adapter('format', async () => pass()) });
    const out = await runPlan(ctx, deps, 'd0');
    const accept = out.rows.find((r) => r.id === 'accept')!;
    expect(accept).toMatchObject({ status: 'PASS', expected: 2, observed: 2, evaluated: 2 });
    expect(accept.details).toMatchObject({ node: 'accept', requiredSet: [], deferred: ctx.plan.deferred });
    expect(accept.details?.node === 'accept' && typeof accept.details.editLoopMs).toBe('number');
  });

  it('lanes: class C and postgres nodes one at a time; model nodes alone', async () => {
    let live = 0;
    let serialLive = 0;
    let maxSerial = 0;
    let modelWithOthers = false;
    const slow = (id: NodeId, serial: boolean, model = false) => adapter(id, async () => {
      live++;
      if (serial) maxSerial = Math.max(maxSerial, ++serialLive);
      if (model && live > 1) modelWithOthers = true;
      await new Promise((r) => setTimeout(r, 20));
      live--;
      if (serial) serialLive--;
      return pass();
    });
    const { ctx, deps } = setup(['e2e', 'deadcode', 'layout', 'format', 'permissions-pattern'], {
      e2e: slow('e2e', true), deadcode: slow('deadcode', true), layout: slow('layout', false), format: slow('format', false),
      typecheck: slow('typecheck', false), 'route-contract': slow('route-contract', false), 'permissions-pattern': slow('permissions-pattern', false, true),
    });
    const out = await runPlan(ctx, deps, 'd0');
    expect(maxSerial).toBe(1);
    expect(modelWithOthers).toBe(false);
    expect(out.rows.every((r) => r.status === 'PASS')).toBe(true);
  });
});
