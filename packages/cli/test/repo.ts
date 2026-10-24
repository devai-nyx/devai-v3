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

/** A workspace carrying the template's fixed files (09 §1.1) plus a minimal root manifest, committed. */
export function templateWorkspace(extra: Record<string, string> = {}): string {
  const dir = tempRepo('devai-w1-ws-');
  cpSync(templateDir, dir, { recursive: true, verbatimSymlinks: true });
  renameSync(resolve(dir, 'gitignore'), resolve(dir, '.gitignore'));
  write(dir, 'package.json', JSON.stringify({ name: 'demo', private: true, type: 'module', engines: { node: '>=24 <25', pnpm: '>=9 <10' }, packageManager: 'pnpm@9.15.0' }, null, 2) + '\n');
  write(dir, 'pnpm-workspace.yaml', 'packages: []\n');
  write(dir, 'devai.json', JSON.stringify(templateConfig(), null, 2) + '\n');
  for (const [p, c] of Object.entries(extra)) write(dir, p, c);
  commitAll(dir, 'chore(template): devai init demo');
  return dir;
}
