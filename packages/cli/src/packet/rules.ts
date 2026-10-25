// 05 §5 rules that read git: the pre-DAG branches (PL-02 uniqueness, PL-05 "not an ancestor", PL-14,
// PL-04 "does not exist at base"), the `packet-scope` rules (PL-04, PL-05, PL-07, PL-09, PL-11, PL-13,
// PL-17), PL-08's classification (B.25), and `accept`'s PL-12 and PL-16. "Introducing commit" is the
// first commit that added the packet's path (`git log --diff-filter=A`), read at HEAD's history.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256 } from '../candidate/digest.js';
import type { DevaiConfig } from '../config.js';
import { isAncestor, log, lsTree, revParse, show } from '../git/git.js';
import type { Finding } from '../proc/tool.js';
import { readSpec } from '../spec/machine-block.js';
import { checkUnique, frontMatter, matcher, type Packet, PacketInvalid, parsePacket, PINNING } from './packet.js';

/** `21d6…`: the short form 05 §5's messages print. */
export const short = (sha: string): string => `${sha.slice(0, 4)}…`;

const HINTS: Record<string, string> = {
  'PL-04': 'a spec is pinned by its digest at base (D-053); a changed setpoint is a successor spec and a new packet',
  'PL-05': 'base advances forward only: devai packet rebase <packet> --to <descendant commit>',
  'PL-07': 'stay inside paths.allowed; paths.forbidden wins inside it (D-052)',
  'PL-09': 'dispositions bind to finding fingerprints in .devai/review/<packet-id>.json (D-035)',
  'PL-11': "expected red is for the spec's unimplemented[] cases only (D-051)",
  'PL-12': 'advance base with devai packet rebase once the after: packets are merged',
  'PL-13': 'id, kind, spec.* and supersedes are frozen at the introducing commit; write a successor packet',
  'PL-16': 'work the successor packet; a superseded packet is ended (05 §4)',
  'PL-17': 'a spec changes by a successor spec (D-053); draft → approved needs approved-by',
};

const finding = (rule: string, locator: string, message: string): Finding => ({ locator, message, standard: `05 ${rule}`, hint: HINTS[rule]! });

export interface RuleResult {
  id: string;
  findings: Finding[];
  /** Notices (PL-04's permitted superseded-by edit, PL-08's touched classes): printed, never a violation. */
  notices: string[];
}

export interface Introduced {
  sha: string;
  /** The packet's bytes at its introducing commit. */
  text: string;
}

/** The introducing commit and the packet's bytes there; null while the packet is in no commit. */
export async function introducing(root: string, path: string): Promise<Introduced | null> {
  const out = (await log(root, ['--reverse', '--diff-filter=A', '--format=%H', 'HEAD', '--', path])).trim();
  const sha = out.split('\n')[0];
  if (!sha) return null;
  const blob = await show(root, sha, path);
  return blob === null ? null : { sha, text: blob.toString('utf8') };
}

/** The spec facts the rules read from a machine block (06 §2); null when the block does not parse. */
export interface SpecMeta {
  id: string | null;
  status: string | null;
  approvedBy: string | null;
  supersedes: { id: string; path: string; sha256: string } | null;
  /** `acceptance: yes` requirement ids. */
  acceptance: string[];
  requirements: string[];
  unimplemented: string[];
  routes: number;
  queries: number;
}

export function specMeta(text: string): SpecMeta | null {
  const r = readSpec(text);
  if (r.kind !== 'document' || r.value === null || typeof r.value !== 'object') return null;
  const v = r.value as Record<string, unknown>;
  const arr = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? x.filter((e): e is Record<string, unknown> => e !== null && typeof e === 'object') : []);
  const s = (x: unknown): string | null => (typeof x === 'string' ? x : null);
  const sup = v['supersedes'] as Record<string, unknown> | undefined;
  return {
    id: s(v['id']),
    status: s(v['status']),
    approvedBy: s(v['approved-by']),
    supersedes: sup && typeof sup === 'object' && s(sup['id']) && s(sup['path']) && s(sup['sha256']) ? { id: s(sup['id'])!, path: s(sup['path'])!, sha256: s(sup['sha256'])! } : null,
    acceptance: arr(v['requirements']).filter((q) => q['acceptance'] === 'yes').map((q) => String(q['id'])),
    requirements: arr(v['requirements']).map((q) => String(q['id'])),
    unimplemented: arr(v['unimplemented']).map((q) => String(q['requirement'])),
    routes: arr(v['routes']).length,
    queries: arr(v['queries']).length,
  };
}

