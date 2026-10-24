// 05 §2 the packet file: one closed YAML front-matter block plus the four literal `##` sections, read
// with `yaml` 2.9.0 and checked by the static pre-DAG rules of 05 §5 (PL-01, PL-02, PL-03, PL-06): the
// ones that need no git. Every message is 05 §5's, verbatim where 05 gives one; the forms 05 leaves
// open are the PR's `## Open` items. A violation is a `PacketInvalid` (exit 2 `packet-invalid`).
import { basename } from 'node:path';
import ignore from 'ignore';
import { isMap, isScalar, LineCounter, parseDocument, type Document } from 'yaml';
import { ProtectedClass } from '../config.js';
import type { Kind } from '../nodes/accept.js';

export const KINDS: readonly Kind[] = ['spec', 'generate', 'test', 'code', 'fix', 'standards'];
/** Kinds that pin a spec digest (05 §2 `spec.sha256`). */
export const PINNING: readonly Kind[] = ['generate', 'test', 'code', 'fix'];
export const PACKET_ID = /^PKT-[A-Z0-9]+-\d{3}$/;
export const SECTIONS = ['Intent', 'Deliverables', 'Notes', 'Review dispositions'] as const;
const REQUIRED_SECTIONS: readonly string[] = ['Intent', 'Deliverables'];
/** 08 A.4: the placeholder `devai packet new` renders, visible to PL-01 as blank. */
export const TITLE_PLACEHOLDER = '<title>';

export interface ContextEntry { path: string; lines: string; why: string }

export interface Packet {
  /** Repo-relative path of the file. */
  path: string;
  text: string;
  id: string;
  title: string;
  kind: Kind;
  spec: { id: string; path: string; sha256: string | null } | null;
  base: string;
  after: string[];
  supersedes: string | null;
  allowed: string[];
  forbidden: string[];
  protected: string[];
  context: ContextEntry[];
  unimplemented: string[];
  /** `## Review dispositions` lines, with their 1-based file line. */
  dispositions: { line: number; text: string }[];
  /** 1-based file line of a front-matter key path (the nearest existing ancestor). */
  lineOf: (path: readonly (string | number)[]) => number;
  /** Line count of the file (PL-14). */
  lines: number;
}

/** A pre-DAG violation: exit 2 with `reason` and 05 §5's one-line message. */
export class PacketInvalid extends Error {
  constructor(readonly reason: 'packet-invalid' | 'base-not-ancestor', message: string, readonly rule: string) {
    super(message);
  }
}

const invalid = (rule: string, message: string) => new PacketInvalid('packet-invalid', message, rule);

const FIELDS: Record<string, readonly string[]> = {
  '': ['id', 'title', 'kind', 'spec', 'base', 'after', 'supersedes', 'paths', 'protected', 'context', 'observations'],
  spec: ['id', 'path', 'sha256'],
  paths: ['allowed', 'forbidden'],
  observations: ['unimplemented'],
  context: ['path', 'lines', 'why'],
};
const REQUIRED: readonly string[] = ['id', 'title', 'kind', 'base', 'paths', 'protected', 'observations'];

const isBlank = (v: unknown): boolean => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const lineCount = (text: string): number => (text === '' ? 0 : text.replace(/\n$/, '').split('\n').length);

/** The front matter (`---` … `---`) and the body, with the body's first file line. */
function split(text: string): { yaml: string; bodyStart: number; body: string[] } | null {
  const lines = text.split('\n');
  if (lines[0] !== '---') return null;
  const end = lines.indexOf('---', 1);
  if (end < 0) return null;
  return { yaml: lines.slice(1, end).join('\n'), bodyStart: end + 2, body: lines.slice(end + 1) };
}

