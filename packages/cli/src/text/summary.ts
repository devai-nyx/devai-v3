// 08 C.3 `--summary` grammar (≤ 10 lines; becomes the PR body). The flag itself arrives with packets
// (R6 W4); the renderer is pure over a Report plus the packet and review facts it names.
import type { DevaiConfig } from '../config.js';
import type { Report } from '../report.js';
import { gates } from '../runner/gating.js';

export interface SummaryInput {
  report: Report;
  config: DevaiConfig;
  title: string;
  /** `kind: spec` only: the candidate spec's status. */
  specStatus?: 'draft' | 'approved';
  /** From `.devai/review/<packet-id>.json` when `review` ran. */
  review?: { minor: number; disposed: string[]; workerFamily: string; reviewerFamily: string; head: string };
}

const short = (s: string | null): string => (s === null ? 'none' : `${s.slice(0, 4)}…`);
const MAX_NODE_LINES = 6;

export function renderSummary(s: SummaryInput): string[] {
  const r = s.report;
  const out: string[] = [];
  const subject = r.kind === 'spec' ? `spec ${r.specId} (candidate, ${s.specStatus ?? 'draft'})` : r.kind === 'standards' ? 'standards' : `spec ${r.specId} @ ${short(r.specSha256)} (frozen)`;
  out.push(`${r.packetId}  ${s.title}   ${subject}`);

  const accept = r.nodes.find((n) => n.id === 'accept');
  const pass = r.nodes.filter((n) => n.status === 'PASS').length;
  const skipped = r.nodes.filter((n) => n.status === 'SKIPPED');
  const skippedText = skipped.length > 0 ? `, ${skipped.length} skipped: ${skipped.map((n) => `${n.id}[${n.evidence}]`).join(', ')}` : '';
  out.push(`acceptance: ${accept?.status ?? 'UNKNOWN'} (${r.nodes.length} nodes: ${pass} pass${skippedText})   runtime: ${r.runtime ?? 'none'}`);

  const pp = r.nodes.find((n) => n.id === 'protected-paths');
  const touched = pp?.details?.node === 'protected-paths' ? pp.details.touched : [];
  const protectedText = touched.length === 0 ? 'none touched'
    : touched.map((t) => `${t.class} (${t.paths[0]}${t.paths.length > 1 ? `, +${t.paths.length - 1}` : ''}, ${t.declared === false ? 'undeclared' : 'declared'})`).join(', ');
  const scope = r.nodes.find((n) => n.id === 'packet-scope');
  const scopeText = !scope ? 'deferred' : scope.findings.length === 0 ? 'ok' : `${scope.findings.length} findings`;
  const st = r.nodes.find((n) => n.id === 'spec-tests');
  const red = st?.details?.node === 'spec-tests' && st.details.expectRed.length > 0 ? `, ${st.details.expectRed.length} expected red (${st.details.expectRed.join(', ')})` : '';
  const specTests = st ? `${st.observed}/${st.expected} requirements covered${red}` : 'deferred';
  out.push(`protected paths: ${protectedText}   packet scope: ${scopeText}   spec tests: ${specTests}`);

  const review = r.nodes.find((n) => n.id === 'review');
  if (review) {
    const blockers = review.findings.length;
    const verdict = review.details?.node === 'review' && review.details.verdict !== 'unknown'
      ? review.details.verdict === 'blockers' ? `blockers (${blockers})` : 'no blockers'
      : `unknown (${review.reason ?? 'verdict-unknown'})`;
    const disposed = s.review && s.review.disposed.length > 0 ? `: ${s.review.disposed.join(', ')}` : '';
    const tallied = gates(review, s.config, r.nodes) ? '' : ', tallied';
    out.push(`review: ${verdict} (${s.review?.minor ?? 0} minor, ${s.review?.disposed.length ?? 0} disposed${disposed}; mustRun: ${s.config.review.mustRun}${tallied})   worker: ${s.review?.workerFamily ?? 'unknown'}   reviewer: ${s.review?.reviewerFamily ?? 'unknown'}   bound to head ${short(s.review?.head ?? r.head)}`);
  }

  if (accept?.status !== 'PASS') {
    const gating = r.nodes.filter((n) => n.id !== 'accept' && gates(n, s.config, r.nodes));
    const bad = [...gating.filter((n) => n.status === 'FAIL'), ...gating.filter((n) => n.status === 'UNKNOWN')];
    const lines = bad.map((n) => `${n.id}: ${n.findings[0]?.message ?? n.reason ?? n.status}`);
    out.push(...(lines.length > MAX_NODE_LINES ? [...lines.slice(0, MAX_NODE_LINES - 1), `+${lines.length - (MAX_NODE_LINES - 1)} more nodes`] : lines));
  }
  return out;
}
