// 08 B.22 `integration` through `devai check --only integration --format json` on PostgreSQL (bare): one
// Vitest run per populated tier with DATABASE_URL = db-apply's scratch database; counted as `unit` (D-081).
import { afterAll, describe, expect, it } from 'vitest';
import type { Server } from '../../src/db/provide.js';
import { standardOf } from '../../src/nodes/integration.js';
import { ADMIN_URL, check, cleanup, dbWorkspace, newPrefix, probePostgres, VITEST_CONFIG } from './w3.js';

const server: Server | null = await probePostgres();
const prefix = newPrefix();
const dirs: string[] = [];
const env = { DATABASE_URL: ADMIN_URL };
afterAll(async () => cleanup(server, dirs, [prefix]), 120_000);

const suite = (title: string, expected: number) => `import pg from 'pg';
import { expect, it } from 'vitest';
it('${title}', async () => {
  const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await c.connect();
  const r = await c.query('SELECT count(*)::int AS n FROM demo_notes.note');
  await c.end();
  expect(r.rows[0].n).toBe(${expected});
});
it('tier is ' + process.env.TEST_TIER, () => {
  expect(['integration', 'db']).toContain(process.env.TEST_TIER);
});
`;

function workspace(files: Record<string, string>): string {
  const dir = dbWorkspace(prefix, { 'vitest.config.ts': VITEST_CONFIG, ...files });
  dirs.push(dir);
  return dir;
}

describe.skipIf(!server)('B.22 integration on PostgreSQL', () => {
  it('PASS: both tiers populated, each run once against the scratch database (expected = observed = cases)', () => {
    const { report, row } = check(workspace({ 'test/integration/notes.integration.spec.ts': suite('reads notes as the suite connects', 0), 'test/db/notes.db.spec.ts': suite('RLS table is reachable', 0) }), 'integration', env);
    expect(report.nodes.map((n) => n.id)).toEqual(['inventory', 'db-apply', 'sql-typed', 'integration', 'accept']);
    expect(report.nodes.find((n) => n.id === 'sql-typed')).toMatchObject({ status: 'SKIPPED' });
    expect(row).toMatchObject({ status: 'PASS', expected: 4, observed: 4, evaluated: 4, needs: ['postgres'] });
  });

  it('FAIL: a failed case, B.22 form; the RLS-isolation subject maps to S-18', () => {
    const { row } = check(workspace({ 'test/db/notes.db.spec.ts': suite('RLS isolation as the app role', 1) }), 'integration', env);
    expect(row).toMatchObject({ status: 'FAIL', expected: 2, observed: 2 });
    expect(row.findings).toEqual([{ locator: 'test/db/notes.db.spec.ts:3', message: 'RLS isolation as the app role: expected +0 to be 1 // Object.is equality', standard: 'S-18', hint: 'fix the behaviour under the application role' }]);
  });

  it('FAIL: a skipped case is a shortfall naming it (D-081)', () => {
    const { row } = check(workspace({ 'test/integration/notes.integration.spec.ts': suite('reads', 0).replace("it('tier is '", "it.skip('tier is '") }), 'integration', env);
    expect(row).toMatchObject({ status: 'FAIL', expected: 2, observed: 1, findings: [{ message: 'tier is integration: skipped', standard: 'S-64' }] });
  });

  it('UNKNOWN tooling-missing: no vitest in node_modules/.bin', () => {
    const dir = dbWorkspace(prefix, { 'vitest.config.ts': VITEST_CONFIG, 'test/db/notes.db.spec.ts': suite('x', 0) }, { vitest: false, stynx: true });
    dirs.push(dir);
    expect(check(dir, 'integration', env).row).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing' });
  });
});

describe('B.22 integration without a server', () => {
  it('UNKNOWN postgres-unreachable: db-apply could not provide a database and sql-typed was SKIPPED (C.1 step 5), so integration reports it itself', () => {
    const { report, row } = check(workspace({ 'vitest.config.ts': VITEST_CONFIG, 'test/db/notes.db.spec.ts': suite('x', 0) }), 'integration', {});
    expect(report.nodes.find((n) => n.id === 'db-apply')).toMatchObject({ status: 'UNKNOWN', reason: 'postgres-unreachable' });
    expect(report.nodes.find((n) => n.id === 'sql-typed')).toMatchObject({ status: 'SKIPPED' });
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'postgres-unreachable', findings: [{ locator: 'devai.json:1', message: 'postgres-unreachable (bare): db-apply provided no scratch database' }] });
  });

  it('standards of the template-emitted subjects (B.22 Findings)', () => {
    expect(standardOf('rejects a request without X-Request-Id')).toBe('S-70');
    expect(standardOf('GET /healthz is served without an id')).toBe('S-70');
    expect(standardOf('RLS isolation observed as demo_app')).toBe('S-18');
    expect(standardOf('creates a note')).toBe('S-02');
  });
});
