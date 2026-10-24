// 08 B.12 `test-integrity`: the changed test files at the working tree against `HEAD` (A.3 edit-loop base).
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workingTree } from '../../src/candidate/digest.js';
import { factsOf, testIntegrity } from '../../src/nodes/test-integrity.js';
import { plan } from '../../src/runner/plan.js';
import { templateConfig } from '../fixtures.js';
import { templateWorkspace, write } from '../repo.js';
import { runOnly } from './w2b.js';

const UNIT = 'domain/notes/api/test/notes.controller.spec.ts';
const ACC = 'domain/notes/api/test/acceptance/spec-demo-001.acceptance.spec.ts';
const cases = (n: number) => Array.from({ length: n }, (_, i) => `  it('case ${i}', () => { expect(f(${i})).toBe(${i}); });`).join('\n');
const unit = (body: string) => `import { describe, expect, it } from 'vitest';\nconst f = (x: number) => x;\ndescribe('notes', () => {\n${body}\n});\n`;
const acceptance = (ids: number[], annotation = '') => `${annotation}import { expect, it } from 'vitest';\n${ids.map((n) => `it('R-${n}: case', () => { expect(${n}).toBeGreaterThan(0); });`).join('\n')}\n`;

describe('B.12 test-integrity', () => {
  it('PASS: an added case with its assertion', async () => {
    const dir = templateWorkspace({ [UNIT]: unit(cases(2)) });
    write(dir, UNIT, unit(cases(3)));
    const { row } = await runOnly(dir, 'test-integrity');
    expect(row).toMatchObject({ status: 'PASS', expected: 1, observed: 1, evaluated: 1 });
  });

  it('FAIL: it.skip without an issue reference; 09 §4 N18: it.skip with "#123" passes', async () => {
    const dir = templateWorkspace({ [UNIT]: unit(cases(2)) });
    write(dir, UNIT, unit(`${cases(2)}\n  it.skip('pending', () => { expect(1).toBeGreaterThan(0); });`));
    expect((await runOnly(dir, 'test-integrity')).row.findings).toEqual([{ locator: `${UNIT}:6`, message: 'it.skip without issue reference', standard: 'S-64', hint: 'link the issue or delete the case' }]);
    write(dir, UNIT, unit(`${cases(2)}\n  it.skip('pending // #123', () => { expect(1).toBeGreaterThan(0); });`));
    expect((await runOnly(dir, 'test-integrity')).row.status).toBe('PASS');
  });

  it("FAIL: assertion count below 80 % of base (B.12 form 'assertions 12 → 7 (−42 %)')", async () => {
    const dir = templateWorkspace({ [UNIT]: unit(cases(12)) });
    write(dir, UNIT, unit(cases(7)));
    const { row } = await runOnly(dir, 'test-integrity');
    expect(row.findings).toEqual([{ locator: `${UNIT}:1`, message: 'assertions 12 → 7 (−42 %)', standard: 'S-64', hint: 'add // @acceptance-change: approved-by=<pilot> in a test packet' }]);
  });

  it('FAIL: a literal verdict', async () => {
    const dir = templateWorkspace({ [UNIT]: unit(cases(1)) });
    write(dir, UNIT, unit(`${cases(1)}\n  it('x', () => { expect(true).toBe(true); });`));
    const { row } = await runOnly(dir, 'test-integrity');
    expect(row.findings).toEqual([{ locator: `${UNIT}:5`, message: 'literal verdict expect(true).toBe(true)', standard: 'S-64', hint: 'assert on observed behaviour, never on a literal' }]);
  });

  it('acceptance file: any change needs @acceptance-change; 09 §4 N7a: a removed R-n of an acceptance: yes requirement is FAIL even annotated', async () => {
    const dir = templateWorkspace({ [ACC]: acceptance([1, 2, 3, 4, 5, 6]) });
    write(dir, ACC, acceptance([1, 2, 3, 4, 5, 6]) + '// touched\n');
    expect((await runOnly(dir, 'test-integrity')).row.findings).toEqual([{ locator: `${ACC}:1`, message: 'acceptance file changed without @acceptance-change', standard: 'S-63', hint: 'add the annotation in a test packet' }]);
    write(dir, ACC, acceptance([1, 2, 4, 5, 6], '// @acceptance-change: approved-by=DemoPilot\n'));
    expect((await runOnly(dir, 'test-integrity')).row.findings).toEqual([{ locator: `${ACC}:1`, message: "it('R-3: …') removed for an acceptance: yes requirement", standard: 'S-63', hint: 'restore the R-3 case; a test packet owns it' }]);
  });

  it('09 §4 N7b: the acceptance file deleted is FAIL (no annotation possible)', async () => {
    const dir = templateWorkspace({ [ACC]: acceptance([1, 2, 3, 4, 5, 6]) });
    rmSync(resolve(dir, ACC));
    const { row } = await runOnly(dir, 'test-integrity');
    expect(row).toMatchObject({ status: 'FAIL', expected: 1, observed: 1 });
    expect(row.findings.map((f) => f.message)).toContain('acceptance file changed without @acceptance-change');
  });

  it('SKIPPED with the 05 §3 string when no test path changed', async () => {
    const { row } = await runOnly(templateWorkspace(), 'test-integrity');
    expect(row).toMatchObject({ status: 'SKIPPED', evidence: 'no changed test/**' });
  });

  it('UNKNOWN base-unreadable when the base commit cannot be read (a packet base not fetched)', async () => {
    const dir = templateWorkspace({ [UNIT]: unit(cases(2)) });
    write(dir, UNIT, unit(cases(3)));
    const ctx = {
      root: dir, config: templateConfig(), runtime: 'bare' as const, cliVersion: '3.0.0', listing: await workingTree(dir, null), base: 'f'.repeat(40), head: 'b'.repeat(40),
      plan: plan({ packet: false, full: false, only: ['test-integrity'] }),
      inventory: { toolchainDigest: 'a'.repeat(64), populations: {} as never, changed: [UNIT], mounts: { apps: [], controllers: [], read: [], unresolved: [] }, projects: [], packageDirs: [] },
    };
    const o = await testIntegrity.run(ctx);
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'base-unreadable', expected: 1, observed: 0 });
    expect(o.findings[0]).toEqual({ locator: `${UNIT}:1`, message: `${'f'.repeat(40)}:${UNIT} not readable`, standard: 'S-64', hint: 'git fetch origin, then re-run' });
  });

  it('factsOf: expect( and assert. calls, R-n cases, focus calls', () => {
    const f = factsOf('a.spec.ts', "it('R-2: x', () => { expect(1).toBe(2); assert.equal(1, 1); });\ndescribe.only('y', () => {}); // ABC-12\n");
    expect(f).toMatchObject({ assertions: 2, focus: [{ what: 'describe.only', line: 2, referenced: true }] });
    expect([...f.cases]).toEqual([['R-2', 1]]);
  });
});
