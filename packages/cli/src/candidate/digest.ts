// 08 C.6: the candidate digest, byte for byte, over one of three sources (working tree, staged index
// snapshot, a commit tree). `.devai/review/**` and `.devai/cache/**` are excluded (D-054, Astra N-13).
import { createHash } from 'node:crypto';
import { lstatSync, readFileSync, readlinkSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { catFileBatch, diffNameStatus, lsFilesStage, lsFilesUntracked, lsTree } from '../git/git.js';

export type Tag = 'F' | 'L' | 'G';
export interface Entry {
  tag: Tag;
  mode: '100644' | '100755' | '120000' | '160000';
  /** sha256 of content (F) or link target bytes (L); the recorded commit sha1 (G). */
  hash: string;
  path: string;
}
export interface Listing {
  base: string | null;
  entries: Entry[];
  deleted: string[];
  /** Working tree only: untracked-not-ignored paths, sorted (C.3 diagnostic, D-076). */
  untracked: string[];
}

/** C.6 `io`: an unreadable path or a symlink escaping the repository; never hashed as empty. */
export class CandidateIo extends Error {
  constructor(readonly path: string, why: string) {
    super(`${path}: ${why}`);
  }
}

export const sha256 = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex');

export const excluded = (path: string): boolean => path.startsWith('.devai/review/') || path.startsWith('.devai/cache/');

const byRawBytes = (a: string, b: string): number => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));

/** The C.6 byte string. */
export function frame(listing: Listing): Buffer {
  const parts: Buffer[] = [Buffer.from(`base ${listing.base ?? 'none'}\n`, 'utf8')];
  const pathField = (p: string) => {
    const bytes = Buffer.from(p, 'utf8');
    return Buffer.concat([Buffer.from(`${bytes.length}:`, 'utf8'), bytes, Buffer.from('\n', 'utf8')]);
  };
  for (const e of [...listing.entries].sort((a, b) => byRawBytes(a.path, b.path))) {
    parts.push(Buffer.from(`${e.tag} ${e.mode} ${e.hash} `, 'utf8'), pathField(e.path));
  }
  for (const d of [...new Set(listing.deleted)].sort(byRawBytes)) parts.push(Buffer.from('D ', 'utf8'), pathField(d));
  return Buffer.concat(parts);
}

export const digestOf = (listing: Listing): string => sha256(frame(listing));

/** Paths present in `git ls-tree -r <base>` and absent from `present`, same exclusions. */
async function baseDeletions(root: string, base: string | null, present: Set<string>): Promise<string[]> {
  if (base === null) return [];
  return (await lsTree(root, base)).map((t) => t.path).filter((p) => !excluded(p) && !present.has(p));
}

const escapes = (root: string, linkPath: string, target: Buffer): boolean => {
  const t = target.toString('utf8');
  const to = isAbsolute(t) ? resolve(t) : resolve(dirname(resolve(root, linkPath)), t);
  const rel = relative(root, to);
  return rel === '..' || rel.startsWith('../') || isAbsolute(rel);
};

/** Reads one working-tree path: an entry, `null` when absent from disk (a D entry), or `io`. */
function readWorkingPath(root: string, path: string): Entry | null {
  const abs = resolve(root, path);
  let st;
  try {
    st = lstatSync(abs);
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') return null;
    throw new CandidateIo(path, `unreadable (${code ?? 'error'})`);
  }
  try {
    if (st.isSymbolicLink()) {
      const target = readlinkSync(abs, { encoding: 'buffer' });
      if (escapes(root, path, target)) throw new CandidateIo(path, `symlink target ${target.toString('utf8')} escapes the repository`);
      return { tag: 'L', mode: '120000', hash: sha256(target), path };
    }
    if (st.isFile()) return { tag: 'F', mode: st.mode & 0o100 ? '100755' : '100644', hash: sha256(readFileSync(abs)), path };
    if (st.isDirectory()) return null;
  } catch (e) {
    if (e instanceof CandidateIo) throw e;
    throw new CandidateIo(path, `unreadable (${(e as NodeJS.ErrnoException).code ?? 'error'})`);
  }
  throw new CandidateIo(path, 'not a regular file, symlink or gitlink');
}

/** Working tree: `git ls-files` ∪ `git ls-files --others --exclude-standard`, content read from disk. */
export async function workingTree(root: string, base: string | null): Promise<Listing> {
  const index = await lsFilesStage(root);
  const untracked = (await lsFilesUntracked(root)).filter((p) => !excluded(p));
  const entries: Entry[] = [];
  const deleted: string[] = [];
  const seen = new Set<string>();
  for (const ie of index) {
    if (excluded(ie.path) || seen.has(ie.path)) continue;
    seen.add(ie.path);
    if (ie.mode === '160000') {
      entries.push({ tag: 'G', mode: '160000', hash: ie.sha1, path: ie.path });
      continue;
    }
    const e = readWorkingPath(root, ie.path);
    if (e === null) deleted.push(ie.path);
    else entries.push(e);
  }
  for (const p of untracked) {
    if (p.endsWith('/')) throw new CandidateIo(p, 'untracked nested repository');
    const e = readWorkingPath(root, p);
    if (e !== null) entries.push(e);
  }
  const present = new Set(entries.map((e) => e.path));
  deleted.push(...(await baseDeletions(root, base, present)));
  return { base, entries, deleted, untracked: [...untracked].sort(byRawBytes) };
}

const entryFromBlob = (mode: string, sha1: string, path: string, bytes: Buffer | undefined): Entry => {
  if (mode === '160000') return { tag: 'G', mode: '160000', hash: sha1, path };
  if (mode === '120000') return { tag: 'L', mode: '120000', hash: sha256(bytes!), path };
  return { tag: 'F', mode: mode === '100755' ? '100755' : '100644', hash: sha256(bytes!), path };
};

async function fromObjects(root: string, base: string | null, rows: { mode: string; sha1: string; path: string }[], extraDeleted: string[]): Promise<Listing> {
  const kept = rows.filter((r) => !excluded(r.path));
  const blobRows = kept.filter((r) => r.mode !== '160000');
  const blobs = await catFileBatch(root, blobRows.map((r) => r.sha1));
  const byPath = new Map(blobRows.map((r, i) => [r.path, blobs[i]]));
  const entries = kept.map((r) => entryFromBlob(r.mode, r.sha1, r.path, byPath.get(r.path)));
  const present = new Set(entries.map((e) => e.path));
  const deleted = [...extraDeleted.filter((p) => !excluded(p) && !present.has(p)), ...(await baseDeletions(root, base, present))];
  return { base, entries, deleted, untracked: [] };
}

/** Staged (`--hook pre-commit`): `git ls-files --stage -z`, index blobs, `git diff --cached --diff-filter=D`. */
export async function staged(root: string, base: string | null): Promise<Listing> {
  const index = await lsFilesStage(root);
  const unmerged = index.find((e) => e.stage !== 0);
  if (unmerged) throw new CandidateIo(unmerged.path, 'unmerged index entry');
  const removed = (await diffNameStatus(root, { cached: true, diffFilter: 'D' })).map((d) => d.path);
  return fromObjects(root, base, index, removed);
}

/** Commit (CI, `packets status`): `git ls-tree -r <commit>`. */
export async function commitTree(root: string, commit: string, base: string | null): Promise<Listing> {
  return fromObjects(root, base, await lsTree(root, commit), []);
}
