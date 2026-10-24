// 08 B.15 `commitlint`: `commitlint --config tools/commitlint.config.mjs --from <base> --to HEAD` over
// the commits in `base..HEAD` (B.1 population table: 0 without `--packet`), or `--edit <msgfile>` for
// the commit-msg hook (A.7, wired by W4 through `lintMessageFile`). commitlint 21.2.2 exits 1 for a
// violation and also for a missing config, a missing message file and a cwd outside git (D-086), so
// those three are pre-flighted and the verdict is read from the parsed text output only.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256 } from '../candidate/digest.js';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { log } from '../git/git.js';
import { type Finding, preflight, runTool, unknown, unknownOutcome } from '../proc/tool.js';

export const COMMITLINT_INSTALL = 'pnpm add -D --save-exact @commitlint/cli@21.2.2 @commitlint/config-conventional@21.2.2';
export const COMMITLINT_CONFIG = 'tools/commitlint.config.mjs';
const STANDARD = 'S-40';
const HINT = 'type(scope): subject';

export interface Linted {
  /** The message as commitlint echoes it after `⧗   --- input ---`. */
  input: string;
  errors: { rule: string; message: string }[];
}

/**
 * commitlint's default text formatter: per reported message a `⧗   --- input ---` block (or the
 * one-line `⧗   input: <header>`), then `✖   <message> [<rule>]` errors, `⚠` warnings and a
 * `found <n> problems` summary. Null when the output does not have that shape for this exit code.
 */
export function parseCommitlint(stdout: string, code: number): Linted[] | null {
  if (code !== 0 && code !== 1) return null;
  const blocks: Linted[] = [];
  let cur: (Linted & { reading: boolean }) | null = null;
  for (const line of stdout.split('\n')) {
    const oneLine = /^⧗\s+input: (.*)$/.exec(line);
    if (/^⧗\s+--- input ---$/.test(line) || oneLine) {
      cur = { input: oneLine?.[1] ?? '', errors: [], reading: !oneLine };
      blocks.push(cur);
      continue;
    }
    if (!cur) continue;
    const mark = /^([✖⚠✔ⓘ])\s+(.*)$/.exec(line);
    if (cur.reading && !mark) {
      cur.input += (cur.input ? '\n' : '') + line;
      continue;
    }
    cur.reading = false;
    if (mark?.[1] !== '✖' || /^found \d+ problems?, \d+ warnings?$/.test(mark[2]!)) continue;
    const err = /^(.*) \[([a-z0-9-]+)\]$/.exec(mark[2]!);
    if (!err) return null;
    cur.errors.push({ rule: err[2]!, message: err[1]! });
  }
  const violations = blocks.some((b) => b.errors.length > 0);
  if ((code === 1) !== violations) return null;
  return blocks;
}

const findingsAt = (locator: string, b: Linted): Finding[] => b.errors.map((e) => ({ locator: `${locator}:1`, message: `${e.rule}: ${e.message}`, standard: STANDARD, hint: HINT }));

/** `git log <base>..HEAD` messages, newest first (commitlint's own order). */
async function commits(root: string, base: string): Promise<{ sha: string; message: string }[]> {
  const out = await log(root, ['--format=%H%x00%B%x1e', `${base}..HEAD`]);
  return out.split('\x1e').map((r) => r.replace(/^\n/, '')).filter((r) => r.includes('\0')).map((r) => {
    const [sha, message] = r.split('\0') as [string, string];
    return { sha, message: message.trim() };
  });
}

const preflightAll = (root: string, messageFile?: string) =>
  preflight(root, { gitRoot: true, configs: [COMMITLINT_CONFIG], ...(messageFile !== undefined ? { messageFile } : {}) }, STANDARD);

const run = (root: string, args: readonly string[]) =>
  runTool({ root, bin: 'commitlint', install: COMMITLINT_INSTALL, args: ['--config', COMMITLINT_CONFIG, ...args], locator: `${COMMITLINT_CONFIG}:1`, standard: STANDARD, parse: parseCommitlint });

const outcome = (expected: number, findings: Finding[]): NodeOutcome =>
  ({ status: findings.length > 0 ? 'FAIL' : 'PASS', expected, observed: expected, evaluated: expected, findings });

/** sha256 of the message file, or `unreadable` (the run pre-flights it: `io`). */
function messageDigest(root: string, file: string): string {
  try {
    return sha256(readFileSync(resolve(root, file)));
  } catch {
    return 'unreadable';
  }
}

/** The commit-msg form (A.7 `--hook commit-msg`): one message, locator = the message file. */
export async function lintMessageFile(ctx: RunContext, messageFile: string): Promise<NodeOutcome> {
  const pre = await preflightAll(ctx.root, messageFile);
  if (pre) return unknownOutcome(pre, { expected: 1 });
  const r = await run(ctx.root, ['--edit', messageFile]);
  if (r.kind === 'unknown') return unknownOutcome(r.unknown, { expected: 1 });
  return outcome(1, r.value.flatMap((b) => findingsAt(messageFile, b)));
}

export const commitlint: NodeAdapter = {
  id: 'commitlint',
  contract: 1,
  configFiles: () => [COMMITLINT_CONFIG],
  inputs: () => [], // the messages are commits or the message file, keyed through `keyExtra` (C.4); no path input
  // Range form: the commits `base..HEAD`; commit-msg form: the message file's bytes.
  keyExtra: async (ctx) => (ctx.messageFile !== undefined ? [`msg:${messageDigest(ctx.root, ctx.messageFile)}`] : [ctx.base ?? 'none', ctx.head]),
  async run(ctx: RunContext): Promise<NodeOutcome> {
    if (ctx.messageFile !== undefined) return lintMessageFile(ctx, ctx.messageFile);
    if (ctx.base === null) return outcome(0, []);
    const pre = await preflightAll(ctx.root);
    if (pre) return unknownOutcome(pre, { expected: ctx.inventory?.populations.commitlint.count ?? 0 });
    const list = await commits(ctx.root, ctx.base);
    const expected = list.length;
    if (expected === 0) return outcome(0, []);
    const r = await run(ctx.root, ['--from', ctx.base, '--to', 'HEAD']);
    if (r.kind === 'unknown') return unknownOutcome(r.unknown, { expected });
    // Each reported input is matched to the next unmatched commit with the same message, then the same header.
    const free = [...list];
    const findings: Finding[] = [];
    for (const b of r.value.filter((x) => x.errors.length > 0)) {
      const input = b.input.trim();
      const header = input.split('\n')[0];
      const i = [free.findIndex((c) => c.message === input), free.findIndex((c) => c.message.split('\n')[0] === header)].find((n) => n >= 0);
      if (i === undefined) return unknownOutcome(unknown('runner-crashed', `${COMMITLINT_CONFIG}:1`, `commitlint reported a message not in ${ctx.base.slice(0, 12)}..HEAD: ${header}`, STANDARD), { expected });
      findings.push(...findingsAt(free[i]!.sha, b));
      free.splice(i, 1);
    }
    return outcome(expected, findings);
  },
};
