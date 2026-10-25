// 08 A.4 `devai packet new | lint | rebase` (05 §2, §4, §5). `new` renders the mechanical fields and
// writes the file; `lint` evaluates every 05 §5 rule that needs no DAG run over HEAD and the working
// tree; `rebase` advances `base` under PL-05's two conditions. Each writes at most the packet file and
// never commits (05 §4: the pilot commits).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { sha256 } from '../candidate/digest.js';
import { diffNameStatus, isAncestor, lsFilesUntracked, revParse, show } from '../git/git.js';
import { CommandRefusal, type Format, loadConfig, resolveRuntime } from '../main.js';
import type { Kind } from '../nodes/accept.js';
import { KINDS, type Packet, PacketInvalid, PINNING, parsePacket, scalarSpan, TITLE_PLACEHOLDER } from '../packet/packet.js';
import { classify, introducedProtected, introducing, preDag, type RuleResult, scopeRules, short, touchedLine } from '../packet/rules.js';
import { MachineBlock, readSpec } from '../spec/machine-block.js';
import { packetPopulation, repoPath, repositoryRoot } from './check.js';

type Result = { stdout: string; exitCode: 0 | 1 | 2 };
export interface RuleLine { id: string; status: 'pass' | 'fail' | 'deferred'; message?: string }

/** Every command reads devai.json first (A.0), resolves the runtime once, and runs at the repository root. */
export async function setup(cwd: string) {
  const config = loadConfig(cwd);
  resolveRuntime(config);
  const { root, head } = await repositoryRoot(cwd);
  return { config, root, head };
}

// ---- new -----------------------------------------------------------------------------------------

/** 08 A.4 "`new` default globs", brace-free; the packet's own path is appended. */
export function defaultGlobs(kind: Kind, slug: string | null, specPath: string | null): string[] {
  switch (kind) {
    case 'code':
    case 'fix':
      return [`domain/${slug}/api/src/**`, `domain/${slug}/web/src/**`, `domain/${slug}/api/test/*.spec.ts`, `domain/${slug}/db/**`, 'database/seed/modules.txt'];
    case 'test':
      return [`domain/${slug}/api/test/acceptance/**`];
    case 'generate':
      // D-093, D-095: the app tsconfigs (`references` mount lines), the routes file at its 09 §1.1 path, `.stynxrc.json`.
      return [`domain/${slug}/**`, 'database/seed/**', 'apps/api/package.json', 'apps/api/src/app.module.ts', 'apps/api/tsconfig.json', 'apps/web/package.json', 'apps/web/src/app/app.routes.ts', 'apps/web/tsconfig.json', '.stynxrc.json', 'pnpm-lock.yaml', 'docs/framework/contracts/**'];
    case 'spec':
      return [`${dirname(specPath!)}/**`];
    case 'standards':
      return ['tools/**', 'devai.json', 'eslint.config.*', 'tsconfig*.json', '.stynxrc.json', '.agents/**', '.claude/skills/**', 'AGENTS.md', '.github/**', 'scripts/**'];
  }
}

/** A YAML plain scalar when it reads back as the same string, else double-quoted. */
const scalar = (s: string): string => {
  try {
    if ((parseYaml(`v: ${s}`) as { v: unknown }).v === s) return s;
  } catch {
    // fall through to quoting
  }
  return JSON.stringify(s);
};

export function renderPacket(f: { id: string; kind: Kind; spec: { id: string; path: string; sha256: string | null } | null; base: string; allowed: string[]; unimplemented: string[] }): string {
  const lines = ['---', `id: ${f.id}`, `title: ${TITLE_PLACEHOLDER}`, `kind: ${f.kind}`];
  if (f.spec) {
    lines.push('spec:', `  id: ${f.spec.id}`, `  path: ${scalar(f.spec.path)}`);
    if (f.spec.sha256 !== null) lines.push(`  sha256: "${f.spec.sha256}"`);
  }
  lines.push(`base: ${scalar(f.base)}`, 'paths:', '  allowed:', ...f.allowed.map((g) => `    - ${scalar(g)}`), 'protected: []', 'observations:', `  unimplemented: [${f.unimplemented.join(', ')}]`, '---', '', '## Intent', '', '## Deliverables', '');
  return lines.join('\n');
}

