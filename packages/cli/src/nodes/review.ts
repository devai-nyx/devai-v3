// 08 B.27 `review` (02 §9, S-64, S-66): two invocations of the other-family CLI (A.8, D-079). Phase 1 is
// blind by construction (no tools, no candidate bytes) and freezes the requirement list; phase 2 runs in
// a scratch copy of the candidate under the CLI's sandbox (D-082), with the tool-call budget counted from
// the stream. The answer is validated with `ReviewModelOutput`; PL-10 is applied to the packet's
// dispositions; under `--packet --full` the result is written to `.devai/review/<packet-id>.json` with
// `workerFamily` and `workerTrailers`. In CI the node never calls a model: it verifies that file by the
// PR head's candidate digest (C.1, D-037), and `stale` otherwise.
import { cpSync, existsSync, mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { frame } from '../cache/key.js';
import { digestOf, sha256 } from '../candidate/digest.js';
import { diffText, lsTree, show, worktreeAdd, worktreeRemove } from '../git/git.js';
import type { Reason } from '../main.js';
import { proxyTokens, REVIEW_INPUT_BOUND, REVIEW_OUTPUT_BOUND, REVIEW_TIMEOUT_MS, REVIEW_TOOL_CALLS } from '../model/budget.js';
import { callModel, modelIdOf, type ModelResult } from '../model/cli.js';
import { ciMode, reviewPath, type ReviewFile, verifyReview, writeReview, writeVerdict } from '../model/evidence.js';
import { dispositions, harnessOf, type PacketFacts, PINNING_KINDS, rangeFamily, reviewerFor, trailerFamily, workerTrailers, type WorkerFamily } from '../model/packet.js';
import { fill, PHASE1, PHASE2, promptDigest, SETPOINT } from '../model/prompts.js';
import type { StreamSummary } from '../model/stream.js';
import { ReviewModelOutput, ReviewPhase1 } from '../report.js';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { HINTS } from '../text/hints.js';
import type { Finding } from '../ts/outcome.js';
import { readSpecText } from '../ts/spec.js';
import type { z } from 'zod';

type Phase1 = z.infer<typeof ReviewPhase1>;
type Phase2 = z.infer<typeof ReviewModelOutput>;
type ReviewFinding = ReviewFile['findings'][number];
const STANDARD = 'S-66';
export const REVIEW_PROMPT_DIGEST = promptDigest(PHASE1 + PHASE2);

/** 02 §9: `fingerprint = sha256(requirement ‖ locator path ‖ normalised statement)`, framed as C.4 frames ‖. */
export function fingerprint(requirement: string, locator: string, statement: string): string {
  const path = locator.replace(/:\d+(:\d+)?$/, '');
  const normalised = statement.toLowerCase().replace(/\s+/g, ' ').trim();
  return sha256(Buffer.concat([frame(requirement), frame(path), frame(normalised)]));
}

const hintOf = (reason: Reason, packet: PacketFacts | undefined, prefix?: string): string =>
  (reason === 'model-error' && prefix ? HINTS['model-error'].replace('<reviewer command>', prefix.split(/\s+/)[0]!)
    : reason === 'stale' && packet ? HINTS.stale.replace('<p>', packet.path)
      : HINTS[reason]).slice(0, 160);

function unknown(reason: Reason, expected: number, locator: string, detail: string, extra: { packet?: PacketFacts | undefined; prefix?: string; details?: NodeOutcome['details']; more?: Finding[] } = {}): NodeOutcome {
  const hint = hintOf(reason, extra.packet, extra.prefix);
  return {
    status: 'UNKNOWN', reason, expected, observed: 0, evaluated: 0,
    findings: [{ locator, message: `review UNKNOWN (${reason}): ${detail}`, standard: STANDARD, hint }, ...(extra.more ?? [])],
    ...(extra.details ? { details: extra.details } : {}),
  };
}

interface Worker { family: WorkerFamily; trailers: string[]; prefix: string | null }
async function workerOf(ctx: RunContext, packet: PacketFacts): Promise<Worker> {
  const trailers = await workerTrailers(ctx.root, packet.base);
  const family = rangeFamily(trailers);
  return { family, trailers, prefix: reviewerFor(ctx.config, family) };
}

/** Phase 1 material and the `expected` ids it is reconciled against (pinning kinds: the spec's `acceptance: yes`). */
async function material(ctx: RunContext, p: PacketFacts): Promise<{ text: string; expected: string[] | null } | { missing: string }> {
  const at = async (path: string): Promise<string | null> => (await show(ctx.root, p.base, path))?.toString('utf8') ?? null;
  const section = (path: string, text: string) => `=== ${path}\n${text.replace(/\n$/, '')}`;
  if (PINNING_KINDS.includes(p.kind)) {
    if (!p.specPath) return { missing: `${p.path}:1` };
    const specText = await at(p.specPath);
    if (specText === null) return { missing: `${p.specPath}:1` };
    const spec = readSpecText(p.specPath, specText);
    const parts = [section(p.specPath, specText)];
    for (const s of spec?.sources ?? []) {
      const t = await at(s);
      if (t === null) return { missing: `${s}:1` };
      parts.push(section(s, t));
    }
    return { text: parts.join('\n\n'), expected: (spec?.requirements ?? []).filter((r) => r.acceptance === 'yes').map((r) => r.id) };
  }
  if (p.kind === 'spec') {
    const parts: string[] = [];
    for (const s of p.sources) {
      const t = await at(s);
      if (t === null) return { missing: `${s}:1` };
      parts.push(section(s, t));
    }
    return { text: parts.join('\n\n'), expected: null };
  }
  return { text: p.deliverables.join('\n'), expected: null };
}

/** `.devai/cache/scratch/<digest>/worktree`: a detached worktree at HEAD overlaid with the candidate's working tree. */
async function scratchWorktree(ctx: RunContext, digest: string): Promise<string> {
  const dir = resolve(ctx.root, '.devai/cache/scratch', digest, 'worktree');
  await worktreeRemove(ctx.root, dir);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dirname(dir), { recursive: true });
  await worktreeAdd(ctx.root, dir, ctx.head);
  const present = new Set(ctx.listing.entries.map((e) => e.path));
  for (const t of await lsTree(ctx.root, ctx.head)) if (!present.has(t.path)) rmSync(resolve(dir, t.path), { force: true });
  for (const e of ctx.listing.entries) {
    if (e.tag === 'G') continue;
    const to = resolve(dir, e.path);
    mkdirSync(dirname(to), { recursive: true });
    rmSync(to, { force: true });
    if (e.tag === 'L') symlinkSync(readlinkSync(resolve(ctx.root, e.path)), to);
    else cpSync(resolve(ctx.root, e.path), to);
  }
  // Installed tools for counterexample runs (`pnpm exec vitest`, `node`): a link the sandbox cannot write through.
  if (existsSync(resolve(ctx.root, 'node_modules')) && !existsSync(resolve(dir, 'node_modules'))) symlinkSync(resolve(ctx.root, 'node_modules'), resolve(dir, 'node_modules'), 'dir');
  return dir;
}

