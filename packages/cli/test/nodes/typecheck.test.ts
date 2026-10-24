// 08 B.5 `typecheck`: `tsc -b --verbose --pretty false` (TypeScript 6.0.3, `@stynx-nyx/tsconfig` 3.0.0
// node24 preset) over the affected project closure from `inventory`.
import { chmodSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { workingTree } from '../../src/candidate/digest.js';
import { typecheck } from '../../src/nodes/typecheck.js';
import { plan } from '../../src/runner/plan.js';
import type { RunContext } from '../../src/runner/run.js';
import { templateConfig } from '../fixtures.js';
import { templateWorkspace, write } from '../repo.js';
import { linkToolchain, runOnly } from './w2b.js';

const TSCONFIG = (refs: string[] = []) => JSON.stringify({ extends: '@stynx-nyx/tsconfig/node24.json', compilerOptions: { rootDir: 'src', outDir: 'dist', composite: true }, include: ['src'], ...(refs.length ? { references: refs.map((path) => ({ path })) } : {}) });

function workspace(): string {
  const dir = templateWorkspace({
    'pnpm-workspace.yaml': "packages:\n  - 'apps/*'\n  - 'packages/*'\n",
    'packages/a/package.json': JSON.stringify({ name: '@demo/a', type: 'module' }),
    'packages/a/tsconfig.json': TSCONFIG(),
    'packages/a/src/index.ts': 'export const a: number = 1;\n',
    'apps/api/tsconfig.json': TSCONFIG(['../../packages/a']),
    'apps/api/src/main.ts': 'export const main = (): string => "ok";\n',
  });
  linkToolchain(dir, { tsc: true, stynx: false });
  return dir;
}

describe('B.5 typecheck', () => {
  it('PASS: the affected project and its references, each named by --verbose with a tsbuildinfo', async () => {
    const dir = workspace();
    write(dir, 'apps/api/src/main.ts', 'export const main = (): string => "changed";\n');
    const { row, rows } = await runOnly(dir, 'typecheck');
    expect(rows[0]!.status).toBe('PASS');
    expect(row).toMatchObject({ status: 'PASS', expected: 2, observed: 2, evaluated: 2, findings: [] });
  });

  it('FAIL: one finding per diagnostic; TS7006 maps to S-33, the rest to S-32', async () => {
    const dir = workspace();
    write(dir, 'apps/api/src/main.ts', 'const x: string = 1;\nexport const y = (z) => z;\n');
    const { row } = await runOnly(dir, 'typecheck');
    expect(row.status).toBe('FAIL');
    expect(row.findings).toEqual([
      { locator: 'apps/api/src/main.ts:1:7', message: "TS2322: Type 'number' is not assignable to type 'string'.", standard: 'S-32', hint: 'fix the type, not the config' },
      { locator: 'apps/api/src/main.ts:2:19', message: "TS7006: Parameter 'z' implicitly has an 'any' type.", standard: 'S-33', hint: 'type the value or parse it with zod' },
    ]);
  });

  it('SKIPPED with "no affected project" when no TypeScript file changed', async () => {
    const { row } = await runOnly(workspace(), 'typecheck');
    expect(row).toMatchObject({ status: 'SKIPPED', evidence: 'no affected project' });
  });

  const direct = async (dir: string): Promise<RunContext> => ({
    root: dir, config: templateConfig(), runtime: 'bare', cliVersion: '3.0.0', listing: await workingTree(dir, null), base: null, head: 'b'.repeat(40),
    plan: plan({ packet: false, full: false, only: ['typecheck'] }),
    inventory: { toolchainDigest: 'a'.repeat(64), populations: {} as never, changed: ['apps/api/src/main.ts'], mounts: { apps: [], controllers: [], read: [], unresolved: [] }, projects: ['apps/api/tsconfig.json', 'packages/a/tsconfig.json'], packageDirs: ['apps/api', 'packages/a'] },
  });

  it('UNKNOWN tooling-missing when tsc is not in node_modules/.bin', async () => {
    const dir = templateWorkspace({ 'apps/api/tsconfig.json': TSCONFIG(), 'packages/a/tsconfig.json': TSCONFIG() });
    const o = await typecheck.run(await direct(dir));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing' });
    expect(o.findings[0]).toEqual({ locator: 'apps/api/tsconfig.json:1', message: 'tsc not resolvable from node_modules/.bin', standard: 'S-31', hint: 'install with pnpm install' });
  });

  it('UNKNOWN runner-crashed on a non-diagnostic crash (D-086), stderr first line as message', async () => {
    const dir = workspace();
    const p = resolve(dir, 'node_modules/.bin/tsc');
    writeFileSync(p, '#!/bin/sh\necho "FATAL ERROR: heap out of memory" >&2\nexit 134\n');
    chmodSync(p, 0o755);
    const o = await typecheck.run(await direct(dir));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed' });
    expect(o.findings[0]).toMatchObject({ message: 'FATAL ERROR: heap out of memory' });
  });

  it('FAIL: an affected project whose effective module is commonjs (B.5 Status)', async () => {
    const dir = workspace();
    write(dir, 'apps/api/tsconfig.json', JSON.stringify({ extends: '@stynx-nyx/tsconfig/node24.json', compilerOptions: { rootDir: 'src', outDir: 'dist', composite: true, module: 'commonjs', moduleResolution: 'node10', ignoreDeprecations: '6.0' }, include: ['src'] }));
    const o = await typecheck.run(await direct(dir));
    expect(o.status).toBe('FAIL');
    expect(o.findings).toContainEqual({ locator: 'apps/api/tsconfig.json:1', message: 'emits commonjs', standard: 'S-31', hint: 'set module: NodeNext' });
  });
});
