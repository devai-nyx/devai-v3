// What the two model nodes need from the packet (05 §2) and its commit range: the facts W4's `--packet`
// plumbing fills into `RunContext.packet`, the worker family of 08 B.27 Inputs (D-079), the reviewer
// selection of A.8 (D-074) and the `## Review dispositions` lines PL-10 applies (02 §9, D-035).
import type { DevaiConfig } from '../config.js';
import { log } from '../git/git.js';

export type Kind = 'spec' | 'generate' | 'test' | 'code' | 'fix' | 'standards';
export const PINNING_KINDS: readonly Kind[] = ['generate', 'test', 'code', 'fix'];

export interface PacketFacts {
  /** `PKT-<PRODUCT>-nnn`. */
  id: string;
  kind: Kind;
  /** Repo-relative packet file. */
  path: string;
  /** The packet's `base` commit. */
  base: string;
  /** The packet bytes at the candidate (dispositions included). */
  text: string;
  /** Pinning kinds: `spec.path` and `spec.sha256`; null for `spec` and `standards`. */
  specPath: string | null;
  specSha256: string | null;
  /** `kind: spec`: the business sources the packet's `context` and the spec's `sources[]` cite, repo-relative. */
  sources: string[];
  /** `## Deliverables` bullets, verbatim (`kind: standards` names its 03 Part A rows there). */
  deliverables: string[];
  /** `--packet --full`: the only invocation that writes `.devai/review/` (A.3 Writes). */
  full: boolean;
}

export type WorkerFamily = 'claude' | 'gpt' | 'unknown' | 'mixed';
export type Harness = 'claude' | 'codex';

/** B.27 Inputs: one trailer's family. */
export function trailerFamily(trailer: string): 'claude' | 'gpt' | 'unknown' {
  if (/\bclaude\b/i.test(trailer)) return 'claude';
  if (/\b(gpt|codex|openai)\b/i.test(trailer)) return 'gpt';
  return 'unknown';
}

/** The range's family: the one value every trailer resolves to, otherwise mixed; no trailer is unknown (D-079). */
export function rangeFamily(trailers: readonly string[]): WorkerFamily {
  const families = new Set(trailers.map(trailerFamily));
  if (families.size === 0) return 'unknown';
  if (families.size > 1) return 'mixed';
  return [...families][0]!;
}

/** `Co-Authored-By` trailer lines of `base..HEAD`, oldest first, as `Co-Authored-By: <value>`. */
export async function workerTrailers(root: string, base: string): Promise<string[]> {
  const out = await log(root, ['--reverse', '--format=%(trailers:key=Co-Authored-By,separator=%x00)%x01', `${base}..HEAD`]);
  return out
    .split('\x01')
    .flatMap((c) => c.split('\0'))
    .map((t) => t.trim())
    .filter((t) => /^co-authored-by:/i.test(t));
}

/** The harness a reviewer argv prefix starts with (A.8's refinement admits only these two). */
export function harnessOf(prefix: string): Harness | null {
  const bin = prefix.trim().split(/\s+/)[0] ?? '';
  const base = bin.split('/').pop();
  return base === 'claude' ? 'claude' : base === 'codex' ? 'codex' : null;
}

/** A.8: `review` runs the other family's reviewer; equal, unknown or mixed family has none (02 §9). */
export function reviewerFor(config: DevaiConfig, family: WorkerFamily): string | null {
  if (family !== 'claude' && family !== 'gpt') return null;
  return config.review.reviewers[family] ?? null;
}

/** B.24 (D-074): the sensor runs the worker family's reviewer, else the first configured in `Family` order. */
export function sensorReviewerFor(config: DevaiConfig, family: WorkerFamily): string | null {
  if (family === 'claude' || family === 'gpt') return config.review.reviewers[family] ?? null;
  if (family === 'mixed') return null;
  return config.review.reviewers.claude ?? config.review.reviewers.gpt ?? null;
}

export interface Disposition {
  /** The fingerprint prefix, ≥ 12 hex (10 §2.4). */
  prefix: string;
  requirement: string;
  locator: string;
  disposition: 'not-a-defect' | 'accepted-risk';
  reason: string;
}

const RV = /^RV ([0-9a-f]{12,64}) · (\S+) · (\S+) · (not-a-defect|accepted-risk) · (.+)$/;

/** The `## Review dispositions` lines of a packet (02 §9 grammar; malformed lines are PL-09's, skipped here). */
export function dispositions(packetText: string): Disposition[] {
  const out: Disposition[] = [];
  let inside = false;
  for (const line of packetText.split('\n')) {
    if (/^## /.test(line)) inside = /^## Review dispositions\s*$/.test(line);
    else if (inside) {
      const m = RV.exec(line.trim());
      if (m) out.push({ prefix: m[1]!, requirement: m[2]!, locator: m[3]!, disposition: m[4] as Disposition['disposition'], reason: m[5]! });
    }
  }
  return out;
}
