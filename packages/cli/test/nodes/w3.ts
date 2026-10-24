// W3 fixtures (beside helpers.ts, tools.ts, w2b.ts): the local PostgreSQL (`DEVAI_TEST_DATABASE_URL`, default
// postgresql://localhost:5432/postgres) probed once, a database workspace in the 09 §1 shape (apply.sh,
// checks.sql, modules.txt, the 09 §6 module SQL) under a per-file product prefix so its roles never meet
// another run's, Vitest and `stynx` linked into `node_modules`, and cleanup that drops exactly the
// databases the descriptors name and the roles the fixture created.
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { chmodSync, mkdirSync, readdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import pg from 'pg';
import { serverOf, type Server } from '../../src/db/provide.js';
import { pruneScratch } from '../../src/db/scratch.js';
import { Report } from '../../src/report.js';
import { templateConfig } from '../fixtures.js';
import { templateWorkspace, write } from '../repo.js';

const require = createRequire(import.meta.url);
const cliDir = resolve(import.meta.dirname, '../..');
const bin = resolve(cliDir, 'dist/main.js');

export const ADMIN_URL = process.env['DEVAI_TEST_DATABASE_URL'] || 'postgresql://localhost:5432/postgres';

/** The admin server when PostgreSQL answers, else null (the DB tests then skip, saying why). */
export async function probePostgres(): Promise<Server | null> {
  const server = serverOf(ADMIN_URL);
  const c = new pg.Client({ connectionString: ADMIN_URL, connectionTimeoutMillis: 3000 });
  c.on('error', () => undefined);
  try {
    await c.connect();
    await c.end();
    return server;
  } catch (e) {
    console.warn(`W3 database tests skipped: PostgreSQL at ${server.host}:${server.port} is unreachable (${(e as Error).message}); set DEVAI_TEST_DATABASE_URL`);
    return null;
  }
}

export const newPrefix = (): string => `devaiw3${randomBytes(4).toString('hex')}`;

/** `devai <args>` on the built binary (D-057) with `extraEnv`; DEVAI_RUNTIME cleared unless given. */
export function devai(cwd: string, args: string[], extraEnv: Record<string, string | undefined> = {}) {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...process.env, DEVAI_RUNTIME: '', DATABASE_URL: undefined, ...extraEnv })) if (v !== undefined) env[k] = v;
  return spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', env });
}

/** `devai check --only <id> --format json`: the C.2-validated report and the row of `id`. */
export function check(cwd: string, id: string, extraEnv: Record<string, string | undefined> = {}) {
  const r = devai(cwd, ['check', '--only', id, '--format', 'json'], extraEnv);
  let report;
  try {
    report = Report.parse(JSON.parse(r.stdout));
  } catch (e) {
    throw new Error(`no C.2 report (exit ${r.status}): ${r.stdout.slice(0, 400)} ${r.stderr.slice(0, 800)} ${(e as Error).message}`);
  }
  if (r.status !== report.exitCode) throw new Error(`exit ${r.status} ≠ report exit ${report.exitCode}`);
  return { report, row: report.nodes.find((n) => n.id === id)!, stderr: r.stderr };
}

/** `node_modules/.bin/<name>` running `js` with this Node. */
function wrap(nm: string, name: string, js: string): void {
  mkdirSync(resolve(nm, '.bin'), { recursive: true });
  writeFileSync(resolve(nm, '.bin', name), `#!/bin/sh\nexec "${process.execPath}" "${js}" "$@"\n`);
  chmodSync(resolve(nm, '.bin', name), 0o755);
}

/** Links what the W3 fixtures run into `<dir>/node_modules`: Vitest 4.1.11 (+ `pg` for the suites), `stynx` 3.0.0. */
export function linkModules(dir: string, which: { vitest?: boolean; stynx?: boolean } = { vitest: true, stynx: true }): void {
  const nm = resolve(dir, 'node_modules');
  mkdirSync(nm, { recursive: true });
  writeFileSync(resolve(dir, '.git/info/exclude'), '/node_modules\n');
  if (which.vitest !== false) {
    const vitest = realpathSync(resolve(cliDir, 'node_modules/vitest'));
    symlinkSync(vitest, resolve(nm, 'vitest'), 'dir');
    symlinkSync(realpathSync(resolve(cliDir, 'node_modules/pg')), resolve(nm, 'pg'), 'dir');
    wrap(nm, 'vitest', resolve(vitest, 'vitest.mjs'));
  }
  if (which.stynx !== false) {
    mkdirSync(resolve(nm, '@stynx-nyx'), { recursive: true });
    wrap(nm, 'stynx', resolve(realpathSync(resolve(cliDir, 'node_modules/@stynx-nyx/cli')), 'dist/cli/src/main.js'));
  }
}

