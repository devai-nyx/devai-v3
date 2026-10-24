// 07 §3: the one spawner — argv, shell: false, bounded buffer and wall time, a missing binary as data.
import { describe, expect, it } from 'vitest';
import { spawn } from '../src/proc/spawn.js';

const node = process.execPath;
const env = process.env;

describe('spawn (07 §3)', () => {
  it('passes an argument vector without a shell', async () => {
    const r = await spawn({ argv: [node, '-e', 'process.stdout.write(process.argv[1])', '$HOME; echo hi'], cwd: process.cwd(), env });
    expect(r.kind === 'exited' && r.stdout.toString()).toBe('$HOME; echo hi');
  });
  it('a missing binary is returned as data, not thrown', async () => {
    expect(await spawn({ argv: ['devai-no-such-binary-w1'], cwd: process.cwd(), env })).toEqual({ kind: 'missing', binary: 'devai-no-such-binary-w1' });
  });
  it('kills on the wall-time bound', async () => {
    const r = await spawn({ argv: [node, '-e', 'setTimeout(() => {}, 10000)'], cwd: process.cwd(), env, timeoutMs: 100 });
    expect(r).toMatchObject({ kind: 'exited', timedOut: true });
  });
  it('kills on the output bound', async () => {
    const r = await spawn({ argv: [node, '-e', 'process.stdout.write("x".repeat(100000))'], cwd: process.cwd(), env, maxBytes: 1000 });
    expect(r).toMatchObject({ kind: 'exited', overflow: true });
  });
  it('feeds stdin and reports the exit code', async () => {
    const r = await spawn({ argv: [node, '-e', 'process.stdin.pipe(process.stdout); process.stdin.on("end", () => process.exit(3))'], cwd: process.cwd(), env, stdin: 'in' });
    expect(r).toMatchObject({ kind: 'exited', code: 3 });
    expect(r.kind === 'exited' && r.stdout.toString()).toBe('in');
  });
});
