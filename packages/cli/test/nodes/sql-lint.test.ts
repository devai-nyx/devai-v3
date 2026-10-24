// 08 B.7 `sql-lint` as amended by D-085, against @stynx-nyx/migration-linter 3.0.0 from the registry:
// one invocation over every root, re-rooted locators, LINT013 against the base and `modules.txt`,
// 09 §4 N4a–c and N5 on a copy of the 09 §6 module SQL, and each Status reason.
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { reroot, rootsOf, sqlLint } from '../../src/nodes/sql-lint.js';
import { templateWorkspace, write } from '../repo.js';
import { linkTools, lines, PINS, runNode, toolsFor } from './helpers.js';

const MODULE_SQL = 'domain/notes/db/demo_notes_notes.sql';
/** 09 §6 `domain/notes/db/demo_notes_notes.sql`, with "WITH CHECK (same predicate)" written out. */
const sql = readFileSync(resolve(import.meta.dirname, 'fixtures/demo_notes_notes.sql'), 'utf8');
const sha = (s: string) => createHash('sha256').update(s).digest('hex');
let tools: string;
beforeAll(() => { tools = toolsFor(PINS.migrationLinter); }, 300_000);

/** The generated module committed with its `modules.txt` line (09 §6), so it is base-present. */
function moduleWorkspace(): string {
  const dir = templateWorkspace({ [MODULE_SQL]: sql, 'database/seed/modules.txt': `${sha(sql)}  ${MODULE_SQL}\n` });
  linkTools(dir, tools);
  return dir;
}
const lgpd = { config: { lgpd: true } };
const without = (pattern: RegExp) => sql.split('\n').filter((l) => !pattern.test(l)).join('\n');
const codes = (o: { findings: { message: string }[] }) => o.findings.map((f) => f.message.split(' ')[0]).sort();

describe('B.7 sql-lint helpers', () => {
  it('roots in 08 order, domain/*/db per module; locators re-rooted by files[]', () => {
    expect(rootsOf(['domain/b/db/x.sql', 'database/migrations/1.sql', 'domain/a/db/y.sql', 'database/ddl/0.sql', 'database/seed/modules.txt'])).toEqual(['database/ddl', 'database/migrations', 'domain/a/db', 'domain/b/db']);
    const files = new Set(['database/ddl/10-a.sql', 'domain/notes/db/x.sql']);
    expect(reroot('10-a.sql', ['database/ddl', 'domain/notes/db'], files)).toBe('database/ddl/10-a.sql');
    expect(reroot('x.sql', ['database/ddl', 'domain/notes/db'], files)).toBe('domain/notes/db/x.sql');
    expect(reroot('domain/notes/db/gone.sql', ['domain/notes/db'], files)).toBe('domain/notes/db/gone.sql');
  });
});

