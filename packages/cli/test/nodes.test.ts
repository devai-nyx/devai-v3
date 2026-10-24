// B.1 `inventory` and B.28 `accept`: Part B status sentences and finding forms as oracles.
import { describe, expect, it } from 'vitest';
import { workingTree } from '../src/candidate/digest.js';
import type { NodeRow } from '../src/cache/result-digest.js';
import { acceptOutcome, requiredSet } from '../src/nodes/accept.js';
import { globMatches, runInventory, satisfies } from '../src/nodes/inventory.js';
import { NODE_IDS } from '../src/runner/edges.js';
import { plan } from '../src/runner/plan.js';
import type { RunContext } from '../src/runner/run.js';
import { templateConfig } from './fixtures.js';
import { commitAll, templateWorkspace, write } from './repo.js';

async function inventoryOf(dir: string) {
  const ctx: RunContext = { root: dir, config: templateConfig(), runtime: 'bare', cliVersion: '3.0.0', listing: await workingTree(dir, null), base: null, head: 'b'.repeat(40), plan: plan({ packet: false, full: false, only: ['inventory'] }) };
  return runInventory(ctx);
}

describe('engines ranges', () => {
  it.each([
    ['24.20.0', '>=24 <25', true], ['25.0.0', '>=24 <25', false], ['23.9.9', '>=24 <25', false], ['24.0.0', '^24.0.0', true],
    ['9.15.0', '>=9 <10', true], ['24.1.0', '~24.0', false], ['24.0.5', '~24.0', true], ['24.3.1', '24', true], ['22.0.0', '>=24 || 22', true],
    ['24.3.1', '24.3.1', true], ['24.3.2', '24.3.1', false], ['24.3.1', '<=24', true], ['25.0.0', '<=24', false],
  ])('%s satisfies %s → %s', (v, range, ok) => expect(satisfies(v, range)).toBe(ok));
});

describe('workspace globs (ignore 7.0.5)', () => {
  it('matches one level per *, any depth with **, anchored at the root', () => {
    expect(globMatches('packages/*', 'packages/a')).toBe(true);
    expect(globMatches('packages/*', 'packages/a/b')).toBe(false);
    expect(globMatches('packages/**', 'packages/a/b')).toBe(true);
    expect(globMatches('domain/*/api', 'domain/notes/api')).toBe(true);
    expect(globMatches('apps/*', 'x/apps/a')).toBe(false);
  });
});

describe('B.1 inventory', () => {
  it('PASS on the template workspace: workspace packages observed (root excluded, D-084), toolchainDigest and every population present', async () => {
    const { outcome, data } = await inventoryOf(templateWorkspace());
    expect(outcome).toMatchObject({ status: 'PASS', expected: 1, observed: 1, evaluated: 1, findings: [] });
    expect(data.packageDirs).toEqual(['apps/api']);
    expect(data.toolchainDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(data.populations).sort()).toEqual([...NODE_IDS].sort());
    expect(data.populations['db-apply']).toMatchObject({ predicate: 'no database/', skippable: true });
    expect(data.populations['db-apply']!.count).toBeGreaterThan(0); // the template ships database/README.md
    expect(data.populations.e2e).toMatchObject({ predicate: 'no test/e2e files', count: 0 });
    expect(data.populations.boundary.skippable).toBe(false);
  });

  it('FAIL: a workspace package without "type": "module", and a glob naming no package (B.1 finding forms)', async () => {
    const dir = templateWorkspace({
      'pnpm-workspace.yaml': "packages:\n  - 'packages/*'\n  - 'libs/*'\n",
      'packages/a/package.json': JSON.stringify({ name: '@demo/a' }),
    });
    const { outcome } = await inventoryOf(dir);
    expect(outcome).toMatchObject({ status: 'FAIL', expected: 1, observed: 1 });
    expect(outcome.findings).toEqual(expect.arrayContaining([
      { locator: 'packages/a/package.json:1', message: '"type" is not "module"', standard: 'S-31', hint: 'set "type": "module"' },
      { locator: 'pnpm-workspace.yaml:3', message: 'glob libs/* matches no package', standard: 'S-06', hint: 'remove it' },
    ]));
  });

  it('UNKNOWN engines-mismatch when packageManager is not the host pnpm', async () => {
    const dir = templateWorkspace();
    write(dir, 'package.json', JSON.stringify({ name: 'demo', type: 'module', engines: { node: '>=24 <25' }, packageManager: 'pnpm@1.0.0' }));
    commitAll(dir);
    const { outcome } = await inventoryOf(dir);
    expect(outcome).toMatchObject({ status: 'UNKNOWN', reason: 'engines-mismatch' });
    expect(outcome.findings[0]!.hint).toBe('corepack use pnpm@1.0.0; Node must satisfy engines (>=24 <25)');
  });

  it('D-084 item 7: a workspace whose globs match no package is FAIL, never observed 0', async () => {
    const dir = templateWorkspace({ 'pnpm-workspace.yaml': "packages:\n  - 'domain/*/api'\n" });
    const { outcome } = await inventoryOf(dir);
    expect(outcome).toMatchObject({ status: 'FAIL', expected: 0, observed: 0 });
    expect(outcome.findings).toEqual([{ locator: 'pnpm-workspace.yaml:2', message: 'glob domain/*/api matches no package', standard: 'S-06', hint: 'remove it' }]);
    const none = await inventoryOf(templateWorkspace({ 'pnpm-workspace.yaml': 'packages: []\n' }));
    expect(none.outcome).toMatchObject({ status: 'FAIL', expected: 0, observed: 0 });
    expect(none.outcome.findings[0]).toMatchObject({ locator: 'pnpm-workspace.yaml:1', standard: 'S-06' });
  });

  it('the root manifest is checked but not counted: a root without "type": "module" is FAIL with expected = packages', async () => {
    const dir = templateWorkspace({ 'package.json': JSON.stringify({ name: 'demo', engines: { node: '>=24 <25' }, packageManager: 'pnpm@9.15.0' }) });
    const { outcome } = await inventoryOf(dir);
    expect(outcome).toMatchObject({ status: 'FAIL', expected: 1, observed: 1, evaluated: 1 });
    expect(outcome.findings[0]).toEqual({ locator: 'package.json:1', message: '"type" is not "module"', standard: 'S-31', hint: 'set "type": "module"' });
  });

  it('records changed paths, including untracked ones', async () => {
    const dir = templateWorkspace();
    write(dir, 'specs/notes/new.md', 'x\n');
    const { data } = await inventoryOf(dir);
    expect(data.changed).toContain('specs/notes/new.md');
    expect(data.populations['spec-lint']!.count).toBe(1);
  });
});

