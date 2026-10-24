// 08 §0 fifth convention (D-086), applied locally by the W2c adapters (`sql-lint`, `boundary`,
// `deadcode`, `openapi`) with `proc/spawn.ts`: binaries resolve from the product's
// `node_modules/.bin` (D-057), a missing binary is `tooling-missing` with the install command, and a
// non-zero exit without the expected machine-readable stdout is `runner-crashed` with stderr's first
// line. Duplicates the helper W2a lands as `src/proc/tool.ts`; folded into it once both merge.
import { resolve } from 'node:path';
import { spawn, type SpawnResult } from '../proc/spawn.js';
import type { NodeOutcome } from '../runner/run.js';

export type Finding = NodeOutcome['findings'][number];
export type Reason = NonNullable<NodeOutcome['reason']>;
export type Exited = Extract<SpawnResult, { kind: 'exited' }>;

/** 10 §4 hints of the reasons these adapters raise. */
export const RUNNER_CRASHED_HINT = 'the tool exited abnormally; re-run once, then put the output under ## Notes';

export const binOf = (root: string, name: string): string => resolve(root, 'node_modules/.bin', name);

export const toolEnv = (): NodeJS.ProcessEnv => ({ ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' });

export function runTool(root: string, bin: string, args: readonly string[], timeoutMs = 300_000): Promise<SpawnResult> {
  return spawn({ argv: [binOf(root, bin), ...args], cwd: root, env: toolEnv(), timeoutMs });
}

/** `UNKNOWN: tooling-missing — <node>: install with <command>` (08 A.1, D-029, S-19). */
export const toolingMissing = (bin: string, install: string, standard: string): Finding => ({
  locator: 'package.json:1', message: `${bin} not resolvable from node_modules/.bin`, standard, hint: `install with ${install}`,
});

export const firstLine = (b: Buffer): string => b.toString('utf8').split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '(no stderr)';

export const crashed = (bin: string, r: Exited, standard: string, locator = 'package.json:1'): Finding => ({
  locator,
  message: `${bin} ${r.timedOut ? 'timed out' : r.overflow ? 'output exceeded the buffer' : `exited ${r.code ?? r.signal}`}: ${r.stderr.toString('utf8').trim() ? firstLine(r.stderr) : firstLine(r.stdout)}`.slice(0, 500),
  standard,
  hint: RUNNER_CRASHED_HINT,
});

/** Parsed JSON stdout, or null when stdout is not one JSON value (the shape check is the caller's). */
export function jsonOf(r: Exited): unknown {
  const text = r.stdout.toString('utf8').trim();
  if (text.length === 0) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** `UNKNOWN` with the first reason; counts as given. */
export const unknown = (reason: Reason, findings: Finding[], counts: { expected: number; observed: number; evaluated: number }): NodeOutcome =>
  ({ status: 'UNKNOWN', reason, ...counts, findings });
