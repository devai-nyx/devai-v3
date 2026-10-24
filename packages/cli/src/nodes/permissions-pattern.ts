// 08 B.24 `permissions-pattern` (02 §4, S-12): the permission slice of the mounted routes sent to the
// worker family's reviewer CLI with no tools (D-074, D-082), the answer validated with `SensorOutput`,
// bounds per 10 §4 / 02 §4 (proxy `bytes / 3.5` before the call, CLI-reported usage after), and under
// `--packet --full` the validated output written to `.devai/review/<packet-id>.permissions.json` with the
// `minConfidence` in force (D-083). In CI the node never calls a model: it verifies that file (C.1).
import { mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Reason } from '../main.js';
import { proxyTokens, SENSOR_OUTPUT_BOUND, SENSOR_TIMEOUT_MS } from '../model/budget.js';
import { callModel, modelIdOf, type ModelResult } from '../model/cli.js';
import { ciMode, sensorPath, verifySensor, writeSensor, writeVerdict } from '../model/evidence.js';
import { harnessOf, rangeFamily, sensorReviewerFor, workerTrailers, type WorkerFamily } from '../model/packet.js';
import { fill, promptDigest, SENSOR } from '../model/prompts.js';
import { linesOf, permissionSlice, renderSlice, type Slice } from '../model/slice.js';
import { SensorOutput } from '../report.js';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { HINTS } from '../text/hints.js';
import type { Finding } from '../ts/outcome.js';
import type { z } from 'zod';

type Output = z.infer<typeof SensorOutput>;
const STANDARD = 'S-12';
/** The 02 §4 question: the last paragraph of the 10 §3.3 template, after the slice. */
export const QUESTION = SENSOR.slice(SENSOR.indexOf('SLICE>>>\n') + 'SLICE>>>\n'.length);
export const SENSOR_PROMPT_DIGEST = promptDigest(SENSOR);

const slices = new WeakMap<RunContext, Slice>();
const sliceOf = (ctx: RunContext): Slice => {
  let s = slices.get(ctx);
  if (!s) slices.set(ctx, (s = permissionSlice(ctx)));
  return s;
};

interface Reviewer { family: WorkerFamily; trailers: string[]; prefix: string | null }
async function reviewerOf(ctx: RunContext): Promise<Reviewer> {
  const base = ctx.packet?.base ?? ctx.base;
  const trailers = base ? await workerTrailers(ctx.root, base) : [];
  const family = rangeFamily(trailers);
  return { family, trailers, prefix: sensorReviewerFor(ctx.config, family) };
}

/** B.24 Status message: `permissions-pattern UNKNOWN (<reason>): <10 §4 hint>`. */
function unknownFinding(reason: Reason, locator: string, hint = HINTS[reason]): Finding {
  return { locator, message: `permissions-pattern UNKNOWN (${reason}): ${hint}`, standard: STANDARD, hint };
}
const unknownOutcome = (reason: Reason, expected: number, findings: Finding[], details?: NodeOutcome['details']): NodeOutcome =>
  ({ status: 'UNKNOWN', reason, expected, observed: 0, evaluated: 0, findings, ...(details ? { details } : {}) });

/** `model-error`'s hint names the reviewer command (10 §4). */
const hintFor = (reason: Reason, prefix: string, r?: ModelResult<unknown>): string =>
  r?.kind === 'unknown' && r.hint ? r.hint : reason === 'model-error' ? HINTS['model-error'].replace('<reviewer command>', prefix.split(/\s+/)[0]!).slice(0, 160) : HINTS[reason];

