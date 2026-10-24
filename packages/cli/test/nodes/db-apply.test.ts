// 08 B.20 `db-apply` through `devai check --only db-apply --format json` against the local PostgreSQL
// (bare mode, DATABASE_URL = the admin URL). Every scratch database is created by the node under its
// `devai_<digest12>` name and dropped afterwards through its descriptor; the roles carry a per-file
// prefix. 09 §4 N4b included. The cases that need no server run everywhere.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from '../../src/db/provide.js';
import { createScratch } from '../../src/db/scratch.js';
import { commitAll, gitIn } from '../repo.js';
import {
  ADMIN_URL, check, cleanup, databaseExists, dbWorkspace, descriptors, devai, fakeBin, MODULE_SQL_PATH, moduleSql, newPrefix, pathWith, probePostgres,
} from './w3.js';

const server: Server | null = await probePostgres();
const prefix = newPrefix();
const dirs: string[] = [];
const ws = (files: Record<string, string> = {}, modules?: { vitest?: boolean; stynx?: boolean }) => {
  const d = dbWorkspace(prefix, files, modules);
  dirs.push(d);
  return d;
};
const env = { DATABASE_URL: ADMIN_URL };

afterAll(async () => cleanup(server, dirs, [prefix]), 120_000);

describe.skipIf(!server)('B.20 db-apply on PostgreSQL (bare)', () => {
  let dir: string;
  let first: ReturnType<typeof check>;
  beforeAll(() => {
    dir = ws();
    first = check(dir, 'db-apply', env);
  }, 120_000);

  it('PASS: every manifest file applied (xtrace census), checks.sql and rls-negative clean, details name the database and schemaDigest', async () => {
    const { row, report } = first;
    expect(row).toMatchObject({ status: 'PASS', expected: 3, observed: 3, evaluated: 3, findings: [], needs: ['postgres'] });
    expect(report.nodes.map((n) => n.id)).toEqual(['inventory', 'db-apply', 'accept']);
    expect(row.details).toMatchObject({ node: 'db-apply', dropped: false });
    const d = row.details as { database: string; schemaDigest: string };
    expect(d.database).toMatch(/^devai_[0-9a-f]{12}$/);
    expect(await databaseExists(d.database)).toBe(true);
    // The edit loop keeps the database and records it in its descriptor (B.20).
    const desc = JSON.parse(readFileSync(resolve(dir, '.devai/cache/scratch', `${d.database.slice(6)}.json`), 'utf8')) as Record<string, unknown>;
    expect(desc).toMatchObject({ database: d.database, runtime: 'bare', schemaDigest: d.schemaDigest });
    expect(JSON.stringify(desc)).not.toContain('password');
  });

  it('C.4 Reuse: an unchanged candidate re-emits the PASS (cached) while its database exists and re-reads to the same schemaDigest', async () => {
    const again = check(dir, 'db-apply', env);
    expect(again.row).toMatchObject({ status: 'PASS', cached: true, details: first.row.details });
    expect(descriptors(dir)).toHaveLength(1);
  });

  it('C.4 Reuse: a dropped database is a miss, never a PASS; the node applies again into a new scratch database', async () => {
    const d = first.row.details as { database: string };
    const c = await import('pg').then((m) => new m.default.Client({ connectionString: ADMIN_URL }));
    await c.connect();
    await c.query(`DROP DATABASE "${d.database}"`);
    await c.end();
    const again = check(dir, 'db-apply', env);
    expect(again.row).toMatchObject({ status: 'PASS', cached: false });
    expect((again.row.details as { database: string; schemaDigest: string }).database).not.toBe(d.database);
    // Same schema from the same inputs: the digest is a function of the schema, not of the database name (C.4).
    expect((again.row.details as { schemaDigest: string }).schemaDigest).toBe((first.row.details as { schemaDigest: string }).schemaDigest);
  });

  it('--prune drops exactly the databases the descriptors name and deletes the descriptors (A.3)', async () => {
    const named = descriptors(dir).map((f) => `devai_${f.slice(0, 12)}`);
    expect(named.length).toBeGreaterThan(0);
    const r = devai(dir, ['check', '--prune'], env);
    expect(r.status).toBe(0);
    for (const n of named) expect(await databaseExists(n)).toBe(false);
    expect(descriptors(dir)).toEqual([]);
  });

  it('FAIL: a psql error is file:line from the server message; the files never reached are a shortfall', () => {
    const bad = moduleSql(prefix).replace('PRIMARY KEY ("id")', 'PRIMARY KEY ("id"),\n  CONSTRAINT oops CHEC (true)');
    const { row } = check(ws({ [MODULE_SQL_PATH]: bad }), 'db-apply', env);
    expect(row).toMatchObject({ status: 'FAIL', expected: 3, observed: 2, evaluated: 1 });
    // psql's own `psql:<file>:<line>:` position (the line it had read when the server answered).
    expect(row.findings[0]).toMatchObject({ locator: `${MODULE_SQL_PATH}:11`, standard: 'S-02', hint: 'fix the statement' });
    expect(row.findings[0]!.message).toMatch(/^ERROR: .*CHEC/);
    expect(row.findings[1]).toEqual({
      locator: 'database/migrations/20261024_01_app_grants.sql:1', message: 'never applied: database/apply.sh did not run psql -f database/migrations/20261024_01_app_grants.sql',
      standard: 'S-01', hint: 'fix the failure above, or apply the file from database/apply.sh in manifest order',
    });
  });

  it('09 §4 N4b: FORCE removed from the module SQL is FAIL from the checks.sql forced-RLS assertion', () => {
    const { row } = check(ws({ [MODULE_SQL_PATH]: moduleSql(prefix).replace('ALTER TABLE "demo_notes"."note" FORCE ROW LEVEL SECURITY;\n', '') }), 'db-apply', env);
    expect(row).toMatchObject({ status: 'FAIL', expected: 3, observed: 3, evaluated: 3 });
    expect(row.findings).toContainEqual(expect.objectContaining({ locator: expect.stringMatching(/^database\/checks\.sql:\d+$/), message: 'ERROR: demo_notes.note: missing FORCE ROW LEVEL SECURITY', standard: 'S-17' }));
  });

  it('UNKNOWN tooling-missing (rls-negative): the applied observations stand, the stynx binary is absent', () => {
    const { row } = check(ws({}, { vitest: false, stynx: false }), 'db-apply', env);
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing', expected: 3, observed: 3, evaluated: 3 });
    expect(row.findings[0]).toMatchObject({ message: 'tooling-missing — db-apply: stynx not resolvable from node_modules/.bin (rls-negative)', hint: 'install with pnpm add -D @stynx-nyx/cli@3.0.0' });
  });

  it('UNKNOWN runner-crashed (D-086): stynx exits non-zero without its JSON; stderr first line is the message', () => {
    const d = ws({}, { vitest: false, stynx: false });
    fakeBin(d, 'stynx', 1, 'stynx: usage error');
    expect(check(d, 'db-apply', env).row).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed', findings: [{ locator: 'database/apply.sh:1', message: 'stynx: usage error' }] });
  });

  it('UNKNOWN psql-missing: the 07 §4 preflight finds no psql on PATH', () => {
    const d = ws();
    const path = pathWith(d, ['git', 'node', 'pnpm', 'corepack', 'sh']);
    expect(check(d, 'db-apply', { ...env, PATH: path }).row).toMatchObject({ status: 'UNKNOWN', reason: 'psql-missing', findings: [{ message: 'psql is not on PATH' }] });
  });

  it('scratch-collision: a 42P04 for a name no descriptor of this repository records is never reused nor dropped', async () => {
    const name = 'devai_c0111d000000';
    const c = await import('pg').then((m) => new m.default.Client({ connectionString: ADMIN_URL }));
    await c.connect();
    await c.query(`CREATE DATABASE "${name}"`);
    try {
      expect(await createScratch(ws(), server!, name, 'f'.repeat(64))).toEqual({ kind: 'collision' });
      expect(await databaseExists(name)).toBe(true);
    } finally {
      await c.query(`DROP DATABASE "${name}"`);
      await c.end();
    }
  });
});

