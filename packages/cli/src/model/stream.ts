// 07 §6, 08 B.24/B.27 Invokes: the two host CLIs' event streams, read incrementally (the runner counts
// tool calls while the process runs) and summarised once it ends. Shapes as recorded from the installed
// CLIs (test/model/fixtures/*.jsonl): `claude -p --output-format stream-json --verbose` 2.1.292 emits
// `system/init` (with `tools`, `model`, `claude_code_version`), `assistant` messages whose content holds
// `tool_use` blocks, `user` messages holding `tool_result` blocks, and one final `result` (with
// `structured_output` under `--json-schema`, `usage`, `is_error`); `--json-schema` itself adds a
// `StructuredOutput` tool, which is the answer channel and not a tool call. `codex exec --json` 0.163.0
// emits `thread.started`, `turn.started`, `item.started`/`item.completed` (`agent_message`,
// `command_execution`, `file_change`, `web_search`, `mcp_tool_call`, …), and `turn.completed` with
// `usage` or `turn.failed`/`error`; it carries no model id.
import type { Harness } from './packet.js';

/** One tool or command the model ran, as the stream shows it. */
export interface ToolItem {
  id: string;
  name: string;
  /** The shell command (Claude `Bash`, Codex `command_execution`). */
  command?: string;
  /** Its output as the stream recorded it. */
  output?: string;
  /** Paths a file-writing item names (Claude Edit/Write/NotebookEdit, Codex `file_change`). */
  writes: string[];
  /** A network item (Claude WebFetch/WebSearch, Codex `web_search`/`mcp_tool_call`). */
  network: boolean;
}

export interface Usage { input: number; output: number }

export interface StreamSummary {
  harness: Harness;
  /** JSON events parsed; 0 means the CLI produced no stream at all. */
  events: number;
  /** Claude's `system/init` (the tool set the CLI actually loaded, its model and version). */
  init: { tools: string[]; model: string | null; version: string | null } | null;
  tools: ToolItem[];
  /** The structured answer: Claude `structured_output`, Codex's last agent message parsed as JSON. */
  final: unknown;
  /** The raw text of the answer (Codex's last agent message, Claude's `result`). */
  finalText: string | null;
  /** Terminal success: Claude `result` without `is_error`, Codex `turn.completed`. */
  completed: boolean;
  error: string | null;
  usage: Usage | null;
  model: string | null;
}

const WRITE_TOOLS = ['Edit', 'Write', 'NotebookEdit', 'MultiEdit'];
const NETWORK_TOOLS = ['WebFetch', 'WebSearch'];
/** `--json-schema`'s answer tool (claude 2.1.292), not a tool call. */
export const ANSWER_TOOL = 'StructuredOutput';

type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {});
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const textOf = (v: unknown): string => (typeof v === 'string' ? v : Array.isArray(v) ? v.map((b) => str(obj(b)['text']) ?? '').join('') : '');

/** Codex strict mode answers an optional property with null (see cli.ts); zod sees it absent. */
export function dropNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(dropNulls);
  if (v === null || typeof v !== 'object') return v;
  return Object.fromEntries(Object.entries(v as Json).filter(([, x]) => x !== null).map(([k, x]) => [k, dropNulls(x)]));
}

export class StreamReader {
  private pending = '';
  private readonly s: StreamSummary;
  private readonly byId = new Map<string, ToolItem>();

  /** `limit`: once the tool items exceed it, the rest of the stream is not read (B.27: terminated at the 21st call). */
  constructor(readonly harness: Harness, private readonly limit = Infinity) {
    this.s = { harness, events: 0, init: null, tools: [], final: undefined, finalText: null, completed: false, error: null, usage: null, model: null };
  }

  /** Feeds a stdout chunk; complete lines are parsed as they arrive. */
  feed(chunk: Buffer | string): void {
    this.pending += chunk.toString();
    let nl: number;
    while ((nl = this.pending.indexOf('\n')) >= 0) {
      this.line(this.pending.slice(0, nl));
      this.pending = this.pending.slice(nl + 1);
    }
  }

  /** Tool and command items so far (the B.27 budget counts these). */
  get toolCalls(): number {
    return this.s.tools.length;
  }

  summary(): StreamSummary {
    if (this.pending.trim() !== '') this.line(this.pending);
    this.pending = '';
    return this.s;
  }

  private tool(id: string, name: string): ToolItem {
    let t = this.byId.get(id);
    if (!t) {
      t = { id, name, writes: [], network: false };
      this.byId.set(id, t);
      this.s.tools.push(t);
    }
    return t;
  }

  /** The tool-item limit was crossed. */
  get exceeded(): boolean {
    return this.s.tools.length > this.limit;
  }

