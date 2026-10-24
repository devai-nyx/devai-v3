// 08 C.3 text report (≤ 40 lines, overflow rule). Rendered from the same Report object as the JSON
// (07 §3); no colour, no TTY detection (Part D).
import type { DevaiConfig } from '../config.js';
import type { NodeRow } from '../cache/result-digest.js';
import { touchedLine } from '../packet/rules.js';
import type { Report } from '../report.js';
import { gates } from '../runner/gating.js';
import { HINTS } from './hints.js';

export const MAX_LINES = 40;
export const MAX_FINDINGS_PER_NODE = 8;

/** The observation unit of each node (Part B row "Observation"), printed after `expected <e>`. */
export const UNITS: Record<NodeRow['id'], string> = {
  inventory: 'packages', format: 'files', lint: 'files', 'lint-tests': 'files', typecheck: 'projects', layout: 'predicate checks',
  'sql-lint': 'SQL files', 'spec-lint': 'specs', 'route-contract': 'routes', 'sql-typed': 'queries', unit: 'cases',
  'test-integrity': 'test files', i18n: 'keys', actionlint: 'workflows', commitlint: 'messages', generated: 'entries',
  boundary: 'files', deadcode: 'checks', openapi: 'checks', 'db-apply': 'SQL files', 'spec-tests': 'acceptance requirements',
  integration: 'cases', e2e: 'tests', 'permissions-pattern': 'entrypoints', 'protected-paths': 'diffs', 'packet-scope': 'checks',
  review: 'requirements', accept: 'nodes',
};

const short = (sha: string | null): string => (sha === null ? 'none' : `${sha.slice(0, 4)}…`);
const plural = (n: number, w: string): string => `${n} ${w}${n === 1 ? '' : 's'}`;

export function statusLine(r: NodeRow): string {
  const evaluated = r.evaluated !== r.observed ? `, evaluated ${r.evaluated}` : '';
  return `${r.status.padEnd(7)}  ${r.id.padEnd(18)}  ${plural(r.findings.length, 'finding')}   (expected ${r.expected} ${UNITS[r.id]}, observed ${r.observed}${evaluated})`;
}

const findingLine = (f: NodeRow['findings'][number]): string => `      ${f.locator}  ${f.message}   [${f.standard}]  ${f.hint}`;
const unknownLine = (r: NodeRow): string => `      UNKNOWN ${r.id} ${r.reason}: ${HINTS[r.reason!]}`;

export function reviewLine(report: Report, config: DevaiConfig): string {
  const review = report.nodes.find((n) => n.id === 'review');
  if (!review) return 'review  not run: deferred';
  if (review.reason === 'prerequisite-failed') return 'review  not run: deterministic nodes failed';
  const verdict = review.details?.node === 'review' ? review.details.verdict : review.status === 'UNKNOWN' ? `unknown (${review.reason})` : review.status;
  const tallied = gates(review, config, report.nodes) ? '' : ', tallied';
  return `review  ${verdict} (${plural(review.findings.length, 'finding')}; mustRun: ${config.review.mustRun}${tallied})`;
}

export interface TextOptions {
  config: DevaiConfig;
  /** C.3 line 2 (D-076): the first untracked-not-ignored path when the working-tree digest ≠ HEAD's. */
  untracked?: string | null;
  /** 10 §4 stage line under `--hook` (W4). */
  hookLine?: string;
}

export function renderText(report: Report, opts: TextOptions): string[] {
  const header = [`${report.command}   runtime=${report.runtime ?? 'none'}   base=${short(report.base)}  head=${short(report.head)}`];
  if (opts.untracked) header.push(`untracked: ${opts.untracked} (not in any commit)`);
  if (report.reason) header.push(`devai: ${report.reason} — ${HINTS[report.reason]}`);

  const order = report.nodes;
  const failing = [...order.filter((n) => n.status === 'FAIL'), ...order.filter((n) => n.status === 'UNKNOWN')];
  const pass = order.filter((n) => n.status === 'PASS');
  const skipped = order.filter((n) => n.status === 'SKIPPED');
  const accept = order.find((n) => n.id === 'accept');
  const deferred = accept?.details?.node === 'accept' ? accept.details.deferred : [];

  // B.25: one notice line per protected class touched (02 §5's hook line); never a finding.
  const pp = order.find((n) => n.id === 'protected-paths');
  const notices = pp?.details?.node === 'protected-paths' ? pp.details.touched.map(touchedLine) : [];
  const tail = [...notices, `PASS  ${plural(pass.length, 'node')} (${pass.filter((n) => n.cached).length} cached, ${Math.round(report.durationMs / 1000)} s)`];
  if (skipped.length > 0) tail.push(`SKIPPED ${plural(skipped.length, 'node')}: ${skipped.map((n) => `${n.id}[${n.evidence}]`).join(', ')}`);
  if (deferred.length > 0) tail.push(`deferred: ${deferred.join(', ')}`);
  tail.push(reviewLine(report, opts.config));
  if (opts.hookLine) tail.push(opts.hookLine);

  // Overflow (C.3): per-node budget min(8, max(1, floor((40 − fixed) / failing))); when not even one
  // line per node fits, the lowest-priority nodes (UNKNOWN before FAIL, later DAG order first) collapse.
  let fixed = header.length + failing.length + tail.length + 1;
  let shown = failing;
  let collapsedFindings = 0;
  if (failing.length > 0 && MAX_LINES - fixed < failing.length) {
    fixed += 1; // the "+<n> more findings" line
    const room = Math.max(0, MAX_LINES - fixed);
    const priority = [...failing].reverse(); // UNKNOWN (later DAG first) before FAIL
    const collapse = new Set(priority.slice(0, failing.length - room).map((r) => r.id));
    shown = failing.filter((r) => !collapse.has(r.id));
    collapsedFindings = failing.filter((r) => collapse.has(r.id)).reduce((s, r) => s + r.findings.length, 0);
  }
  const per = shown.length === 0 ? 0 : Math.min(MAX_FINDINGS_PER_NODE, Math.max(1, Math.floor((MAX_LINES - fixed) / shown.length)));

  const blocks: string[] = [];
  let cut = collapsedFindings;
  for (const r of failing) {
    blocks.push(statusLine(r));
    if (!shown.includes(r)) continue;
    if (r.findings.length === 0) {
      blocks.push(unknownLine(r));
      continue;
    }
    const lines = r.findings.slice(0, per).map(findingLine);
    const more = r.findings.length - lines.length;
    if (more > 0) {
      lines[lines.length - 1] += `  +${more} more`;
      cut += more;
    }
    blocks.push(...lines);
  }
  const out = [...header, ...blocks, ...tail];
  if (collapsedFindings > 0 || shown.length < failing.length) out.push(`+${cut} more findings: .devai/cache/reports/${report.candidateDigest}.json`);
  out.push(`exit ${report.exitCode}`);
  return out;
}