describe('B.20 db-apply without a reachable server', () => {
  it('UNKNOWN postgres-unreachable (bare): DATABASE_URL not set, B.20 remedy as the hint', () => {
    const { row, report } = check(ws(), 'db-apply', {});
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'postgres-unreachable' });
    expect(row.findings).toEqual([{ locator: 'devai.json:1', message: 'postgres-unreachable (bare): DATABASE_URL is not set', standard: '02 §6', hint: 'start PostgreSQL for the declared runtime; check DATABASE_URL and CREATE DATABASE privilege, then re-run' }]);
    expect(report.exitCode).toBe(2);
  });

  it('UNKNOWN postgres-unreachable (bare): nothing listens at the URL', () => {
    const { row } = check(ws(), 'db-apply', { DATABASE_URL: 'postgresql://devai@127.0.0.1:1/postgres' });
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'postgres-unreachable' });
    expect(row.findings[0]!.message).toMatch(/^postgres-unreachable \(bare\): .*ECONNREFUSED/);
  });

  it('UNKNOWN docker-unreachable (docker mode): docker info fails; remedy "start Docker", no fallback to bare (02 §6)', () => {
    const d = ws();
    const fake = '#!/bin/sh\ncase "$1 $2" in "compose version") echo "Docker Compose version v2"; exit 0;; esac\necho "Cannot connect to the Docker daemon" >&2\nexit 1\n';
    const path = pathWith(d, ['git', 'node', 'pnpm', 'corepack', 'sh', 'psql'], { docker: fake });
    const { row } = check(d, 'db-apply', { ...env, PATH: path, DEVAI_RUNTIME: 'docker' });
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'docker-unreachable', findings: [{ locator: 'compose.yaml:1', message: 'docker-unreachable: Cannot connect to the Docker daemon', hint: 'start Docker' }] });
  });

  it('SKIPPED with the B.20 string when the candidate has no database/', () => {
    const d = ws();
    gitIn(d, 'rm', '-rq', 'database', MODULE_SQL_PATH);
    commitAll(d);
    expect(check(d, 'db-apply', env).row).toMatchObject({ status: 'SKIPPED', evidence: 'no database/' });
  });
});
