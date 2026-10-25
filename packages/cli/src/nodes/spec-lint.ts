// 08 B.8 `spec-lint`: 06 §4 SL01–SL08 and SL12 over the specs in scope (changed `specs/**/*.md`, and
// every spec whose `sources[].path` is a changed `product/**` file), in process with `yaml` 2.9.0 and
// zod 4.4.3. SL09–SL11 are `packet-scope`'s (D-054). Messages are 06 §4's, verbatim.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { z } from 'zod';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { pointer, type RuleParams, UseCase } from '../spec/machine-block.js';
import { parseSpec } from '../spec/parse-spec.js';
import type { Finding } from './tool-local.js';

const HINT = 'fix it in a spec packet';
const SPEC = /^specs\/.+\.md$/;
const USE_CASE = /^product\/use-cases\/[^/]+\.json$/;

/** 06 §4 message per rule, `<…>` filled from the subject. */
const message = {
  SL01: (ptr: string, reason: string) => `invalid contract at ${ptr}: ${reason}`,
  SL02: (id: string, path: string) => `source ${id}: missing artifact, id, or verbatim quote at ${path}`,
  SL03: (subject: string) => `${subject}: observable and falsifier required`,
  SL04: (subject: string) => subject,
  SL05: (subject: string) => `${subject}: limits/nullability/PII declaration invalid`,
  SL06: (subject: string) => `duplicate or malformed ${subject}`,
  SL07: (id: string) => `useCase ${id}: unresolved actor/rule/endpoint claim`,
  SL08: (subject: string) => `${subject}: invalid binding or cardinality`,
  SL12: (key: string) => `i18n ${key}: missing locale or unresolved error message`,
};

type Raw = Record<string, unknown>;
const at = (v: unknown, ...path: (string | number)[]): unknown => path.reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Raw)[k as string] : undefined), v);
const str = (v: unknown): string => (typeof v === 'string' ? v : JSON.stringify(v) ?? 'undefined');

/** A zod issue on the machine block → its 06 §4 rule and message. */
export function ruleOf(issue: z.core.$ZodIssue, value: unknown): { rule: string; text: string } {
  const p = issue.path as (string | number)[];
  const params = (issue as { params?: RuleParams }).params;
  if (params?.rule) {
    const text = params.rule === 'SL04' ? message.SL04(params.subject.includes(': missing or invalid') ? params.subject : `${params.subject}: missing or invalid ${String(p[2] ?? 'route')}`) : message[params.rule](params.subject);
    return { rule: params.rule, text };
  }
  const id = (kind: string, ...path: (string | number)[]) => ({ rule: 'SL06', text: message.SL06(`${kind} ${str(at(value, ...path))}`) });
  if (p.length === 1 && p[0] === 'id') return id('spec', 'id');
  if (p[0] === 'sources' && p.length === 3 && p[2] === 'id') return id('source', ...p);
  if (p[0] === 'requirements' && p.length === 3 && p[2] === 'id') return id('requirement', ...p);
  if (p[0] === 'queries' && p.length === 3 && p[2] === 'name') return id('query', ...p);
  if (p[0] === 'unimplemented' && p.length === 3 && p[2] === 'requirement') return id('requirement', ...p);
  if (p[0] === 'data' && p[1] === 'tables' && p.length === 4 && p[3] === 'name') return id('table', ...p);
  if (p[0] === 'routes' && typeof p[1] === 'number' && p.length >= 3) {
    return { rule: 'SL04', text: message.SL04(`route ${str(at(value, 'routes', p[1], 'method'))} ${str(at(value, 'routes', p[1], 'path'))}: missing or invalid ${String(p[2])}`) };
  }
  if (p[0] === 'data' && p[1] === 'tables' && p[3] === 'columns' && typeof p[4] === 'number') {
    if (p.length === 6 && p[5] === 'name') return { rule: 'SL06', text: message.SL06(`column ${str(at(value, 'data', 'tables', p[2]!, 'name'))}.${str(at(value, ...p))}`) };
    return { rule: 'SL05', text: message.SL05(`column ${str(at(value, 'data', 'tables', p[2]!, 'name'))}.${str(at(value, 'data', 'tables', p[2]!, 'columns', p[4], 'name'))}`) };
  }
  if (p[0] === 'data' && p[1] === 'tables' && p[3] === 'primaryKey') return { rule: 'SL05', text: message.SL05(`column ${str(at(value, 'data', 'tables', p[2]!, 'name'))}.${str(at(value, ...p))}`) };
  if (p[0] === 'queries' && typeof p[1] === 'number') return { rule: 'SL08', text: message.SL08(`query ${str(at(value, 'queries', p[1], 'name'))}`) };
  if (p[0] === 'i18n' && p.length >= 2) return { rule: 'SL12', text: message.SL12(String(p[1])) };
  return { rule: 'SL01', text: message.SL01(pointer(p), issue.message) };
}