const CAMPAIGN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export async function packetNew(opts: { kind: string; spec?: string; campaign?: string }, format: Format, cwd: string): Promise<Result> {
  const { config, root, head } = await setup(cwd);
  if (!(KINDS as readonly string[]).includes(opts.kind)) throw new CommandRefusal('usage', `--kind ${opts.kind}: expected spec|generate|test|code|fix|standards`);
  const kind = opts.kind as Kind;
  if (kind === 'standards' && opts.spec !== undefined) throw new CommandRefusal('usage', '--spec is rejected for kind: standards (PL-03)');
  if (kind !== 'standards' && opts.spec === undefined) throw new CommandRefusal('usage', `--spec is required for kind: ${kind}`);

  // Campaign: the single folder under packets/ when exactly one exists, else required.
  let campaign = opts.campaign;
  if (campaign !== undefined && !CAMPAIGN.test(campaign)) throw new CommandRefusal('usage', `--campaign ${campaign}: not a folder name`);
  if (campaign === undefined) {
    const dir = resolve(root, 'packets');
    const folders = existsSync(dir) ? readdirSync(dir).filter((d) => statSync(resolve(dir, d)).isDirectory()) : [];
    if (folders.length !== 1) throw new CommandRefusal('usage', `--campaign is required: packets/ holds ${folders.length} campaign folders`);
    campaign = folders[0]!;
  }

  // id: next PKT-<PRODUCT>-nnn over the global population (D-050).
  const product = config.productPrefix.toUpperCase();
  const own = new RegExp(`^PKT-${product}-(\\d{3})\\.md$`);
  const used = (await packetPopulation(root)).map((p) => own.exec(basename(p))?.[1]).filter((n): n is string => n !== undefined).map(Number);
  const next = Math.max(0, ...used) + 1;
  if (next > 999) throw new CommandRefusal('usage', `packet ids PKT-${product}-001…999 are exhausted`);
  const id = `PKT-${product}-${String(next).padStart(3, '0')}`;
  const path = `packets/${campaign}/${id}.md`;

  let spec: { id: string; path: string; sha256: string | null } | null = null;
  let slug: string | null = null;
  let unimplemented: string[] = [];
  if (kind === 'spec') {
    const specPath = repoPath(root, opts.spec!);
    const stem = basename(specPath, '.md');
    if (!/^specs\/.+\.md$/.test(specPath) || !/^SPEC-[A-Z][A-Z0-9]*-[0-9]{3}$/.test(stem)) throw new CommandRefusal('usage', `--spec ${opts.spec}: expected specs/<area>-<capability>/SPEC-<PRODUCT>-nnn.md`);
    spec = { id: stem, path: specPath, sha256: null };
  } else if (PINNING.includes(kind)) {
    const specPath = repoPath(root, opts.spec!);
    const blob = await show(root, 'HEAD', specPath);
    if (blob === null) throw new CommandRefusal('spec-invalid', `${specPath}:1 not in HEAD`);
    const text = blob.toString('utf8');
    const read = readSpec(text);
    if (read.kind === 'malformed' || read.problems.length > 0) {
      const p = read.problems[0]!;
      throw new CommandRefusal('spec-invalid', `${specPath}:${p.line} ${p.reason}`);
    }
    const parsed = MachineBlock.safeParse(read.value);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      throw new CommandRefusal('spec-invalid', `${specPath}:${read.lineOf(issue.path)} ${issue.message}`);
    }
    const block = parsed.data;
    if (block.status.startsWith('superseded-by: ')) throw new CommandRefusal('spec-superseded', `spec ${block.id} is ${block.status}: pin the successor`);
    if (block.status !== 'approved' || block['approved-by'] === null) throw new CommandRefusal('spec-not-approved', `spec ${block.id} status ${block.status}: the pilot approves it; note it under ## Notes and stop`);
    spec = { id: block.id, path: specPath, sha256: sha256(blob) };
    slug = block.module.slug;
    if (kind === 'test') unimplemented = block.unimplemented.map((u) => u.requirement);
  }

  const abs = resolve(root, path);
  if (existsSync(abs)) throw new CommandRefusal('usage', `${path} exists`);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, renderPacket({ id, kind, spec, base: head, allowed: [...defaultGlobs(kind, slug, spec?.path ?? null), path], unimplemented }));
  return format === 'json'
    ? { stdout: JSON.stringify({ path, id, rules: [], accepted: false, exitCode: 0 }) + '\n', exitCode: 0 }
    : { stdout: `${path}\n`, exitCode: 0 };
}

// ---- lint ----------------------------------------------------------------------------------------

/** "Changed" for a packet: the working tree against HEAD, untracked files, and `base..HEAD` (B.1 Inputs). */
export async function changedSince(root: string, base: string): Promise<string[]> {
  const untracked = (await lsFilesUntracked(root)).filter((p) => !p.startsWith('.devai/cache/') && !p.startsWith('.devai/review/'));
  return [...new Set([
    ...(await diffNameStatus(root, { from: 'HEAD' })).map((d) => d.path),
    ...untracked,
    ...(await diffNameStatus(root, { from: base, to: 'HEAD' })).map((d) => d.path),
  ])].sort();
}

