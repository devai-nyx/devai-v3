// The model-CLI layer: argument vectors against 07 §6 / B.24 / B.27 (D-082), the Codex strict schema,
// the classification of recorded streams into the Part B reasons, and the 10 §4 bytes/3.5 proxy.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { proxyTokens } from '../../src/model/budget.js';
import { argvOf, CODEX_CONFINE, modelIdOf, REJECTED_FLAG, replay, schemaFor } from '../../src/model/cli.js';
import { ReviewModelOutput, SensorOutput } from '../../src/report.js';

const fixture = (name: string): string => readFileSync(resolve(import.meta.dirname, 'fixtures', name), 'utf8');
const law08 = readFileSync(resolve(import.meta.dirname, '../../../../docs/framework/08-cli-and-nodes.md'), 'utf8');
const Answer = z.strictObject({ verdict: z.enum(['compliant', 'violation', 'unknown']), confidence: z.number() });
const call = (over: Partial<Parameters<typeof replay>[0]> = {}) => ({
  prefix: 'claude -p --model haiku', mode: 'sensor' as const, schema: Answer, cwd: '/tmp/devai-rec/empty', inputBound: 60000, outputBound: 2000, toolUseReason: 'tool-use-observed' as const, ...over,
});

describe('argument vectors', () => {
  it('B.24 Claude sensor: the 07 §6 list plus --tools "" --restricted, no --bare (D-101), stream requested', () => {
    const a = argvOf({ prefix: 'claude -p --model claude-opus-5-5', harness: 'claude', mode: 'sensor', schema: '{}', cd: '/e' });
    expect(a).toEqual(['claude', '-p', '--model', 'claude-opus-5-5', '--output-format', 'stream-json', '--verbose', '--json-schema', '{}', '--no-session-persistence', '--setting-sources', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--tools', '', '--restricted']);
    expect(a).not.toContain('--bare');
    // every flag B.24 names is present (law text, not this test, is the oracle)
    for (const flag of ['--output-format', 'stream-json', '--verbose', '--json-schema', '--no-session-persistence', '--setting-sources', '--strict-mcp-config', '--mcp-config', '--tools', '--restricted']) expect(law08).toContain(flag);
  });

  it('B.24 Codex sensor: read-only sandbox in an empty --cd, prompt on stdin', () => {
    const a = argvOf({ prefix: 'codex exec --model gpt-6-astra', harness: 'codex', mode: 'sensor', schema: '/s/schema.json', cd: '/e' });
    expect(a).toEqual(['codex', 'exec', '--model', 'gpt-6-astra', '--json', '--output-schema', '/s/schema.json', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--cd', '/e', '--sandbox', 'read-only', '-']);
  });

  it('B.27 phase 1: Claude with --tools "", no sandbox flags', () => {
    const a = argvOf({ prefix: 'claude', harness: 'claude', mode: 'phase1', schema: '{}', cd: '/e' });
    expect(a.slice(0, 2)).toEqual(['claude', '-p']);
    expect(a.slice(-2)).toEqual(['--tools', '']);
  });

  it('B.27 phase 2 Claude: restricted tool set, allow rules, deny list and sandbox settings verbatim (D-082)', () => {
    const a = argvOf({ prefix: 'claude -p', harness: 'claude', mode: 'phase2', schema: '{}', cd: '/w' });
    const tail = a.slice(a.indexOf('--restricted'));
    expect(tail).toEqual(['--restricted', '--tools', 'Read,Grep,Glob,Bash', '--allowedTools', 'Read,Grep,Glob,Bash(git log:*),Bash(git diff:*),Bash(git show:*),Bash(node:*),Bash(pnpm exec vitest:*),Bash(psql:*)', '--disallowedTools', 'Edit,Write,NotebookEdit,WebFetch,WebSearch', '--settings', '{"sandbox":{"enabled":true,"allowUnsandboxedCommands":false,"network":{"allowedDomains":[],"strictAllowlist":true}}}']);
    for (const t of tail.slice(1)) if (t.length > 3) expect(law08).toContain(t);
  });

  it('B.27 phase 2 Codex: workspace-write confined to the scratch --cd, network denied', () => {
    const a = argvOf({ prefix: 'codex exec', harness: 'codex', mode: 'phase2', schema: '/s.json', cd: '/w' });
    expect(a).toEqual(['codex', 'exec', '--json', '--output-schema', '/s.json', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--skip-git-repo-check', '--cd', '/w', '--sandbox', 'workspace-write', ...CODEX_CONFINE, '-']);
  });

  it('A.8: the model id is the prefix --model, else the CLI default', () => {
    expect(modelIdOf('codex exec --model gpt-6-astra')).toBe('gpt-6-astra');
    expect(modelIdOf('codex exec -m o9')).toBe('o9');
    expect(modelIdOf('claude -p')).toBe('claude default');
  });
});

describe('schemas', () => {
  it('Claude gets the zod emission as is; Codex gets every property required, optional ones nullable', () => {
    const claude = schemaFor('claude', ReviewModelOutput) as { properties: { findings: { items: { required: string[] } } } };
    expect(claude.properties.findings.items.required).not.toContain('counterexample');
    const codex = schemaFor('codex', ReviewModelOutput) as { properties: { findings: { items: { required: string[]; properties: Record<string, unknown> } } } };
    expect(codex.properties.findings.items.required).toContain('counterexample');
    expect(codex.properties.findings.items.properties['counterexample']).toEqual({ anyOf: [{ type: 'string', minLength: 1 }, { type: 'null' }] });
    const { $schema, ...sensor } = schemaFor('codex', SensorOutput);
    expect($schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schemaFor('claude', SensorOutput)).toEqual(sensor); // nothing optional there; claude refuses the $schema key
  });
});

describe('classification of recorded streams', () => {
  it('claude sensor → ok, model from init', () => {
    const r = replay(call(), 'claude', fixture('claude-sensor.jsonl'));
    expect(r).toMatchObject({ kind: 'ok', output: { verdict: 'compliant', confidence: 0.9 }, model: 'claude-haiku-4-5-20251001', usage: { input: 4732, output: 168 } });
  });

  it('claude --bare unauthenticated → model-error with the CLI text', () => {
    expect(replay(call(), 'claude', fixture('claude-bare-unauthenticated.jsonl'))).toMatchObject({ kind: 'unknown', reason: 'model-error', message: 'Not logged in · Please run /login' });
  });

  it('claude init with a wider tool set than the mode allows → capability-missing (the flag did not hold)', () => {
    expect(replay(call(), 'claude', fixture('claude-phase2-n19.jsonl'))).toMatchObject({ kind: 'unknown', reason: 'capability-missing' });
  });

  it('claude phase 2 below 2.1.219 → capability-missing (no strictAllowlist)', () => {
    const old = fixture('claude-phase2-n19.jsonl').replace('"claude_code_version":"2.1.292"', '"claude_code_version":"2.1.100"');
    const Phase2Probe = z.strictObject({ files: z.array(z.string()), wrote: z.boolean(), network: z.boolean() });
    const c = call({ mode: 'phase2', schema: Phase2Probe, toolUseReason: 'capability-missing', cwd: '/tmp/devai-rec/wt', inputBound: 150_000, outputBound: 4000 });
    expect(replay(c, 'claude', fixture('claude-phase2-n19.jsonl'))).toMatchObject({ kind: 'ok', output: { wrote: false, network: false } });
    expect(replay(c, 'claude', old)).toMatchObject({ kind: 'unknown', reason: 'capability-missing' });
  });

  it('claude phase 2 usage counts every input component the CLI reports (68,154 for three Bash calls)', () => {
    const s = replay(call({ mode: 'phase2', schema: z.unknown(), toolUseReason: 'capability-missing', inputBound: 60_000 }), 'claude', fixture('claude-phase2-n19.jsonl'));
    expect(s).toMatchObject({ kind: 'unknown', reason: 'input-bound-exceeded', message: '68154 input tokens reported (bound 60000)' });
  });

  it('codex sensor → ok; model id from the prefix (the stream has none)', () => {
    expect(replay(call({ prefix: 'codex exec --model gpt-6-astra' }), 'codex', fixture('codex-sensor.jsonl'))).toMatchObject({ kind: 'ok', model: 'gpt-6-astra' });
  });

  it('codex command items in a no-tools mode → the mode reason (tool-use-observed for the sensor)', () => {
    const Probe = z.strictObject({ files: z.array(z.string()), wrote: z.boolean(), network: z.boolean() });
    expect(replay(call({ prefix: 'codex exec', schema: Probe }), 'codex', fixture('codex-phase2.jsonl'))).toMatchObject({ kind: 'unknown', reason: 'tool-use-observed' });
  });

  it('codex turn.failed → model-error', () => {
    expect(replay(call({ prefix: 'codex exec', schema: ReviewModelOutput }), 'codex', fixture('codex-schema-rejected.jsonl'))).toMatchObject({ kind: 'unknown', reason: 'model-error' });
  });

  it('usage: absent → input-bound-exceeded; over the bounds → input/output-bound-exceeded', () => {
    const noUsage = fixture('codex-sensor.jsonl').replace(/"usage":\{[^}]*\}/, '"x":1');
    expect(replay(call({ prefix: 'codex exec' }), 'codex', noUsage)).toMatchObject({ reason: 'input-bound-exceeded' });
    expect(replay(call({ prefix: 'codex exec', inputBound: 18000 }), 'codex', fixture('codex-sensor.jsonl'))).toMatchObject({ reason: 'input-bound-exceeded' });
    expect(replay(call({ prefix: 'codex exec', outputBound: 20 }), 'codex', fixture('codex-sensor.jsonl'))).toMatchObject({ reason: 'output-bound-exceeded' });
  });

  it('an answer the schema rejects, or no answer → schema-invalid', () => {
    expect(replay(call({ schema: SensorOutput }), 'claude', fixture('claude-sensor.jsonl'))).toMatchObject({ reason: 'schema-invalid' });
    const noAnswer = fixture('codex-sensor.jsonl').replace(/\{"type":"item.completed".*\n/, '');
    expect(replay(call({ prefix: 'codex exec' }), 'codex', noAnswer)).toMatchObject({ reason: 'schema-invalid' });
  });

  it('a rejected flag is recognised from both CLIs\' stderr', () => {
    expect(REJECTED_FLAG.test(fixture('claude-reject.err').trim())).toBe(true);
    expect(REJECTED_FLAG.test(fixture('codex-reject.err').split('\n')[0]!)).toBe(true);
  });
});

describe('10 §4 budget proxy', () => {
  it('ceil(utf8 bytes / 3.5)', () => {
    expect(proxyTokens('')).toBe(0);
    expect(proxyTokens('abcdefg')).toBe(2);
    expect(proxyTokens('é')).toBe(1); // 2 bytes
    expect(proxyTokens('x'.repeat(210_000))).toBe(60_000);
    expect(proxyTokens('x'.repeat(210_001))).toBe(60_001);
  });
});
