// 08 B.17 `boundary` and the D-087 `.stynxrc.json` definition, against @stynx-nyx/cli 3.0.0 from the
// registry: PASS, FAIL forms, missing file FAIL, `[1]` → config-invalid (published command alone passes it),
// tooling-missing, and a `stynx` exit 1 without JSON → runner-crashed (D-086).
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { boundary } from '../../src/nodes/boundary.js';
import { StynxRc } from '../../src/stynxrc.js';
import { commitAll, gitIn, templateWorkspace } from '../repo.js';
import { linkTools, lines, PINS, runNode, STYNXRC_09, toolsFor } from './helpers.js';

let tools: string;
beforeAll(() => { tools = toolsFor(PINS.stynx); }, 300_000);

function workspace(files: Record<string, string> = {}, link = true): string {
  const dir = templateWorkspace({ '.stynxrc.json': STYNXRC_09, ...files });
  if (link) linkTools(dir, tools);
  return dir;
}
const controller = (imports: string) => `${imports}\nexport class NotesController {}\n`;

describe('D-087 .stynxrc.json definition', () => {
  it('the 09 §1.1 file is valid; other STYNX keys pass through', () => {
    expect(StynxRc.safeParse(JSON.parse(STYNXRC_09)).success).toBe(true);
    expect(StynxRc.safeParse({ ...JSON.parse(STYNXRC_09), rlsNegative: { runtimeDir: 'x' } }).success).toBe(true);
  });
  it.each([
    ['[1]', [1]],
    ['no boundary', { apiCoverage: { sourceRoots: [] }, publicApi: { packageRoots: [] } }],
    ['no apiCoverage.sourceRoots', { boundary: {}, apiCoverage: {}, publicApi: { packageRoots: [] } }],
    ['no publicApi.packageRoots', { boundary: {}, apiCoverage: { sourceRoots: [] }, publicApi: {} }],
    ['an absolute root', { boundary: { roots: ['/etc'] }, apiCoverage: { sourceRoots: [] }, publicApi: { packageRoots: [] } }],
    ['an unknown boundary key', { boundary: { root: ['apps'] }, apiCoverage: { sourceRoots: [] }, publicApi: { packageRoots: [] } }],
  ])('%s is invalid', (_n, v) => expect(StynxRc.safeParse(v).success).toBe(false));
});

describe('B.17 boundary (stynx verify-stynx-boundary 3.0.0)', () => {
  it('PASS: every *.ts under the roots scanned, no violation', async () => {
    const dir = workspace({ 'apps/api/src/main.ts': controller("import { x } from '@stynx-nyx/core';"), 'domain/notes/api/src/notes.ts': 'export const n = 1;\n' });
    expect(await runNode(boundary, dir)).toEqual({ status: 'PASS', expected: 2, observed: 2, evaluated: 2, findings: [] });
  });

  it('FAIL: imports forbidden and undeclared seam, in 08\'s forms', async () => {
    const rc = JSON.parse(STYNXRC_09) as { boundary: { forbiddenImports: string[] } };
    rc.boundary.forbiddenImports = ['@stynx-nyx/core/internal'];
    const dir = workspace({
      '.stynxrc.json': JSON.stringify(rc),
      'domain/notes/api/src/notes.controller.ts': controller("import { a } from '@stynx-nyx/core';\nimport { b } from '@stynx-nyx/core/internal';"),
      'apps/api/src/main.ts': controller("import { c } from '@stynxx/other';"),
    });
    const o = await runNode(boundary, dir);
    expect(o).toMatchObject({ status: 'FAIL', expected: 2, observed: 2, evaluated: 2 });
    expect(lines(o)).toEqual([
      'apps/api/src/main.ts:1 imports undeclared STYNX seam @stynxx/other [S-34] add it to .stynxrc.json allowedPackages or import the barrel',
      'domain/notes/api/src/notes.controller.ts:1 imports forbidden @stynx-nyx/core/internal [S-44] import the public entry point',
    ]);
  });

  it('FAIL: .stynxrc.json missing (never SKIPPED)', async () => {
    const dir = workspace();
    gitIn(dir, 'rm', '-q', '.stynxrc.json');
    commitAll(dir);
    expect(lines(await runNode(boundary, dir))).toEqual(['.stynxrc.json:1 .stynxrc.json is missing; the boundary is undeclared [S-34] add .stynxrc.json with a boundary block (roots, allowedPackages)']);
  });

  it('UNKNOWN config-invalid: .stynxrc.json = [1] (the published command alone would PASS it, fact sheet b8)', async () => {
    const dir = workspace({ '.stynxrc.json': '[1]\n', 'domain/notes/api/src/notes.ts': 'export const n = 1;\n' });
    expect(await runNode(boundary, dir)).toMatchObject({ status: 'UNKNOWN', reason: 'config-invalid', findings: [{ locator: '.stynxrc.json:1', standard: 'S-34' }] });
  });

  it('UNKNOWN tooling-missing with the install line', async () => {
    expect(lines(await runNode(boundary, workspace({}, false)))).toEqual(['package.json:1 stynx not resolvable from node_modules/.bin [S-34] install with pnpm add -w -D @stynx-nyx/cli@3.0.0 && pnpm install']);
  });

  it('UNKNOWN runner-crashed: stynx exit 1 with empty stdout (usage error, D-086)', async () => {
    const dir = workspace({}, false);
    mkdirSync(resolve(dir, 'node_modules/.bin'), { recursive: true });
    writeFileSync(resolve(dir, 'node_modules/.bin/stynx'), "#!/bin/sh\necho \"error: unknown option '--json'\" >&2\nexit 1\n");
    chmodSync(resolve(dir, 'node_modules/.bin/stynx'), 0o755);
    expect(lines(await runNode(boundary, dir))).toEqual(["package.json:1 stynx verify-stynx-boundary exited 1: error: unknown option '--json' [S-34] the tool exited abnormally; re-run once, then put the output under ## Notes"]);
  });

  it('a template workspace with no source under the roots observes nothing: UNKNOWN no-observations (C.1 step 9)', async () => {
    expect(await runNode(boundary, workspace())).toMatchObject({ status: 'UNKNOWN', reason: 'no-observations', expected: 0, observed: 0 });
  });
});
