// 08 B.10 `sql-typed` DB part on PostgreSQL 16 (bare): `devai check --only sql-typed` with DATABASE_URL
// reachable plans the DB phase (A.3) and its prerequisite `db-apply`; the R2 prototype's four cases (D-068:
// empty SELECT, INSERT … RETURNING, unsupported OID, protocol error) plus a terminated backend; 09 §4 N3.
import { afterAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { describe as describeQuery } from '../../src/db/describe.js';
import type { Server } from '../../src/db/provide.js';
import { charLengthBounds } from '../../src/nodes/sql-typed-db.js';
import { commitAll, gitIn, write } from '../repo.js';
import { ADMIN_URL, check, cleanup, dbWorkspace, newPrefix, probePostgres, REPOSITORY } from './w3.js';

const server: Server | null = await probePostgres();
const prefix = newPrefix();
const dirs: string[] = [];
const env = { DATABASE_URL: ADMIN_URL };
const REPO = 'domain/notes/api/src/notes.repository.ts';
const LIMIT_HINT = "keep the zod bound within the column's limits; in a generated module, equal to the spec's data bound";

afterAll(async () => cleanup(server, dirs, [prefix]), 120_000);

/** A database workspace with a generated notes module (manifest → SPEC-DEMO-001) and `repository` changed. */
function workspace(repository: string): string {
  const dir = dbWorkspace(prefix, { 'domain/notes/generation-manifest.json': JSON.stringify({ generator: '@devai-nyx/cli', specId: 'SPEC-DEMO-001' }), [REPO]: REPOSITORY });
  dirs.push(dir);
  write(dir, REPO, repository + '\n');
  return dir;
}

const query = (name: string, text: string, params: string, row: string) => `
export const q_${name.replace(/\W/g, '_')} = defineQuery({
  name: '${name}',
  text: sql\`${text}\`,
  params: z.tuple([${params}]),
  row: ${row},
  expects: 'many',
});
`;
const HEAD = "import { defineQuery, sql } from '@stynx-nyx/data';\nimport { z } from 'zod';\n";

describe.skipIf(!server)('B.10 sql-typed DB part on PostgreSQL', () => {
  it('PASS on the 09 §6 repository: db-apply runs first; details phase db; INSERT … RETURNING described without executing (R2 case 2)', async () => {
    const dir = workspace(REPOSITORY);
    const { report, row } = check(dir, 'sql-typed', env);
    expect(report.nodes.map((n) => n.id)).toEqual(['inventory', 'db-apply', 'sql-typed', 'accept']);
    expect(row).toMatchObject({ status: 'PASS', expected: 2, observed: 2, evaluated: 2, needs: ['postgres'], details: { node: 'sql-typed', phase: 'db' } });
    // Nothing was bound or executed: the scratch table is still empty.
    const db = (report.nodes[1]!.details as { database: string }).database;
    const c = new pg.Client({ connectionString: ADMIN_URL.replace(/\/[^/]*$/, `/${db}`) });
    await c.connect();
    expect((await c.query('SELECT count(*)::int AS n FROM demo_notes.note')).rows[0].n).toBe(0);
    await c.end();
  });

  it('09 §4 N3: max(80) → max(1024) is FAIL static (≠ spec limit) and DB (exceeds varchar(80), outside CHECK)', () => {
    const { row } = check(workspace(REPOSITORY.replace('z.string().min(1).max(80)', 'z.string().min(1).max(1024)')), 'sql-typed', env);
    expect(row.status).toBe('FAIL');
    expect(row.findings).toEqual([
      { locator: `${REPO}:6`, message: 'param $1 z.string().min(1).max(1024) ≠ spec limit note.title maxLength 80', standard: 'S-27', hint: LIMIT_HINT },
      { locator: `${REPO}:6`, message: 'param $1 z.string().min(1).max(1024) exceeds demo_notes.note.title varchar(80)', standard: 'S-27', hint: LIMIT_HINT },
      { locator: `${REPO}:6`, message: 'param $1 z.string().min(1).max(1024) outside CHECK char_length BETWEEN 1 AND 80', standard: 'S-27', hint: LIMIT_HINT },
    ]);
  });

  it('R2 case 1: an empty SELECT (no result columns) is described; a zero-column row schema matches', () => {
    const repo = HEAD + query('demo_notes.note.touch', 'select from demo_notes.note where id = $1', 'z.string().uuid()', 'z.object({})');
    expect(check(workspace(repo), 'sql-typed', env).row).toMatchObject({ status: 'PASS', expected: 1, observed: 1, evaluated: 1 });
  });

  it('R2 case 3: an OID outside 02 §3\'s table is UNKNOWN unsupported-oid 600, never a guess', () => {
    const repo = HEAD + query('demo_notes.note.where', 'select point(1, 2) as p from demo_notes.note where id = $1', 'z.string().uuid()', 'z.object({ p: z.string() })');
    const { row } = check(workspace(repo), 'sql-typed', env);
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'unsupported-oid', findings: [{ locator: `${REPO}:4`, message: 'row column p unsupported-oid 600', standard: 'S-21' }] });
  });

  it('R2 case 4: a protocol (parse) error is FAIL keyed on SQLSTATE 42601, and the client stays usable for the next site', () => {
    const repo = HEAD + query('demo_notes.note.bad', 'selec id from demo_notes.note where id = $1', 'z.string().uuid()', 'z.object({ id: z.string().uuid() })')
      + query('demo_notes.note.ok', 'select id from demo_notes.note where id = $1', 'z.string().uuid()', 'z.object({ id: z.string().uuid() })');
    const { row } = check(workspace(repo), 'sql-typed', env);
    expect(row).toMatchObject({ status: 'FAIL', expected: 2, observed: 2, evaluated: 2 });
    expect(row.findings).toHaveLength(1);
    expect(row.findings[0]).toMatchObject({ locator: `${REPO}:4`, standard: 'S-21', hint: 'fix the SQL text' });
    expect(row.findings[0]!.message).toMatch(/^prepare failed: 42601 /);
  });

  it('DB checks: parameter and row OIDs against the zod leaves; row keys against RowDescription', () => {
    const repo = HEAD + query('demo_notes.note.mixed', 'select id, title from demo_notes.note where id = $1', 'z.number().int()', 'z.object({ id: z.string().uuid(), missing: z.string() })');
    const { row } = check(workspace(repo), 'sql-typed', env);
    expect(row.status).toBe('FAIL');
    expect(row.findings.map((f) => f.message)).toEqual([
      'param $1 z.number().int() is not the uuid leaf z.string().uuid()',
      'row column title is not a key of row',
      'row key missing is not returned by the statement',
    ]);
  });

  it('UNKNOWN unsupported-binding: a $n under a cast cannot be resolved to a column', () => {
    const repo = HEAD + query('demo_notes.note.cast', 'select id from demo_notes.note where title = $1::text', 'z.string().max(80)', 'z.object({ id: z.string().uuid() })');
    expect(check(workspace(repo), 'sql-typed', env).row).toMatchObject({ status: 'UNKNOWN', reason: 'unsupported-binding', findings: [{ message: 'param $1 unsupported-binding' }] });
  });

  it('a terminated backend is postgres-unreachable (R2): the describe is answered without submit()', async () => {
    let dropped: string | null = null;
    const c = new pg.Client({ connectionString: ADMIN_URL });
    c.on('error', (e) => { dropped = e.message; });
    await c.connect();
    const pid = (await c.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;
    const admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query('SELECT pg_terminate_backend($1)', [pid]);
    await admin.end();
    for (let i = 0; i < 50 && dropped === null; i++) await new Promise((r) => setTimeout(r, 100));
    expect(await describeQuery(c, 'select 1', () => dropped)).toMatchObject({ kind: 'unreachable' });
    await c.end().catch(() => undefined);
  });

  it('UNKNOWN postgres-unreachable: db-apply SKIPPED (no database/) leaves the DB part without a scratch database', () => {
    const dir = dbWorkspace(prefix, {}, { vitest: false, stynx: false });
    dirs.push(dir);
    gitIn(dir, 'rm', '-rq', 'database', 'domain/notes/db');
    commitAll(dir);
    write(dir, REPO, REPOSITORY + '\n');
    const { report, row } = check(dir, 'sql-typed', env);
    expect(report.nodes.find((n) => n.id === 'db-apply')).toMatchObject({ status: 'SKIPPED', evidence: 'no database/' });
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'postgres-unreachable', findings: [{ message: 'postgres-unreachable (bare): db-apply provided no scratch database' }] });
  });
});

describe('B.10 DB part without a server', () => {
  it('static only: without a reachable DATABASE_URL the edit loop keeps sql-typed static (A.3)', () => {
    const dir = dbWorkspace(prefix, { [REPO]: REPOSITORY }, { vitest: false, stynx: false });
    write(dir, REPO, REPOSITORY + '\n');
    const { report, row } = check(dir, 'sql-typed', {});
    expect(report.nodes.map((n) => n.id)).toEqual(['inventory', 'sql-typed', 'accept']);
    expect(row).toMatchObject({ status: 'PASS', details: { phase: 'static' }, needs: [] });
  });

  it('CHECK char_length bounds are read in both renderings (BETWEEN and PostgreSQL\'s >= … AND <= …)', () => {
    expect(charLengthBounds(['CHECK (((char_length((title)::text) >= 1) AND (char_length((title)::text) <= 80)))'], 'title')).toEqual({ min: 1, max: 80 });
    expect(charLengthBounds(['CHECK (char_length("title") BETWEEN 1 AND 64)'], 'title')).toEqual({ min: 1, max: 64 });
    expect(charLengthBounds(['CHECK (((char_length((author_alias)::text) >= 1)))'], 'title')).toEqual({ min: null, max: null });
  });
});