/**
 * The pre-DAG branches that read git (C.1 step 1): PL-02 uniqueness over `packets/**` (HEAD plus
 * untracked), PL-05 "not an ancestor", PL-14, PL-04 "does not exist at base". Throws `PacketInvalid`.
 */
export async function preDag(root: string, p: Packet, packetPaths: readonly string[]): Promise<void> {
  checkUnique(p, packetPaths);
  const base = await revParse(root, p.base);
  if (base === null || !(await isAncestor(root, base, 'HEAD'))) {
    throw new PacketInvalid('base-not-ancestor', `base ${short(p.base)} is not an ancestor of HEAD; rebase onto it or run devai packet rebase`, 'PL-05');
  }
  // PL-14: context entries resolve at base, ranges inside the file, 05 §2 bounds; ≤ 200 lines.
  const pl14 = (m: string) => new PacketInvalid('packet-invalid', m, 'PL-14');
  if (p.context.length > 8) throw pl14(`context has ${p.context.length} entries (limit 8)`);
  let total = 0;
  for (const [i, c] of p.context.entries()) {
    const blob = await show(root, p.base, c.path);
    if (blob === null) throw pl14(`context[${i}] ${c.path} does not exist at base ${short(p.base)}`);
    const n = blob.toString('utf8').replace(/\n$/, '').split('\n').length;
    // D-135: an entry without `lines` is the whole file, held to the same bounds at its length.
    const [a, b] = c.lines ? (c.lines.split('-').map(Number) as [number, number]) : [1, n];
    const range = c.lines ? `lines ${c.lines}` : `(whole file, ${n} lines)`;
    if (b > n) throw pl14(`context[${i}] ${c.path} ${range} exceeds the file (${n} lines)`);
    if (b - a + 1 > 40) throw pl14(`context[${i}] ${c.path} ${range} spans ${b - a + 1} lines (limit 40)`);
    total += b - a + 1;
  }
  if (total > 200) throw pl14(`context spans ${total} lines (limit 200)`);
  if (p.lines > 200) throw pl14(`packet is ${p.lines} lines (limit 200): move prose to the spec or the module README`);
  if (p.spec && PINNING.includes(p.kind) && (await show(root, p.base, p.spec.path)) === null) {
    throw new PacketInvalid('packet-invalid', `spec ${p.spec.path} does not exist at base ${short(p.base)}`, 'PL-04');
  }
}

export interface ScopeInput {
  root: string;
  packet: Packet;
  /** Changed paths of `base..candidate` (adds, deletes, untracked; `--no-renames`), sorted. */
  changed: readonly string[];
  intro: Introduced | null;
  /** Candidate bytes of a repo path, or null when absent. */
  read?: (path: string) => Buffer | null;
}

const readWorking = (root: string) => (path: string): Buffer | null => {
  try {
    return readFileSync(resolve(root, path));
  } catch {
    return null;
  }
};

/** B.26 Observation: the review evidence files are not scope observations (D-054). */
export const reviewFiles = (id: string): string[] => [`.devai/review/${id}.json`, `.devai/review/${id}.permissions.json`];

/** The `packet-scope` rules, in 05 §5 order: PL-04, PL-05, PL-07, PL-09, PL-11, PL-13, PL-17. */
export async function scopeRules(input: ScopeInput): Promise<RuleResult[]> {
  const read = input.read ?? readWorking(input.root);
  return [
    await pl04(input, read),
    await pl05(input),
    pl07(input, read),
    await pl09(input, read),
    await pl11(input),
    pl13(input),
    await pl17(input, read),
  ];
}

