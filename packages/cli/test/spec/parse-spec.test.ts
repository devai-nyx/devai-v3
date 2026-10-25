// parse-spec: the one reading of a spec file shared by spec-lint, the generator, the `generated`
// replay and i18n. Positive oracle: the 06 §7 fixture; negatives: 06 §2 blocks the definition rejects.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { noOpenQuestions, parseSpec, sectionBody } from '../../src/spec/parse-spec.js';

const spec = readFileSync(resolve(import.meta.dirname, '../../template/specs/notes/SPEC-DEMO-001.md'), 'utf8');
const swap = (from: string, to: string) => { if (!spec.includes(from)) throw new Error(from); return spec.replace(from, to); };
const issuesOf = (text: string) => {
  const r = parseSpec(text);
  return r.kind === 'invalid' ? r.issues.map((i) => `${i.path.join('.')}: ${i.message}`) : r.kind;
};

describe('parse-spec on the 06 §7 fixture', () => {
  const r = parseSpec(spec);
  it('is valid, with the block, its digest, the acceptance criteria, i18n and open questions', () => {
    expect(r.kind).toBe('valid');
    if (r.kind !== 'valid') return;
    expect(r.block.id).toBe('SPEC-DEMO-001');
    expect(r.acceptance.map((q) => q.id)).toEqual(['R-1', 'R-2', 'R-3', 'R-4', 'R-5', 'R-6']);
    expect(Object.keys(r.i18n).sort()).toEqual(['demo.notes.forbidden', 'demo.notes.invalid', 'demo.notes.missing', 'demo.notes.unauthenticated', 'demo.notes.unavailable']);
    expect(r.i18n['demo.notes.missing']).toEqual({ 'en-US': 'Note not found.', 'pt-BR': 'Nota não encontrada.' });
    expect(r.openQuestions).toBe('None.');
    expect(noOpenQuestions(r.openQuestions)).toBe(true);
    // machineBlockSha256 is taken over the fenced YAML's bytes, every line newline-terminated (09 §2).
    const yaml = spec.slice(spec.indexOf('```yaml\n') + 8, spec.indexOf('\n```\n\n## Contract notes') + 1);
    expect(r.blockText).toBe(yaml);
    expect(r.machineBlockSha256).toBe(createHash('sha256').update(yaml).digest('hex'));
  });
  it('requirements carry their acceptance flag and the falsifier text', () => {
    if (r.kind !== 'valid') throw new Error(r.kind);
    expect(r.block.requirements.every((q) => q.acceptance === 'yes' && q.falsifier !== null)).toBe(true);
  });
});

describe('parse-spec rejects 06 §2-invalid blocks', () => {
  it('an undeclared key at any level (closed keys)', () => {
    expect(issuesOf(swap('product: demo\n', 'product: demo\nowner: x\n'))).toEqual([': Unrecognized key: "owner"']);
    expect(issuesOf(swap('module: {name: Notes, slug: notes, namespace: demo_notes}', 'module: {name: Notes, slug: notes, namespace: demo_notes, version: 1}'))).toEqual(['module: Unrecognized key: "version"']);
  });
  it('acceptance as a boolean, not the strings "yes"/"no"', () => {
    expect(issuesOf(swap('acceptance: "yes"', 'acceptance: true'))[0]).toMatch(/^requirements\.0\.acceptance: /);
  });
  it('a reserved schema (STYNX set, 09 §5) and a reserved word as namespace', () => {
    expect(issuesOf(swap('namespace: demo_notes', 'namespace: demo'))).toContain('module.namespace: reserved schema');
    expect(issuesOf(swap('namespace: demo_notes', 'namespace: pg_notes'))).toContain('module.namespace: reserved schema');
    expect(issuesOf(swap('namespace: demo_notes', 'namespace: select'))).toContain('module.namespace: reserved word');
  });
  it('idempotency none without a reason; key with a reason', () => {
    expect(issuesOf(swap('idempotency: {mode: none, reason: Each successful submission creates a distinct note.}', 'idempotency: {mode: none}'))[0]).toMatch(/^routes\.0\.idempotency\.reason: /);
    expect(issuesOf(swap('idempotency: {mode: none, reason: Each successful submission creates a distinct note.}', 'idempotency: {mode: key, header: Idempotency-Key, ttlMs: 1, reason: x}'))[0]).toMatch(/^routes\.0\.idempotency: Unrecognized key/);
  });
  it('a default whose type does not pair, and an unresolved column binding', () => {
    expect(issuesOf(swap('default: generated-uuid}', 'default: transaction-time}'))).toContain('data.tables.0.columns.0.default: default transaction-time needs type timestamptz');
    expect(issuesOf(swap('title: {column: note.title, required: true}', 'title: {column: note.headline, required: true}'))).toContain('routes.0.request: body.title: unresolved column note.headline');
  });
});

describe('parse-spec: malformed readable bytes (06 §4 SL01)', () => {
  it('no block under ## Contract, two blocks, an alias', () => {
    expect(parseSpec(spec.replace('## Contract\n', '## Contracts\n')).kind).toBe('malformed');
    expect(parseSpec(swap('## Contract notes', '```yaml\na: 1\n```\n\n## Contract notes')).kind).toBe('malformed');
    expect(parseSpec(swap('product: demo\n', 'product: &p demo\nx: *p\n'))).toMatchObject({ kind: 'malformed', problems: [{ reason: 'alias' }] });
  });
});

describe('sectionBody', () => {
  it('reads one ## section, ignoring headings inside fences', () => {
    const text = '# T\n\n## A\n\none\n```\n## B\n```\n\n## Open questions\n\n- Who signs?\n';
    expect(sectionBody(text, 'A')).toBe('one\n```\n## B\n```');
    expect(sectionBody(text, 'Open questions')).toBe('- Who signs?');
    expect(sectionBody(text, 'Missing')).toBeNull();
    expect(noOpenQuestions('- Who signs?')).toBe(false);
    expect(noOpenQuestions('')).toBe(true);
  });
});
