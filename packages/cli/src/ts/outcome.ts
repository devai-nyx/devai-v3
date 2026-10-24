// Shared by the W2b adapters: the finding type, the status rule over FAIL findings and UNKNOWN causes,
// and the product's `node_modules/.bin` binaries (08 B.1: `tsc` resolves from there only; D-057).
import { resolve } from 'node:path';
import type { NodeOutcome, RunContext } from '../runner/run.js';

export type Finding = NodeOutcome['findings'][number];
export type Reason = NonNullable<NodeOutcome['reason']>;
export interface Unknown { reason: Reason; finding: Finding }
export interface Counts { expected: number; observed: number; evaluated: number }

/**
 * 08 §0: `PASS` needs `evaluated = observed = expected` and no finding. FAIL findings with an UNKNOWN
 * cause are `FAIL` keeping every finding (B.1's reading of A.3, applied the same way here).
 */
export function outcome(counts: Counts, findings: readonly Finding[], unknown: readonly Unknown[], details?: NodeOutcome['details']): NodeOutcome {
  const d = details ? { details } : {};
  const all = [...findings, ...unknown.map((u) => u.finding)];
  if (findings.length > 0) return { status: 'FAIL', ...counts, findings: all, ...d };
  if (unknown.length > 0) return { status: 'UNKNOWN', reason: unknown[0]!.reason, ...counts, findings: all, ...d };
  // A shortfall the adapter did not name as findings is a crash of the adapter's own reading.
  if (counts.observed < counts.expected || counts.evaluated < counts.observed) return { status: 'UNKNOWN', reason: 'runner-crashed', ...counts, findings: [], ...d };
  return { status: 'PASS', ...counts, findings: [], ...d };
}

export const bin = (ctx: RunContext, name: string): string => resolve(ctx.root, 'node_modules/.bin', name);
export const env = { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0', NO_COLOR: '1' };

/** D-086 (08 §0 fifth convention): a non-zero exit without parseable stdout, stderr's first line as message. */
export const crashed = (locator: string, stderr: Buffer | string, code: number | null, standard: string): Unknown => ({
  reason: 'runner-crashed',
  finding: { locator, message: String(stderr).split('\n').find((l) => l.trim() !== '')?.trim() || `exited ${code}`, standard, hint: 'the tool exited abnormally; re-run once, then put the output under ## Notes' },
});