describe('B.28 accept: 05 §3 required set by kind', () => {
  it('derives each kind with its conditions resolved', () => {
    expect(requiredSet('spec', null, [])).toEqual(['spec-lint']);
    expect(requiredSet('generate', { routes: 1, queries: 0 }, [])).toEqual(['generated', 'layout', 'lint', 'typecheck', 'unit', 'sql-lint', 'db-apply', 'route-contract']);
    expect(requiredSet('test', { routes: 1, queries: 1 }, [])).toEqual(['spec-tests', 'test-integrity', 'lint-tests', 'typecheck', 'db-apply']);
    expect(requiredSet('code', { routes: 0, queries: 2 }, [])).toEqual(['spec-tests', 'unit', 'lint', 'typecheck', 'db-apply', 'permissions-pattern', 'sql-typed']);
    expect(requiredSet('fix', { routes: 0, queries: 0 }, [])).toEqual(requiredSet('code', { routes: 0, queries: 0 }, []));
    expect(requiredSet('standards', null, ['tools/x.mjs'])).toEqual(['lint', 'typecheck', 'layout']);
    expect(requiredSet('standards', null, ['.github/workflows/devai.yml', 'apps/api/package.json'])).toEqual(['lint', 'typecheck', 'layout', 'actionlint', 'generated', 'unit', 'db-apply', 'integration']);
  });
});

describe('B.28 accept: findings and the UNKNOWN reason (D-084 item 3)', () => {
  const ctx = (only: string[]) => ({ root: '/', config: templateConfig(), runtime: 'bare' as const, cliVersion: '3.0.0', listing: { base: null, entries: [], deleted: [], untracked: [] }, base: null, head: 'b'.repeat(40), plan: plan({ packet: false, full: false, only: only as never }) });
  const r = (id: string, status: string, extra: Partial<NodeRow> = {}) => ({ id, status, expected: 1, observed: 1, evaluated: 1, findings: [], durationMs: 0, cached: false, needs: [], ...extra }) as NodeRow;
  const f = { locator: 'a.ts:1', message: 'm', standard: 'S-1', hint: 'h' };
  it('one finding per gating FAIL and per gating UNKNOWN, locator = node id, [S-65]; FAIL wins', () => {
    const o = acceptOutcome(ctx(['layout', 'route-contract']), [r('inventory', 'PASS'), r('typecheck', 'UNKNOWN', { reason: 'tooling-missing' }), r('layout', 'FAIL', { findings: [f, f] }), r('route-contract', 'UNKNOWN', { reason: 'prerequisite-failed' })], [], null);
    expect(o.status).toBe('FAIL');
    expect(o.findings).toEqual([
      { locator: 'typecheck', message: 'typecheck UNKNOWN (tooling-missing)', standard: 'S-65', hint: 'fix typecheck first' },
      { locator: 'layout', message: 'layout FAIL (2 findings)', standard: 'S-65', hint: 'fix the findings of layout' },
      { locator: 'route-contract', message: 'route-contract UNKNOWN (prerequisite-failed)', standard: 'S-65', hint: 'fix route-contract first' },
    ]);
  });
  it("a gating UNKNOWN without FAIL carries the first such node's reason verbatim (DAG order), not prerequisite-failed", () => {
    const o = acceptOutcome(ctx(['route-contract']), [r('inventory', 'PASS'), r('typecheck', 'UNKNOWN', { reason: 'tooling-missing' }), r('route-contract', 'UNKNOWN', { reason: 'prerequisite-failed' })], [], null);
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing' });
  });
});