/** A `node_modules/.bin/<bin>` that writes `stderr` and exits `code` with empty stdout (D-086 crash cases). */
export function fakeBin(dir: string, name: string, code = 2, stderr = 'boom: the tool fell over'): void {
  mkdirSync(resolve(dir, 'node_modules/.bin'), { recursive: true });
  writeFileSync(resolve(dir, 'node_modules/.bin', name), `#!/bin/sh\necho '${stderr}' >&2\nexit ${code}\n`);
  chmodSync(resolve(dir, 'node_modules/.bin', name), 0o755);
}

/** 09 §1 `apply.sh` (POSIX sh, `$PSQL -f` per file, `PG*` environment); step 2 (`stynx migrate up`) has no platform migrations here. */
export const APPLY_SH = `#!/bin/sh
set -eu
for f in database/ddl/*.sql; do [ -e "$f" ] || continue; $PSQL -f "$f"; done
while read -r sum path; do $PSQL -f "$path"; done < database/seed/modules.txt
for f in database/migrations/*.sql; do [ -e "$f" ] || continue; $PSQL -f "$f"; done
for f in database/seed/*.sql; do [ -e "$f" ] || continue; $PSQL -f "$f"; done
`;

/** 09 §1.1 `checks.sql`: every non-system table has relrowsecurity and relforcerowsecurity. */
export const CHECKS_SQL = `-- 90 assertions
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
             FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r' AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg\\_%'
            ORDER BY 1, 2 LOOP
    IF NOT r.relrowsecurity THEN RAISE EXCEPTION '%.%: missing ENABLE ROW LEVEL SECURITY', r.nspname, r.relname; END IF;
    IF NOT r.relforcerowsecurity THEN RAISE EXCEPTION '%.%: missing FORCE ROW LEVEL SECURITY', r.nspname, r.relname; END IF;
  END LOOP;
END $$;
`;

export const bootstrapSql = (p: string): string => `-- 00 core bootstrap: the product roles (S-18) and the tenancy table the module references
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${p}_owner') THEN CREATE ROLE ${p}_owner NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${p}_app') THEN CREATE ROLE ${p}_app NOLOGIN NOBYPASSRLS; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${p}_reader') THEN CREATE ROLE ${p}_reader NOLOGIN NOBYPASSRLS; END IF;
END $$;
CREATE SCHEMA tenancy;
CREATE TABLE tenancy.tenants (id uuid PRIMARY KEY);
ALTER TABLE tenancy.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenancy.tenants FORCE ROW LEVEL SECURITY;
CREATE POLICY tenants_self ON tenancy.tenants FOR ALL
  USING (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
`;

export const MODULE_SQL_PATH = 'domain/notes/db/demo_notes_notes.sql';
/** 09 §6 `domain/notes/db/demo_notes_notes.sql` with the product's owner role. */
export const moduleSql = (p: string): string => readFileSync(resolve(import.meta.dirname, 'fixtures/demo_notes_notes.sql'), 'utf8').replace('demo_owner', `${p}_owner`);
export const grantsSql = (p: string): string => `GRANT USAGE ON SCHEMA demo_notes TO ${p}_app;\nGRANT SELECT, INSERT, UPDATE, DELETE ON demo_notes.note TO ${p}_app;\n`;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