const order = (id: string): number => Number(id.slice(3));
const ruleLines = (results: RuleResult[]): RuleLine[] => results.flatMap((r): RuleLine[] =>
  r.findings.length > 0 ? r.findings.map((f) => ({ id: r.id, status: 'fail' as const, message: `${f.locator}  ${f.message}` }))
    : r.notices.length > 0 ? r.notices.map((n) => ({ id: r.id, status: 'pass' as const, message: n }))
      : [{ id: r.id, status: 'pass' as const }]);

function render(path: string, id: string | undefined, rules: RuleLine[], exitCode: 0 | 1 | 2, format: Format, reason?: string): Result {
  if (format === 'json') {
    return { stdout: JSON.stringify({ path, ...(id ? { id } : {}), rules, accepted: false, exitCode, ...(reason ? { reason } : {}) }) + '\n', exitCode };
  }
  return { stdout: rules.map((r) => `${r.id}  ${r.status}${r.message ? `  ${r.message}` : ''}`).join('\n') + '\n', exitCode };
}

/** Pre-DAG reading of a packet for `lint` and `rebase`: the packet, or the violated rule's line (exit 2). */
async function readChecked(root: string, path: string): Promise<{ packet: Packet } | { rule: RuleLine; reason: string }> {
  try {
    const text = readFileSync(resolve(root, path), 'utf8');
    const packet = parsePacket(path, text);
    await preDag(root, packet, await packetPopulation(root));
    return { packet };
  } catch (e) {
    if (e instanceof PacketInvalid) {
      const rule: RuleLine = { id: e.rule, status: 'fail', message: e.message };
      return { rule, reason: e.reason };
    }
    if ((e as NodeJS.ErrnoException).code === 'ENOENT' || (e as NodeJS.ErrnoException).code === 'EISDIR') {
      return { rule: { id: 'PL-01', status: 'fail', message: `packet invalid: ${path}:1 not readable` }, reason: 'packet-invalid' };
    }
    throw e;
  }
}

export async function packetLint(pathArg: string, format: Format, cwd: string): Promise<Result> {
  const { config, root } = await setup(cwd);
  const path = repoPath(root, pathArg);
  const r = await readChecked(root, path);
  if (!('packet' in r)) return render(path, undefined, [r.rule], 2, format, r.reason);
  const p = r.packet;
  const intro = await introducing(root, p.path);
  const changed = await changedSince(root, p.base);
  const results = await scopeRules({ root, packet: p, changed, intro });
  const touched = classify(config, changed, introducedProtected(p, intro));
  const pre: RuleLine[] = ['PL-01', 'PL-02', 'PL-03', 'PL-06', 'PL-14'].map((id) => ({ id, status: 'pass' }));
  const notice: RuleLine[] = touched.length > 0 ? touched.map((t) => ({ id: 'PL-08', status: 'pass', message: touchedLine(t) })) : [{ id: 'PL-08', status: 'pass' }];
  const deferred: RuleLine[] = ['PL-10', 'PL-12', 'PL-15', 'PL-16'].map((id) => ({ id, status: 'deferred' }));
  const rules = [...pre, ...ruleLines(results), ...notice, ...deferred].sort((a, b) => order(a.id) - order(b.id));
  return render(path, p.id, rules, rules.some((x) => x.status === 'fail') ? 1 : 0, format);
}

// ---- rebase --------------------------------------------------------------------------------------

export async function packetRebase(pathArg: string, to: string, format: Format, cwd: string): Promise<Result> {
  const { root } = await setup(cwd);
  const path = repoPath(root, pathArg);
  const r = await readChecked(root, path);
  if (!('packet' in r)) return render(path, undefined, [r.rule], 2, format, r.reason);
  const p = r.packet;
  const target = await revParse(root, to);
  if (target === null) throw new CommandRefusal('usage', `--to ${to}: not a commit`);
  const fail = (id: string, message: string) => render(path, p.id, [{ id, status: 'fail', message }], 1, format);
  if (!(await isAncestor(root, p.base, target))) return fail('PL-05', `base moved backwards (introduced ${short(p.base)}, now ${short(target)})`);
  if (p.spec && p.spec.sha256 !== null) {
    const blob = await show(root, target, p.spec.path);
    if (blob === null) return fail('PL-04', `spec ${p.spec.path} does not exist at base ${short(target)}`);
    const digest = sha256(blob);
    if (digest !== p.spec.sha256) return fail('PL-04', `spec ${p.spec.id} at base is ${short(digest)} ≠ packet ${short(p.spec.sha256)}: the setpoint moved; write a successor packet`);
  }
  const span = scalarSpan(p.text, 'base')!;
  writeFileSync(resolve(root, path), p.text.slice(0, span.start) + target + p.text.slice(span.end));
  if (format === 'json') return render(path, p.id, [{ id: 'PL-05', status: 'pass' }], 0, format);
  return { stdout: `${path}\n`, exitCode: 0 };
}
