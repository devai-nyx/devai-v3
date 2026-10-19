import { z } from 'zod';
const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const Sha1 = z.string().regex(/^[0-9a-f]{40}$/);
const Count = z.number().int().nonnegative();
const Text = z.string().min(1);
export const NodeId = z.enum(['inventory','format','lint','lint-tests','typecheck','layout','sql-lint','spec-lint',
  'route-contract','sql-typed','unit','test-integrity','i18n','actionlint','commitlint','generated','boundary',
  'deadcode','openapi','db-apply','spec-tests','integration','e2e','permissions-pattern','protected-paths',
  'packet-scope','review','accept']);                                               // the 28 of 02 §2
export const Status = z.enum(['PASS', 'FAIL', 'UNKNOWN', 'SKIPPED']);
export const ReasonCode = z.enum([
  // could not run (command level)
  'config-invalid','not-a-repository','packet-invalid','base-not-ancestor','expect-red-nothing-named','no-report',
  'candidate-changed','usage','dir-not-empty','spec-not-approved','spec-invalid','spec-superseded','output-exists','spec-mismatch',
  // could not observe (node level)
  'no-observations','prerequisite-failed','tooling-missing','engines-mismatch','lint-config-failed','runner-crashed','timeout',
  'base-unreadable','io','parser-unavailable','adapter-unbound','unsupported-oid','unsupported-binding','mount-unresolved',
  'missing-source','postgres-unreachable','docker-unreachable','psql-missing','shell-missing','scratch-collision',
  'browsers-missing','setup-failed','expect-red-not-reached','assertion-unresolved','generator-version-mismatch',
  'generator-unavailable','catalog-unresolved','slice-too-large','input-bound-exceeded','output-bound-exceeded',
  'budget-exhausted','review-incomplete','tool-use-observed','capability-missing','schema-invalid','verdict-unknown',
  'model-error','no-reviewer-configured','family','stale',
]);
export const Finding = z.strictObject({
  locator: Text,                         // <path>:<line>[:<col>] or <path>:1
  message: Text,
  standard: Text,                        // 'S-27', '04 §2', '05 PL-07', 'tests', 'tiers' (02 §8: required)
  hint: Text.max(160),                   // one line (02 §8: required)
});
const Details = z.discriminatedUnion('node', [
  z.strictObject({ node: z.literal('inventory'), toolchainDigest: Sha256, populations: z.record(NodeId, z.strictObject({ predicate: Text, count: Count })) }),
  z.strictObject({ node: z.literal('sql-typed'), phase: z.enum(['static', 'db']), queries: z.array(z.strictObject({ name: Text, path: Text, textSha256: Sha256 })) }),
  z.strictObject({ node: z.literal('db-apply'), schemaDigest: Sha256, database: z.string().regex(/^devai_[0-9a-f]{12}$/), dropped: z.boolean() }),
  z.strictObject({ node: z.literal('spec-tests'), expectRed: z.array(z.string().regex(/^R-[1-9][0-9]*$/)), reached: z.array(Text), uncovered: z.array(Text) }),
  z.strictObject({ node: z.literal('permissions-pattern'), sliceDigest: Sha256, model: Text, inputTokens: Count, outputTokens: Count, seconds: z.number().nonnegative(), proxyTokens: Count }),
  z.strictObject({ node: z.literal('review'), model: Text, verdict: z.enum(['no-blockers','blockers','unknown']), inputTokens: Count, outputTokens: Count, seconds: z.number().nonnegative(), toolCalls: Count, unexamined: z.array(Text) }),
  z.strictObject({ node: z.literal('protected-paths'), touched: z.array(z.strictObject({ class: Text, paths: z.array(Text), declared: z.boolean().nullable() })) }),
  z.strictObject({ node: z.literal('accept'), requiredSet: z.array(NodeId), deferred: z.array(NodeId), editLoopMs: Count.nullable() }),
]);
export const NodeResult = z.strictObject({
  id: NodeId,
  status: Status,
  expected: Count, observed: Count, evaluated: Count,
  findings: z.array(Finding),
  reason: ReasonCode.optional(),         // UNKNOWN only
  evidence: z.string().optional(),       // SKIPPED only: inventory's population predicate string (D-044)
  durationMs: Count,
  cached: z.boolean(),
  cacheKey: Sha256.optional(),
  needs: z.array(z.enum(['postgres', 'model'])),
  details: Details.optional(),
}).superRefine((n, ctx) => {             // Astra's invariants, imported
  const bad = (m: string) => ctx.addIssue({ code: 'custom', message: `${n.id}: ${m}` });
  if (n.evaluated > n.observed) bad('evaluated > observed');
  if (n.status === 'PASS' && (n.observed === 0 || n.findings.length > 0)) bad('PASS needs observed > 0 and no findings');
  if (n.status === 'FAIL' && n.findings.length === 0) bad('FAIL needs a finding');
  if (n.status === 'UNKNOWN' && !n.reason) bad('UNKNOWN needs a reason');
  if (n.status === 'SKIPPED' && (!n.evidence || n.observed !== 0 || n.expected !== 0)) bad('SKIPPED needs evidence and zero counts');
  if (n.cached && n.status !== 'PASS') bad('only PASS is reusable');
  if (n.details && n.details.node !== n.id) bad('details belong to another node');
});
export const Report = z.strictObject({
  schemaVersion: z.literal('3'),
  command: Text,                         // the argv as run, e.g. "devai check --packet … --full"
  packetId: z.string().regex(/^PKT-[A-Z0-9]+-\d{3}$/).nullable(),
  kind: z.enum(['spec','generate','test','code','fix','standards']).nullable(),
  specId: Text.nullable(), specSha256: Sha256.nullable(),                 // null for spec/standards kinds and no-packet runs
  base: Sha1.nullable(),
  head: Sha1.nullable(), candidateDigest: Sha256.nullable(), toolchainDigest: Sha256.nullable(), // null only before acquisition (config-invalid, not-a-repository)
  runtime: z.enum(['bare', 'docker']).nullable(),
  accepted: z.boolean(),                 // true only on --packet --full with exit 0
  exitCode: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  reason: ReasonCode.optional(),         // command-level could-not-run
  nodes: z.array(NodeResult),            // every planned node; prerequisite failures included; deferred nodes absent
  durationMs: Count,
}).superRefine((r, ctx) => {
  const bad = (m: string) => ctx.addIssue({ code: 'custom', message: m });
  if (new Set(r.nodes.map((n) => n.id)).size !== r.nodes.length) bad('duplicate node id');
  if (r.nodes.length > 0 && !r.nodes.some((n) => n.id === 'accept')) bad('accept row missing');
  if (r.accepted && (r.exitCode !== 0 || !r.packetId || !r.base || !r.candidateDigest || !r.toolchainDigest || !/\s--full(\s|$)/.test(r.command))) bad('accepted needs a full packet run with exit 0');
  if (r.exitCode === 2 && !r.reason && !r.nodes.some((n) => n.status === 'UNKNOWN')) bad('exit 2 needs a reason or an UNKNOWN row');
  if (r.exitCode === 1 && !r.nodes.some((n) => n.status === 'FAIL')) bad('exit 1 needs a FAIL row');
  if (r.reason && r.exitCode !== 2) bad('a command-level reason is exit 2');
});
export type Report = z.infer<typeof Report>;