/** A committed template workspace with the 09 §1 database tree for product `p`; `files` override or add paths. */
export function dbWorkspace(p: string, files: Record<string, string> = {}, modules: { vitest?: boolean; stynx?: boolean } = { vitest: true, stynx: true }): string {
  const mod = files[MODULE_SQL_PATH] ?? moduleSql(p);
  const dir = templateWorkspace({
    'devai.json': JSON.stringify({ ...templateConfig(), productPrefix: p }, null, 2) + '\n',
    'database/apply.sh': APPLY_SH,
    'database/checks.sql': CHECKS_SQL,
    'database/ddl/00-core-bootstrap.sql': bootstrapSql(p),
    'database/seed/modules.txt': `${sha(mod)}  ${MODULE_SQL_PATH}\n`,
    [MODULE_SQL_PATH]: mod,
    'database/migrations/20261024_01_app_grants.sql': grantsSql(p),
    ...files,
  });
  linkModules(dir, modules);
  return dir;
}

/** Drops every database the workspaces' descriptors name, then the product roles (afterAll). */
export async function cleanup(server: Server | null, dirs: readonly string[], prefixes: readonly string[]): Promise<void> {
  if (!server) return;
  for (const d of dirs) await pruneScratch(d, server, (l) => console.warn(l));
  const c = new pg.Client({ connectionString: ADMIN_URL });
  c.on('error', () => undefined);
  await c.connect();
  try {
    for (const p of prefixes) for (const r of ['owner', 'app', 'reader']) await c.query(`DROP ROLE IF EXISTS ${p}_${r}`).catch((e: Error) => console.warn(`drop role ${p}_${r}: ${e.message}`));
  } finally {
    await c.end();
  }
}

export const descriptors = (dir: string): string[] => {
  try {
    return readdirSync(resolve(dir, '.devai/cache/scratch')).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
};

export async function databaseExists(name: string): Promise<boolean> {
  const c = new pg.Client({ connectionString: ADMIN_URL });
  c.on('error', () => undefined);
  await c.connect();
  try {
    return (await c.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])).rowCount === 1;
  } finally {
    await c.end();
  }
}

/** The current PATH with a folder of fake binaries in front (a `psql` that cannot run, a `docker` without a daemon). */
export function pathWith(dir: string, fakes: Record<string, string>): string {
  const binDir = resolve(dir, '.devai-test-bin');
  mkdirSync(binDir, { recursive: true });
  for (const [n, script] of Object.entries(fakes)) {
    writeFileSync(resolve(binDir, n), script);
    chmodSync(resolve(binDir, n), 0o755);
  }
  writeFileSync(resolve(dir, '.git/info/exclude'), '/node_modules\n/.devai-test-bin\n');
  return `${binDir}:${process.env['PATH'] ?? ''}`;
}

/** The template's tier selection reduced to what `unit` needs (09 §1.1 `vitest.config.ts`, TEST_TIER). */
export const VITEST_CONFIG = `import { defineConfig } from 'vitest/config';
const tier = process.env.TEST_TIER ?? 'unit';
const tiers = ['acceptance', 'integration', 'db', 'e2e'];
export default defineConfig({
  test: tier === 'unit'
    ? { include: ['**/test/**/*.spec.ts'], exclude: ['**/node_modules/**', ...tiers.map((t) => \`**/*.\${t}.spec.ts\`)] }
    : { include: [\`**/*.\${tier}.spec.ts\`], exclude: ['**/node_modules/**'] },
});
`;

/** 09 §6's notes repository (SPEC-DEMO-001's two queries), shared by the static and DB sql-typed tests. */
export const REPOSITORY = `import { defineQuery, sql } from '@stynx-nyx/data';
import { z } from 'zod';

const noteRow = z.strictObject({ id: z.string().uuid(), title: z.string(), author_alias: z.string() });

export const insertNote = defineQuery({
  name: 'demo_notes.note.insert',
  text: sql\`insert into demo_notes.note (title, author_alias) values ($1, $2) returning id, title, author_alias\`,
  params: z.tuple([z.string().min(1).max(80), z.string().min(1).max(40)]),
  row: noteRow,
  expects: 'one',
});

export const getNote = defineQuery({
  name: 'demo_notes.note.get',
  text: sql\`select id, title, author_alias from demo_notes.note where id = $1\`,
  params: z.tuple([z.string().uuid()]),
  row: noteRow,
  expects: 'zero-or-one',
});
`;

export { dirname, require, write };
