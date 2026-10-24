// A fake `claude` and `codex` on PATH that replay streams shaped like the recorded ones
// (fixtures/README.md: claude 2.1.292 stream-json, codex 0.163.0 JSONL), so CI, which has no
// authenticated model CLI, runs every model-node path. Each invocation is logged (argv, stdin, cwd and
// the cwd's top-level entries) and answered from a plan keyed by the call: `sensor`, `phase1`, `phase2`.
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { vi } from 'vitest';

export interface Reply { stdout?: string; stderr?: string; code?: number }
export type Plan = Partial<Record<'sensor' | 'phase1' | 'phase2', Reply>>;
export interface Call { bin: string; argv: string[]; stdin: string; cwd: string; entries: string[] }

const SCRIPT = (bin: string) => `#!${process.execPath}
const fs = require('node:fs');
const argv = process.argv.slice(2);
let stdin = '';
try { stdin = fs.readFileSync(0, 'utf8'); } catch {}
const which = stdin.startsWith('DEVAI review, phase 1') ? 'phase1' : stdin.startsWith('DEVAI review, phase 2') ? 'phase2' : 'sensor';
let entries = [];
try { entries = fs.readdirSync(process.cwd()).sort(); } catch {}
fs.appendFileSync(process.env.FAKE_LOG, JSON.stringify({ bin: ${JSON.stringify(bin)}, argv, stdin, cwd: process.cwd(), entries }) + '\\n');
const plan = JSON.parse(fs.readFileSync(process.env.FAKE_PLAN, 'utf8'));
const r = plan[which] || { stderr: 'fake: no reply planned for ' + which, code: 70 };
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
process.exitCode = r.code || 0;
`;

export interface Fake {
  bin: string;
  plan(p: Plan): void;
  calls(): Call[];
}

/** Installs the fake CLIs (only those named) on a PATH that holds no real model CLI. */
export function installFake(bins: readonly ('claude' | 'codex')[] = ['claude', 'codex']): Fake {
  const dir = mkdtempSync(resolve(tmpdir(), 'devai-w5-fake-'));
  const bin = resolve(dir, 'bin');
  mkdirSync(bin);
  for (const b of bins) {
    writeFileSync(resolve(bin, b), SCRIPT(b));
    chmodSync(resolve(bin, b), 0o755);
  }
  const log = resolve(dir, 'calls.jsonl');
  const planFile = resolve(dir, 'plan.json');
  writeFileSync(planFile, '{}');
  vi.stubEnv('PATH', `${bin}:/usr/bin:/bin`);
  vi.stubEnv('FAKE_LOG', log);
  vi.stubEnv('FAKE_PLAN', planFile);
  return {
    bin,
    plan: (p) => writeFileSync(planFile, JSON.stringify(p)),
    calls: () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter((l) => l !== '').map((l) => JSON.parse(l) as Call) : []),
  };
}

const lines = (events: unknown[]): string => events.map((e) => JSON.stringify(e)).join('\n') + '\n';

export interface StreamOpts {
  commands?: { command: string; output: string }[];
  usage?: { input: number; output: number } | null;
  /** Claude: the init tool set and version (defaults: the mode's own, 2.1.292). */
  tools?: string[];
  version?: string;
  /** Extra raw items (Codex) or tool_use blocks (Claude). */
  items?: unknown[];
}

/** A `codex exec --json` stream (0.163.0 shape): thread, turn, command items, the answer, turn.completed. */
export function codexStream(answer: unknown, o: StreamOpts = {}): string {
  const ev: unknown[] = [{ type: 'thread.started', thread_id: 'fake' }, { type: 'turn.started' }];
  (o.commands ?? []).forEach((c, i) => {
    ev.push({ type: 'item.started', item: { id: `item_c${i}`, type: 'command_execution', command: c.command, aggregated_output: '', exit_code: null, status: 'in_progress' } });
    ev.push({ type: 'item.completed', item: { id: `item_c${i}`, type: 'command_execution', command: c.command, aggregated_output: c.output, exit_code: 0, status: 'completed' } });
  });
  for (const it of o.items ?? []) ev.push({ type: 'item.completed', item: it });
  ev.push({ type: 'item.completed', item: { id: 'item_a', type: 'agent_message', text: JSON.stringify(answer) } });
  const u = o.usage === undefined ? { input: 18000, output: 120 } : o.usage;
  ev.push(u === null ? { type: 'turn.completed' } : { type: 'turn.completed', usage: { input_tokens: u.input, cached_input_tokens: 0, cache_write_input_tokens: 0, output_tokens: u.output, reasoning_output_tokens: 0 } });
  return lines(ev);
}

/** A `claude -p --output-format stream-json --verbose` stream (2.1.292 shape). */
export function claudeStream(answer: unknown, o: StreamOpts = {}): string {
  const ev: unknown[] = [{ type: 'system', subtype: 'init', cwd: '/x', tools: o.tools ?? ['StructuredOutput'], model: 'claude-fake-1', claude_code_version: o.version ?? '2.1.292' }];
  (o.commands ?? []).forEach((c, i) => {
    ev.push({ type: 'assistant', message: { content: [{ type: 'tool_use', id: `toolu_${i}`, name: 'Bash', input: { command: c.command } }] } });
    ev.push({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: `toolu_${i}`, content: c.output }] } });
  });
  for (const b of o.items ?? []) ev.push({ type: 'assistant', message: { content: [b] } });
  ev.push({ type: 'assistant', message: { content: [{ type: 'tool_use', id: 'toolu_answer', name: 'StructuredOutput', input: answer }] } });
  const u = o.usage === undefined ? { input: 5000, output: 150 } : o.usage;
  ev.push({ type: 'result', subtype: 'success', is_error: false, result: JSON.stringify(answer), structured_output: answer, ...(u === null ? {} : { usage: { input_tokens: u.input, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, output_tokens: u.output } }), modelUsage: { 'claude-fake-1': {} } });
  return lines(ev);
}
