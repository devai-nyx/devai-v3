// 08 B.10 `sql-typed`, static phase, on 09 §6's notes repository against SPEC-DEMO-001's `data` bounds.
import { describe, expect, it } from 'vitest';
import { sha256 } from '../../src/candidate/digest.js';
import { commitAll, templateWorkspace, write } from '../repo.js';
import { runOnly } from './helpers.js';

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

const REPO = 'domain/notes/api/src/notes.repository.ts';

/** A generated notes module (its manifest names SPEC-DEMO-001), the repository changed in the working tree. */
function workspace(repository = REPOSITORY, extra: Record<string, string> = {}): string {
  const dir = templateWorkspace({ 'domain/notes/generation-manifest.json': JSON.stringify({ generator: '@devai-nyx/cli', specId: 'SPEC-DEMO-001' }), [REPO]: REPOSITORY, ...extra });
  write(dir, REPO, repository + '\n');
  return dir;
}

describe('B.10 sql-typed (static)', () => {
  it('PASS on the 09 §6 repository; details carry each query textSha256', async () => {
    const { row } = await runOnly(workspace(), 'sql-typed');
    expect(row).toMatchObject({ status: 'PASS', expected: 2, observed: 2, evaluated: 2 });
    expect(row.details).toEqual({ node: 'sql-typed', phase: 'static', queries: [
      { name: 'demo_notes.note.insert', path: REPO, textSha256: sha256('insert into demo_notes.note (title, author_alias) values ($1, $2) returning id, title, author_alias') },
      { name: 'demo_notes.note.get', path: REPO, textSha256: sha256('select id, title, author_alias from demo_notes.note where id = $1') },
    ] });
  });

  it('09 §4 N3 (static half): z.string().max(80) → max(1024) is FAIL ≠ spec limit', async () => {
    const { row } = await runOnly(workspace(REPOSITORY.replace('z.string().min(1).max(80)', 'z.string().min(1).max(1024)')), 'sql-typed');
    expect(row.status).toBe('FAIL');
    expect(row.findings).toEqual([{ locator: `${REPO}:6`, message: 'param $1 z.string().min(1).max(1024) ≠ spec limit note.title maxLength 80', standard: 'S-27', hint: "keep the zod bound within the column's limits; in a generated module, equal to the spec's data bound" }]);
  });

  it('FAIL: $n count ≠ tuple length (B.10 form)', async () => {
    const { row } = await runOnly(workspace(REPOSITORY.replace('values ($1, $2)', 'values ($1, $2, $3)')), 'sql-typed');
    expect(row.findings).toContainEqual({ locator: `${REPO}:6`, message: '$3 declared but tuple has 2 params', standard: 'S-21', hint: 'make z.tuple([...]) list one schema per $n' });
  });

  it('FAIL: a text with expressions is not a sql template without expressions', async () => {
    const { row } = await runOnly(workspace(REPOSITORY.replace('where id = $1`', 'where id = ${"$1"}`')), 'sql-typed');
    expect(row.findings).toContainEqual({ locator: `${REPO}:14`, message: 'demo_notes.note.get text is not a sql template without expressions', standard: 'S-21', hint: 'write the SQL as one sql`…` literal with $n parameters' });
  });

  it('FAIL: name unique workspace-wide, against an unchanged repository elsewhere (B.10 form)', async () => {
    const dir = workspace(REPOSITORY, { 'domain/other/api/src/other.repository.ts': REPOSITORY.split('export const getNote')[0]! });
    const { row } = await runOnly(dir, 'sql-typed');
    expect(row.findings).toContainEqual({ locator: `${REPO}:6`, message: 'name demo_notes.note.insert duplicates domain/other/api/src/other.repository.ts:6', standard: 'S-21', hint: 'rename one query' });
  });

  it('SKIPPED with the 05 §3 string when no repository changed', async () => {
    const dir = workspace();
    commitAll(dir);
    const { row } = await runOnly(dir, 'sql-typed');
    expect(row).toMatchObject({ status: 'SKIPPED', evidence: 'no *.repository.ts changed' });
  });

  it('a changed repository without defineQuery is UNKNOWN no-observations (runner rewrite, S-65)', async () => {
    const { row } = await runOnly(workspace('export const nothing = 1;'), 'sql-typed');
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'no-observations', observed: 0 });
  });
});
