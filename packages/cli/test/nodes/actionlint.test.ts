// 08 B.14 `actionlint` against github-actionlint 1.7.12 as installed (binary downloaded at install).
import { beforeAll, describe, expect, it } from 'vitest';
import { actionlint } from '../../src/nodes/actionlint.js';
import { Report } from '../../src/report.js';
import { contextOf, devaiCheck, fakeTool, toolModules, workspace } from './tools.js';

const run = async (dir: string) => actionlint.run(await contextOf(dir, 'actionlint'));
const GOOD = 'on: push\njobs:\n  a:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo hi\n';
const BAD = 'on: push\njobs:\n  a:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo ${{ github.foo }}\n';

describe('B.14 actionlint', () => {
  beforeAll(() => void toolModules(), 300_000);

  it('PASS: a clean workflow is observed by the exit status plus its absence from the error list', async () => {
    expect(await run(workspace({}, { '.github/workflows/ci.yml': GOOD }))).toEqual({ status: 'PASS', expected: 1, observed: 1, evaluated: 1, findings: [] });
  });

  it('FAIL: "<file>:<line>:<col> <kind>: <message> [S-43] fix the expression or input"', async () => {
    const o = await run(workspace({}, { '.github/workflows/bad.yml': BAD, '.github/workflows/ci.yaml': GOOD }));
    expect(o).toMatchObject({ status: 'FAIL', expected: 2, observed: 2, evaluated: 2 });
    expect(o.findings).toHaveLength(1);
    expect(o.findings[0]).toMatchObject({ locator: '.github/workflows/bad.yml:6:23', standard: 'S-43', hint: 'fix the expression or input' });
    expect(o.findings[0]!.message).toMatch(/^expression: property "foo" is not defined in object type/);
  });

  it('UNKNOWN tooling-missing, and runner-crashed on an exit outside {0, 1} without JSON', async () => {
    expect(await run(workspace({}, { '.github/workflows/ci.yml': GOOD }, null))).toMatchObject({
      status: 'UNKNOWN', reason: 'tooling-missing', findings: [{ locator: 'package.json:1', message: 'github-actionlint not resolvable from node_modules/.bin', standard: 'S-19', hint: 'install with pnpm add -D --save-exact github-actionlint@1.7.12' }],
    });
    expect(await run(workspace({}, { '.github/workflows/ci.yml': GOOD }, fakeTool('github-actionlint', 3)))).toMatchObject({
      status: 'UNKNOWN', reason: 'runner-crashed', findings: [{ locator: '.github/workflows/ci.yml:1', message: 'boom: the tool fell over', standard: 'S-43' }],
    });
  });

  it('SKIPPED with the B.14 evidence string, and a C.2-valid report on the template workspace', () => {
    const skipped = Report.parse(JSON.parse(devaiCheck(workspace({}, {}, toolModules(), true), 'actionlint').stdout));
    expect(skipped.nodes.find((n) => n.id === 'actionlint')).toMatchObject({ status: 'SKIPPED', evidence: 'no changed .github/**' });
    const r = devaiCheck(workspace({}, { '.github/workflows/devai.yml': BAD }, toolModules(), true), 'actionlint');
    const report = Report.parse(JSON.parse(r.stdout));
    expect(report.nodes.map((n) => [n.id, n.status])).toEqual([['inventory', 'PASS'], ['actionlint', 'FAIL'], ['accept', 'FAIL']]);
    expect(r.status).toBe(1);
  });
});
