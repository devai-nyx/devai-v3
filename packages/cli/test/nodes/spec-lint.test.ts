// 08 B.8 `spec-lint`: PASS on the fixture, one negative case per SL rule it executes (06 §4 messages
// verbatim), UNKNOWN io, scope through a changed product/** source.
import { chmodSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { specLint } from '../../src/nodes/spec-lint.js';
import { commitAll, gitIn, templateWorkspace, write } from '../repo.js';
import { lines, runNode } from './helpers.js';

const SPEC = 'specs/notes/SPEC-DEMO-001.md';
const fixture = readFileSync(resolve(import.meta.dirname, '../../template', SPEC), 'utf8');

/** A workspace whose HEAD lacks the spec, with `text` written as an untracked (changed) file. */
function withSpec(text: string = fixture): string {
  const dir = templateWorkspace();
  gitIn(dir, 'rm', '-q', SPEC);
  commitAll(dir, 'drop spec');
  write(dir, SPEC, text);
  return dir;
}
const lineOf = (text: string, needle: string): number => text.slice(0, text.indexOf(needle)).split('\n').length;
const edit = (from: string, to: string) => {
  expect(fixture).toContain(from);
  return fixture.replace(from, to);
};
const finding = (text: string, needle: string, rest: string) => `${SPEC}:${lineOf(text, needle)} ${rest} [S-25] fix it in a spec packet`;

describe('B.8 spec-lint', () => {
  it('PASS: the fixture spec in scope, expected = observed = evaluated = 1', async () => {
    expect(await runNode(specLint, withSpec())).toEqual({ status: 'PASS', expected: 1, observed: 1, evaluated: 1, findings: [] });
  });

  it('a changed product/** source brings its spec into scope', async () => {
    const dir = templateWorkspace();
    write(dir, 'product/demo/rules/RN-DEMO-001.md', readFileSync(resolve(dir, 'product/demo/rules/RN-DEMO-001.md'), 'utf8') + '\nA note.\n');
    expect(await runNode(specLint, dir)).toMatchObject({ status: 'PASS', expected: 1 });
  });

  it('SL01 closed schema: invalid contract at <pointer>: <reason>', async () => {
    const text = edit('id: SPEC-DEMO-001\n', 'id: SPEC-DEMO-001\nextra: 1\n');
    const o = await runNode(specLint, withSpec(text));
    expect(o.status).toBe('FAIL');
    expect(lines(o)).toEqual([finding(text, 'id: SPEC', 'SL01 invalid contract at /: Unrecognized key: "extra"')]);
  });

  it('SL01 malformed readable YAML is FAIL and not observed', async () => {
    const text = edit('approved-by: DemoPilot', 'approved-by: DemoPilot\napproved-by: Other');
    const o = await runNode(specLint, withSpec(text));
    expect(o).toMatchObject({ status: 'FAIL', expected: 1, observed: 0 });
    expect(o.findings[0]!.message).toMatch(/^SL01 invalid contract at \/: Map keys must be unique/);
    expect(o.findings[0]!.locator).toBe(`${SPEC}:${lineOf(text, 'approved-by: Other')}`);
  });

  it('SL01 required section missing', async () => {
    const text = edit('## Open questions\n\nNone.\n', '');
    expect(lines(await runNode(specLint, withSpec(text)))).toEqual([`${SPEC}:1 SL01 invalid contract at /: missing section ## Open questions [S-25] fix it in a spec packet`]);
  });

  it('SL02 a quote that is not verbatim', async () => {
    const text = edit('quote: A valid submission creates one note retrievable only in its tenant.', 'quote: A valid submission creates a note.');
    expect(lines(await runNode(specLint, withSpec(text)))).toEqual([finding(text, '  - id: UC-DEMO-001', 'SL02 source UC-DEMO-001: missing artifact, id, or verbatim quote at product/use-cases/UC-DEMO-001.json')]);
  });

  it('SL03 acceptance yes without a falsifier', async () => {
    const text = edit("falsifier: The application role sees another tenant's row, or isolation is claimed from an empty fixture.", 'falsifier: null');
    expect(lines(await runNode(specLint, withSpec(text)))).toEqual([finding(text, '  - id: R-6', 'SL03 acceptance R-6: observable and falsifier required')]);
  });

  it('SL04 an invalid contract field', async () => {
    const text = edit('slo: {metric: http.server.duration, percentile: 95, maxMs: 250}', 'slo: {metric: http.server.duration, percentile: 100, maxMs: 250}');
    expect(lines(await runNode(specLint, withSpec(text)))).toEqual([finding(text, 'percentile: 100', 'SL04 route GET /notes/:id: missing or invalid slo')]);
  });

  it('SL05 limits out of order', async () => {
    const text = edit('{name: title, type: varchar, limits: {minLength: 1, maxLength: 80}', '{name: title, type: varchar, limits: {minLength: 81, maxLength: 80}');
    expect(lines(await runNode(specLint, withSpec(text)))).toEqual([finding(text, 'minLength: 81', 'SL05 column note.title: limits/nullability/PII declaration invalid')]);
  });

  it('SL06 duplicate requirement id within the spec; duplicate spec id across specs', async () => {
    const text = edit('  - id: R-6', '  - id: R-5');
    const o = await runNode(specLint, withSpec(text));
    expect(lines(o)).toContain(finding(text, '  - id: R-5\n    text: Row-level', 'SL06 duplicate or malformed requirement R-5'));
    const dir = withSpec();
    write(dir, 'specs/notes-copy/SPEC-DEMO-001.md', fixture);
    const o2 = await runNode(specLint, dir);
    expect(o2).toMatchObject({ status: 'FAIL', expected: 2 });
    expect(lines(o2)).toContain(finding(fixture, 'id: SPEC', 'SL06 duplicate or malformed spec SPEC-DEMO-001'));
  });

  it('SL07 route roles differ from the use case actor', async () => {
    const text = edit('    roles: [demo-member]\n    errorContract:\n      - {status: 400, code: VALIDATION, messageKey: demo.notes.invalid}\n      - {status: 401, code: UNAUTHENTICATED, messageKey: demo.notes.unauthenticated}\n      - {status: 403, code: FORBIDDEN, messageKey: demo.notes.forbidden}\n      - {status: 503', '    roles: [demo-admin]\n    errorContract:\n      - {status: 400, code: VALIDATION, messageKey: demo.notes.invalid}\n      - {status: 401, code: UNAUTHENTICATED, messageKey: demo.notes.unauthenticated}\n      - {status: 403, code: FORBIDDEN, messageKey: demo.notes.forbidden}\n      - {status: 503');
    expect(lines(await runNode(specLint, withSpec(text)))).toEqual([finding(text, '    useCase: UC-DEMO-001', 'SL07 useCase UC-DEMO-001: unresolved actor/rule/endpoint claim')]);
  });

  it('SL08 an insert whose cardinality is not one', async () => {
    const text = edit('returns: [note.id, note.title, note.author_alias]\n    expects: one', 'returns: [note.id, note.title, note.author_alias]\n    expects: zero-or-one');
    expect(lines(await runNode(specLint, withSpec(text)))).toEqual([finding(text, '  - name: demo_notes.note.insert', 'SL08 query demo_notes.note.insert: invalid binding or cardinality')]);
  });

  it('SL12 a configured locale missing for a key', async () => {
    const text = edit('demo.notes.missing: {en-US: Note not found., pt-BR', 'demo.notes.missing: {pt-BR');
    expect(lines(await runNode(specLint, withSpec(text)))).toEqual([finding(text, 'demo.notes.missing: {pt-BR', 'SL12 i18n demo.notes.missing: missing locale or unresolved error message')]);
    expect(lines(await runNode(specLint, withSpec(), { config: { locales: ['en-US', 'de-DE'] } })).length).toBe(5);
  });

  it('UNKNOWN io: a source cannot be read', async () => {
    const dir = withSpec();
    try {
      expect(await runNode(specLint, dir, { beforeRun: () => chmodSync(resolve(dir, 'product/demo/rules/RN-DEMO-002.md'), 0o000) })).toMatchObject({ status: 'UNKNOWN', reason: 'io', expected: 1, observed: 1, evaluated: 0, findings: [{ locator: 'product/demo/rules/RN-DEMO-002.md:1' }] });
    } finally {
      chmodSync(resolve(dir, 'product/demo/rules/RN-DEMO-002.md'), 0o644);
    }
  });
});
