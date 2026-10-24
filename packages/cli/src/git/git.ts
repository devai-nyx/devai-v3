// The host `git` (07 §2 row git; no isomorphic-git, 07 §7), through the one spawner. Only the
// invocations 08 names: ls-files, ls-tree, cat-file --batch, show, rev-parse, merge-base
// --is-ancestor, diff --name-status --no-renames, log; B.27's `diff base..candidate` and its detached
// scratch worktree (worktree add --detach / remove). Paths are raw bytes in git's -z output and are
// decoded as UTF-8 (git's own default for path names on the hosts 12 pins).
import { spawn } from '../proc/spawn.js';

export class GitMissing extends Error {
  constructor() {
    super('git: not found on PATH; install git');
  }
}
export class GitFailed extends Error {
  constructor(readonly args: readonly string[], readonly code: number | null, readonly stderr: string) {
    super(`git ${args.join(' ')}: exit ${code}: ${stderr.trim().split('\n')[0] ?? ''}`);
  }
}

const GIT_MAX_BYTES = 1024 * 1024 * 1024;
const GIT_TIMEOUT_MS = 300_000;

/** Runs `git <args>` in `root` and resolves with stdout; a non-zero exit throws `GitFailed`. */
export async function git(root: string, args: readonly string[], opts: { stdin?: string } = {}): Promise<Buffer> {
  return (await gitMaybe(root, args, opts.stdin))!;
}

/** As `git`, but a plain non-zero exit resolves with null when `allowFail` (an answer, not an error). */
async function gitMaybe(root: string, args: readonly string[], stdin?: string, allowFail = false): Promise<Buffer | null> {
  const r = await spawn({
    argv: ['git', ...args],
    cwd: root,
    env: process.env,
    ...(stdin === undefined ? {} : { stdin }),
    maxBytes: GIT_MAX_BYTES,
    timeoutMs: GIT_TIMEOUT_MS,
  });
  if (r.kind === 'missing') throw new GitMissing();
  if (r.code === 0 && !r.overflow && !r.timedOut) return r.stdout;
  if (allowFail && !r.overflow && !r.timedOut) return null;
  throw new GitFailed(args, r.code, r.overflow ? 'output exceeded the bound' : r.timedOut ? 'timed out' : r.stderr.toString('utf8'));
}

const splitZ = (b: Buffer): string[] => {
  const s = b.toString('utf8');
  if (s === '') return [];
  const parts = s.split('\0');
  if (parts[parts.length - 1] === '') parts.pop();
  return parts;
};

export interface IndexEntry { mode: string; sha1: string; stage: number; path: string }
export interface TreeEntry { mode: string; type: string; sha1: string; path: string }
export interface NameStatus { status: string; path: string }

/** `git ls-files -z`: tracked paths. */
export const lsFilesTracked = async (root: string): Promise<string[]> => splitZ(await git(root, ['ls-files', '-z']));

/** `git ls-files -z --others --exclude-standard`: untracked, not ignored. */
export const lsFilesUntracked = async (root: string): Promise<string[]> =>
  splitZ(await git(root, ['ls-files', '-z', '--others', '--exclude-standard']));

/** `git ls-files --stage -z`: the index, with modes and blob names. */
export async function lsFilesStage(root: string): Promise<IndexEntry[]> {
  return splitZ(await git(root, ['ls-files', '--stage', '-z'])).map((line) => {
    const tab = line.indexOf('\t');
    const [mode, sha1, stage] = line.slice(0, tab).split(' ');
    return { mode: mode!, sha1: sha1!, stage: Number(stage), path: line.slice(tab + 1) };
  });
}

/** `git ls-tree -r -z <rev>`. */
export async function lsTree(root: string, rev: string): Promise<TreeEntry[]> {
  return splitZ(await git(root, ['ls-tree', '-r', '-z', '--full-tree', rev])).map((line) => {
    const tab = line.indexOf('\t');
    const [mode, type, sha1] = line.slice(0, tab).split(' ');
    return { mode: mode!, type: type!, sha1: sha1!, path: line.slice(tab + 1) };
  });
}

