// 08 C.1 steps 5–11: inventory alone, then a Kahn walk with the lanes of step 6, the cache check of
// step 7, prerequisite-failed rows (step 8), the no-observations rewrite (step 9), the candidate
// re-digest (step 10) and `accept` over whatever results exist (step 11).
import { availableParallelism } from 'node:os';
import type { DevaiConfig } from '../config.js';
import type { Listing } from '../candidate/digest.js';
import { cacheKey, configDigest, inputDigest, nodeVersion } from '../cache/key.js';
import { type NodeRow, resultDigest } from '../cache/result-digest.js';
import type { CacheStore } from '../cache/store.js';
import type { Scratch } from '../db/scratch.js';
import type { PacketFacts } from '../model/packet.js';
import type { PacketView } from '../nodes/spec-tests.js';
import type { MountCensus } from '../ts/mounts.js';
import { isEditLoopClass, lane, needsOf, type NodeId } from './edges.js';
import type { Plan } from './plan.js';

/**
 * What a node returns; the runner adds id, durationMs, cached, cacheKey and needs. `fromEvidence` marks a
 * PASS read from a tracked evidence file whose digests matched (B.24: reported as `cached: true`).
 */
export type NodeOutcome = Omit<NodeRow, 'id' | 'durationMs' | 'cached' | 'cacheKey' | 'needs'> & { fromEvidence?: boolean };

/** `inventory`'s population verdict per node (B.1 "every population Part B names"). */
export interface Population {
  /** The Part B population string, printed as SKIPPED evidence when `count` is 0. */
  predicate: string;
  count: number;
  /** False for the nodes Part B says are never SKIPPED. */
  skippable: boolean;
}

export interface InventoryData {
  toolchainDigest: string;
  populations: Record<NodeId, Population>;
  /** Changed paths (base..HEAD plus working tree, adds/deletes/untracked; B.1 Inputs), sorted. */
  changed: string[];
  /** B.1 side products (R6 W2): the mounted-route census and the affected `tsc -b` project closure. */
  mounts: MountCensus;
  /** Repo-relative tsconfig paths of the affected project closure, sorted. */
  projects: string[];
  /** Workspace package folders the globs match (root excluded), sorted. */
  packageDirs: string[];
}

export interface RunContext {
  root: string;
  config: DevaiConfig;
  runtime: 'bare' | 'docker';
  cliVersion: string;
  /** The candidate at step 4; inputs and config files are hashed from it. */
  listing: Listing;
  /** The packet's base commit, or null without `--packet`. */
  base: string | null;
  head: string;
  plan: Plan;
  /** Set by step 5. */
  inventory?: InventoryData;
  /** Set by `db-apply` (B.20), run or reused: the scratch database its consumers use. */
  scratch?: Scratch;
  /**
   * The packet the run is bound to (`--packet`, W4): `spec-tests` reads its kind, observations and pin;
   * the model nodes read the `PacketFacts` part (`modelPacket` in model/packet.ts).
   */
  packet?: PacketView & Partial<PacketFacts>;
  /** Results so far, by node (B.27 phase 2 reads the current report). */
  rows?: ReadonlyMap<NodeId, NodeRow>;
}

export interface NodeAdapter {
  id: NodeId;
  /** The per-node integer of `nodeVersion` (C.4), bumped when the node's contract changes. */
  contract: number;
  /** Config files (C.4 `configDigest`), repo-relative. */
  configFiles(ctx: RunContext): string[];
  /** Declared inputs (Part B "Inputs"), repo-relative paths at the candidate. */
  inputs(ctx: RunContext): string[];
  /** Trailing key components after the general C.4 key (the model components of B.24, B.27; D-076). */
  keyExtra?(ctx: RunContext): Promise<string[]>;
  run(ctx: RunContext): Promise<NodeOutcome>;
  /** C.4 Reuse beyond the key: a stored PASS is re-emitted only when this agrees (`db-apply`: its database still exists). */
  reuse?(ctx: RunContext, hit: NodeRow): Promise<boolean>;
}

export interface Timing { id: NodeId; start: number; end: number }

export interface RunnerDeps {
  inventory: (ctx: RunContext) => Promise<{ outcome: NodeOutcome; data: InventoryData }>;
  adapters: Partial<Record<NodeId, NodeAdapter>>;
  accept: (ctx: RunContext, rows: readonly NodeRow[], timings: readonly Timing[]) => NodeOutcome;
  /** C.1 step 10: the candidate digest after the run (same source as step 4). */
  redigest: () => Promise<string>;
  store: CacheStore;
  parallelism?: number;
  /** stderr, for diagnostics about the command itself (08 Part A). */
  diagnostic?: (line: string) => void;
}

