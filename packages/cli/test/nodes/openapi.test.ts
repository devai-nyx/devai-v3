// 08 B.19 `openapi` as amended by D-087/D-088, against @stynx-nyx/cli 3.0.0 from the registry. The PASS
// fixture's OpenAPI document is produced by the published engine's own writer (test setup only; the
// node never writes, D-029), because 3.0.0 publishes no write form (D-088).
import { chmodSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { breakingPackages, majorBumps, openapi, WRITE_PAIR_HINT } from '../../src/nodes/openapi.js';
import { commitAll, gitIn, templateWorkspace, write } from '../repo.js';
import { contextOf, linkTools, lines, PINS, runNode, STYNXRC_09, toolsFor } from './helpers.js';

const OPENAPI = 'docs/framework/contracts/openapi.json';
const BASELINE = 'docs/framework/contracts/public-api-baselines.json';
let tools: string;
let seed: string;
beforeAll(async () => {
  tools = toolsFor(PINS.stynx);
  // The seed document for a workspace without routes, as `api:docs:write` would write it.
  const scratch = templateWorkspace({ '.stynxrc.json': STYNXRC_09 });
  const engine = resolve(realpathSync(resolve(tools, 'node_modules/@stynx-nyx/cli')), 'engines/api-coverage.mjs');
  const { verifyApiCoverage } = (await import(pathToFileURL(engine).href)) as { verifyApiCoverage: (o: { root: string; writeOpenApi: boolean }) => unknown };
  verifyApiCoverage({ root: scratch, writeOpenApi: true });
  seed = readFileSync(resolve(scratch, OPENAPI), 'utf8');
}, 300_000);

const baseline = (hash: string) => JSON.stringify({ schemaVersion: '1', packages: { '@demo/a': { exports: { '.': './dist/index.js' }, declarationHashes: { 'index.d.ts': hash } } } });
function workspace(files: Record<string, string> = {}, link = true): string {
  const dir = templateWorkspace({ '.stynxrc.json': STYNXRC_09, [OPENAPI]: seed, [BASELINE]: JSON.stringify({ schemaVersion: '1', packages: {} }), ...files });
  if (link) linkTools(dir, tools);
  return dir;
}

describe('B.19 changeset rule helpers', () => {
  it('a removed or changed declaration, or changed exports, is breaking; an added one is not', () => {
    const b = JSON.parse(baseline('aa'));
    expect(breakingPackages(b, JSON.parse(baseline('aa')))).toEqual([]);
    expect(breakingPackages(b, JSON.parse(baseline('bb')))).toEqual(['@demo/a']);
    expect(breakingPackages(b, { packages: {} })).toEqual(['@demo/a']);
    expect(breakingPackages({ packages: {} }, b)).toEqual([]);
    expect(majorBumps('---\n"@demo/a": major\n\'@demo/b\': minor\n---\n\nx\n')).toEqual(['@demo/a']);
  });
});

describe('B.19 openapi (stynx 3.0.0 check forms)', () => {
  it('PASS: the three checks and the changeset rule, expected = observed = evaluated = 4', async () => {
    expect(await runNode(openapi, workspace())).toEqual({ status: 'PASS', expected: 4, observed: 4, evaluated: 4, findings: [] });
  });

  it('UNKNOWN tooling-missing (D-088): contract files missing, the D-088 hint verbatim', async () => {
    const dir = workspace();
    gitIn(dir, 'rm', '-q', OPENAPI, BASELINE);
    commitAll(dir);
    const o = await runNode(openapi, dir);
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing' });
    expect(o.findings.every((f) => f.hint === WRITE_PAIR_HINT)).toBe(true);
    expect(WRITE_PAIR_HINT).toBe('openapi: install @stynx-nyx/cli ≥ <v> with the write pair');
    expect(o.findings.slice(0, 2).map((f) => f.locator)).toEqual([`${OPENAPI}:1`, `${BASELINE}:1`]);
  });

  it('UNKNOWN tooling-missing (D-088): a route the document lacks; the check names the write pair', async () => {
    const dir = workspace({ 'apps/api/src/notes.controller.ts': "import { Controller, Get } from '@nestjs/common';\n@Controller('notes')\nexport class NotesController {\n  @Get()\n  list(): string[] { return []; }\n}\n" });
    const o = await runNode(openapi, dir);
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing' });
    expect(lines(o).some((l) => /^apps\/api\/src\/notes\.controller\.ts:\d+ \/notes operation not in docs\/framework\/contracts\/openapi\.json \[S-22\] openapi: install @stynx-nyx\/cli ≥ <v> with the write pair$/.test(l))).toBe(true);
  });

  it('FAIL: breaking baseline without a major changeset; a major changeset clears it', async () => {
    const dir = workspace({ [BASELINE]: baseline('aa') });
    write(dir, BASELINE, baseline('bb'));
    const o = await runNode(openapi, dir);
    expect(o).toMatchObject({ status: 'FAIL', expected: 4, observed: 4 });
    expect(lines(o)).toEqual([`${BASELINE}:1 breaking change without major changeset [S-40] pnpm changeset (major)`]);
    write(dir, '.changeset/break.md', '---\n"@demo/a": major\n---\n\nRemove a declaration.\n');
    expect(await runNode(openapi, dir)).toMatchObject({ status: 'PASS' });
  });

  it('UNKNOWN config-invalid: .stynxrc.json = [1], and absent', async () => {
    expect(await runNode(openapi, workspace({ '.stynxrc.json': '[1]\n' }))).toMatchObject({ status: 'UNKNOWN', reason: 'config-invalid' });
    const dir = workspace();
    gitIn(dir, 'rm', '-q', '.stynxrc.json');
    commitAll(dir);
    expect(await runNode(openapi, dir)).toMatchObject({ status: 'UNKNOWN', reason: 'config-invalid' });
  });

  it('a stynx UNKNOWN keeps its reason: prerequisite-failed for an unbuilt publishable package', async () => {
    const rc = JSON.parse(STYNXRC_09) as { publicApi: { packageRoots: string[] } };
    rc.publicApi.packageRoots = ['packages'];
    const dir = workspace({ '.stynxrc.json': JSON.stringify(rc), 'packages/a/package.json': JSON.stringify({ name: '@demo/a', version: '1.0.0', type: 'module', scripts: { build: 'tsc' } }) });
    expect(await runNode(openapi, dir)).toMatchObject({ status: 'UNKNOWN', reason: 'prerequisite-failed', observed: 3, findings: [{ locator: 'packages/a/package.json:1' }] });
  });

  it('SKIPPED is inventory\'s: the B.19 population string when no app binding or public surface changed', async () => {
    const ctx = await contextOf(workspace(), { only: 'openapi' });
    expect(ctx.inventory!.populations.openapi).toEqual({ predicate: 'no app binding changed and no public-API surface changed', count: 0, skippable: true });
  });

  it('UNKNOWN tooling-missing without the binary; runner-crashed on a stynx exit 1 without JSON', async () => {
    expect(lines(await runNode(openapi, workspace({}, false)))).toEqual(['package.json:1 stynx not resolvable from node_modules/.bin [S-22] install with pnpm add -w -D @stynx-nyx/cli@3.0.0 && pnpm install']);
    const dir = workspace({}, false);
    mkdirSync(resolve(dir, 'node_modules/.bin'), { recursive: true });
    writeFileSync(resolve(dir, 'node_modules/.bin/stynx'), "#!/bin/sh\necho \"error: unknown option '--strict'\" >&2\nexit 1\n");
    chmodSync(resolve(dir, 'node_modules/.bin/stynx'), 0o755);
    const o = await runNode(openapi, dir);
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed', observed: 1 });
    expect(lines(o)[0]).toBe("package.json:1 stynx verify-api-coverage exited 1: error: unknown option '--strict' [S-22] the tool exited abnormally; re-run once, then put the output under ## Notes");
  });
});