/** `git cat-file --batch`: object bytes by name, in request order. */
export async function catFileBatch(root: string, names: readonly string[]): Promise<Buffer[]> {
  if (names.length === 0) return [];
  const out = await git(root, ['cat-file', '--batch'], { stdin: names.join('\n') + '\n' });
  const blobs: Buffer[] = [];
  let at = 0;
  for (const name of names) {
    const nl = out.indexOf(0x0a, at);
    const header = out.subarray(at, nl).toString('utf8');
    if (header.endsWith(' missing')) throw new GitFailed(['cat-file', '--batch'], 1, `${name} missing`);
    const size = Number(header.split(' ')[2]);
    blobs.push(out.subarray(nl + 1, nl + 1 + size));
    at = nl + 1 + size + 1;
  }
  return blobs;
}

/** `git show <rev>:<path>`: the blob bytes, or null when the path does not exist at `rev`. */
export const show = (root: string, rev: string, path: string): Promise<Buffer | null> =>
  gitMaybe(root, ['show', `${rev}:${path}`], undefined, true);

/** `git rev-parse --verify --quiet <rev>^{commit}`: the commit sha1, or null. */
export async function revParse(root: string, rev: string): Promise<string | null> {
  const out = await gitMaybe(root, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`], undefined, true);
  return out === null ? null : out.toString('utf8').trim();
}

/** `git rev-parse --show-toplevel`, or null outside a work tree. */
export async function topLevel(dir: string): Promise<string | null> {
  const out = await gitMaybe(dir, ['rev-parse', '--show-toplevel'], undefined, true);
  return out === null ? null : out.toString('utf8').trim();
}

/** `git merge-base --is-ancestor <a> <b>`. */
export async function isAncestor(root: string, a: string, b: string): Promise<boolean> {
  return (await gitMaybe(root, ['merge-base', '--is-ancestor', a, b], undefined, true)) !== null;
}

/**
 * `git diff --name-status --no-renames -z` in its three forms: `{ cached: true }` (index vs HEAD),
 * `{ from }` (working tree vs `from`), `{ from, to }` (two commits).
 */
export async function diffNameStatus(root: string, range: { cached?: boolean; from?: string; to?: string; diffFilter?: string }): Promise<NameStatus[]> {
  const args = ['diff', '--name-status', '--no-renames', '-z'];
  if (range.diffFilter) args.push(`--diff-filter=${range.diffFilter}`);
  if (range.cached) args.push('--cached');
  if (range.from) args.push(range.from);
  if (range.to) args.push(range.to);
  args.push('--');
  const parts = splitZ(await git(root, args));
  const out: NameStatus[] = [];
  for (let i = 0; i + 1 < parts.length; i += 2) out.push({ status: parts[i]!, path: parts[i + 1]! });
  return out;
}

/** `git log <args>`: stdout as text (format and range are the caller's). */
export async function log(root: string, args: readonly string[]): Promise<string> {
  return (await git(root, ['log', ...args])).toString('utf8');
}

/** B.27 Inputs: the diff `base..candidate` (tracked paths, working tree against `base`) as patch text. */
export async function diffText(root: string, base: string): Promise<string> {
  return (await git(root, ['diff', '--no-color', '--no-ext-diff', '--no-renames', base, '--'])).toString('utf8');
}

/** B.27 phase 2: a detached worktree at `rev` in `dir` (the scratch copy's starting point). */
export async function worktreeAdd(root: string, dir: string, rev: string): Promise<void> {
  await git(root, ['worktree', 'add', '--detach', '--force', '--quiet', dir, rev]);
}

/** Removes a scratch worktree and its administrative files; a worktree already gone is not an error. */
export async function worktreeRemove(root: string, dir: string): Promise<void> {
  await gitMaybe(root, ['worktree', 'remove', '--force', dir], undefined, true);
  await gitMaybe(root, ['worktree', 'prune'], undefined, true);
}
