// 07 §6, 08 B.24 and B.27 Invokes (D-057, D-082): the two host CLIs run through the one spawner, prompt
// on stdin, the schema emitted from the zod definition that validates the answer, the event stream
// requested so tool use is observable. Isolation is enforced by the CLI's own flags and sandbox and the
// stream is read as the second signal: a CLI that rejects an enforcement flag, or whose init shows a tool
// set wider than the one asked for, is `capability-missing`. Reasons follow the Part B rows; a non-zero
// exit without a stream is `runner-crashed` (D-086).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { z } from 'zod';
import type { Reason } from '../main.js';
import { spawn } from '../proc/spawn.js';
import type { Harness } from './packet.js';
import { readStream, StreamReader, type StreamSummary, type Usage } from './stream.js';

/** `sensor` = B.24's flag list; `phase1` = B.27 phase 1 (no tools); `phase2` = B.27 phase 2 (sandboxed). */
export type Mode = 'sensor' | 'phase1' | 'phase2';

/** 07 §2 row "Claude Code / Codex CLI" (12 §3 pins), printed on a `tooling-missing` finding. */
export const INSTALL: Record<Harness, string> = {
  claude: 'npm install -g @anthropic-ai/claude-code@2.1.292',
  codex: 'npm install -g @openai/codex@0.163.0',
};

/** B.27 phase 2 Claude allow rules, verbatim. */
export const PHASE2_ALLOWED = 'Read,Grep,Glob,Bash(git log:*),Bash(git diff:*),Bash(git show:*),Bash(node:*),Bash(pnpm exec vitest:*),Bash(psql:*)';
/** 07 §6 / B.27 phase 2 Claude sandbox settings (D-082). */
export const PHASE2_SETTINGS = '{"sandbox":{"enabled":true,"allowUnsandboxedCommands":false,"network":{"allowedDomains":[],"strictAllowlist":true}}}';
/** 07 §6: `strictAllowlist` needs Claude Code ≥ 2.1.219. */
export const MIN_SANDBOX_CLAUDE = [2, 1, 219] as const;
/**
 * Codex 0.163.0 `workspace-write` also makes `/tmp` and `$TMPDIR` writable (recorded on this host); these
 * overrides confine it to the `--cd` scratch copy as 07 §6 requires, and deny network explicitly.
 */
export const CODEX_CONFINE = [
  '-c', 'sandbox_workspace_write.network_access=false',
  '-c', 'sandbox_workspace_write.exclude_slash_tmp=true',
  '-c', 'sandbox_workspace_write.exclude_tmpdir_env_var=true',
];

/** The tools each mode may load (Claude init `tools`); `StructuredOutput` is `--json-schema`'s answer channel. */
const ALLOWED_TOOLS: Record<Mode, readonly string[]> = {
  sensor: ['StructuredOutput'],
  phase1: ['StructuredOutput'],
  phase2: ['StructuredOutput', 'Read', 'Grep', 'Glob', 'Bash'],
};

const tokens = (prefix: string): string[] => prefix.trim().split(/\s+/).filter((t) => t !== '');

/** The model id the key and the evidence use before the stream reports one: `--model`/`-m` in the prefix, else the CLI's default. */
export function modelIdOf(prefix: string): string {
  const t = tokens(prefix);
  for (let i = 0; i < t.length - 1; i++) if (t[i] === '--model' || t[i] === '-m') return t[i + 1]!;
  const m = t.find((x) => x.startsWith('--model='));
  return m ? m.slice('--model='.length) : `${t[0] ?? 'model'} default`;
}

/**
 * JSON Schema for the CLI, from the zod definition that validates the answer (D-057). Codex's `--output-schema` is OpenAI strict mode, which rejects an object whose
 * `required` omits a property (`counterexample` in `ReviewModelOutput`, recorded on codex 0.163.0); an
 * optional property is sent as required-or-null and the null is dropped before zod validates.
 */
export function schemaFor(harness: Harness, schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  if (harness === 'codex') return strict(json) as Record<string, unknown>;
  // claude 2.1.292 refuses the draft 2020-12 `$schema` key zod emits ("--json-schema is not a valid JSON
  // Schema: no schema with key or ref"; recorded on this host); the schema itself is unchanged.
  const { $schema: _, ...rest } = json;
  return rest;
}

function strict(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(strict);
  if (s === null || typeof s !== 'object') return s;
  const o: Record<string, unknown> = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, strict(v)]));
  if (o['type'] === 'object' && o['properties'] && typeof o['properties'] === 'object') {
    const props = o['properties'] as Record<string, unknown>;
    const required = new Set(Array.isArray(o['required']) ? (o['required'] as string[]) : []);
    for (const k of Object.keys(props)) if (!required.has(k)) props[k] = { anyOf: [props[k], { type: 'null' }] };
    o['required'] = Object.keys(props);
  }
  return o;
}