/** B.24 Status over a validated answer (shared by the local and CI paths). */
export function judge(slice: Slice, out: Output, minConfidence: number, details: NodeOutcome['details']): NodeOutcome {
  const expected = slice.entrypoints.length;
  const known = (e: string) => slice.entrypoints.find((p) => p.id === e || p.route === e || p.locator === e);
  const inspected = new Set(out.inspectedEntrypoints.map(known).filter((p) => p !== undefined).map((p) => p.id));
  const observed = inspected.size;
  const files = new Map(slice.files.map((f) => [f.path, linesOf(f.text)]));
  const valid = out.findings.filter((f) => (files.get(f.path) ?? 0) >= f.line);
  const allValid = valid.length === out.findings.length;
  const evaluated = allValid ? observed : 0;
  const counts = { expected, observed, evaluated };
  const d = details ? { details } : {};
  const fail = (f: Output['findings']): Finding[] => f.map((x) => ({ locator: `${x.path}:${x.line}`, message: `${x.statement} — ${x.evidence}`, standard: STANDARD, hint: 'decide from the token principal' }));
  if (out.verdict === 'violation') {
    if (valid.length > 0) return { status: 'FAIL', ...counts, findings: fail(valid), ...d };
    return { status: 'UNKNOWN', reason: 'schema-invalid', ...counts, findings: [unknownFinding('schema-invalid', 'devai.json:1')], ...d };
  }
  if (out.verdict === 'unknown') return { status: 'UNKNOWN', reason: 'verdict-unknown', ...counts, findings: [unknownFinding('verdict-unknown', 'devai.json:1')], ...d };
  // compliant: every other PASS condition, else verdict-unknown with what was missing.
  if (!allValid || out.findings.length > 0) {
    return { status: 'UNKNOWN', reason: 'schema-invalid', ...counts, findings: [unknownFinding('schema-invalid', 'devai.json:1'), ...fail(out.findings.filter((f) => !valid.includes(f))).map((f) => ({ ...f, message: `invalid locator in a compliant answer: ${f.message}` }))], ...d };
  }
  const gaps: Finding[] = [
    ...out.unresolved.map((u) => ({ locator: 'devai.json:1', message: `unresolved: ${u}`, standard: STANDARD, hint: HINTS['verdict-unknown'] })),
    ...slice.entrypoints.filter((p) => !inspected.has(p.id)).map((p) => ({ locator: p.locator, message: `entrypoint ${p.id} not inspected`, standard: STANDARD, hint: HINTS['verdict-unknown'] })),
    ...(out.confidence < minConfidence ? [{ locator: 'devai.json:1', message: `confidence ${out.confidence} < minConfidence ${minConfidence}`, standard: STANDARD, hint: HINTS['verdict-unknown'] }] : []),
  ];
  if (gaps.length > 0) return { status: 'UNKNOWN', reason: 'verdict-unknown', ...counts, findings: [unknownFinding('verdict-unknown', 'devai.json:1'), ...gaps], ...d };
  return { status: 'PASS', ...counts, findings: [], ...d };
}

