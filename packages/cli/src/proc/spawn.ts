// 07 §3, 08 §0: the one process spawner. Argument vector, `shell: false`, explicit cwd and env, a bounded
// output buffer and a bounded wall time. A missing binary is returned as data (the node reports
// `UNKNOWN: tooling-missing`, D-029), never thrown.
import { spawn as nodeSpawn } from 'node:child_process';

export interface SpawnSpec {
  argv: readonly [string, ...string[]];
  cwd: string;
  env: NodeJS.ProcessEnv;
  stdin?: string | Buffer;
  /** Bound on stdout and on stderr, each; beyond it the process is killed and `overflow` is set. */
  maxBytes?: number;
  /** Wall-time bound; beyond it the process is killed and `timedOut` is set. */
  timeoutMs?: number;
  /** Sees each stdout chunk as it arrives; returning true kills the process and sets `stopped` (a caller's budget). */
  onStdout?: (chunk: Buffer) => boolean | void;
}

export type SpawnResult =
  | { kind: 'missing'; binary: string }
  | {
      kind: 'exited';
      code: number | null;
      signal: NodeJS.Signals | null;
      stdout: Buffer;
      stderr: Buffer;
      overflow: boolean;
      timedOut: boolean;
      /** Killed because `onStdout` asked for it. */
      stopped: boolean;
      durationMs: number;
    };

export const DEFAULT_MAX_BYTES = 64 * 1024 * 1024;
export const DEFAULT_TIMEOUT_MS = 120_000;

export function spawn(spec: SpawnSpec): Promise<SpawnResult> {
  const [binary, ...args] = spec.argv;
  const maxBytes = spec.maxBytes ?? DEFAULT_MAX_BYTES;
  const started = Date.now();
  return new Promise((resolvePromise) => {
    let settled = false;
    const done = (r: SpawnResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolvePromise(r);
    };
    const child = nodeSpawn(binary, args, { cwd: spec.cwd, env: spec.env, shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let outLen = 0;
    let errLen = 0;
    let overflow = false;
    let timedOut = false;
    let stopped = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, spec.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const collect = (chunks: Buffer[], add: (n: number) => number) => (chunk: Buffer) => {
      if (overflow) return;
      if (add(chunk.length) > maxBytes) {
        overflow = true;
        child.kill('SIGKILL');
        return;
      }
      chunks.push(chunk);
    };
    const collectOut = collect(out, (n) => (outLen += n));
    child.stdout.on('data', (chunk: Buffer) => {
      collectOut(chunk);
      if (!stopped && spec.onStdout?.(chunk) === true) {
        stopped = true;
        child.kill('SIGKILL');
      }
    });
    child.stderr.on('data', collect(err, (n) => (errLen += n)));
    child.on('error', (e: NodeJS.ErrnoException) => {
      if (e.code === 'ENOENT' || e.code === 'EACCES') done({ kind: 'missing', binary });
      else done({ kind: 'exited', code: null, signal: null, stdout: Buffer.alloc(0), stderr: Buffer.from(String(e.message)), overflow, timedOut, stopped, durationMs: Date.now() - started });
    });
    child.on('close', (code, signal) => {
      done({ kind: 'exited', code, signal, stdout: Buffer.concat(out), stderr: Buffer.concat(err), overflow, timedOut, stopped, durationMs: Date.now() - started });
    });
    child.stdin.on('error', () => undefined); // a child that exits before reading stdin is reported by its exit, not here
    child.stdin.end(spec.stdin ?? '');
  });
}
