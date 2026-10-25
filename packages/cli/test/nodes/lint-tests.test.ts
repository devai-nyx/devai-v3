// 08 B.4 `lint-tests` against ESLint 10.10.0 and the published `@stynx-nyx/eslint-config/test` profile:
// findings mapped by ruleId plus message prefix (D-086), forms verbatim from B.4 Findings.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { lintTests } from '../../src/nodes/lint-tests.js';
import { Report } from '../../src/report.js';
import { contextOf, devaiCheck, fakeTool, toolModules, workspace } from './tools.js';

const run = async (dir: string) => lintTests.run(await contextOf(dir, 'lint-tests'));
const GOOD = "import { expect, it } from 'vitest';\nit('adds', () => {\n  expect(1 + 1).toBe(2);\n});\n";

describe('B.4 lint-tests', () => {
  beforeAll(() => void toolModules(), 300_000);

  it('PASS: value assertions only', async () => {
    expect(await run(workspace({}, { 'test/a.spec.ts': GOOD }))).toEqual({ status: 'PASS', expected: 1, observed: 1, evaluated: 1, findings: [] });
  });

  it('FAIL: WAVE-05A/CW-1 and R19-W06 by ruleId plus message prefix, in B.4\'s forms', async () => {
    const dir = workspace({}, {
      'domain/notes/api/test/a.spec.ts': "import { expect, it } from 'vitest';\nimport { x } from '../../../other/src';\nit('exists', () => {\n  expect(x).toBeTruthy();\n});\n",
    });
    expect(await run(dir)).toEqual({
      status: 'FAIL', expected: 1, observed: 1, evaluated: 1,
      findings: [
        { locator: 'domain/notes/api/test/a.spec.ts:2:1', message: 'R19-W06: Import sibling packages through their package name and test alias, not relative */src paths.', standard: 'S-60', hint: 'import the package, not its src by relative path' },
        { locator: 'domain/notes/api/test/a.spec.ts:4:3', message: 'WAVE-05A/CW-1: Use a value assertion (.toBe(x) / .toEqual(...) / .toMatch(/.../)) instead of an existence-only assertion; existence assertions survive most mutations.', standard: 'S-60', hint: 'assert a value, not existence' },
      ],
    });
  });

  it('UNKNOWN tooling-missing: the ./test profile is not installed', async () => {
    expect(await run(workspace({}, { 'test/a.spec.ts': GOOD }, null))).toEqual({
      status: 'UNKNOWN', reason: 'tooling-missing', expected: 1, observed: 0, evaluated: 0,
      findings: [{ locator: 'package.json:1', message: '@stynx-nyx/eslint-config/test not resolvable from node_modules', standard: 'S-19', hint: 'install with pnpm add -w -D --save-exact @stynx-nyx/eslint-config@3.0.0 && pnpm install' }],
    });
  });

  it('UNKNOWN runner-crashed: a non-zero exit without ESLint\'s JSON', async () => {
    const modules = fakeTool('eslint');
    mkdirSync(resolve(modules, '@stynx-nyx/eslint-config'), { recursive: true });
    writeFileSync(resolve(modules, '@stynx-nyx/eslint-config/package.json'), JSON.stringify({ name: '@stynx-nyx/eslint-config', type: 'module', exports: { './test': './test.mjs' } }));
    writeFileSync(resolve(modules, '@stynx-nyx/eslint-config/test.mjs'), 'export default [];\n');
    expect(await run(workspace({}, { 'test/a.spec.ts': GOOD }, modules))).toMatchObject({
      status: 'UNKNOWN', reason: 'runner-crashed', findings: [{ locator: 'test/a.spec.ts:1', message: 'boom: the tool fell over', standard: 'S-60' }],
    });
  });

  it('SKIPPED with the B.4 evidence string, and a C.2-valid report on the template workspace', () => {
    const skipped = Report.parse(JSON.parse(devaiCheck(workspace({}, {}, toolModules(), true), 'lint-tests').stdout));
    expect(skipped.nodes.find((n) => n.id === 'lint-tests')).toMatchObject({ status: 'SKIPPED', evidence: 'no changed *.spec.ts' });
    const r = devaiCheck(workspace({}, { 'test/notes.spec.ts': GOOD }, toolModules(), true), 'lint-tests');
    const report = Report.parse(JSON.parse(r.stdout));
    expect(report.nodes.map((n) => [n.id, n.status])).toEqual([['inventory', 'PASS'], ['lint-tests', 'PASS'], ['accept', 'PASS']]);
    expect(r.status).toBe(0);
  });
});