/** The `report.json` the reviewer reads as fact: every result so far (review's prerequisites). */
function currentReport(ctx: RunContext): string {
  const nodes = [...(ctx.rows?.values() ?? [])].filter((r) => r.id !== 'review' && r.id !== 'accept');
  return JSON.stringify({ schemaVersion: '3', packetId: ctx.packet?.id ?? null, head: ctx.head, nodes }, null, 2);
}

async function diffOf(ctx: RunContext, base: string): Promise<string> {
  const parts = [await diffText(ctx.root, base)];
  for (const p of ctx.listing.untracked) {
    try {
      parts.push(`diff --git a/${p} b/${p}\nnew file (untracked)\n+++ b/${p}\n${readFileSync(resolve(ctx.root, p), 'utf8')}`);
    } catch {
      // C.6 already made an unreadable path `io`
    }
  }
  return parts.join('\n');
}

/** `<path>:<line>[:<col>]` naming a file of the candidate and a line inside it. */
function validLocator(ctx: RunContext, lines: Map<string, number>, locator: string): boolean {
  const m = /^(.+?):(\d+)(?::\d+)?$/.exec(locator);
  if (!m) return false;
  const path = m[1]!;
  if (!lines.has(path)) {
    if (!ctx.listing.entries.some((e) => e.path === path && e.tag === 'F')) return false;
    try {
      lines.set(path, readFileSync(resolve(ctx.root, path), 'utf8').replace(/\n$/, '').split('\n').length);
    } catch {
      return false;
    }
  }
  const n = Number(m[2]);
  return n >= 1 && n <= lines.get(path)!;
}