async function pl04({ root, packet: p, intro }: ScopeInput, read: (path: string) => Buffer | null): Promise<RuleResult> {
  const r: RuleResult = { id: 'PL-04', findings: [], notices: [] };
  if (!p.spec || p.spec.sha256 === null) return r;
  const at = `${p.path}:${p.lineOf(['spec', 'sha256'])}`;
  const blob = await show(root, p.base, p.spec.path);
  if (blob === null) return r; // pre-DAG (exit 2)
  const digest = sha256(blob);
  if (digest !== p.spec.sha256) {
    r.findings.push(finding('PL-04', at, `spec ${p.spec.id} at base is ${short(digest)} ≠ packet ${short(p.spec.sha256)}: the setpoint moved; write a successor packet`));
    return r;
  }
  const meta = specMeta(blob.toString('utf8'));
  const superseded = /^superseded-by: (\S+)$/.exec(meta?.status ?? '');
  if (superseded) r.findings.push(finding('PL-04', at, `spec ${p.spec.id} is superseded-by ${superseded[1]}: pin the successor`));
  else if (meta?.status !== 'approved') r.findings.push(finding('PL-04', at, `spec ${p.spec.id} status ${meta?.status ?? 'unreadable'}: the pilot approves it; note it under ## Notes and stop`));
  const now = read(p.spec.path);
  if (now !== null && sha256(now) === digest) return r;
  const succ = now === null ? null : statusOnlySuccessor(blob.toString('utf8'), now.toString('utf8'));
  if (succ === null) {
    r.findings.push(finding('PL-04', `${p.spec.path}:1`, `spec ${p.spec.id} edited in the candidate: a spec is a successor, not an edit`));
  } else if (intro !== null && (intro.sha === p.base || (await isAncestor(root, intro.sha, p.base)))) {
    r.notices.push(`spec ${p.spec.id} is superseded-by ${succ} in the candidate (D-053's one permitted edit)`);
  } else {
    r.findings.push(finding('PL-04', `${p.spec.path}:1`, `spec ${p.spec.id} is superseded-by ${succ}: pin the successor`));
  }
  return r;
}

