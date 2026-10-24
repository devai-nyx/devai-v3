// 08 C.6 vectors over a tiny repository: the byte string by hand, the three sources agreeing on a
// committed tree, untracked and ignored files, deletions, exclusions and `io`.
import { createHash } from 'node:crypto';
import { chmodSync, rmSync, symlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CandidateIo, commitTree, digestOf, frame, staged, workingTree } from '../src/candidate/digest.js';
import { commitAll, gitIn, tempRepo, write } from './repo.js';

const h = (s: string) => createHash('sha256').update(s).digest('hex');

function tiny(): { dir: string; head: string } {
  const dir = tempRepo();
  write(dir, 'b.txt', 'bee\n');
  write(dir, 'a/x.sh', '#!/bin/sh\n');
  chmodSync(resolve(dir, 'a/x.sh'), 0o755);
  symlinkSync('../b.txt', resolve(dir, 'a/link'));
  write(dir, '.gitignore', '.DS_Store\n');
  write(dir, '.devai/review/PKT-DEMO-001.json', '{}\n');
  const head = commitAll(dir);
  return { dir, head };
}

describe('candidate digest (C.6)', () => {
  it('frames entries by raw path bytes, F/L tags, modes, sha256 and <len>:<path>', async () => {
    const { dir } = tiny();
    const listing = await workingTree(dir, null);
    const expected =
      'base none\n' +
      `F 100644 ${h('.DS_Store\n')} 10:.gitignore\n` +
      `L 120000 ${h('../b.txt')} 6:a/link\n` +
      `F 100755 ${h('#!/bin/sh\n')} 6:a/x.sh\n` +
      `F 100644 ${h('bee\n')} 5:b.txt\n`;
    expect(frame(listing).toString('utf8')).toBe(expected);
    expect(digestOf(listing)).toBe(h(expected));
  });

  it('the three sources agree on a committed tree', async () => {
    const { dir, head } = tiny();
    const wt = digestOf(await workingTree(dir, null));
    expect(digestOf(await staged(dir, null))).toBe(wt);
    expect(digestOf(await commitTree(dir, head, null))).toBe(wt);
  });

  it('an untracked file changes the working-tree digest; a .DS_Store ignored by the template gitignore does not', async () => {
    const { dir, head } = tiny();
    const clean = digestOf(await workingTree(dir, null));
    write(dir, '.DS_Store', 'junk');
    write(dir, 'a/.DS_Store', 'junk');
    expect(digestOf(await workingTree(dir, null))).toBe(clean);
    write(dir, 'notes.md', 'stray\n');
    const listing = await workingTree(dir, null);
    expect(digestOf(listing)).not.toBe(clean);
    expect(listing.untracked).toEqual(['notes.md']);
    expect(digestOf(await commitTree(dir, head, null))).toBe(clean);
  });

  it('excludes .devai/review/** and .devai/cache/**', async () => {
    const { dir } = tiny();
    const clean = digestOf(await workingTree(dir, null));
    write(dir, '.devai/review/PKT-DEMO-001.json', '{"changed":true}\n');
    write(dir, '.devai/cache/reports/x.json', '{}\n');
    expect(digestOf(await workingTree(dir, null))).toBe(clean);
  });

  it('a tracked path missing from disk is a D entry, and base paths absent now are D entries', async () => {
    const { dir, head } = tiny();
    rmSync(resolve(dir, 'b.txt'));
    const listing = await workingTree(dir, head);
    expect(frame(listing).toString('utf8')).toMatch(new RegExp(`^base ${head}\\n`));
    expect(frame(listing).toString('utf8').endsWith('D 5:b.txt\n')).toBe(true);
    gitIn(dir, 'rm', '-q', '--cached', 'b.txt');
    expect(frame(await staged(dir, head)).toString('utf8').endsWith('D 5:b.txt\n')).toBe(true);
  });

  it('the base sha1 is part of the digest', async () => {
    const { dir, head } = tiny();
    expect(digestOf(await workingTree(dir, head))).not.toBe(digestOf(await workingTree(dir, null)));
  });

  it('a symlink whose target escapes the repository is io, never hashed', async () => {
    const { dir } = tiny();
    symlinkSync('../../outside', resolve(dir, 'a/escape'));
    await expect(workingTree(dir, null)).rejects.toBeInstanceOf(CandidateIo);
  });

  it('the staged source reads index bytes, not the disk', async () => {
    const { dir } = tiny();
    write(dir, 'b.txt', 'edited\n');
    const before = digestOf(await staged(dir, null));
    gitIn(dir, 'add', 'b.txt');
    expect(digestOf(await staged(dir, null))).not.toBe(before);
    expect(digestOf(await staged(dir, null))).toBe(digestOf(await workingTree(dir, null)));
  });
});