interface Read { text: string | null }
const readOr = (root: string, path: string): Read => {
  try {
    return { text: readFileSync(resolve(root, path), 'utf8') };
  } catch {
    return { text: null };
  }
};

async function run(ctx: RunContext): Promise<NodeOutcome> {
  const paths = ctx.listing.entries.map((e) => e.path);
  const listed = new Set(paths);
  const changed = new Set(ctx.inventory?.changed ?? []);
  const io: Finding[] = [];
  const ioFinding = (path: string): Finding => ({ locator: `${path}:1`, message: `${path} cannot be read`, standard: 'S-25', hint: 'make the path readable (permissions, broken or escaping symlink), then re-run' });

  // The global identity population (SL06) and the scope's source join need every spec and use case.
  const specs = new Map<string, { text: string | null; read: ReturnType<typeof parseSpec> | null }>();
  for (const p of paths.filter((x) => SPEC.test(x))) {
    const { text } = readOr(ctx.root, p);
    specs.set(p, { text, read: text === null ? null : parseSpec(text) });
  }
  const useCases = new Map<string, { text: string | null; value: unknown; parsed: z.ZodSafeParseResult<UseCase> | null }>();
  for (const p of paths.filter((x) => USE_CASE.test(x))) {
    const { text } = readOr(ctx.root, p);
    let value: unknown = undefined;
    let parsed: z.ZodSafeParseResult<UseCase> | null = null;
    if (text !== null) {
      try {
        value = JSON.parse(text);
        parsed = UseCase.safeParse(value);
      } catch {
        value = undefined;
      }
    }
    useCases.set(p, { text, value, parsed });
  }
  const docOf = (p: string) => { const r = specs.get(p)?.read; return r && r.kind !== 'malformed' ? r : null; };
  const scope = [...specs.keys()].filter((p) => {
    if (changed.has(p)) return true;
    const sources = at(docOf(p)?.value, 'sources');
    return Array.isArray(sources) && sources.some((s) => typeof at(s, 'path') === 'string' && (at(s, 'path') as string).startsWith('product/') && changed.has(at(s, 'path') as string));
  }).sort();
  const idCount = new Map<string, number>();
  for (const p of specs.keys()) { const id = at(docOf(p)?.value, 'id'); if (typeof id === 'string') idCount.set(id, (idCount.get(id) ?? 0) + 1); }
  for (const u of useCases.values()) { const id = at(u.value, 'id'); if (typeof id === 'string') idCount.set(id, (idCount.get(id) ?? 0) + 1); }
  for (const [p, u] of useCases) if (u.text === null) io.push(ioFinding(p));

  const findings: Finding[] = [];
  let observed = 0;
  let evaluated = 0;
  for (const specPath of scope) {
    const entry = specs.get(specPath)!;
    if (entry.text === null || entry.read === null) { io.push(ioFinding(specPath)); continue; }
    const out: Finding[] = [];
    const add = (rule: string, line: number, text: string) => out.push({ locator: `${specPath}:${line}`, message: `${rule} ${text}`, standard: 'S-25', hint: HINT });
    const read = entry.read;
    for (const pr of read.problems) add('SL01', pr.line, message.SL01(pr.pointer, pr.reason));
    if (read.kind === 'malformed') { findings.push(...dedupe(out)); continue; }
    observed++;
    const id = at(read.value, 'id');
    if (typeof id === 'string' && (idCount.get(id) ?? 0) > 1) add('SL06', read.lineOf(['id']), message.SL06(`spec ${id}`));
    if (read.kind === 'invalid') {
      for (const i of read.issues) { const r = ruleOf(i, read.value); add(r.rule, read.lineOf(i.path), r.text); }
      findings.push(...dedupe(out));
      continue;
    }
    const b = read.block;
    let complete = true;
    // SL02: each source resolves to an existing product/** artifact carrying the id and the verbatim quote.
    const sourceIds = new Set(b.sources.map((s) => s.id));
    for (const [i, s] of b.sources.entries()) {
      const line = read.lineOf(['sources', i]);
      if (!s.path.startsWith('product/') || !listed.has(s.path)) { add('SL02', line, message.SL02(s.id, s.path)); continue; }
      const src = readOr(ctx.root, s.path);
      if (src.text === null) { io.push(ioFinding(s.path)); complete = false; continue; }
      let hasId: boolean;
      if (s.path.endsWith('.json')) { try { hasId = at(JSON.parse(src.text), 'id') === s.id; } catch { hasId = false; } }
      else hasId = src.text.includes(s.id);
      if (!hasId || !src.text.includes(s.quote)) add('SL02', line, message.SL02(s.id, s.path));
    }
    for (const [i, r] of b.requirements.entries()) for (const [j, sid] of r.sources.entries()) if (!sourceIds.has(sid)) add('SL02', read.lineOf(['requirements', i, 'sources', j]), message.SL02(sid, specPath));
    // SL07: the route's use case resolves, claims the endpoint and the roles; its rules resolve through the source table; endpoint sets agree.
    const ucById = new Map<string, { path: string; uc: UseCase | null }>();
    for (const [p, u] of useCases) { const uid = at(u.value, 'id'); if (typeof uid === 'string') ucById.set(uid, { path: p, uc: u.parsed?.success ? u.parsed.data : null }); }
    const claimed = [...new Set(b.routes.map((r) => r.useCase))];
    for (const ucId of claimed) {
      const routes = b.routes.map((r, i) => ({ r, i })).filter((x) => x.r.useCase === ucId);
      const line = read.lineOf(['routes', routes[0]!.i, 'useCase']);
      const hit = ucById.get(ucId);
      if (!hit) { add('SL07', line, message.SL07(ucId)); continue; }
      const u = useCases.get(hit.path)!;
      if (u.text === null) { complete = false; continue; }
      if (!hit.uc) {
        // SL01 reads the use-case JSON too.
        const issues = u.parsed && !u.parsed.success ? u.parsed.error.issues : [{ path: [], message: 'not parseable JSON' }];
        for (const i of issues) add('SL01', line, message.SL01(`${hit.path}#${pointer(i.path as PropertyKey[])}`, i.message));
        continue;
      }
      const uc = hit.uc;
      const endpoints = new Set(uc.endpoints.map((e) => `${e.method} ${e.path}`));
      const roles = [...uc.actor.roles].sort().join(',');
      let bad = uc.rules.some((rid) => !sourceIds.has(rid));
      for (const { r } of routes) if (!endpoints.has(`${r.method} ${r.path}`) || [...new Set(r.roles)].sort().join(',') !== roles) bad = true;
      const mine = new Set(routes.map(({ r }) => `${r.method} ${r.path}`));
      if ([...endpoints].some((e) => !mine.has(e))) bad = true;
      if (bad) add('SL07', line, message.SL07(ucId));
    }
    // SL12: every configured locale for every key; every error message key resolves.
    for (const [key, byLocale] of Object.entries(b.i18n)) if (ctx.config.locales.some((l) => !(l in byLocale))) add('SL12', read.lineOf(['i18n', key]), message.SL12(key));
    for (const [i, r] of b.routes.entries()) for (const [j, e] of r.errorContract.entries()) if (!(e.messageKey in b.i18n)) add('SL12', read.lineOf(['routes', i, 'errorContract', j, 'messageKey']), message.SL12(e.messageKey));
    findings.push(...dedupe(out));
    if (complete) evaluated++;
  }
  const counts = { expected: scope.length, observed, evaluated };
  if (findings.length > 0) return { status: 'FAIL', ...counts, findings: [...findings, ...io] };
  if (io.length > 0) return { status: 'UNKNOWN', reason: 'io', ...counts, findings: io };
  return { status: 'PASS', ...counts, findings: [] };
}

const dedupe = (fs: Finding[]): Finding[] => {
  const seen = new Set<string>();
  return fs.filter((f) => { const k = `${f.locator}\0${f.message}`; if (seen.has(k)) return false; seen.add(k); return true; });
};

export const specLint: NodeAdapter = {
  id: 'spec-lint',
  contract: 1,
  configFiles: () => ['devai.json'],
  // B.8 Inputs: every spec (scope and SL06), every product/** artifact a spec references, every use case (SL06/SL07).
  inputs: (ctx) => ctx.listing.entries.map((e) => e.path).filter((p) => SPEC.test(p) || p.startsWith('product/')),
  run,
};