/** 02 §9: `observed` only when the evidence names a command in the stream and the sha256 of its output. */
function observedInStream(evidence: string, s: StreamSummary | null): boolean {
  for (const t of s?.tools ?? []) {
    if (t.command === undefined || t.output === undefined) continue;
    const inner = /^\S+ -l?c '?(.*?)'?$/.exec(t.command)?.[1];
    const named = evidence.includes(t.command) || (inner !== undefined && inner !== '' && evidence.includes(inner));
    if (named && (evidence.includes(sha256(t.output)) || evidence.includes(sha256(t.output.trimEnd())))) return true;
  }
  return false;
}

/** PL-10 over the current review: which findings a disposition removes from the verdict. */
export function disposed(packetText: string, f: Pick<ReviewFinding, 'fingerprint' | 'basis'>): string | null {
  const d = dispositions(packetText).find((x) => f.fingerprint.startsWith(x.prefix));
  if (!d) return null;
  if (d.disposition === 'accepted-risk') return 'accepted-risk';
  return f.basis === 'observed' ? null : 'not-a-defect'; // a not-a-defect claim falls when the finding recurs observed
}

interface Judged { outcome: NodeOutcome; file: ReviewFile | null }

/** B.27 Status over a validated phase-2 answer (shared by the local and CI paths). */
export function judge(ctx: RunContext, p: PacketFacts, ids: readonly string[], expected: number, out: Phase2 | ReviewFile, findings: ReviewFinding[], details: Extract<NodeOutcome['details'], { node: 'review' }>): Judged {
  const lines = new Map<string, number>();
  const inList = new Set(ids);
  const seen = new Map<string, Phase2['requirements'][number]>();
  for (const r of out.requirements) if (inList.has(r.id) && !seen.has(r.id)) seen.set(r.id, r);
  const observed = seen.size;
  const evaluated = [...seen.values()].filter((r) => r.locators.length > 0).length;
  const counts = { expected, observed, evaluated };
  const badLocator = [...out.requirements.flatMap((r) => r.locators), ...findings.map((f) => f.locator)].find((l) => !validLocator(ctx, lines, l));
  const blocker = findings.some((f) => f.severity === 'blocker');
  const inconsistent = (out.verdict === 'blockers' && !blocker) || (out.verdict === 'no-blockers' && blocker);
  const unexamined = ids.filter((id) => !seen.has(id) || seen.get(id)!.locators.length === 0);
  const live = findings.filter((f) => disposed(p.text, f) === null);
  const verdict: 'blockers' | 'unknown' | 'no-blockers' = live.some((f) => f.severity === 'blocker') ? 'blockers' : out.verdict === 'unknown' ? 'unknown' : 'no-blockers';
  const d = { ...details, verdict, unexamined };
  if (badLocator !== undefined || inconsistent) {
    const why = badLocator !== undefined ? `invalid locator ${badLocator}` : `verdict ${out.verdict} is inconsistent with the findings`;
    return { outcome: { status: 'UNKNOWN', reason: 'schema-invalid', ...counts, findings: [{ locator: `${p.path}:1`, message: `review UNKNOWN (schema-invalid): ${why}`, standard: STANDARD, hint: HINTS['schema-invalid'] }], details: { ...d, verdict: 'unknown' } }, file: null };
  }
  const file: ReviewFile = {
    packetId: p.id, head: ctx.head, candidateDigest: digestOf(ctx.listing), specSha256: p.specSha256,
    requirements: out.requirements, findings, verdict: out.verdict,
    inputTokens: details.inputTokens, outputTokens: details.outputTokens, seconds: details.seconds, model: details.model,
    workerFamily: 'unknown', workerTrailers: [],
  };
  const lineOf = (f: ReviewFinding): Finding => ({ locator: f.locator, message: `${f.statement} (${f.requirement}, ${f.severity}, basis: ${f.basis})`, standard: STANDARD, hint: 'fix or dispose with a contract-bound reason' });
  if (verdict === 'blockers') return { outcome: { status: 'FAIL', ...counts, findings: live.map(lineOf), details: d }, file };
  if (observed < expected || unexamined.length > 0) {
    return { outcome: { status: 'UNKNOWN', reason: 'review-incomplete', ...counts, findings: [{ locator: `${p.path}:1`, message: `review UNKNOWN (review-incomplete): unexamined ${unexamined.join(', ') || `${expected - observed} requirement(s)`}`, standard: STANDARD, hint: HINTS['review-incomplete'] }], details: d }, file };
  }
  if (verdict === 'unknown') return { outcome: { status: 'UNKNOWN', reason: 'verdict-unknown', ...counts, findings: [{ locator: `${p.path}:1`, message: 'review UNKNOWN (verdict-unknown): the reviewer answered unknown', standard: STANDARD, hint: HINTS['verdict-unknown'] }], details: d }, file };
  return { outcome: { status: 'PASS', ...counts, findings: [], details: d }, file };
}