/** PL-01: `## ` headings outside code fences, the four of 05 §2 in order, the two required present. */
function sections(path: string, body: string[], bodyStart: number): { name: string; line: number; lines: { line: number; text: string }[] }[] {
  const out: { name: string; line: number; lines: { line: number; text: string }[] }[] = [];
  let fence: string | null = null;
  body.forEach((l, i) => {
    const f = /^(`{3,}|~{3,})/.exec(l);
    if (f) fence = fence === null ? f[1]! : l.startsWith(fence) ? null : fence;
    const h = fence === null ? /^## (.+?)\s*$/.exec(l) : null;
    if (h) out.push({ name: h[1]!, line: bodyStart + i, lines: [] });
    else if (out.length > 0) out[out.length - 1]!.lines.push({ line: bodyStart + i, text: l });
  });
  const known = out.filter((s) => (SECTIONS as readonly string[]).includes(s.name));
  const seen = new Set<string>();
  let last = -1;
  for (const s of known) {
    if (seen.has(s.name)) throw invalid('PL-01', `packet invalid: ${path}:${s.line} duplicate '## ${s.name}'`);
    seen.add(s.name);
    const at = (SECTIONS as readonly string[]).indexOf(s.name);
    if (at < last) throw invalid('PL-01', `packet invalid: ${path}:${s.line} '## ${s.name}' out of order`);
    last = at;
  }
  for (const r of REQUIRED_SECTIONS) if (!seen.has(r)) throw invalid('PL-01', `packet invalid: ${path}:${bodyStart} missing '## ${r}'`);
  return out;
}

/**
 * Reads `text` as the packet at repo path `path` and applies PL-01, PL-02 (grammar and stem; the
 * uniqueness half needs the id population, `checkUnique`), PL-03 and PL-06. Throws `PacketInvalid`.
 */
export function parsePacket(path: string, text: string): Packet {
  const parts = split(text);
  if (!parts) throw invalid('PL-01', `packet invalid: ${path}:1 missing front matter (--- … ---)`);
  const lc = new LineCounter();
  const doc: Document = parseDocument(parts.yaml, { version: '1.2', schema: 'core', uniqueKeys: true, lineCounter: lc, prettyErrors: false });
  const at = (pos: number | undefined) => (pos === undefined ? 2 : lc.linePos(pos).line + 1);
  const err = doc.errors[0];
  if (err) throw invalid('PL-01', `packet invalid: ${path}:${at(err.pos[0])} ${err.message.split('\n')[0]}`);
  const lineOf = (keys: readonly (string | number)[]): number => {
    for (let n = keys.length; n >= 0; n--) {
      const node = (n === 0 ? doc.contents : doc.getIn(keys.slice(0, n), true)) as { range?: [number, number, number] } | null | undefined;
      if (node && typeof node === 'object' && node.range) return at(node.range[0]);
    }
    return 2;
  };
  if (!isMap(doc.contents)) throw invalid('PL-01', `packet invalid: ${path}:2 front matter is not a mapping`);
  const fm = doc.toJS() as Record<string, unknown>;
  const pl01 = (keys: (string | number)[], what: string) => invalid('PL-01', `packet invalid: ${path}:${lineOf(keys)} ${what}`);

  // Closed keys (05 §2: unknown keys are rejected), at the root and in each nested object.
  const closed = (obj: unknown, scope: string, keys: (string | number)[]) => {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return;
    for (const k of Object.keys(obj)) {
      if (!FIELDS[scope]!.includes(k)) throw pl01([...keys, k], `unknown field '${[...keys.filter((x) => typeof x === 'string'), k].join('.')}'`);
    }
  };
  closed(fm, '', []);
  for (const k of ['spec', 'paths', 'observations'] as const) closed(fm[k], k, [k]);
  if (Array.isArray(fm['context'])) fm['context'].forEach((c, i) => closed(c, 'context', ['context', i]));

  // Required and blank (a placeholder title is blank: 08 A.4).
  for (const k of REQUIRED) if (!(k in fm)) throw pl01([], `missing '${k}'`);
  for (const [k, v] of Object.entries(fm)) if (isBlank(v)) throw pl01([k], `blank '${k}'`);
  if (fm['title'] === TITLE_PLACEHOLDER) throw pl01(['title'], `blank 'title'`);
  const spec0 = fm['spec'];
  if (spec0 !== null && typeof spec0 === 'object' && !Array.isArray(spec0)) {
    for (const k of ['id', 'path', 'sha256']) if (k in spec0 && isBlank((spec0 as Record<string, unknown>)[k])) throw pl01(['spec', k], `blank 'spec.${k}'`);
  }

  // Types (05 §2).
  const str = (keys: (string | number)[], v: unknown, test?: (s: string) => boolean, expect?: string): string => {
    if (typeof v !== 'string' || (test && !test(v))) throw pl01(keys, `'${keys.join('.')}' is not ${expect ?? 'a string'}`);
    return v;
  };
  const list = (keys: (string | number)[], v: unknown, test?: (s: string) => boolean, expect?: string): string[] => {
    if (!Array.isArray(v)) throw pl01(keys, `'${keys.join('.')}' is not a list`);
    return v.map((x, i) => str([...keys, i], x, test, expect));
  };
  const obj = (k: string): Record<string, unknown> => {
    const v = fm[k];
    if (v === null || typeof v !== 'object' || Array.isArray(v)) throw pl01([k], `'${k}' is not a mapping`);
    return v as Record<string, unknown>;
  };
  const id = str(['id'], fm['id']);
  const title = str(['title'], fm['title']);
  if (title.length > 80 || title.includes('\n')) throw pl01(['title'], `'title' is not one line of at most 80 characters`);
  const kindRaw = str(['kind'], fm['kind']);
  const base = str(['base'], fm['base'], (s) => /^[0-9a-f]{40}$/.test(s), 'a 40-hex commit');
  let spec: Packet['spec'] = null;
  if ('spec' in fm) {
    const s = obj('spec');
    if (!('id' in s)) throw pl01(['spec'], `missing 'spec.id'`);
    if (!('path' in s)) throw pl01(['spec'], `missing 'spec.path'`);
    spec = {
      id: str(['spec', 'id'], s['id'], (v) => /^SPEC-[A-Z][A-Z0-9]*-[0-9]{3}$/.test(v), 'a SPEC-<PRODUCT>-nnn id'),
      path: str(['spec', 'path'], s['path'], (v) => /^specs\/[^\s]+\.md$/.test(v) && !v.split('/').includes('..'), 'a specs/**.md repo path'),
      sha256: 'sha256' in s ? str(['spec', 'sha256'], s['sha256'], (v) => /^[0-9a-f]{64}$/.test(v), '64 lowercase hex') : null,
    };
  }
  const after = 'after' in fm ? list(['after'], fm['after'], (s) => PACKET_ID.test(s), 'a packet id') : [];
  const supersedes = 'supersedes' in fm ? str(['supersedes'], fm['supersedes'], (s) => PACKET_ID.test(s), 'a packet id') : null;
  const paths = obj('paths');
  if (!('allowed' in paths)) throw pl01(['paths'], `missing 'paths.allowed'`);
  const allowed = list(['paths', 'allowed'], paths['allowed'] ?? [], (s) => s.trim() !== '', 'a glob');
  const forbidden = 'forbidden' in paths ? list(['paths', 'forbidden'], paths['forbidden'] ?? [], (s) => s.trim() !== '', 'a glob') : [];
  const protectedList = list(['protected'], fm['protected'], (s) => (ProtectedClass.options as readonly string[]).includes(s), `one of ${ProtectedClass.options.join(' ')}`);
  const context: ContextEntry[] = [];
  if ('context' in fm) {
    if (!Array.isArray(fm['context'])) throw pl01(['context'], `'context' is not a list`);
    fm['context'].forEach((c, i) => {
      if (c === null || typeof c !== 'object' || Array.isArray(c)) throw pl01(['context', i], `'context.${i}' is not a mapping`);
      const e = c as Record<string, unknown>;
      for (const k of ['path', 'lines', 'why']) if (isBlank(e[k])) throw pl01(['context', i, k], `blank 'context.${i}.${k}'`);
      const lines = str(['context', i, 'lines'], e['lines'], (s) => {
        const m = /^([1-9]\d*)-([1-9]\d*)$/.exec(s);
        return m !== null && Number(m[1]) <= Number(m[2]);
      }, 'a line range "a-b"');
      context.push({ path: str(['context', i, 'path'], e['path']), lines, why: str(['context', i, 'why'], e['why']) });
    });
  }
  const observations = obj('observations');
  if (!('unimplemented' in observations)) throw pl01(['observations'], `missing 'observations.unimplemented'`);
  const unimplemented = list(['observations', 'unimplemented'], observations['unimplemented'] ?? [], (s) => /^R-[1-9][0-9]*$/.test(s), 'an R-n id');

  const secs = sections(path, parts.body, parts.bodyStart);

  // PL-02: grammar and stem (D-050).
  if (!PACKET_ID.test(id)) throw invalid('PL-02', `packet invalid: id ${id} does not match PKT-<PRODUCT>-nnn (D-050)`);
  if (basename(path) !== `${id}.md`) throw invalid('PL-02', `packet invalid: id ${id} is not the file stem`);

  // PL-03.
  if (!(KINDS as readonly string[]).includes(kindRaw)) throw invalid('PL-03', `packet invalid: kind '${kindRaw}' (expected spec|generate|test|code|fix|standards)`);
  const kind = kindRaw as Kind;
  if (kind === 'standards' && spec) throw invalid('PL-03', `packet invalid: spec is for kinds other than standards`);
  if (kind !== 'standards' && !spec) throw invalid('PL-03', `packet invalid: missing 'spec' for kind: ${kind}`);
  if (spec && PINNING.includes(kind) && spec.sha256 === null) throw invalid('PL-03', `packet invalid: missing 'spec.sha256' for kind: ${kind}`);
  if (spec && kind === 'spec' && spec.sha256 !== null) throw invalid('PL-03', `packet invalid: spec.sha256 is for pinning kinds, not kind: spec`);
  if (kind !== 'test' && unimplemented.length > 0) throw invalid('PL-03', 'observations.unimplemented is for kind: test only (D-051)');

  // PL-06.
  if (!matcher(allowed).ignores(path)) throw invalid('PL-06', `paths.allowed must include this packet (${path})`);
  for (const g of allowed) if (!inRootSet(g)) throw invalid('PL-06', `paths.allowed '${g}' is outside the layout root set (04-layout §1)`);

  const dispositions = (secs.find((s) => s.name === 'Review dispositions')?.lines ?? []).filter((l) => l.text.trim() !== '').map((l) => ({ line: l.line, text: l.text.trim() }));
  return {
    path, text, id, title, kind, spec, base, after, supersedes, allowed, forbidden, protected: protectedList, context, unimplemented,
    dispositions, lineOf, lines: lineCount(text),
  };
}

/** The bullets of a `## <name>` section, verbatim (continuation lines kept), without the leading `- `. */
export function sectionBullets(text: string, name: string): string[] {
  const out: string[] = [];
  let inside = false;
  for (const line of text.split('\n')) {
    if (/^## /.test(line)) inside = line.trim() === `## ${name}`;
    else if (inside && /^[-*] /.test(line)) out.push(line.slice(2));
    else if (inside && /^\s+\S/.test(line) && out.length > 0) out[out.length - 1] += `\n${line}`;
  }
  return out;
}

/** A gitignore matcher (`ignore` 7.0.5, B.26) over repo-relative globs. */
export const matcher = (globs: readonly string[]) => ignore().add([...globs]);

/** 04 §1 root folders, plus the folders a devai.json protected class names by default (02 §5). */
const ROOT_FOLDERS = new Set(['specs', 'packets', 'apps', 'domain', 'database', 'test', 'scripts', 'infra', 'product', 'law', 'docs', '.agents', 'tools', '.github', '.claude']);
/** PL-06's root files (04 §1/§4 and the devai.json protected classes), as globs. */
const ROOT_FILES = ['README.md', 'AGENTS.md', 'CLAUDE.md', 'decisions.md', 'devai.json', 'eslint.config.*', 'tsconfig*.json', '.stynxrc.json', 'compose.yaml', 'vitest.config.ts', 'package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml'];
const rootFiles = matcher(ROOT_FILES);

/** PL-06: the glob's literal prefix lies under a root folder, or the glob names a root file. */
export function inRootSet(glob: string): boolean {
  const g = glob.replace(/^\//, '');
  const meta = g.search(/[*?[\\!]/);
  const literal = meta < 0 ? g : g.slice(0, meta);
  const slash = literal.indexOf('/');
  if (slash > 0) return ROOT_FOLDERS.has(literal.slice(0, slash));
  if (ROOT_FILES.includes(g)) return true;
  return meta < 0 && rootFiles.ignores(g);
}

/** PL-02, second half: no other file under `packets/**` (HEAD plus untracked) carries this stem. */
export function checkUnique(p: Packet, packetPaths: readonly string[]): void {
  const other = packetPaths.find((q) => q !== p.path && q.startsWith('packets/') && basename(q) === `${p.id}.md`);
  if (other) throw invalid('PL-02', `packet invalid: id ${p.id} already used by ${other}`);
}

/** The scalar source span of a top-level front-matter key, as file offsets (for `packet rebase`). */
export function scalarSpan(text: string, key: string): { start: number; end: number } | null {
  const parts = split(text);
  if (!parts) return null;
  const doc = parseDocument(parts.yaml, { version: '1.2', schema: 'core' });
  const node = doc.get(key, true);
  if (!isScalar(node) || !node.range) return null;
  const offset = text.indexOf('\n') + 1;
  return { start: offset + node.range[0], end: offset + node.range[1] };
}

/** Lenient read of a front matter (`packets status`, PL-13, PL-16): the object, or null. */
export function frontMatter(text: string): Record<string, unknown> | null {
  const parts = split(text);
  if (!parts) return null;
  const doc = parseDocument(parts.yaml, { version: '1.2', schema: 'core', uniqueKeys: true });
  if (doc.errors.length > 0 || !isMap(doc.contents)) return null;
  return doc.toJS() as Record<string, unknown>;
}

