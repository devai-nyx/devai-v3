// 08 §0 fourth and fifth conventions (D-029, D-086) as one helper over spawn.ts, shared by the tool
// adapters: pre-flight what DEVAI controls (config file present and parseable, message file readable,
// inside a git repository) and report the block's reason without invoking; resolve the binary from
// `<root>/node_modules/.bin` only (as B.1 resolves `tsc`) and report a missing one as
// `UNKNOWN: tooling-missing` with the install command on the finding line; read verdicts from parsed
// stdout only, so a non-zero exit without the expected output is `UNKNOWN: runner-crashed` with
// stderr's first line as the finding message. Exit codes are never the verdict.
import { accessSync, constants, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { topLevel } from '../git/git.js';
import type { Reason } from '../main.js';
import type { NodeOutcome, RunContext } from '../runner/run.js';
import { HINTS } from '../text/hints.js';
import { spawn } from './spawn.js';

export type Finding = NodeOutcome['findings'][number];

/** A could-not-observe result: the reason and the one finding that names its cause. */
export interface Unknown {
  reason: Reason;
  finding: Finding;
}

export interface Preflight {
  /** Config files DEVAI owns (repo-relative): each must exist and parse (JSON, or JS by syntax only, never executed). */
  configs?: readonly string[];
  /** A message file that must be readable (commitlint `--edit`). */
  messageFile?: string;
  /** The `cwd` must be inside a git work tree. */
  gitRoot?: boolean;
}

export interface ToolSpec<T> {
  root: string;
  /** Binary name under `<root>/node_modules/.bin`. */
  bin: string;
  /** The install command printed on the `tooling-missing` finding (07 §2 pin, D-029). */
  install: string;
  args: readonly string[];
  /** Locator of the `runner-crashed` finding (the tool's config, or its first input). */
  locator: string;
  standard: string;
  /** Parses stdout; `null` means "not the expected machine-readable output". */
  parse: (stdout: string, code: number) => T | null;
  timeoutMs?: number;
  maxBytes?: number;
}

export type ToolResult<T> = { kind: 'unknown'; unknown: Unknown } | { kind: 'parsed'; value: T; code: number; stderr: string };

const hint = (reason: Reason): string => HINTS[reason];

export const unknown = (reason: Reason, locator: string, message: string, standard: string, hintText = hint(reason)): Unknown =>
  ({ reason, finding: { locator, message, standard, hint: hintText } });

/** The first non-empty line of a tool's stderr (ESLint, for one, starts its crash report with a blank line). */
export const firstLine = (text: string): string => text.split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';

/** `UNKNOWN` outcome for a could-not-observe result; counts are what was established before it. */
export const unknownOutcome = (u: Unknown, counts: { expected: number; observed?: number; evaluated?: number }): NodeOutcome => ({
  status: 'UNKNOWN', reason: u.reason, expected: counts.expected, observed: counts.observed ?? 0, evaluated: counts.evaluated ?? 0, findings: [u.finding],
});

/** JS/TS source parses (syntax only); returns the first diagnostic's text or null. */
function syntaxError(path: string, text: string): string | null {
  const out = ts.transpileModule(text, { fileName: path, reportDiagnostics: true, compilerOptions: { allowJs: true, noEmit: true } });
  const d = out.diagnostics?.[0];
  return d ? ts.flattenDiagnosticMessageText(d.messageText, ' ') : null;
}

/** 08 §0 fifth convention, first half: the inputs DEVAI controls, checked before invoking. */
export async function preflight(root: string, p: Preflight, standard: string): Promise<Unknown | null> {
  if (p.gitRoot && (await topLevel(root)) === null) return unknown('not-a-repository', `${root}:1`, 'not inside a git work tree', standard);
  for (const config of p.configs ?? []) {
    let text: string;
    try {
      text = readFileSync(resolve(root, config), 'utf8');
    } catch {
      return unknown('lint-config-failed', `${config}:1`, 'config file is missing or unreadable', standard);
    }
    let error: string | null = null;
    if (config.endsWith('.json')) {
      try {
        JSON.parse(text);
      } catch (e) {
        error = (e as Error).message;
      }
    } else error = syntaxError(config, text);
    if (error !== null) return unknown('lint-config-failed', `${config}:1`, `config does not parse: ${error}`, standard);
  }
  if (p.messageFile !== undefined) {
    const path = resolve(root, p.messageFile);
    try {
      accessSync(path, constants.R_OK);
      if (!statSync(path).isFile()) throw new Error('not a file');
    } catch {
      return unknown('io', `${p.messageFile}:1`, 'message file is not readable', standard);
    }
  }
  return null;
}

/** 08 §0 fourth and fifth conventions, second half: spawn, then parse stdout or report the crash. */
export async function runTool<T>(spec: ToolSpec<T>): Promise<ToolResult<T>> {
  const binPath = resolve(spec.root, 'node_modules/.bin', spec.bin);
  const r = await spawn({
    argv: [binPath, ...spec.args], cwd: spec.root, env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
    ...(spec.timeoutMs !== undefined ? { timeoutMs: spec.timeoutMs } : {}),
    ...(spec.maxBytes !== undefined ? { maxBytes: spec.maxBytes } : {}),
  });
  if (r.kind === 'missing') {
    return { kind: 'unknown', unknown: unknown('tooling-missing', 'package.json:1', `${spec.bin} not resolvable from node_modules/.bin`, 'S-19', `install with ${spec.install}`) };
  }
  if (r.timedOut) return { kind: 'unknown', unknown: unknown('timeout', spec.locator, `${spec.bin} exceeded its wall time`, spec.standard) };
  const stderr = r.stderr.toString('utf8');
  if (r.overflow || r.code === null) {
    return { kind: 'unknown', unknown: unknown('runner-crashed', spec.locator, firstLine(stderr) || `${spec.bin} ${r.overflow ? 'exceeded its output bound' : `ended by ${r.signal ?? 'a signal'}`}`, spec.standard) };
  }
  const value = spec.parse(r.stdout.toString('utf8'), r.code);
  if (value === null) {
    return { kind: 'unknown', unknown: unknown('runner-crashed', spec.locator, firstLine(stderr) || `${spec.bin} exited ${r.code} without the expected output`, spec.standard) };
  }
  return { kind: 'parsed', value, code: r.code, stderr };
}

/** Changed paths present at the candidate that satisfy `test`, sorted (B.1 population table: "changed, present"). */
export function changedPresent(ctx: RunContext, test: (path: string) => boolean): string[] {
  const present = new Set(ctx.listing.entries.map((e) => e.path));
  return (ctx.inventory?.changed ?? []).filter((p) => present.has(p) && test(p));
}

/** Paths at the candidate that satisfy `test`, sorted (cache inputs, C.4). */
export const candidatePaths = (ctx: RunContext, test: (path: string) => boolean): string[] =>
  ctx.listing.entries.map((e) => e.path).filter(test).sort();