export interface ArgvSpec {
  prefix: string;
  harness: Harness;
  mode: Mode;
  /** Claude: the schema JSON text; Codex: the schema file path. */
  schema: string;
  /** Codex `--cd`: the empty dir (sensor, phase 1) or the scratch worktree (phase 2). */
  cd: string;
}

/** The argument vector: the reviewer prefix (A.8), then the fixed flag list of 07 §6 and the Part B row. */
export function argvOf(a: ArgvSpec): [string, ...string[]] {
  const t = tokens(a.prefix);
  const [bin, ...rest] = t as [string, ...string[]];
  if (a.harness === 'claude') {
    const head = rest.includes('-p') || rest.includes('--print') ? rest : ['-p', ...rest];
    const base = ['--output-format', 'stream-json', '--verbose', '--json-schema', a.schema, '--no-session-persistence', '--setting-sources', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}'];
    const mode =
      a.mode === 'sensor' ? ['--tools', '', '--restricted'] // D-101: no --bare; the host's own authentication
      : a.mode === 'phase1' ? ['--tools', '']
      : ['--restricted', '--tools', 'Read,Grep,Glob,Bash', '--allowedTools', PHASE2_ALLOWED, '--disallowedTools', 'Edit,Write,NotebookEdit,WebFetch,WebSearch', '--settings', PHASE2_SETTINGS];
    return [bin, ...head, ...base, ...mode];
  }
  const head = rest[0] === 'exec' ? rest : ['exec', ...rest];
  const sandbox = a.mode === 'phase2' ? ['--sandbox', 'workspace-write', ...CODEX_CONFINE] : ['--sandbox', 'read-only'];
  return [bin, ...head, '--json', '--output-schema', a.schema, '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--cd', a.cd, ...sandbox, '-'];
}

export interface ModelCall<T> {
  prefix: string;
  mode: Mode;
  schema: z.ZodType<T>;
  prompt: string;
  /** Working directory: an empty dir for the sensor and phase 1, the scratch worktree for phase 2. */
  cwd: string;
  /** Where the Codex schema file is written (never inside `cwd`). */
  scratch: string;
  timeoutMs: number;
  /** Bounds checked on the CLI-reported usage. */
  inputBound: number;
  outputBound: number;
  /** B.27: the process is terminated at the (max + 1)th tool call. */
  maxToolCalls?: number;
  /** The reason a tool item carries in `sensor`/`phase1`, where none may appear. */
  toolUseReason: Reason;
  env?: NodeJS.ProcessEnv;
}

export type ModelResult<T> =
  | { kind: 'ok'; output: T; usage: Usage; model: string; summary: StreamSummary; seconds: number }
  | { kind: 'unknown'; reason: Reason; message: string; summary: StreamSummary | null; usage: Usage | null; seconds: number; hint?: string };

/** `error: unknown option` (claude 2.1.292), `error: unexpected argument` / `invalid value` (codex 0.163.0). */
export const REJECTED_FLAG = /^error: (unknown option|unexpected argument|invalid value|option .* argument missing)/;

const firstLine = (t: string): string => t.split('\n').map((l) => l.trim()).find((l) => l !== '') ?? '';

function versionBelow(v: string | null, min: readonly number[]): boolean {
  if (v === null) return true;
  const parts = v.split(/[.-]/).slice(0, 3).map(Number);
  for (let i = 0; i < min.length; i++) {
    const p = parts[i] ?? 0;
    if (Number.isNaN(p)) return true;
    if (p !== min[i]) return p < min[i]!;
  }
  return false;
}

const inside = (dir: string, p: string): boolean => {
  const abs = resolve(dir, p);
  return abs === dir || abs.startsWith(dir.endsWith(sep) ? dir : dir + sep);
};

