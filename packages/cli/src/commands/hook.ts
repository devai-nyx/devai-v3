// 08 A.7 `--hook pre-commit|pre-push|commit-msg`: the staged snapshot pre-commit checks, the fetched
// base pre-push reads from its stdin ref lines, and the 10 §4 stage line printed before `exit <code>`.
import { existsSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Listing } from '../candidate/digest.js';
import { git, isAncestor, mergeBase, revParse } from '../git/git.js';
import type { Report } from '../report.js';
import { byDag } from '../runner/edges.js';
import type { HookStage } from '../runner/plan.js';

export const HOOK_STAGES: readonly HookStage[] = ['pre-commit', 'pre-push', 'commit-msg'];

/**
 * A.7: `git checkout-index -a -f --prefix=.devai/cache/scratch/staged-<digest>/` plus symlinked
 * `node_modules` (the root's and each package folder's), so tools see the whole project as staged.
 * Returns the copy's absolute path; the caller removes it after the last consumer (C.1 step 10).
 */
export async function materialiseStaged(root: string, listing: Listing, digest: string): Promise<string> {
  const rel = `.devai/cache/scratch/staged-${digest}`;
  const dir = resolve(root, rel);
  rmSync(dir, { recursive: true, force: true });
  await git(root, ['checkout-index', '-a', '-f', `--prefix=${rel}/`]);
  const folders = ['.', ...listing.entries.filter((e) => e.path.endsWith('/package.json')).map((e) => dirname(e.path))];
  for (const f of folders) {
    const from = resolve(root, f, 'node_modules');
    const to = resolve(dir, f, 'node_modules');
    if (existsSync(from) && existsSync(resolve(dir, f)) && !existsSync(to)) symlinkSync(from, to);
  }
  return dir;
}

const ZERO = /^0+$/;

/**
 * A.7: per stdin line `<local ref> <local sha> <remote ref> <remote sha>` (the first that is not a
 * deletion), the fetched base is `<remote sha>` when non-zero and an ancestor of `<local sha>`, else
 * `git merge-base <local sha> refs/remotes/origin/HEAD`; null when unresolvable.
 */
export async function fetchedBase(root: string, stdin: string): Promise<string | null> {
  const line = stdin.split('\n').map((l) => l.trim().split(/\s+/)).find((f) => f.length === 4 && !ZERO.test(f[1]!));
  if (!line) return null;
  const [, local, , remote] = line as [string, string, string, string];
  if (!ZERO.test(remote) && (await revParse(root, remote)) !== null && (await isAncestor(root, remote, local))) return remote;
  return mergeBase(root, local, 'refs/remotes/origin/HEAD');
}

/** A.7 pre-push: `database/**`, `domain/*\/db/**` or `*.repository.ts` changed since the fetched base. */
export const dataLayerChanged = (changed: readonly string[]): boolean =>
  changed.some((p) => p.startsWith('database/') || /^domain\/[^/]+\/db\//.test(p) || p.endsWith('.repository.ts'));

const abbrev = (sha: string | null): string => (sha === null ? 'none' : sha.slice(0, 7));

/** 10 §4 stage lines (FAIL with UNKNOWN prints FAIL, E-6-03). */
export function stageLine(stage: HookStage, report: Report): string {
  const status = report.exitCode === 0 ? 'PASS' : report.exitCode === 1 ? 'FAIL' : 'UNKNOWN';
  const unknownRow = report.nodes.filter((n) => n.status === 'UNKNOWN' && n.id !== 'accept').sort((a, b) => byDag(a.id, b.id))[0];
  const cause = unknownRow ? `${unknownRow.id}: ${unknownRow.reason}` : `devai: ${report.reason ?? report.nodes.find((n) => n.id === 'accept')?.reason ?? 'runner-crashed'}`;
  switch (stage) {
    case 'pre-commit':
      if (status === 'PASS') return 'devai pre-commit PASS — format lint lint-tests sql-lint on the staged snapshot';
      if (status === 'FAIL') return 'devai pre-commit FAIL — fix the lines above, git add, commit again; CI runs the same nodes';
      return `devai pre-commit UNKNOWN — ${cause}; do the remedy above, then commit again`;
    case 'pre-push':
      if (status === 'PASS') return `devai pre-push PASS — ${report.nodes.length} nodes over ${abbrev(report.base)}..${abbrev(report.head)}`;
      if (status === 'FAIL') return 'devai pre-push FAIL — fix the lines above, commit, push again; CI runs the same nodes';
      return `devai pre-push UNKNOWN — ${cause}; do the remedy above, then push again`;
    case 'commit-msg':
      if (status === 'PASS') return 'devai commit-msg PASS';
      if (status === 'FAIL') return 'devai commit-msg FAIL — write type(scope): subject, scope = package or module slug; keep the trailers';
      return `devai commit-msg UNKNOWN — commitlint: ${report.nodes.find((n) => n.id === 'commitlint')?.reason ?? report.reason ?? unknownRow?.reason ?? 'runner-crashed'}; do the remedy above, then commit again`;
  }
}
