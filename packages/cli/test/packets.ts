// Packet fixtures for the W4 tests: a packet text builder over 05 §7's shape and a committed template
// workspace whose packets pin the shipped fixture spec at a real `base`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256 } from '../src/candidate/digest.js';
import { commitAll, gitIn, templateWorkspace, write } from './repo.js';

export const SPEC_PATH = 'specs/notes/SPEC-DEMO-001.md';
export const PACKET = 'packets/CMP-DEMO-001/PKT-DEMO-005.md';

export interface PacketFields {
  id?: string;
  title?: string;
  kind?: string;
  spec?: string | null;
  base?: string;
  extra?: string;
  allowed?: string[];
  forbidden?: string[];
  protected?: string[];
  unimplemented?: string[];
  body?: string;
}

/** A packet text; `spec` is the YAML of the spec block (null omits it). */
export function packetText(f: PacketFields & { sha?: string }): string {
  const id = f.id ?? 'PKT-DEMO-005';
  const spec = f.spec === undefined ? `spec:\n  id: SPEC-DEMO-001\n  path: ${SPEC_PATH}\n  sha256: "${f.sha ?? 'a'.repeat(64)}"\n` : f.spec === null ? '' : f.spec;
  const allowed = f.allowed ?? ['domain/notes/api/src/**', `packets/CMP-DEMO-001/${id}.md`];
  const fm = [
    `id: ${id}`,
    `title: ${f.title ?? 'Implement note creation'}`,
    `kind: ${f.kind ?? 'code'}`,
    spec.replace(/\n$/, ''),
    `base: ${f.base ?? 'b'.repeat(40)}`,
    ...(f.extra ? [f.extra.replace(/\n$/, '')] : []),
    'paths:',
    '  allowed:',
    ...allowed.map((g) => `    - ${g}`),
    ...(f.forbidden ? ['  forbidden:', ...f.forbidden.map((g) => `    - ${g}`)] : []),
    `protected: [${(f.protected ?? []).join(', ')}]`,
    'observations:',
    `  unimplemented: [${(f.unimplemented ?? []).join(', ')}]`,
  ].filter((l) => l !== '');
  return `---\n${fm.join('\n')}\n---\n\n${f.body ?? '## Intent\n\nNotes can be created.\n\n## Deliverables\n\n- R-1\n'}`;
}

/** The template workspace (09 §1.1 fixed files), committed; `sha` is the shipped spec's digest. */
export function packetWorkspace(): { dir: string; base: string; sha: string } {
  const dir = templateWorkspace();
  const base = gitIn(dir, 'rev-parse', 'HEAD').trim();
  const sha = sha256(readFileSync(resolve(dir, SPEC_PATH)));
  return { dir, base, sha };
}

/** Writes and commits a packet (its introducing commit), returning that commit. */
export function commitPacket(dir: string, text: string, path = PACKET, message = 'chore(packets): add PKT-DEMO-005'): string {
  write(dir, path, text);
  return commitAll(dir, message);
}

export { write };
