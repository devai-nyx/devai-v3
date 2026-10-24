// 08 B.11 `unit` (D-081) through `devai check --only unit --format json` on the built binary, with the
// C.5 reporter in the product's own Vitest 4.1.11; 09 §4 N18 included.
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { commitAll, templateWorkspace, write } from '../repo.js';
import { check, fakeBin, linkModules, VITEST_CONFIG } from './w3.js';

const SPEC = 'apps/api/test/notes.spec.ts';
const PASSING = `import { expect, it } from 'vitest';
it('adds', () => {
  expect(1 + 1).toBe(2);
});
it('subtracts', () => {
  expect(2 - 1).toBe(1);
});
`;

/** A workspace whose `apps/api` package has `spec` committed as `base` and changed to `head` (so it is affected). */
function workspace(head: string, base = PASSING, extra: Record<string, string> = {}, modules = true): string {
  const dir = templateWorkspace({ 'vitest.config.ts': VITEST_CONFIG, [SPEC]: base, ...extra });
  if (modules) linkModules(dir, { vitest: true, stynx: false });
  write(dir, SPEC, head);
  return dir;
}

describe('B.11 unit', () => {
  it('PASS: every collected case ran and passed (expected = observed = evaluated = cases)', () => {
    const { row, report } = check(workspace(PASSING + '\n'), 'unit');
    expect(row).toMatchObject({ status: 'PASS', expected: 2, observed: 2, evaluated: 2, findings: [] });
    expect(report.exitCode).toBe(0);
  });

  it('FAIL: a failed case, B.11 finding form with the case line and the first message line', () => {
    const { row } = check(workspace(PASSING.replace('toBe(2)', 'toBe(3)')), 'unit');
    expect(row).toMatchObject({ status: 'FAIL', expected: 2, observed: 2, evaluated: 2 });
    expect(row.findings).toEqual([{ locator: `${SPEC}:2`, message: 'adds: expected 2 to be 3 // Object.is equality', standard: 'tests', hint: 'fix the behaviour or the case through its packet' }]);
  });

  it('09 §4 N18 (D-081): it.skip with an issue reference is test-integrity PASS and unit FAIL skipped [S-64], observed < expected by one', () => {
    const dir = workspace(PASSING.replace("it('subtracts'", "it.skip('subtracts // #123'"));
    expect(check(dir, 'test-integrity').row).toMatchObject({ status: 'PASS' });
    const { row } = check(dir, 'unit');
    expect(row).toMatchObject({ status: 'FAIL', expected: 2, observed: 1, evaluated: 1 });
    expect(row.findings).toEqual([{ locator: `${SPEC}:5`, message: 'subtracts // #123: skipped', standard: 'S-64', hint: 'make it run or delete the case' }]);
  });

  it('FAIL: a module that fails to import is a candidate defect, locator = module (C.5, D-074)', () => {
    const { row } = check(workspace(`import './missing.js';\n${PASSING}`), 'unit');
    expect(row.status).toBe('FAIL');
    expect(row.findings).toHaveLength(1);
    expect(row.findings[0]).toMatchObject({ locator: `${SPEC}:1`, standard: 'tests', hint: 'fix the import' });
    expect(row.findings[0]!.message).toMatch(/^collection failed: .*missing\.js/);
  });

  it('UNKNOWN setup-failed: a beforeAll hook failure (C.5)', () => {
    const { row } = check(workspace(`import { beforeAll } from 'vitest';\nbeforeAll(() => { throw new Error('hook boom'); });\n${PASSING}`), 'unit');
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'setup-failed', expected: 2, observed: 0 });
    expect(row.findings[0]).toMatchObject({ locator: `${SPEC}:2`, message: 'setup failed: hook boom' });
  });

  it('FAIL: a population file the config does not collect is a shortfall naming the file', () => {
    const { row } = check(workspace(PASSING + '\n', PASSING, { 'vitest.config.ts': VITEST_CONFIG.replace("'**/test/**/*.spec.ts'", "'nothing/**/*.spec.ts'") }), 'unit');
    expect(row.status).toBe('FAIL');
    expect(row.findings).toEqual([{ locator: `${SPEC}:1`, message: 'not collected: vitest.config.ts did not select the file for its tier', standard: 'tests', hint: 'put the file where the tier glob expects it (04 §4)' }]);
  });

  it('UNKNOWN tooling-missing: no node_modules/.bin/vitest', () => {
    const { row } = check(workspace(PASSING + '\n', PASSING, {}, false), 'unit');
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing' });
    expect(row.findings[0]!.hint).toBe('install with pnpm add -D vitest@4.1.11');
  });

  it('UNKNOWN runner-crashed (D-086): a config that does not load leaves no onTestRunEnd; stderr first line is the message', () => {
    const { row } = check(workspace(PASSING + '\n', PASSING, { 'vitest.config.ts': 'export default {\n' }), 'unit');
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed' });
    expect(row.findings[0]!.locator).toBe('vitest.config.ts:1');
    expect(row.findings[0]!.message).toMatch(/config/i);
  });

  it('UNKNOWN runner-crashed: a vitest that exits without the reporter events', () => {
    const dir = workspace(PASSING + '\n', PASSING, {}, false);
    fakeBin(dir, 'vitest', 1, 'vitest: segmentation fault');
    expect(check(dir, 'unit').row).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed', findings: [{ message: 'vitest: segmentation fault' }] });
  });

  it('SKIPPED with the B.11 string when no package is affected', () => {
    const dir = workspace(PASSING + '\n');
    commitAll(dir);
    rmSync(resolve(dir, '.devai'), { recursive: true, force: true });
    expect(check(dir, 'unit').row).toMatchObject({ status: 'SKIPPED', evidence: 'no unit test files in affected projects' });
  });
});
