// Temporary git repositories for the W1 tests (digest vectors, inventory, `devai check` end to end).
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, renameSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { templateConfig } from './fixtures.js';

export const gitIn = (dir: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.name=devai-test', '-c', 'user.email=test@devai.local', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8' });

export function tempRepo(prefix = 'devai-w1-'): string {
  const dir = mkdtempSync(resolve(tmpdir(), prefix));
  gitIn(dir, 'init', '-q', '-b', 'main');
  return dir;
}

export function write(dir: string, path: string, content: string | Buffer): void {
  mkdirSync(dirname(resolve(dir, path)), { recursive: true });
  writeFileSync(resolve(dir, path), content);
}

export const commitAll = (dir: string, message = 'c'): string => {
  gitIn(dir, 'add', '-A');
  gitIn(dir, 'commit', '-q', '-m', message);
  return gitIn(dir, 'rev-parse', 'HEAD').trim();
};

export const templateDir = resolve(import.meta.dirname, '../template');

/**
 * The template files the node fixtures were written against: the fixed-byte rows (09 §1.1). The rendered
 * rows (shells, tier config, SQL, workflow; R6 W7) carry init's product tokens and are exercised by
 * init.test.ts instead.
 */
const FIXTURE_FILES = ['.agents', '.stynxrc.json', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'compose.yaml', 'database/README.md', 'gitignore', 'packets', 'product', 'scripts/hooks', 'specs'];

/** Copies `FIXTURE_FILES` into `dir`, `gitignore` written as `.gitignore` (D-074). */
export function copyFixtureTemplate(dir: string): void {
  for (const f of FIXTURE_FILES) cpSync(resolve(templateDir, f), resolve(dir, f), { recursive: true });
  renameSync(resolve(dir, 'gitignore'), resolve(dir, '.gitignore'));
}

/** A workspace carrying the template's fixed files (09 §1.1) plus a minimal root manifest and `apps/api`, committed. */
export function templateWorkspace(extra: Record<string, string> = {}): string {
  const dir = tempRepo('devai-w1-ws-');
  copyFixtureTemplate(dir);
  write(dir, 'package.json', JSON.stringify({ name: 'demo', private: true, type: 'module', engines: { node: '>=24 <25', pnpm: '>=9 <10' }, packageManager: 'pnpm@9.15.0' }, null, 2) + '\n');
  // 09 §1.1's `apps/*` glob with one real package (D-084 item 7: a glob matching no package is FAIL).
  write(dir, 'pnpm-workspace.yaml', "packages:\n  - 'apps/*'\n");
  write(dir, 'apps/api/package.json', JSON.stringify({ name: '@demo/api', private: true, type: 'module' }, null, 2) + '\n');
  write(dir, 'devai.json', JSON.stringify(templateConfig(), null, 2) + '\n');
  for (const [p, c] of Object.entries(extra)) write(dir, p, c);
  commitAll(dir, 'chore(template): devai init demo');
  return dir;
}