// The two tracked evidence files under .devai/review/ (02 §11), validated with the same definitions that emit the model schemas.
export const SensorOutput = z.strictObject({                                   // 02 §4 question's JSON
  verdict: z.enum(['compliant','violation','unknown']), inspectedEntrypoints: z.array(Text),
  findings: z.array(z.strictObject({ path: Text, line: z.number().int().positive(), statement: Text, evidence: Text })),
  unresolved: z.array(Text), confidence: z.number().min(0).max(1),
});
export const SensorEvidence = z.strictObject({                                 // .devai/review/<packet-id>.permissions.json (D-058)
  packetId: z.string().regex(/^PKT-[A-Z0-9]+-\d{3}$/), sliceDigest: Sha256, promptDigest: Sha256, model: Text,
  output: SensorOutput, inputTokens: Count, outputTokens: Count, seconds: z.number().nonnegative(),
});
export const Review = z.strictObject({                                         // .devai/review/<packet-id>.json, 02 §9 shape
  packetId: z.string().regex(/^PKT-[A-Z0-9]+-\d{3}$/), head: Sha1, candidateDigest: Sha256, specSha256: Sha256.nullable(),
  requirements: z.array(z.strictObject({ id: Text, implemented: z.enum(['yes','no','partial']), tested: z.enum(['yes','no','weak']), locators: z.array(Text) })),
  findings: z.array(z.strictObject({ fingerprint: Sha256, severity: z.enum(['blocker','major','minor']), requirement: Text, locator: Text,
    statement: Text, evidence: Text, counterexample: Text.optional(), basis: z.enum(['observed','derived']), confidence: z.number().min(0).max(1) })),
  verdict: z.enum(['no-blockers','blockers','unknown']), inputTokens: Count, outputTokens: Count, seconds: z.number().nonnegative(), model: Text,
});
export const ReviewPhase1 = z.strictObject({ requirements: z.array(z.strictObject({ id: Text, observable: Text, falsifier: Text })).min(1) });   // phase-1 model output (10 §3.1)
export const ReviewModelOutput = Review.pick({ requirements: true, verdict: true }).extend({ findings: z.array(Review.shape.findings.element.omit({ fingerprint: true })) });   // phase-2 model output (10 §3.2); the runner adds fingerprint, digests, usage