export const review: NodeAdapter = {
  id: 'review',
  contract: 1,
  configFiles: () => ['devai.json'],
  inputs: (ctx) => [ctx.packet?.path, ctx.packet?.specPath].filter((p): p is string => typeof p === 'string').sort(),
  // C.4 (D-076): the general key (every prerequisite's resultDigest, toolchainDigest, configDigest) plus
  // candidate digest, specSha256, packet digest (dispositions included), prompt digest, model id.
  async keyExtra(ctx) {
    const p = ctx.packet;
    const prefix = p ? (await workerOf(ctx, p)).prefix : null;
    return [digestOf(ctx.listing), p?.specSha256 ?? '', p ? sha256(p.text) : '', REVIEW_PROMPT_DIGEST, prefix ? modelIdOf(prefix) : 'none'];
  },
  async run(ctx: RunContext): Promise<NodeOutcome> {
    const p = ctx.packet;
    if (!p) return unknown('runner-crashed', 0, 'devai.json:1', 'review runs under --packet --full only (A.3)');
    const locator = `${p.path}:1`;
    const m = await material(ctx, p);
    if ('missing' in m) return unknown('missing-source', 0, m.missing, 'phase-1 material is missing at base', { packet: p });
    const blankDetails = (model: string) => ({ node: 'review' as const, model, verdict: 'unknown' as const, inputTokens: 0, outputTokens: 0, seconds: 0, toolCalls: 0, unexamined: m.expected ?? [] });

    // CI (C.1): verify the tracked evidence by the head's candidate digest, never call a model.
    if (ciMode()) {
      const v = verifyReview(ctx.root, { packetId: p.id, candidateDigest: digestOf(ctx.listing), specSha256: p.specSha256 });
      const expected = m.expected?.length ?? 0;
      if (v.kind === 'stale') return unknown('stale', expected, `${reviewPath(p.id)}:1`, v.message, { packet: p, details: blankDetails('none') });
      const e = v.value;
      const ids = m.expected ?? e.requirements.map((r) => r.id);
      const details = { node: 'review' as const, model: e.model, verdict: e.verdict, inputTokens: e.inputTokens, outputTokens: e.outputTokens, seconds: e.seconds, toolCalls: 0, unexamined: [] };
      const j = judge(ctx, p, ids, ids.length, e, e.findings, details).outcome;
      return j.status === 'PASS' ? { ...j, fromEvidence: true } : j;
    }

    const worker = await workerOf(ctx, p);
    const trailerLines = worker.trailers.map((t) => ({ locator, message: `trailer: ${t} → ${trailerFamily(t)}`, standard: STANDARD, hint: HINTS.family }));
    if (worker.family !== 'claude' && worker.family !== 'gpt') {
      return unknown('family', m.expected?.length ?? 0, locator, `worker family ${worker.family} from ${worker.trailers.length} Co-Authored-By trailer(s) in ${p.base.slice(0, 7)}..HEAD`, { packet: p, more: trailerLines });
    }
    if (!worker.prefix) return unknown('no-reviewer-configured', m.expected?.length ?? 0, 'devai.json:1', `no review.reviewers.${worker.family}`, { packet: p });
    const harness = harnessOf(worker.prefix);
    const reviewerFamily = harness === 'claude' ? 'claude' : 'gpt';
    if (reviewerFamily === worker.family) return unknown('family', m.expected?.length ?? 0, locator, `reviewer ${worker.prefix} is the worker's family`, { packet: p, more: trailerLines });

    const started = Date.now();
    const digest = digestOf(ctx.listing);
    const scratchRoot = resolve(ctx.root, '.devai/cache/scratch', digest);
    const empty = resolve(scratchRoot, 'empty');
    rmSync(empty, { recursive: true, force: true });
    mkdirSync(empty, { recursive: true });
    let input = 0;
    let output = 0;
    let toolCalls = 0;
    const details = (model: string, verdict: 'no-blockers' | 'blockers' | 'unknown' = 'unknown', unexamined: string[] = m.expected ?? []) =>
      ({ node: 'review' as const, model, verdict, inputTokens: input, outputTokens: output, seconds: (Date.now() - started) / 1000, toolCalls, unexamined });
    const failed = (r: Extract<ModelResult<unknown>, { kind: 'unknown' }>, phase: 1 | 2, unexamined: string[]): NodeOutcome => {
      // Phase 2 terminated without output (tool calls or wall time) is budget-exhausted (B.27).
      const reason: Reason = r.reason === 'timeout' ? 'budget-exhausted' : r.reason;
      return unknown(reason, m.expected?.length ?? unexamined.length, locator, `phase ${phase}: ${r.message}`, { packet: p, prefix: worker.prefix!, details: details(modelIdOf(worker.prefix!), 'unknown', unexamined) });
    };

    // Phase 1: blind, no tools, prompt holds no candidate bytes.
    const prompt1 = fill(PHASE1, { kind: p.kind, setpoint: PINNING_KINDS.includes(p.kind) ? SETPOINT.pinning : p.kind === 'spec' ? SETPOINT.spec : SETPOINT.standards, material: m.text });
    const proxy1 = proxyTokens(prompt1);
    if (proxy1 > REVIEW_INPUT_BOUND) return unknown('input-bound-exceeded', m.expected?.length ?? 0, locator, `phase-1 prompt proxy ${proxy1} > ${REVIEW_INPUT_BOUND}`, { packet: p, details: details(modelIdOf(worker.prefix)) });
    const r1 = await callModel<Phase1>({
      prefix: worker.prefix, mode: 'phase1', schema: ReviewPhase1, prompt: prompt1, cwd: empty, scratch: resolve(scratchRoot, 'schema'),
      timeoutMs: REVIEW_TIMEOUT_MS, inputBound: REVIEW_INPUT_BOUND, outputBound: REVIEW_OUTPUT_BOUND, toolUseReason: 'capability-missing',
    });
    input += r1.usage?.input ?? 0;
    output += r1.usage?.output ?? 0;
    if (r1.kind === 'unknown') return failed(r1, 1, m.expected ?? []);
    const ids = [...new Set(r1.output.requirements.map((r) => r.id))];
    const expectedIds = m.expected ?? ids;

    // Phase 2: the scratch copy of the candidate, under the sandbox.
    let r2: ModelResult<Phase2>;
    let model = r1.model;
    try {
      const wt = await scratchWorktree(ctx, digest);
      const prompt2 = fill(PHASE2, { phase1: JSON.stringify(r1.output, null, 2), packet: p.text, report: currentReport(ctx), diff: await diffOf(ctx, p.base) });
      const proxy2 = proxyTokens(prompt2);
      if (proxy1 + proxy2 > REVIEW_INPUT_BOUND || input + proxy2 > REVIEW_INPUT_BOUND) {
        return unknown('input-bound-exceeded', expectedIds.length, locator, `phase-2 prompt proxy ${proxy2} over the remaining ${REVIEW_INPUT_BOUND - input}`, { packet: p, details: details(model, 'unknown', expectedIds) });
      }
      const remaining = REVIEW_TIMEOUT_MS - (Date.now() - started);
      r2 = await callModel<Phase2>({
        prefix: worker.prefix, mode: 'phase2', schema: ReviewModelOutput, prompt: prompt2, cwd: wt, scratch: resolve(scratchRoot, 'schema'),
        timeoutMs: Math.max(1, remaining), inputBound: REVIEW_INPUT_BOUND - input, outputBound: REVIEW_OUTPUT_BOUND - output,
        maxToolCalls: REVIEW_TOOL_CALLS, toolUseReason: 'capability-missing',
      });
    } finally {
      await worktreeRemove(ctx.root, resolve(scratchRoot, 'worktree'));
      rmSync(scratchRoot, { recursive: true, force: true });
    }
    input += r2.usage?.input ?? 0;
    output += r2.usage?.output ?? 0;
    toolCalls = r2.summary?.tools.length ?? 0;
    if (r2.kind === 'unknown') return failed(r2, 2, expectedIds);
    model = r2.model;

    const findings: ReviewFinding[] = r2.output.findings.map((f) => ({
      ...f,
      fingerprint: fingerprint(f.requirement, f.locator, f.statement),
      basis: f.basis === 'observed' && !observedInStream(f.evidence, r2.summary) ? 'derived' : f.basis,
    }));
    const j = judge(ctx, p, expectedIds, expectedIds.length, r2.output, findings, details(model));
    if (j.file) {
      const file = { ...j.file, workerFamily: worker.family, workerTrailers: worker.trailers };
      writeVerdict(ctx.root, 'review', digest, file);
      if (p.full) writeReview(ctx.root, file);
    }
    return j.outcome;
  },
};
