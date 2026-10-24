// Fixtures for the W2a tool adapters (helpers.ts is W2c's): the 07 §2 pins installed once from the registry into a shared
// temp folder (one install for every test file, under a mkdir lock), temp workspaces that link it as
// `node_modules`, fake binaries for the crash cases, and a RunContext built the way `devai check` does.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { workingTree } from '../../src/candidate/digest.js';
import type { DevaiConfig } from '../../src/config.js';
import { runInventory } from '../../src/nodes/inventory.js';
import { plan } from '../../src/runner/plan.js';
import type { NodeId } from '../../src/runner/edges.js';
import type { RunContext } from '../../src/runner/run.js';
import { templateConfig } from '../fixtures.js';
import { commitAll, gitIn, tempRepo, write } from '../repo.js';

/** 07 §2 pins for format, lint, lint-tests, i18n, actionlint, commitlint (and `tsc` for inventory). */
export const PINS = [
  'prettier@3.9.6', 'eslint@10.10.0', '@stynx-nyx/eslint-config@3.0.0', 'typescript@6.0.3',
  '@angular-eslint/eslint-plugin-template@22.0.0', '@angular-eslint/template-parser@22.0.0',
  'github-actionlint@1.7.12', '@commitlint/cli@21.2.2', '@commitlint/config-conventional@21.2.2',
];

export const templateDir = resolve(import.meta.dirname, '../../template');
const repoRoot = resolve(import.meta.dirname, '../../../..');
const sleep = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

/** The shared install, created on first use; returns its `node_modules`. */
export function toolModules(): string {
  const dir = resolve(tmpdir(), `devai-w2a-tools-${createHash('sha256').update(PINS.join(' ')).digest('hex').slice(0, 12)}`);
  const done = resolve(dir, '.done');
  const lock = `${dir}.lock`;
  for (let waited = 0; !existsSync(done); waited += 500) {
    try {
      mkdirSync(lock);
    } catch {
      if (waited > 300_000) throw new Error(`timed out waiting for ${lock}`);
      sleep(500);
      continue;
    }
    try {
      if (!existsSync(done)) {
        rmSync(dir, { recursive: true, force: true });
        mkdirSync(dir, { recursive: true });
        writeFileSync(resolve(dir, 'package.json'), JSON.stringify({ name: 'devai-w2a-tools', private: true, type: 'module' }));
        writeFileSync(resolve(dir, '.npmrc'), readFileSync(resolve(repoRoot, '.npmrc')));
        execFileSync('pnpm', ['add', '-D', '--save-exact', ...PINS], { cwd: dir, stdio: 'pipe', env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' } });
        writeFileSync(done, '');
      }
    } finally {
      rmSync(lock, { recursive: true, force: true });
    }
  }
  return resolve(dir, 'node_modules');
}

export const ROOT_PACKAGE = JSON.stringify({ name: 'demo', private: true, type: 'module', engines: { node: '>=24 <25', pnpm: '>=9 <10' }, packageManager: 'pnpm@9.15.0' }, null, 2) + '\n';

/**
 * A committed workspace with `base` files, then `changes` written (uncommitted, hence "changed" per
 * A.3's edit-loop base). `modules`: the shared install, a fake `.bin` folder, or none (tooling hidden).
 */
export function workspace(base: Record<string, string>, changes: Record<string, string> = {}, modules: string | null = toolModules(), template = false): string {
  const dir = tempRepo('devai-w2a-');
  if (template) {
    cpSync(templateDir, dir, { recursive: true, verbatimSymlinks: true });
    renameSync(resolve(dir, 'gitignore'), resolve(dir, '.gitignore'));
  }
  write(dir, 'package.json', ROOT_PACKAGE);
  // 09 §1.1's `apps/*` glob with one real package (D-084 item 7: a glob matching no package is FAIL).
  write(dir, 'pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n");
  write(dir, 'apps/api/package.json', JSON.stringify({ name: '@demo/api', private: true, type: 'module' }, null, 2) + '\n');
  write(dir, 'devai.json', JSON.stringify(templateConfig(), null, 2) + '\n');
  for (const [p, c] of Object.entries(base)) write(dir, p, c);
  writeFileSync(resolve(dir, '.git/info/exclude'), 'node_modules\n');
  if (modules) symlinkSync(modules, resolve(dir, 'node_modules'));
  commitAll(dir, 'chore: base');
  for (const [p, c] of Object.entries(changes)) write(dir, p, c);
  return dir;
}

/** A `node_modules/.bin/<bin>` that writes `stderr` and exits `code` with empty stdout. */
export function fakeTool(bin: string, code = 2, stderr = 'boom: the tool fell over'): string {
  const dir = resolve(tempRepo('devai-w2a-fake-'), 'node_modules');
  mkdirSync(resolve(dir, '.bin'), { recursive: true });
  writeFileSync(resolve(dir, '.bin', bin), `#!/bin/sh\necho '${stderr}' >&2\nexit ${code}\n`);
  chmodSync(resolve(dir, '.bin', bin), 0o755);
  return dir;
}

/** The RunContext `devai check --only <id>` builds, with inventory's data from the real node. */
export async function contextOf(dir: string, id: NodeId, base: string | null = null, config: DevaiConfig = templateConfig()): Promise<RunContext> {
  const ctx: RunContext = {
    root: dir, config, runtime: 'bare', cliVersion: '3.0.0', listing: await workingTree(dir, base), base,
    head: gitIn(dir, 'rev-parse', 'HEAD').trim(), plan: plan({ packet: false, full: false, only: [id] }),
  };
  ctx.inventory = (await runInventory(ctx)).data;
  return ctx;
}

const bin = resolve(import.meta.dirname, '../../dist/main.js');
/** `devai check --only <id> --format json` on the built binary (D-057). */
export const devaiCheck = (cwd: string, id: NodeId) =>
  spawnSync(process.execPath, [bin, 'check', '--only', id, '--format', 'json'], { cwd, encoding: 'utf8', env: { ...process.env, DEVAI_RUNTIME: '' } });

export { write };