export interface RunOutcome {
  rows: NodeRow[];
  toolchainDigest: string | null;
  candidateChanged: boolean;
}

const UNCACHED: readonly NodeId[] = ['inventory', 'accept'];

/** C.1 step 9: a success with `observed = 0` is `UNKNOWN: no-observations` (S-65). */
export function rewriteNoObservations(o: NodeOutcome): NodeOutcome {
  if (o.status !== 'PASS' || o.observed !== 0) return o;
  return { ...o, status: 'UNKNOWN', reason: 'no-observations' };
}

export async function runPlan(ctx: RunContext, deps: RunnerDeps, digest0: string): Promise<RunOutcome> {
  const { plan } = ctx;
  const phase = plan.sqlTypedPhase;
  const rows = new Map<NodeId, NodeRow>();
  ctx.rows = rows;
  const timings: Timing[] = [];
  const row = (id: NodeId, outcome: NodeOutcome, durationMs: number, extra: Partial<Pick<NodeRow, 'cached' | 'cacheKey'>> = {}): NodeRow => {
    const { fromEvidence, ...o } = outcome;
    const cached = fromEvidence === true && o.status === 'PASS' && extra.cacheKey !== undefined;
    return ({ id, ...o, durationMs, cached, needs: needsOf(id, phase), ...extra }) as NodeRow;
  };
  const timed = async <T>(id: NodeId, f: () => Promise<T>): Promise<T> => {
    const start = Date.now();
    try {
      return await f();
    } finally {
      timings.push({ id, start, end: Date.now() });
    }
  };

  // Step 5: inventory alone.
  let inventoryOutcome: NodeOutcome;
  const t0 = Date.now();
  try {
    const inv = await timed('inventory', () => deps.inventory(ctx));
    ctx.inventory = inv.data;
    inventoryOutcome = rewriteNoObservations(inv.outcome);
  } catch (e) {
    deps.diagnostic?.(`devai: inventory crashed: ${(e as Error).stack ?? String(e)}`);
    inventoryOutcome = { status: 'UNKNOWN', reason: 'runner-crashed', expected: 0, observed: 0, evaluated: 0, findings: [] };
  }
  rows.set('inventory', row('inventory', inventoryOutcome, Date.now() - t0));

  // Steps 6–9.
  const prerequisiteFailed = (id: NodeId): NodeOutcome | null => {
    const failed = (plan.prerequisites.get(id) ?? []).filter((p) => {
      const s = rows.get(p)?.status;
      return s === 'FAIL' || s === 'UNKNOWN';
    });
    if (failed.length === 0) return null;
    return {
      status: 'UNKNOWN', reason: 'prerequisite-failed', expected: 0, observed: 0, evaluated: 0,
      findings: failed.map((p) => ({ locator: p, message: `prerequisite ${p} is ${rows.get(p)!.status}`, standard: '02 §2', hint: `fix ${p} first; this node did not run` })),
    };
  };

  const execute = async (id: NodeId): Promise<void> => {
    const start = Date.now();
    const inventoryFailed = rows.get('inventory')!.status !== 'PASS';
    const pre = inventoryFailed ? prerequisiteFailed(id) : null;
    if (pre) return void rows.set(id, row(id, pre, 0));
    const pop = ctx.inventory?.populations[id];
    if (pop && pop.skippable && pop.count === 0) {
      return void rows.set(id, row(id, { status: 'SKIPPED', evidence: pop.predicate, expected: 0, observed: 0, evaluated: 0, findings: [] }, 0));
    }
    const pre2 = prerequisiteFailed(id);
    if (pre2) return void rows.set(id, row(id, pre2, 0));
    const adapter = deps.adapters[id];
    if (!adapter) throw new Error(`no adapter for planned node ${id}`); // the command refuses such plans (W1: later waves)
    let key: string | undefined;
    try {
      key = UNCACHED.includes(id) ? undefined : keyOf(ctx, adapter, rows, (await adapter.keyExtra?.(ctx)) ?? []);
    } catch (e) {
      deps.diagnostic?.(`devai: ${id} key crashed: ${(e as Error).stack ?? String(e)}`);
      return void rows.set(id, row(id, { status: 'UNKNOWN', reason: 'runner-crashed', expected: 0, observed: 0, evaluated: 0, findings: [] }, Date.now() - start));
    }
    if (key) {
      const hit = deps.store.lookup(id, key);
      if (hit && (!adapter.reuse || (await adapter.reuse(ctx, hit)))) return void rows.set(id, { ...hit, durationMs: Date.now() - start, cached: true, cacheKey: key });
    }
    let o: NodeOutcome;
    try {
      o = rewriteNoObservations(await timed(id, () => adapter.run(ctx)));
    } catch (e) {
      deps.diagnostic?.(`devai: ${id} crashed: ${(e as Error).stack ?? String(e)}`);
      o = { status: 'UNKNOWN', reason: 'runner-crashed', expected: 0, observed: 0, evaluated: 0, findings: [] };
    }
    const r = row(id, o, Date.now() - start, key ? { cacheKey: key } : {});
    rows.set(id, r);
    if (key && r.status === 'PASS') deps.store.store(id, key, r);
  };

  const P = Math.max(1, deps.parallelism ?? availableParallelism());
  const pending = plan.nodes.filter((n) => n !== 'inventory' && n !== 'accept');
  const running = new Map<NodeId, Promise<void>>();
  const done = (id: NodeId) => rows.has(id);
  const canStart = (id: NodeId): boolean => {
    const lanes = [...running.keys()].map((r) => lane(r, phase));
    if (lanes.includes('exclusive')) return false;
    const l = lane(id, phase);
    if (l === 'exclusive') return running.size === 0;
    if (running.size >= P) return false;
    return l === 'pool' || !lanes.includes('serial');
  };
  while (pending.length > 0 || running.size > 0) {
    for (const id of [...pending]) {
      if (!(plan.prerequisites.get(id) ?? []).every(done) || !canStart(id)) continue;
      pending.splice(pending.indexOf(id), 1);
      running.set(id, execute(id).finally(() => running.delete(id)));
    }
    if (running.size === 0) {
      if (pending.length > 0) throw new Error(`runner stalled with ${pending.join(', ')} pending`);
      break;
    }
    await Promise.race(running.values());
  }

  // Step 10: candidate re-digest.
  const candidateChanged = (await deps.redigest()) !== digest0;
  if (candidateChanged) deps.store.discard();

  // Step 11: accept over whatever results exist (never cached, never blocked).
  if (plan.nodes.includes('accept')) {
    const others = plan.nodes.filter((n) => n !== 'accept').map((n) => rows.get(n)).filter((r): r is NodeRow => r !== undefined);
    const ta = Date.now();
    rows.set('accept', row('accept', deps.accept(ctx, others, timings), Date.now() - ta));
  }
  return {
    rows: plan.nodes.map((n) => rows.get(n)).filter((r): r is NodeRow => r !== undefined),
    toolchainDigest: ctx.inventory?.toolchainDigest ?? null,
    candidateChanged,
  };
}

