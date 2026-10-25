// 08 B.18 `deadcode` against knip 6.35.1, depcheck 1.4.7 and madge 8.0.0 from the registry (07 §2):
// package × tool observations, 08's three finding forms, tooling-missing and runner-crashed.
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { deadcode } from '../../src/nodes/deadcode.js';
import { templateWorkspace } from '../repo.js';
import { linkTools, lines, PINS, runNode, toolsFor } from './helpers.js';

let tools: string;
beforeAll(() => { tools = toolsFor(PINS.deadcode); }, 300_000);

const KNIP = "export default { workspaces: { 'packages/*': { entry: ['src/index.ts'] } } };\n";
const pkg = (deps: Record<string, string> = {}) => JSON.stringify({ name: '@demo/a', private: true, type: 'module', exports: { '.': './src/index.ts' }, dependencies: deps });
function workspace(files: Record<string, string>, link = true): string {
  const dir = templateWorkspace({ 'pnpm-workspace.yaml': 'packages:\n  - packages/*\n', 'tools/knip.config.ts': KNIP, 'packages/a/package.json': pkg(), ...files });
  if (link) linkTools(dir, tools);
  return dir;
}

describe('B.18 deadcode', () => {
  it('PASS: one package × three tools, every JSON parsed, nothing unused', async () => {
    const dir = workspace({ 'packages/a/src/index.ts': "import { x } from './u.js';\nexport const y = x;\n", 'packages/a/src/u.ts': 'export const x = 1;\n' });
    expect(await runNode(deadcode, dir)).toEqual({ status: 'PASS', expected: 3, observed: 3, evaluated: 3, findings: [] });
  });

  it('FAIL: unused export (knip), unused dependency (depcheck), cycle (madge), in 08\'s forms', async () => {
    const dir = workspace({
      'packages/a/package.json': pkg({ 'left-pad': '1.3.0' }),
      'packages/a/src/index.ts': "import { x } from './u.js';\nimport { a } from './a.js';\nexport const y = x + a;\n",
      'packages/a/src/u.ts': 'export const x = 1;\nexport const unused = 2;\n',
      'packages/a/src/a.ts': "import { b } from './b.js';\nexport const a = 1;\nexport const ab = b;\n",
      'packages/a/src/b.ts': "import { ab } from './a.js';\nexport const b = 2;\nexport const ba = ab;\n",
    });
    const o = await runNode(deadcode, dir);
    expect(o).toMatchObject({ status: 'FAIL', expected: 3, observed: 3, evaluated: 3 });
    const l = lines(o);
    expect(l).toContain('packages/a/src/u.ts:2 unused export unused [S-42] remove it or add a knip entry (knip)');
    expect(l).toContain('packages/a/package.json:1 unused dependency left-pad [S-42] remove it (depcheck)');
    expect(l).toContain('packages/a/src/a.ts:1 cycle: packages/a/src/a.ts → packages/a/src/b.ts → packages/a/src/a.ts [S-42] break the cycle (madge)');
  });

  it('UNKNOWN tooling-missing: one line per missing binary with its install command', async () => {
    const o = await runNode(deadcode, workspace({ 'packages/a/src/index.ts': 'export const y = 1;\n' }, false));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing', expected: 3, observed: 0 });
    expect(lines(o)).toEqual([
      'package.json:1 knip not resolvable from node_modules/.bin [S-42] install with pnpm add -w -D knip@6.35.1 && pnpm install',
      'package.json:1 depcheck not resolvable from node_modules/.bin [S-42] install with pnpm add -w -D depcheck@1.4.7 && pnpm install',
      'package.json:1 madge not resolvable from node_modules/.bin [S-42] install with pnpm add -w -D madge@8.0.0 && pnpm install',
    ]);
  });

  it('UNKNOWN runner-crashed: knip without its config; the other pairs still reported', async () => {
    const dir = workspace({ 'tools/knip.config.ts': '', 'packages/a/src/index.ts': 'export const y = 1;\n' });
    const o = await runNode(deadcode, dir, { beforeRun: () => rmSync(resolve(dir, 'tools/knip.config.ts')) });
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed', expected: 3, observed: 2 });
    expect(o.findings[0]!.message).toMatch(/^knip \(packages\/a\) exited 2: ERROR: Unable to find tools\/knip\.config\.ts/);
  });
});
