// 08 B.2 `format` against Prettier 3.9.6 as installed: Status sentences and finding forms as oracles.
import { beforeAll, describe, expect, it } from 'vitest';
import { format } from '../../src/nodes/format.js';
import { Report } from '../../src/report.js';
import { contextOf, devaiCheck, fakeTool, toolModules, workspace } from './helpers.js';

const PRETTIER = JSON.stringify({ name: 'demo', private: true, type: 'module', engines: { node: '>=24 <25', pnpm: '>=9 <10' }, packageManager: 'pnpm@9.15.0', prettier: { printWidth: 100, singleQuote: true, trailingComma: 'all', semi: true } }, null, 2) + '\n';
const run = async (dir: string) => format.run(await contextOf(dir, 'format'));

describe('B.2 format', () => {
  beforeAll(() => void toolModules(), 300_000);

  it('PASS: every changed file formatted', async () => {
    const dir = workspace({ 'package.json': PRETTIER }, { 'src/a.ts': "export const a = 'x';\n" });
    expect(await run(dir)).toEqual({ status: 'PASS', expected: 1, observed: 1, evaluated: 1, findings: [] });
  });

  it('FAIL: a listed path is "<path>:1 not formatted [S-41] run prettier --write <path>"; a syntax error is a defect', async () => {
    const dir = workspace({ 'package.json': PRETTIER }, { 'src/a.ts': 'export const a  =  "x"\n', 'src/ok.ts': "export const b = 1;\n", 'src/broken.ts': 'const = ;\n' });
    expect(await run(dir)).toEqual({
      status: 'FAIL', expected: 3, observed: 2, evaluated: 2,
      findings: [
        { locator: 'src/a.ts:1', message: 'not formatted', standard: 'S-41', hint: 'run prettier --write src/a.ts' },
        { locator: 'src/broken.ts:1:7', message: 'syntax error: Variable declaration expected.', standard: 'S-41', hint: 'fix the file' },
      ],
    });
  });

  it('UNKNOWN tooling-missing: prettier absent from node_modules/.bin, install command on the finding line', async () => {
    const dir = workspace({}, { 'src/a.ts': 'export const a = 1;\n' }, null);
    expect(await run(dir)).toEqual({
      status: 'UNKNOWN', reason: 'tooling-missing', expected: 1, observed: 0, evaluated: 0,
      findings: [{ locator: 'package.json:1', message: 'prettier not resolvable from node_modules/.bin', standard: 'S-19', hint: 'install with pnpm add -D --save-exact prettier@3.9.6' }],
    });
  });

  it('UNKNOWN runner-crashed: an exit outside {0, 1, 2}, and an exit 2 without a syntax error, with stderr\'s first line', async () => {
    for (const code of [3, 2]) {
      const dir = workspace({}, { 'src/a.ts': 'export const a = 1;\n' }, fakeTool('prettier', code));
      expect(await run(dir)).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed', findings: [{ locator: 'src/a.ts:1', message: 'boom: the tool fell over', standard: 'S-41' }] });
    }
  });

  it('SKIPPED with the B.2 evidence string, and a C.2-valid report on the template workspace', () => {
    const clean = workspace({ 'package.json': PRETTIER }, {}, toolModules(), true);
    const skipped = Report.parse(JSON.parse(devaiCheck(clean, 'format').stdout));
    expect(skipped.nodes.find((n) => n.id === 'format')).toMatchObject({ status: 'SKIPPED', evidence: 'no changed *.{ts,mjs,json,md}' });
    const dirty = workspace({ 'package.json': PRETTIER }, { 'README.md': '#  Demo\n' }, toolModules(), true);
    const r = devaiCheck(dirty, 'format');
    const report = Report.parse(JSON.parse(r.stdout));
    expect(r.status).toBe(1);
    expect(report.nodes.map((n) => [n.id, n.status])).toEqual([['inventory', 'PASS'], ['format', 'FAIL'], ['accept', 'FAIL']]);
    expect(report.nodes[1]!.findings).toEqual([{ locator: 'README.md:1', message: 'not formatted', standard: 'S-41', hint: 'run prettier --write README.md' }]);
  });
});
