// B.1 `inventory` and B.28 `accept`: Part B status sentences and finding forms as oracles.
import { describe, expect, it } from 'vitest';
import { workingTree } from '../src/candidate/digest.js';
import { requiredSet } from '../src/nodes/accept.js';
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
  it('PASS on the template workspace: root manifest observed, toolchainDigest and every population present', async () => {
    const { outcome, data } = await inventoryOf(templateWorkspace());
    expect(outcome).toMatchObject({ status: 'PASS', expected: 1, observed: 1, evaluated: 1, findings: [] });
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
    expect(outcome).toMatchObject({ status: 'FAIL', expected: 2, observed: 2 });
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