/** D-053's one permitted edit: only the status line changed, `approved` → `"superseded-by: <SpecId>"`; the successor id, or null. */
export function statusOnlySuccessor(before: string, after: string): string | null {
  const a = before.split('\n');
  const b = after.split('\n');
  if (a.length !== b.length) return null;
  const diff = a.map((l, i) => i).filter((i) => a[i] !== b[i]);
  if (diff.length !== 1) return null;
  const i = diff[0]!;
  const to = /^status: (["'])superseded-by: (SPEC-[A-Z][A-Z0-9]*-[0-9]{3})\1\s*$/.exec(b[i]!); // 06 §6: quoted for valid YAML
  if (to) return /^status: approved\s*$/.test(a[i]!) ? to[2]! : null;
  return null;
}

async function pl05({ root, packet: p, intro }: ScopeInput): Promise<RuleResult> {
  const r: RuleResult = { id: 'PL-05', findings: [], notices: [] };
  const old = intro ? frontMatter(intro.text)?.['base'] : undefined;
  if (typeof old !== 'string' || old === p.base) return r;
  if (!(await isAncestor(root, old, p.base))) r.findings.push(finding('PL-05', `${p.path}:${p.lineOf(['base'])}`, `base moved backwards (introduced ${short(old)}, now ${short(p.base)})`));
  return r;
}

function pl07({ packet: p, changed }: ScopeInput, read: (path: string) => Buffer | null): RuleResult {
  const r: RuleResult = { id: 'PL-07', findings: [], notices: [] };
  const allowed = matcher(p.allowed);
  const forbidden = matcher(p.forbidden);
  const skip = new Set(reviewFiles(p.id));
  const paths = changed.filter((c) => !skip.has(c));
  for (const c of paths) {
    if (forbidden.ignores(c)) r.findings.push(finding('PL-07', `${c}:1`, `forbidden path touched: ${c} (regenerate or move the logic to a seed)`));
    else if (!allowed.ignores(c)) r.findings.push(finding('PL-07', `${c}:1`, `out of scope: ${c} (edit paths.allowed to widen, then re-run)`));
  }
  // 02 §7: the generation manifest belongs to `generate`, or to a `standards` upgrade (D-074).
  const manifests = paths.filter((c) => /^domain\/[^/]+\/generation-manifest\.json$/.test(c));
  if (manifests.length > 0 && p.kind !== 'generate' && !(p.kind === 'standards' && upgradeOnly(paths, read))) {
    for (const m of manifests) r.findings.push(finding('PL-07', `${m}:1`, `generation-manifest.json changed by a ${p.kind} packet`));
  }
  return r;
}

/** D-074: every changed `domain/**` path is a module's `api/package.json`, its manifest or a `mode: generated` entry of it. */
function upgradeOnly(paths: readonly string[], read: (path: string) => Buffer | null): boolean {
  return paths.filter((c) => c.startsWith('domain/')).every((c) => {
    const m = /^domain\/([^/]+)\/(.+)$/.exec(c);
    if (!m) return false;
    if (m[2] === 'api/package.json' || m[2] === 'generation-manifest.json') return true;
    try {
      const manifest = JSON.parse(read(`domain/${m[1]}/generation-manifest.json`)?.toString('utf8') ?? 'null') as { files?: { path?: unknown; mode?: unknown }[] } | null;
      return (manifest?.files ?? []).some((f) => f.path === m[2] && f.mode === 'generated');
    } catch {
      return false;
    }
  });
}

const RV = /^RV ([0-9a-f]{12,64}) · (R-[1-9][0-9]*) · (.+?) · (not-a-defect|accepted-risk) · (.+)$/;

interface ReviewFinding { fingerprint: string; requirement: string; locator: string }

/** "Committed review history": every version of `.devai/review/<id>.json` in `base..HEAD`, plus the working copy. */
async function reviewHistory(root: string, p: Packet, read: (path: string) => Buffer | null): Promise<ReviewFinding[]> {
  const path = `.devai/review/${p.id}.json`;
  const shas = (await log(root, ['--format=%H', `${p.base}..HEAD`, '--', path])).split('\n').filter((s) => s !== '');
  const texts = [...(await Promise.all(shas.map((s) => show(root, s, path)))), read(path)];
  const out = new Map<string, ReviewFinding>();
  for (const t of texts) {
    if (t === null) continue;
    try {
      const doc = JSON.parse(t.toString('utf8')) as { findings?: Partial<ReviewFinding>[] };
      for (const f of doc.findings ?? []) {
        if (typeof f.fingerprint === 'string' && typeof f.requirement === 'string' && typeof f.locator === 'string') {
          out.set(`${f.fingerprint} ${f.requirement} ${f.locator}`, { fingerprint: f.fingerprint, requirement: f.requirement, locator: f.locator });
        }
      }
    } catch {
      // an unparseable version holds no finding a disposition could bind to
    }
  }
  return [...out.values()];
}

async function pl09({ root, packet: p }: ScopeInput, read: (path: string) => Buffer | null): Promise<RuleResult> {
  const r: RuleResult = { id: 'PL-09', findings: [], notices: [] };
  if (p.dispositions.length === 0) return r;
  const history = await reviewHistory(root, p, read);
  for (const d of p.dispositions) {
    const at = `${p.path}:${d.line}`;
    const m = RV.exec(d.text);
    if (!m) {
      r.findings.push(finding('PL-09', at, `RV line does not parse: RV <fingerprint> · R-n · <locator> · not-a-defect|accepted-risk · <reason>`));
      continue;
    }
    const [, prefix, req, locator] = m as unknown as [string, string, string, string];
    const fps = [...new Set(history.filter((f) => f.fingerprint.startsWith(prefix)).map((f) => f.fingerprint))];
    if (fps.length === 0) r.findings.push(finding('PL-09', at, `RV ${prefix} not found in .devai/review/${p.id}.json or its history since base: dispositions bind to fingerprints; copy one from the report`));
    else if (fps.length > 1) r.findings.push(finding('PL-09', at, `RV ${short(prefix)} ambiguous (${fps.length} findings); use a longer prefix`));
    else if (!history.some((f) => f.fingerprint === fps[0] && f.requirement === req && f.locator === locator)) {
      const f = history.find((x) => x.fingerprint === fps[0])!;
      r.findings.push(finding('PL-09', at, `RV ${short(prefix)} names ${req} · ${locator}; the finding is ${f.requirement} · ${f.locator}`));
    }
  }
  return r;
}

async function pl11({ root, packet: p }: ScopeInput): Promise<RuleResult> {
  const r: RuleResult = { id: 'PL-11', findings: [], notices: [] };
  if (p.unimplemented.length === 0 || !p.spec) return r;
  const blob = await show(root, p.base, p.spec.path);
  const meta = blob === null ? null : specMeta(blob.toString('utf8'));
  const at = `${p.path}:${p.lineOf(['observations', 'unimplemented'])}`;
  for (const id of p.unimplemented) {
    if (!meta?.acceptance.includes(id)) r.findings.push(finding('PL-11', at, `${id} is not a requirement of ${p.spec.id}`));
    else if (!meta.unimplemented.includes(id)) r.findings.push(finding('PL-11', at, `${id} is not in ${p.spec.id} unimplemented[]: a test packet may expect red only for cases the spec declares unimplemented`));
  }
  return r;
}

function pl13({ packet: p, intro }: ScopeInput): RuleResult {
  const r: RuleResult = { id: 'PL-13', findings: [], notices: [] };
  const was = intro ? frontMatter(intro.text) : null;
  if (!was || !intro) return r;
  const wasSpec = (was['spec'] ?? null) as Record<string, unknown> | null;
  const fields: [string, unknown, unknown, (string | number)[]][] = [
    ['id', was['id'], p.id, ['id']],
    ['kind', was['kind'], p.kind, ['kind']],
    ['spec.id', wasSpec?.['id'] ?? null, p.spec?.id ?? null, ['spec', 'id']],
    ['spec.path', wasSpec?.['path'] ?? null, p.spec?.path ?? null, ['spec', 'path']],
    ['spec.sha256', wasSpec?.['sha256'] ?? null, p.spec?.sha256 ?? null, ['spec', 'sha256']],
    ['supersedes', was['supersedes'] ?? null, p.supersedes, ['supersedes']],
  ];
  for (const [name, before, now, keys] of fields) {
    if (before !== now) r.findings.push(finding('PL-13', `${p.path}:${p.lineOf(keys)}`, `frozen field '${name}' changed since ${short(intro.sha)}; write a successor packet`));
  }
  return r;
}

const statusLine = (text: string): number => {
  const i = text.split('\n').findIndex((l) => /^status:/.test(l));
  return i < 0 ? 1 : i + 1;
};

async function pl17({ root, packet: p, changed }: ScopeInput, read: (path: string) => Buffer | null): Promise<RuleResult> {
  const r: RuleResult = { id: 'PL-17', findings: [], notices: [] };
  const specs = changed.filter((c) => /^specs\/.+\.md$/.test(c));
  for (const path of specs) {
    const oldBlob = await show(root, p.base, path);
    const newBlob = read(path);
    if (oldBlob !== null && newBlob !== null && oldBlob.equals(newBlob)) continue;
    const before = oldBlob === null ? null : specMeta(oldBlob.toString('utf8'));
    const after = newBlob === null ? null : specMeta(newBlob.toString('utf8'));
    if ((oldBlob !== null && before === null) || (newBlob !== null && after === null)) continue; // spec-lint's SL01
    const id = after?.id ?? before?.id ?? path;
    const at = `${path}:${newBlob === null ? 1 : statusLine(newBlob.toString('utf8'))}`;
    const from = before?.status ?? 'absent';
    const to = after === null ? 'deleted' : after.status === 'approved' && after.approvedBy === null ? 'approved without approved-by' : after.status ?? 'unreadable';
    const illegal = () => r.findings.push(finding('PL-17', at, `spec ${id}: illegal transition ${from} → ${to}; write a successor`));
    if (after === null) {
      illegal();
      continue;
    }
    if (before === null || before.status === 'draft') {
      if (after.status === 'draft' || (after.status === 'approved' && after.approvedBy !== null)) continue;
      illegal();
      continue;
    }
    const succ = before.status === 'approved' ? statusOnlySuccessor(oldBlob!.toString('utf8'), newBlob!.toString('utf8')) : null;
    if (succ === null) {
      illegal();
      continue;
    }
    // The successor must be in the candidate, carrying supersedes {id, path, sha256 = the blob at base}.
    let successor: SpecMeta | null = null;
    for (const q of changed.filter((c) => /^specs\/.+\.md$/.test(c) && c !== path)) {
      const m = read(q);
      const meta = m === null ? null : specMeta(m.toString('utf8'));
      if (meta?.id === succ) successor = meta;
    }
    if (successor === null) {
      r.findings.push(finding('PL-17', at, `spec ${id} superseded-by ${succ} but ${succ} is not in the candidate`));
      continue;
    }
    const s = successor.supersedes;
    if (!s || s.id !== id || s.path !== path || s.sha256 !== sha256(oldBlob!)) {
      r.findings.push(finding('PL-17', at, `spec ${id} superseded-by ${succ} but ${succ}.supersedes.sha256 ≠ blob at base`));
    }
  }
  return r;
}

// ---- PL-08 (B.25) ------------------------------------------------------------------------------

export interface Touched { class: string; paths: string[]; declared: boolean | null }

/** 02 §5: each class's globs over old and new paths; `declared` against the packet's introducing `protected` (D-078). */
export function classify(config: DevaiConfig, changed: readonly string[], declared: readonly string[] | null): Touched[] {
  const out: Touched[] = [];
  for (const [cls, globs] of Object.entries(config.protected)) {
    const m = matcher(globs ?? []);
    const paths = changed.filter((c) => m.ignores(c));
    if (paths.length > 0) out.push({ class: cls, paths: [...paths].sort(), declared: declared === null ? null : declared.includes(cls) });
  }
  return out;
}

/** D-078: the packet's `protected` at its introducing commit; a packet in no commit yet uses its first (current) version. */
export function introducedProtected(p: Packet, intro: Introduced | null): string[] {
  if (intro === null) return p.protected;
  const v = frontMatter(intro.text)?.['protected'];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** The B.25 text line: `protected:infra — database/ddl/21-est-rls.sql (packet declares: yes)`. */
export const touchedLine = (t: Touched): string =>
  `protected:${t.class} — ${t.paths[0]}${t.paths.length > 1 ? `, +${t.paths.length - 1}` : ''} (${t.declared === null ? 'no packet' : `packet declares: ${t.declared ? 'yes' : 'no'}`})`;

// ---- accept: PL-12, PL-16 ------------------------------------------------------------------------

/** Packet paths and front matters at HEAD (`packets/**`). */
export async function packetsAtHead(root: string): Promise<{ path: string; fm: Record<string, unknown> | null }[]> {
  const entries = (await lsTree(root, 'HEAD')).filter((e) => /^packets\/.+\/PKT-[^/]+\.md$/.test(e.path));
  return Promise.all(entries.map(async (e) => ({ path: e.path, fm: frontMatter((await show(root, 'HEAD', e.path))?.toString('utf8') ?? '') })));
}

/** PL-12 (`--full` only): each `after` id is a `Packet:` trailer in `git log <base>`; `supersedes` names an existing packet. */
export async function pl12(root: string, p: Packet): Promise<Finding[]> {
  const out: Finding[] = [];
  const trailers = new Set((await log(root, ['--format=%(trailers:key=Packet,valueonly)', p.base])).split('\n').map((s) => s.trim()).filter((s) => s !== ''));
  for (const a of p.after) if (!trailers.has(a)) out.push(finding('PL-12', `${p.path}:${p.lineOf(['after'])}`, `after: ${a} is not merged below base ${short(p.base)}; advance base with devai packet rebase`));
  if (p.supersedes !== null && !(await packetsAtHead(root)).some((q) => q.fm?.['id'] === p.supersedes)) {
    out.push(finding('PL-12', `${p.path}:${p.lineOf(['supersedes'])}`, `supersedes: ${p.supersedes} names no packet under packets/**`));
  }
  return out;
}

/** PL-16: no packet under `packets/**` at HEAD carries `supersedes: <this id>`. */
export async function pl16(root: string, p: Packet): Promise<Finding[]> {
  const by = (await packetsAtHead(root)).filter((q) => q.fm?.['supersedes'] === p.id).map((q) => String(q.fm!['id']));
  return by.map((s) => finding('PL-16', `${p.path}:1`, `packet ${p.id} is superseded by ${s}; work that packet`));
}

/** Reads and pre-DAG-checks the packet at repo path `path` (C.1 step 1); throws `PacketInvalid`. */
export async function loadPacket(root: string, path: string, packetPaths: readonly string[]): Promise<Packet> {
  let text: string;
  try {
    text = readFileSync(resolve(root, path), 'utf8');
  } catch {
    throw new PacketInvalid('packet-invalid', `packet invalid: ${path}:1 not readable`, 'PL-01');
  }
  const p = parsePacket(path, text);
  await preDag(root, p, packetPaths);
  return p;
}