export const permissionsPattern: NodeAdapter = {
  id: 'permissions-pattern',
  contract: 1,
  // `agentic.permissionsPattern` (B.24 Inputs) is in devai.json; its change misses the cache (D-076, N20).
  configFiles: () => ['devai.json'],
  inputs: (ctx) => {
    const listed = new Set(ctx.listing.entries.map((e) => e.path));
    return sliceOf(ctx).files.map((f) => f.path).filter((p) => listed.has(p));
  },
  // C.4 (D-076): slice digest, prompt digest, model id.
  async keyExtra(ctx) {
    const r = await reviewerOf(ctx);
    return [sliceOf(ctx).digest, SENSOR_PROMPT_DIGEST, r.prefix ? modelIdOf(r.prefix) : 'none'];
  },
  async run(ctx: RunContext): Promise<NodeOutcome> {
    const slice = sliceOf(ctx);
    const expected = slice.entrypoints.length;
    const { minConfidence, maxInputTokens } = ctx.config.agentic.permissionsPattern;
    if (slice.unresolved.length > 0) {
      return unknownOutcome('mount-unresolved', expected, [unknownFinding('mount-unresolved', slice.unresolved[0]!.locator), ...slice.unresolved.map((u) => ({ locator: u.locator, message: u.message, standard: STANDARD, hint: HINTS['mount-unresolved'] }))]);
    }
    if (slice.missing.length > 0) {
      return unknownOutcome('missing-source', expected, [unknownFinding('missing-source', slice.missing[0]!.locator), ...slice.missing.map((u) => ({ locator: u.locator, message: u.message, standard: STANDARD, hint: HINTS['missing-source'] }))]);
    }

    // CI (C.1): verify the tracked evidence, never call a model.
    if (ciMode()) {
      if (!ctx.packet) return unknownOutcome('stale', expected, [unknownFinding('stale', 'devai.json:1')]);
      const v = verifySensor(ctx.root, { packetId: ctx.packet.id, sliceDigest: slice.digest, promptDigest: SENSOR_PROMPT_DIGEST, minConfidence });
      const hint = HINTS.stale.replace('<p>', ctx.packet.path);
      if (v.kind === 'stale') return unknownOutcome('stale', expected, [unknownFinding('stale', `${sensorPath(ctx.packet.id)}:1`, hint), { locator: `${sensorPath(ctx.packet.id)}:1`, message: v.message, standard: STANDARD, hint }]);
      const e = v.value;
      const details = { node: 'permissions-pattern' as const, sliceDigest: slice.digest, model: e.model, inputTokens: e.inputTokens, outputTokens: e.outputTokens, seconds: e.seconds, proxyTokens: proxyTokens(renderSlice(slice) + QUESTION) };
      const o = judge(slice, e.output, minConfidence, details);
      return o.status === 'PASS' ? { ...o, fromEvidence: true } : o;
    }

    const reviewer = await reviewerOf(ctx);
    if (reviewer.family === 'mixed') {
      return unknownOutcome('family', expected, [unknownFinding('family', 'devai.json:1'), ...reviewer.trailers.map((t) => ({ locator: 'devai.json:1', message: `trailer: ${t}`, standard: STANDARD, hint: HINTS.family }))]);
    }
    if (!reviewer.prefix) return unknownOutcome('no-reviewer-configured', expected, [unknownFinding('no-reviewer-configured', 'devai.json:1')]);
    const harness = harnessOf(reviewer.prefix);
    if (!harness) return unknownOutcome('capability-missing', expected, [unknownFinding('capability-missing', 'devai.json:1')]);

    const sliceText = renderSlice(slice);
    const proxy = proxyTokens(sliceText + QUESTION);
    if (proxy > maxInputTokens) {
      return unknownOutcome('slice-too-large', expected, [
        unknownFinding('slice-too-large', `${slice.files[0]?.path ?? 'devai.json'}:1`),
        ...slice.files.map((f) => ({ locator: `${f.path}:1`, message: `slice file, ${Buffer.byteLength(f.text)} bytes (proxy ${proxy} > maxInputTokens ${maxInputTokens})`, standard: STANDARD, hint: HINTS['slice-too-large'] })),
      ]);
    }

    const scratch = resolve(ctx.root, '.devai/cache/scratch', `${slice.digest.slice(0, 12)}-sensor`);
    rmSync(scratch, { recursive: true, force: true });
    const empty = resolve(scratch, 'empty');
    mkdirSync(empty, { recursive: true });
    let r: ModelResult<Output>;
    try {
      r = await callModel({
        prefix: reviewer.prefix, mode: 'sensor', schema: SensorOutput, prompt: fill(SENSOR, { slice: sliceText }), cwd: empty, scratch: resolve(scratch, 'schema'),
        timeoutMs: SENSOR_TIMEOUT_MS, inputBound: maxInputTokens, outputBound: SENSOR_OUTPUT_BOUND, toolUseReason: 'tool-use-observed',
      });
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
    const usage = r.usage ?? { input: 0, output: 0 };
    const model = r.kind === 'ok' ? r.model : modelIdOf(reviewer.prefix);
    const details = { node: 'permissions-pattern' as const, sliceDigest: slice.digest, model, inputTokens: usage.input, outputTokens: usage.output, seconds: r.seconds, proxyTokens: proxy };
    if (r.kind === 'unknown') {
      const hint = hintFor(r.reason, reviewer.prefix, r);
      return unknownOutcome(r.reason, expected, [unknownFinding(r.reason, 'devai.json:1', hint), { locator: 'devai.json:1', message: r.message, standard: STANDARD, hint }], details);
    }
    writeVerdict(ctx.root, 'permissions-pattern', slice.digest, { sliceDigest: slice.digest, promptDigest: SENSOR_PROMPT_DIGEST, model, output: r.output });
    if (ctx.packet?.full) {
      writeSensor(ctx.root, {
        packetId: ctx.packet.id, sliceDigest: slice.digest, promptDigest: SENSOR_PROMPT_DIGEST, model, output: r.output,
        inputTokens: usage.input, outputTokens: usage.output, seconds: r.seconds, minConfidence,
      });
    }
    return judge(slice, r.output, minConfidence, details);
  },
};
