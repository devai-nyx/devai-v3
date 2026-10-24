// 08 C.5, runner side: spawn `vitest run --config vitest.config.ts --reporter <reporter module>` with the
// events file in `DEVAI_VITEST_EVENTS`, read the JSON lines back into a per-module census, and classify
// failures (`reached` / `unresolved`). Exit codes are never read (08 §0 fifth convention): a run that
// wrote no `end` event is `runner-crashed`.
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { firstLine, unknown, type Unknown } from '../proc/tool.js';
import { spawn } from '../proc/spawn.js';

/** The reporter module (compiled beside this file), passed to Vitest by absolute path. */
export const REPORTER = fileURLToPath(new URL('./reporter.js', import.meta.url));
export const VITEST_CONFIG = 'vitest.config.ts';
const VITEST_TIMEOUT_MS = 600_000;

const Err = z.object({ name: z.string().nullable(), message: z.string(), stacks: z.array(z.object({ file: z.string(), line: z.number(), column: z.number() })) });
const Event = z.discriminatedUnion('e', [
  z.object({ e: z.literal('collected'), file: z.string(), cases: z.array(z.object({ id: z.string(), name: z.string(), fullName: z.string(), line: z.number().nullable(), top: z.boolean() })), errors: z.array(Err) }),
  z.object({ e: z.literal('result'), file: z.string(), id: z.string(), state: z.enum(['passed', 'failed', 'skipped', 'pending']), errors: z.array(Err) }),
  z.object({ e: z.literal('module-end'), file: z.string(), errors: z.array(Err) }),
  z.object({ e: z.literal('end'), reason: z.string(), unhandled: z.array(Err) }),
]);
export type EventError = z.infer<typeof Err>;

export interface Case {
  id: string;
  name: string;
  fullName: string;
  line: number;
  top: boolean;
  /** Absent: no `onTestCaseResult` arrived (runner-crashed at run end, C.5). */
  state?: 'passed' | 'failed' | 'skipped' | 'pending';
  errors: EventError[];
}

export interface Module {
  /** Repo-relative path. */
  file: string;
  cases: Case[];
  /** Collection errors with no case collected: the module failed to import (C.5). */
  importError: EventError | null;
  /** Errors reported on the module after its cases ran: a hook or worker failure (C.5 setup-failed). */
  hookError: EventError | null;
}

export interface Census {
  modules: Map<string, Module>;
  ended: boolean;
  unhandled: EventError[];
}

export function parseEvents(root: string, text: string): Census {
  const modules = new Map<string, Module>();
  const byId = new Map<string, Case>();
  let ended = false;
  let unhandled: EventError[] = [];
  const real = realpathSync(root);
  const rel = (f: string) => relative(f.startsWith(real + '/') ? real : root, f).split('\\').join('/');
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    let ev: z.infer<typeof Event>;
    try {
      ev = Event.parse(JSON.parse(line));
    } catch {
      continue; // a torn line from a killed run: the missing `end` reports it
    }
    if (ev.e === 'collected') {
      const cases = ev.cases.map((c): Case => ({ ...c, line: c.line ?? 1, errors: [] }));
      for (const c of cases) byId.set(c.id, c);
      modules.set(rel(ev.file), { file: rel(ev.file), cases, importError: cases.length === 0 && ev.errors.length > 0 ? ev.errors[0]! : null, hookError: null });
    } else if (ev.e === 'result') {
      const c = byId.get(ev.id);
      if (c) {
        c.state = ev.state;
        c.errors = ev.errors;
      }
    } else if (ev.e === 'module-end') {
      const m = modules.get(rel(ev.file));
      if (m && !m.importError && ev.errors.length > 0) m.hookError = ev.errors[0]!;
    } else {
      ended = true;
      unhandled = ev.unhandled;
    }
  }
  return { modules, ended, unhandled };
}

/** The absolute path Vitest reports for a repo-relative file (module ids and stack frames are real paths). */
export const absolute = (root: string, file: string): string => resolve(realpathSync(root), file);

/** C.5 `reached`: failed with chai's AssertionError whose first frame is in `file` within `[from, to]`. */
export function reached(c: Case, absFile: string, range: { from: number; to: number } | undefined): boolean {
  const e = c.errors[0];
  const top = e?.stacks[0];
  return c.state === 'failed' && e?.name === 'AssertionError' && top !== undefined && top.file === absFile && range !== undefined && top.line >= range.from && top.line <= range.to;
}

/** C.5 `unresolved`: failed with an error that carries no name or no source-mapped frame. */
export const unresolved = (c: Case): boolean => c.state === 'failed' && (c.errors[0]?.name == null || (c.errors[0]?.stacks.length ?? 0) === 0);

export const firstMessageLine = (e: EventError | undefined): string => (e?.message ?? '').split('\n').map((l) => l.trim()).find((l) => l !== '') ?? 'no message';

export interface VitestRun {
  root: string;
  tier: string;
  /** Positional file filters, repo-relative. */
  files: readonly string[];
  env?: Record<string, string>;
}

export type RunResult = { kind: 'census'; census: Census } | { kind: 'unknown'; unknown: Unknown };

/** One `vitest run` with the C.5 reporter; tooling and crash causes come back as `Unknown`. */
export async function runVitest(r: VitestRun): Promise<RunResult> {
  const dir = mkdtempSync(resolve(tmpdir(), 'devai-vitest-'));
  const events = resolve(dir, 'events.jsonl');
  try {
    const res = await spawn({
      argv: [resolve(r.root, 'node_modules/.bin/vitest'), 'run', '--config', VITEST_CONFIG, '--reporter', REPORTER, ...r.files],
      cwd: r.root,
      env: { ...process.env, ...r.env, TEST_TIER: r.tier, DEVAI_VITEST_EVENTS: events, NO_COLOR: '1', FORCE_COLOR: '0', CI: '1' },
      timeoutMs: VITEST_TIMEOUT_MS,
    });
    if (res.kind === 'missing') return { kind: 'unknown', unknown: unknown('tooling-missing', 'package.json:1', 'tooling-missing — vitest not resolvable from node_modules/.bin', 'S-19', 'install with pnpm add -D vitest@4.1.11') };
    if (res.timedOut) return { kind: 'unknown', unknown: unknown('timeout', `${VITEST_CONFIG}:1`, 'vitest exceeded its wall time', 'tests') };
    let text = '';
    try {
      text = readFileSync(events, 'utf8');
    } catch {
      text = '';
    }
    const census = parseEvents(r.root, text);
    if (!census.ended) {
      const stderr = res.stderr.toString('utf8');
      return { kind: 'unknown', unknown: unknown('runner-crashed', `${VITEST_CONFIG}:1`, firstLine(stderr) || firstLine(res.stdout.toString('utf8')) || `vitest exited ${res.code ?? res.signal} without onTestRunEnd`, 'tests') };
    }
    return { kind: 'census', census };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