  private line(text: string): void {
    if (text.trim() === '' || this.exceeded) return;
    let e: Json;
    try {
      e = obj(JSON.parse(text));
    } catch {
      return; // not an event (a CLI warning on stdout); the summary is built from events only
    }
    this.s.events++;
    if (this.harness === 'claude') this.claude(e);
    else this.codex(e);
  }

  private claude(e: Json): void {
    const type = e['type'];
    if (type === 'system' && e['subtype'] === 'init') {
      const tools = Array.isArray(e['tools']) ? e['tools'].filter((t): t is string => typeof t === 'string') : [];
      this.s.init = { tools, model: str(e['model']), version: str(e['claude_code_version']) };
      this.s.model ??= str(e['model']);
      return;
    }
    if (type === 'assistant') {
      const message = obj(e['message']);
      if (typeof e['error'] === 'string') this.s.error ??= textOf(message['content']) || e['error'];
      for (const b of Array.isArray(message['content']) ? message['content'] : []) {
        const block = obj(b);
        if (block['type'] !== 'tool_use') continue;
        const name = str(block['name']) ?? '';
        if (name === ANSWER_TOOL) continue;
        const t = this.tool(str(block['id']) ?? `tool-${this.s.tools.length}`, name);
        const input = obj(block['input']);
        if (typeof input['command'] === 'string') t.command = input['command'];
        if (WRITE_TOOLS.includes(name)) t.writes.push(str(input['file_path']) ?? str(input['notebook_path']) ?? '');
        if (NETWORK_TOOLS.includes(name) || name.startsWith('mcp__')) t.network = true;
      }
      return;
    }
    if (type === 'user') {
      for (const b of Array.isArray(obj(e['message'])['content']) ? (obj(e['message'])['content'] as unknown[]) : []) {
        const block = obj(b);
        const t = block['type'] === 'tool_result' ? this.byId.get(str(block['tool_use_id']) ?? '') : undefined;
        if (t) t.output = textOf(block['content']);
      }
      return;
    }
    if (type === 'result') {
      const u = obj(e['usage']);
      if (Object.keys(u).length > 0) {
        this.s.usage = {
          input: num(u['input_tokens']) + num(u['cache_creation_input_tokens']) + num(u['cache_read_input_tokens']),
          output: num(u['output_tokens']),
        };
      }
      this.s.model ??= Object.keys(obj(e['modelUsage']))[0] ?? null;
      this.s.finalText = str(e['result']);
      if (e['is_error'] === true || e['subtype'] !== 'success') this.s.error ??= str(e['result']) ?? str(e['subtype']) ?? 'error result';
      else this.s.completed = true;
      if ('structured_output' in e) this.s.final = e['structured_output'];
    }
  }

  private codex(e: Json): void {
    const type = e['type'];
    if (type === 'item.started' || type === 'item.completed') {
      const item = obj(e['item']);
      const id = str(item['id']) ?? `item-${this.s.events}`;
      switch (item['type']) {
        case 'agent_message': {
          const text = str(item['text']);
          if (type === 'item.completed' && text !== null && text.trim() !== '') this.s.finalText = text;
          break;
        }
        case 'command_execution': {
          const t = this.tool(id, 'command_execution');
          if (typeof item['command'] === 'string') t.command = item['command'];
          if (typeof item['aggregated_output'] === 'string' && type === 'item.completed') t.output = item['aggregated_output'];
          break;
        }
        case 'file_change': {
          const t = this.tool(id, 'file_change');
          for (const c of Array.isArray(item['changes']) ? item['changes'] : []) {
            const p = str(obj(c)['path']);
            if (p !== null && !t.writes.includes(p)) t.writes.push(p);
          }
          break;
        }
        case 'web_search':
        case 'mcp_tool_call':
          this.tool(id, String(item['type'])).network = true;
          break;
        default:
          break; // reasoning, todo_list: not tool items
      }
      return;
    }
    if (type === 'turn.completed') {
      this.s.completed = true;
      const u = obj(e['usage']);
      if (Object.keys(u).length > 0) this.s.usage = { input: (this.s.usage?.input ?? 0) + num(u['input_tokens']), output: (this.s.usage?.output ?? 0) + num(u['output_tokens']) };
      if (this.s.finalText !== null) {
        try {
          this.s.final = dropNulls(JSON.parse(this.s.finalText));
        } catch {
          this.s.final = undefined;
        }
      }
      return;
    }
    if (type === 'turn.failed') this.s.error ??= str(obj(e['error'])['message']) ?? 'turn failed';
    else if (type === 'error') this.s.error ??= str(e['message']) ?? 'error';
  }
}

/** A whole recorded stream, summarised. */
export function readStream(harness: Harness, text: string): StreamSummary {
  const r = new StreamReader(harness);
  r.feed(text);
  return r.summary();
}
