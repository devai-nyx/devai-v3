// 08 B.28 `accept`: aggregates every other planned node's result (never its own), derives the 05 §3
// required set, applies PL-15 (PL-12/PL-16 need the packet: R6 W4), records `editLoopMs` (D-047) and
// lists the deferred nodes without a status (D-058). Always runs, never cached, never blocked.
import type { NodeRow } from '../cache/result-digest.js';
import { byDag, type NodeId } from '../runner/edges.js';
import { gates } from '../runner/gating.js';
import { editLoopMs, type NodeOutcome, type RunContext, type Timing } from '../runner/run.js';

export type Kind = 'spec' | 'generate' | 'test' | 'code' | 'fix' | 'standards';

/** What `accept` reads from the packet (W4); null without `--packet`. */
export interface AcceptPacket {
  path: string;
  kind: Kind;
  /** The pinned spec's machine block sizes, or null for `spec`/`standards`. */
  spec: { routes: number; queries: number } | null;
  /** The changed paths of `base..candidate`. */
  diff: readonly string[];
}

const touchesPackageJson = (diff: readonly string[]) => diff.some((p) => p === 'package.json' || p.endsWith('/package.json'));

/** 05 §3 "Required PASS" by kind, with its conditions resolved (so PL-15 never sees a conditional). */
export function requiredSet(kind: Kind, spec: { routes: number; queries: number } | null, diff: readonly string[]): NodeId[] {
  const routes = (spec?.routes ?? 0) > 0;
  const queries = (spec?.queries ?? 0) > 0;
  switch (kind) {
    case 'spec':
      return ['spec-lint'];
    case 'generate':
      return ['generated', 'layout', 'lint', 'typecheck', 'unit', 'sql-lint', 'db-apply', ...(routes ? (['route-contract'] as const) : []), ...(queries ? (['sql-typed'] as const) : [])];
    case 'test':
      return ['spec-tests', 'test-integrity', 'lint-tests', 'typecheck', 'db-apply'];
    case 'code':
    case 'fix':
      return ['spec-tests', 'unit', 'lint', 'typecheck', 'db-apply', 'permissions-pattern', ...(routes ? (['route-contract'] as const) : []), ...(queries ? (['sql-typed'] as const) : [])];
    case 'standards': {
      const out: NodeId[] = ['lint', 'typecheck', 'layout'];
      if (diff.some((p) => p.startsWith('.github/'))) out.push('actionlint');
      if (diff.some((p) => p.startsWith('domain/')) || touchesPackageJson(diff)) out.push('generated');
      if (touchesPackageJson(diff) || diff.includes('pnpm-lock.yaml')) out.push('unit', 'db-apply', 'integration');
      return out;
    }
  }
}

export function acceptOutcome(ctx: RunContext, rows: readonly NodeRow[], timings: readonly Timing[], packet: AcceptPacket | null): NodeOutcome {
  const planned = ctx.plan.nodes.filter((n) => n !== 'accept');
  const byId = new Map(rows.map((r) => [r.id, r]));
  const required = packet ? requiredSet(packet.kind, packet.spec, packet.diff) : [];
  const findings: NodeOutcome['findings'] = [];

  for (const id of required) {
    const r = byId.get(id);
    if (r?.status === 'SKIPPED') {
      findings.push({
        locator: `${packet!.path}:1`,
        message: `required node skipped for kind: ${packet!.kind}: ${id} (inventory: ${r.evidence})`,
        standard: '05 PL-15',
        hint: 'deliver what the kind requires (05 §3); an empty population means the deliverable is missing',
      });
    }
  }
  // B.28 Findings (D-084 item 3): one per gating FAIL and one per gating UNKNOWN, locator = the node id,
  // in DAG order (the order of `rows`); the UNKNOWN status carries the first gating UNKNOWN's reason.
  const gating = rows.filter((r) => gates(r, ctx.config, rows));
  for (const r of gating) {
    if (r.status === 'FAIL') findings.push({ locator: r.id, message: `${r.id} FAIL (${r.findings.length} finding${r.findings.length === 1 ? '' : 's'})`, standard: 'S-65', hint: `fix the findings of ${r.id}` });
    if (r.status === 'UNKNOWN') findings.push({ locator: r.id, message: `${r.id} UNKNOWN (${r.reason})`, standard: 'S-65', hint: `fix ${r.id} first` });
  }
  const missing = planned.filter((id) => !byId.has(id));
  for (const id of missing) findings.push({ locator: id, message: `${id} has no status`, standard: 'S-65', hint: 'the tool exited abnormally; re-run once, then put the output under ## Notes' });
  const firstUnknown = gating.filter((g) => g.status === 'UNKNOWN').sort((a, b) => byDag(a.id, b.id))[0];
  const observed = planned.length - missing.length;
  const details = { node: 'accept' as const, requiredSet: required, deferred: [...ctx.plan.deferred], editLoopMs: editLoopMs(timings) };
  const counts = { expected: planned.length, observed, evaluated: observed };
  const failed = findings.some((f) => f.standard === '05 PL-15') || gating.some((g) => g.status === 'FAIL');
  if (failed) return { status: 'FAIL', ...counts, findings, details };
  if (firstUnknown) return { status: 'UNKNOWN', reason: firstUnknown.reason ?? 'runner-crashed', ...counts, findings, details };
  if (missing.length > 0) return { status: 'UNKNOWN', reason: 'runner-crashed', ...counts, findings, details };
  return { status: 'PASS', ...counts, findings: [], details };
}
