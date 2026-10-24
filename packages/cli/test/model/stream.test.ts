// The stream parsers against streams recorded from claude 2.1.292 and codex 0.163.0 (fixtures/README.md).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dropNulls, readStream, StreamReader } from '../../src/model/stream.js';

const fixture = (name: string): string => readFileSync(resolve(import.meta.dirname, 'fixtures', name), 'utf8');

describe('claude stream-json (2.1.292)', () => {
  it('sensor run: init tool set, structured answer, usage summed over cache components', () => {
    const s = readStream('claude', fixture('claude-sensor.jsonl'));
    expect(s.init).toEqual({ tools: ['StructuredOutput'], model: 'claude-haiku-4-5-20251001', version: '2.1.292' });
    expect(s.tools).toEqual([]); // the StructuredOutput tool_use is the answer channel, not a tool call
    expect(s.completed).toBe(true);
    expect(s.error).toBeNull();
    expect(s.final).toEqual({ verdict: 'compliant', confidence: 0.9 });
    expect(s.usage).toEqual({ input: 9 + 4723 + 0, output: 168 });
    expect(s.model).toBe('claude-haiku-4-5-20251001');
  });

  it('--bare without an API key: authentication_failed is an error, not a completion', () => {
    const s = readStream('claude', fixture('claude-bare-unauthenticated.jsonl'));
    expect(s.completed).toBe(false);
    expect(s.error).toBe('Not logged in · Please run /login');
    expect(s.final).toBeUndefined();
  });

  it('phase 2 under the sandbox: Bash items with their outputs; the blocked write and fetch', () => {
    const s = readStream('claude', fixture('claude-phase2-n19.jsonl'));
    expect(s.init?.tools).toEqual(['Bash', 'Glob', 'Grep', 'Read', 'StructuredOutput']);
    expect(s.tools.map((t) => t.name)).toEqual(['Bash', 'Bash', 'Bash']);
    expect(s.tools[0]).toMatchObject({ command: 'ls', output: 'a.ts\nin.ts\nin2.ts', writes: [], network: false });
    expect(s.tools[1]!.output).toContain('EPERM: operation not permitted');
    expect(s.tools.every((t) => t.writes.length === 0 && !t.network)).toBe(true);
    expect(s.final).toEqual({ files: [], wrote: false, network: false });
  });
});

describe('codex exec --json (0.163.0)', () => {
  it('sensor run: last agent message parsed after turn.completed, usage from turn.completed, no model id', () => {
    const s = readStream('codex', fixture('codex-sensor.jsonl'));
    expect(s.completed).toBe(true);
    expect(s.final).toEqual({ verdict: 'compliant', confidence: 0.9 });
    expect(s.usage).toEqual({ input: 18098, output: 23 });
    expect(s.model).toBeNull();
    expect(s.tools).toEqual([]);
  });

  it('workspace-write: command items, started and completed folded into one', () => {
    const s = readStream('codex', fixture('codex-phase2.jsonl'));
    expect(s.tools).toHaveLength(3);
    expect(s.tools[0]).toMatchObject({ name: 'command_execution', command: '/bin/zsh -lc ls', output: 'a.ts\n' });
    expect(s.tools[2]!.output).toContain('Could not resolve host');
    expect(s.final).toEqual({ files: ['a.ts'], wrote: true, network: false });
  });

  it('turn.failed is an error and never a completion', () => {
    const s = readStream('codex', fixture('codex-schema-rejected.jsonl'));
    expect(s.completed).toBe(false);
    expect(s.error).toContain("Missing 'counterexample'");
  });

  it('a null optional property is dropped before validation', () => {
    const s = readStream('codex', fixture('codex-nullable-answer.jsonl'));
    expect((s.final as { findings: Record<string, unknown>[] }).findings[0]).not.toHaveProperty('counterexample');
    expect(dropNulls({ a: null, b: [{ c: null, d: 1 }] })).toEqual({ b: [{ d: 1 }] });
  });
});

describe('incremental reading', () => {
  it('counts tool items as chunks arrive, across split lines', () => {
    const text = fixture('codex-phase2.jsonl');
    const r = new StreamReader('codex');
    const counts: number[] = [];
    for (let i = 0; i < text.length; i += 97) {
      r.feed(text.slice(i, i + 97));
      counts.push(r.toolCalls);
    }
    expect(counts[counts.length - 1]).toBe(3);
    expect(r.summary().completed).toBe(true);
  });

  it('a line that is not JSON is not an event', () => {
    expect(readStream('codex', 'warning: something\n').events).toBe(0);
  });
});