/** C.4 key of a node at this candidate. */
export function keyOf(ctx: RunContext, adapter: NodeAdapter, rows: ReadonlyMap<NodeId, NodeRow>, extra: readonly string[] = []): string {
  const hashes = new Map(ctx.listing.entries.map((e) => [e.path, e.hash]));
  const deps = (ctx.plan.prerequisites.get(adapter.id) ?? []).map((p) => resultDigest(rows.get(p)!));
  return cacheKey({
    nodeId: adapter.id,
    nodeVersion: nodeVersion(ctx.cliVersion, adapter.contract),
    toolchainDigest: ctx.inventory?.toolchainDigest ?? '',
    configDigest: configDigest(adapter.configFiles(ctx).map((path) => ({ path, sha256: hashes.get(path) ?? null }))),
    runtimeOrSchema: schemaOrRuntime(ctx, adapter.id, rows),
    inputDigests: adapter.inputs(ctx).map((p) => inputDigest(p, hashes.get(p) ?? null)),
    dependencyResultDigests: deps,
    extra: [...(adapter.id === 'sql-typed' ? [ctx.plan.sqlTypedPhase] : []), ...extra],
  });
}

/** C.4: DB-backed nodes key on `db-apply`'s `schemaDigest` instead of the runtime mode (mode-independent, 02 §2). */
function schemaOrRuntime(ctx: RunContext, id: NodeId, rows: ReadonlyMap<NodeId, NodeRow>): string {
  if (id === 'db-apply' || !needsOf(id, ctx.plan.sqlTypedPhase).includes('postgres')) return ctx.runtime;
  const d = rows.get('db-apply')?.details;
  return d?.node === 'db-apply' ? d.schemaDigest : ctx.runtime;
}

/** D-047: wall time from the first class A/B node's start to the last one's end. */
export function editLoopMs(timings: readonly Timing[]): number | null {
  const ab = timings.filter((t) => isEditLoopClass(t.id));
  if (ab.length === 0) return null;
  return Math.max(...ab.map((t) => t.end)) - Math.min(...ab.map((t) => t.start));
}