/** Classifies a finished stream (shared with the replay tests). */
export function classify<T>(call: Pick<ModelCall<T>, 'prefix' | 'mode' | 'schema' | 'cwd' | 'inputBound' | 'outputBound' | 'toolUseReason'>, s: StreamSummary, seconds: number):
  ModelResult<T> {
  const no = (reason: Reason, message: string): ModelResult<T> => ({ kind: 'unknown', reason, message, summary: s, usage: s.usage, seconds });
  if (s.harness === 'claude') {
    // The init event shows the tool set the CLI loaded; one wider than the mode allows means a flag did not hold.
    if (s.init === null) return no('capability-missing', 'claude stream has no init event: the tool set cannot be confirmed');
    const extra = s.init.tools.filter((t) => !ALLOWED_TOOLS[call.mode].includes(t));
    if (extra.length > 0) return no('capability-missing', `claude loaded tools the ${call.mode} flags remove: ${extra.join(', ')}`);
    if (call.mode === 'phase2' && versionBelow(s.init.version, MIN_SANDBOX_CLAUDE)) {
      return no('capability-missing', `claude ${s.init.version ?? '(unknown version)'} lacks sandbox strictAllowlist (needs ≥ ${MIN_SANDBOX_CLAUDE.join('.')})`);
    }
  }
  if (s.error !== null) return no('model-error', s.error.split('\n')[0]!.slice(0, 300));
  if (!s.completed) return no('model-error', `${s.harness} stream ended without terminal success`);
  if (call.mode !== 'phase2' && s.tools.length > 0) return no(call.toolUseReason, `${s.harness} stream shows ${s.tools.length} tool item(s): ${s.tools.map((t) => t.command ?? t.name).join('; ').slice(0, 200)}`);
  if (call.mode === 'phase2') {
    const escaped = s.tools.flatMap((t) => t.writes).filter((p) => p === '' || !inside(call.cwd, p));
    if (escaped.length > 0) return no(call.toolUseReason, `${s.harness} stream shows a write outside the scratch copy: ${escaped.join(', ')}`);
    const net = s.tools.filter((t) => t.network);
    if (net.length > 0) return no(call.toolUseReason, `${s.harness} stream shows a network item: ${net.map((t) => t.name).join(', ')}`);
  }
  if (s.usage === null) return no('input-bound-exceeded', `${s.harness} reported no usage`);
  if (s.usage.input > call.inputBound) return no('input-bound-exceeded', `${s.usage.input} input tokens reported (bound ${call.inputBound})`);
  if (s.usage.output > call.outputBound) return no('output-bound-exceeded', `${s.usage.output} output tokens reported (bound ${call.outputBound})`);
  if (s.final === undefined) return no('schema-invalid', `${s.harness} returned no structured answer`);
  const parsed = call.schema.safeParse(s.final);
  if (!parsed.success) return no('schema-invalid', `answer fails the schema: ${parsed.error.issues[0]?.message ?? 'invalid'} at ${parsed.error.issues[0]?.path.join('.') ?? ''}`);
  return { kind: 'ok', output: parsed.data, usage: s.usage, model: s.model ?? modelIdOf(call.prefix), summary: s, seconds };
}

/** Runs one model call. */
export async function callModel<T>(call: ModelCall<T>): Promise<ModelResult<T>> {
  const harness: Harness = /(^|\/)codex$/.test(tokens(call.prefix)[0] ?? '') ? 'codex' : 'claude';
  const json = schemaFor(harness, call.schema);
  let schema = JSON.stringify(json);
  if (harness === 'codex') {
    mkdirSync(call.scratch, { recursive: true });
    schema = resolve(call.scratch, `schema-${call.mode}.json`);
    writeFileSync(schema, JSON.stringify(json));
  }
  const argv = argvOf({ prefix: call.prefix, harness, mode: call.mode, schema, cd: call.cwd });
  const reader = new StreamReader(harness, call.maxToolCalls);
  const r = await spawn({
    argv, cwd: call.cwd, env: call.env ?? process.env, stdin: call.prompt, timeoutMs: call.timeoutMs, maxBytes: 64 * 1024 * 1024,
    onStdout: (chunk) => {
      reader.feed(chunk);
      return reader.exceeded;
    },
  });
  if (r.kind === 'missing') {
    return { kind: 'unknown', reason: 'tooling-missing', message: `${argv[0]} not found on PATH`, summary: null, usage: null, seconds: 0, hint: `install with ${INSTALL[harness]}` };
  }
  const seconds = r.durationMs / 1000;
  const s = reader.summary();
  const stderr = r.stderr.toString('utf8');
  const no = (reason: Reason, message: string): ModelResult<T> => ({ kind: 'unknown', reason, message, summary: s, usage: s.usage, seconds });
  if (r.stopped || reader.exceeded) return no('budget-exhausted', `terminated at tool call ${reader.toolCalls} (bound ${call.maxToolCalls ?? 0})`);
  if (r.timedOut) return no('timeout', `${harness} exceeded ${Math.round(call.timeoutMs / 1000)} s`);
  if (r.overflow) return no('runner-crashed', `${harness} exceeded its output bound`);
  if (s.events === 0) {
    if (r.code !== 0 && REJECTED_FLAG.test(firstLine(stderr))) return no('capability-missing', firstLine(stderr));
    return no('runner-crashed', firstLine(stderr) || `${harness} exited ${r.code ?? r.signal} without an event stream`);
  }
  return classify(call, s, seconds);
}

/** For tests and fixtures: a recorded stream as the live path would see it. */
export const replay = <T>(call: Pick<ModelCall<T>, 'prefix' | 'mode' | 'schema' | 'cwd' | 'inputBound' | 'outputBound' | 'toolUseReason'>, harness: Harness, text: string): ModelResult<T> =>
  classify(call, readStream(harness, text), 0);