describe('B.7 sql-lint (stynx-migration-lint 3.0.0)', () => {
  it('PASS: the 09 §6 module SQL changed only in the working tree is clean (expected = observed = evaluated)', async () => {
    const dir = templateWorkspace({ 'database/seed/modules.txt': '' });
    linkTools(dir, tools);
    write(dir, MODULE_SQL, sql);
    expect(await runNode(sqlLint, dir, lgpd)).toEqual({ status: 'PASS', expected: 1, observed: 1, evaluated: 1, findings: [] });
  });

  // 09 §4 N4a–c expect LINT001 and LINT013. 3.0.0 matches `ALTER TABLE <schema>.<table>` unquoted only
  // (`lint.js:148-159`), so 09 §6's quoted identifiers hide LINT001; FORCE is not a LINT001 input. The
  // node reports what the tool says (D-085); the gap is in the PR's Open list.
  it.each([
    ['N4a ENABLE removed', /ENABLE ROW LEVEL SECURITY/],
    ['N4b FORCE removed', /FORCE ROW LEVEL SECURITY/],
    ['N4c policy removed', /POLICY|USING|WITH CHECK/],
  ])('%s: FAIL LINT013 twice (manifest digest and base-present bytes), re-rooted', async (_name, pattern) => {
    const dir = moduleWorkspace();
    const edited = without(pattern);
    write(dir, MODULE_SQL, edited);
    const o = await runNode(sqlLint, dir, lgpd);
    expect(o).toMatchObject({ status: 'FAIL', expected: 1, observed: 1, evaluated: 1 });
    expect(lines(o)).toEqual([
      `${MODULE_SQL}:1 LINT013 Applied migration ${MODULE_SQL} changed: sha256 ${sha(edited)} differs from manifest ${sha(sql)}; add a new migration instead. [S-24] see the migration-linter rule`,
      `${MODULE_SQL}:1 LINT013 Migration ${MODULE_SQL} present at base differs at head; applied migrations are never rewritten. [S-24] see the migration-linter rule`,
    ]);
  });

  it('LINT001 is raised (and mapped) for the same SQL with unquoted identifiers', async () => {
    const dir = templateWorkspace();
    linkTools(dir, tools);
    write(dir, 'domain/notes/db/demo_notes_notes.sql', without(/ENABLE ROW LEVEL SECURITY/).replace(/"/g, ''));
    const o = await runNode(sqlLint, dir, lgpd);
    expect(o.status).toBe('FAIL');
    expect(codes(o)).toEqual(['LINT001', 'LINT002']);
    expect(lines(o), lines(o).join('\n')).toContain(`${MODULE_SQL}:2 LINT001 Tenant-scoped table demo_notes.note must enable RLS and declare a tenant isolation policy in the same migration. [S-24] see the migration-linter rule`);
  });

  // 09 §4 N5 expects LINT012; `author_alias` is no PII token in 3.0.0 (`context-rules.js` PII_COLUMN_TOKENS).
  it('N5 @pii removed: FAIL LINT013 only (no LINT012 for author_alias in 3.0.0)', async () => {
    const dir = moduleWorkspace();
    write(dir, MODULE_SQL, without(/@pii/));
    expect(codes(await runNode(sqlLint, dir, lgpd))).toEqual(['LINT013', 'LINT013']);
  });

  it('LINT012 for a PII-token column without @pii, under lgpd only', async () => {
    const dir = templateWorkspace();
    linkTools(dir, tools);
    write(dir, 'database/migrations/20261024_01_contacts.sql', 'CREATE TABLE app.contacts (id uuid PRIMARY KEY, email text NOT NULL);\n');
    const o = await runNode(sqlLint, dir, lgpd);
    expect(lines(o)).toEqual(['database/migrations/20261024_01_contacts.sql:1 LINT012 PII column email has no -- @pii: annotation; LGPD requires a documented legal basis and retention. [S-24] email ... -- @pii: basis=<legal basis>, retention=<period>']);
    expect(await runNode(sqlLint, dir)).toMatchObject({ status: 'PASS' });
  });

  it('one invocation over every root: LINT010 across roots, as the tool says (same-day prefix collides, D-085)', async () => {
    const dir = templateWorkspace();
    linkTools(dir, tools);
    write(dir, 'database/migrations/20261024_01_a.sql', 'SELECT 1;\n');
    write(dir, 'domain/notes/db/20261024_02_b.sql', 'SELECT 2;\n');
    const o = await runNode(sqlLint, dir);
    expect(o).toMatchObject({ status: 'FAIL', expected: 2, observed: 2, evaluated: 2 });
    expect(lines(o)).toEqual(['domain/notes/db/20261024_02_b.sql:1 LINT010 Migration prefix 20261024_ is already used by database/migrations/20261024_01_a.sql; prefixes must be unique across every migration root. [S-24] Rename 20261024_02_b.sql to the next unused prefix.']);
  });

  it('a parser issue is FAIL, the file observed but not evaluated', async () => {
    const dir = templateWorkspace();
    linkTools(dir, tools);
    write(dir, 'database/migrations/0001_bad.sql', 'CREATE TABLEX oops (;\n');
    write(dir, 'database/migrations/0002_ok.sql', 'SELECT 1;\n');
    const o = await runNode(sqlLint, dir);
    expect(o).toMatchObject({ status: 'FAIL', expected: 2, observed: 2, evaluated: 1 });
    expect(lines(o)).toEqual(['database/migrations/0001_bad.sql:1 parser: syntax error at or near "TABLEX" [S-24] fix the SQL syntax']);
  });

  it('UNKNOWN lint-config-failed: exit 2, empty stdout, "does not exist" (manifest gone after listing)', async () => {
    const dir = moduleWorkspace();
    write(dir, MODULE_SQL, sql + '\n');
    const o = await runNode(sqlLint, dir, { beforeRun: () => rmSync(resolve(dir, 'database/seed/modules.txt')) });
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'lint-config-failed', findings: [{ locator: 'database/seed/modules.txt:1', message: '--manifest database/seed/modules.txt does not exist or is not a file.' }] });
  });

  it('UNKNOWN io: exit 2, empty stdout, any other input error (a malformed manifest)', async () => {
    const dir = moduleWorkspace();
    write(dir, 'database/seed/modules.txt', 'not a digest line\n');
    write(dir, MODULE_SQL, sql + '\n');
    const o = await runNode(sqlLint, dir);
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'io', findings: [{ message: "--manifest database/seed/modules.txt:1 is not '<sha256>  <path>' (sha256sum form)." }] });
  });

  it('UNKNOWN tooling-missing with the install line', async () => {
    const dir = templateWorkspace();
    write(dir, MODULE_SQL, sql);
    expect(lines(await runNode(sqlLint, dir))).toEqual(['package.json:1 stynx-migration-lint not resolvable from node_modules/.bin [S-24] install with pnpm add -D @stynx-nyx/migration-linter@3.0.0']);
  });

  it('UNKNOWN runner-crashed: exit ∉ {0,1,2}', async () => {
    const dir = templateWorkspace();
    mkdirSync(resolve(dir, 'node_modules/.bin'), { recursive: true });
    writeFileSync(resolve(dir, 'node_modules/.bin/stynx-migration-lint'), '#!/bin/sh\necho boom >&2\nexit 3\n');
    chmodSync(resolve(dir, 'node_modules/.bin/stynx-migration-lint'), 0o755);
    write(dir, MODULE_SQL, sql);
    expect(await runNode(sqlLint, dir)).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed', findings: [{ message: 'stynx-migration-lint exited 3: boom' }] });
  });

  it('SKIPPED is inventory\'s: no changed *.sql is the evidence string', async () => {
    const dir = moduleWorkspace();
    const { contextOf } = await import('./helpers.js');
    const ctx = await contextOf(dir, { only: 'sql-lint' });
    expect(ctx.inventory!.populations['sql-lint']).toEqual({ predicate: 'no changed *.sql', count: 0, skippable: true });
  });
});
