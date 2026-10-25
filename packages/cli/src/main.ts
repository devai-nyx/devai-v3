#!/usr/bin/env node
// 08 Part A preamble: every command reads devai.json first (A.8), resolves the runtime once (02 §6),
// prints text or one JSON document (07 §3) and exits with 02 §8's three codes. Commands are added per
// R6 wave; this file carries only what every command shares.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command, CommanderError } from 'commander';
import type { z } from 'zod';
import { check } from './commands/check.js';
import { newModule } from './commands/new-module.js';
import { packetLint, packetNew, packetRebase } from './commands/packet.js';
import { packetsStatus } from './commands/packets.js';
import { DevaiConfig } from './config.js';
import type { ReasonCode } from './report.js';

export type Format = 'text' | 'json';
export type Reason = z.infer<typeof ReasonCode>;
export type RuntimeMode = 'bare' | 'docker';

/** A command-level "could not run" (02 §8 exit 2) with its reason code and one-line locator + remedy. */
export class CommandRefusal extends Error {
  constructor(readonly reason: Reason, message: string) {
    super(message);
  }
}

export const cliVersion = (): string =>
  (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;

/** 08 A.8: devai.json must exist in `dir` and validate; otherwise exit 2 `config-invalid`. */
export function loadConfig(dir: string): DevaiConfig {
  const path = resolve(dir, 'devai.json');
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    throw new CommandRefusal('config-invalid', `${path}: not found; run devai init`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    throw new CommandRefusal('config-invalid', `${path}: ${(e as Error).message}`);
  }
  const parsed = DevaiConfig.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    const at = issue.path.length ? issue.path.map(String).join('.') : '(root)';
    throw new CommandRefusal('config-invalid', `${path}: ${at} ${issue.message}`);
  }
  return parsed.data;
}

/** 02 §6: `DEVAI_RUNTIME=bare|docker` overrides `runtime.mode`; any other value is exit 2 `config-invalid`. */
export function resolveRuntime(config: DevaiConfig, env: NodeJS.ProcessEnv = process.env): { mode: RuntimeMode } {
  const override = env['DEVAI_RUNTIME'];
  if (override === undefined || override === '') return { mode: config.runtime.mode };
  if (override === 'bare' || override === 'docker') return { mode: override };
  throw new CommandRefusal('config-invalid', `DEVAI_RUNTIME=${override}: expected bare or docker (02 §6)`);
}

/** Git's ref lines on stdin (A.7 pre-push); empty when stdin is a terminal or unreadable. */
function readStdin(): string {
  if (process.stdin.isTTY) return '';
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/** The command-level refusal as 08 C.3 prints it: `devai: <reason> — <hint>` or the JSON envelope. */
export function renderRefusal(r: CommandRefusal, format: Format): string {
  if (format === 'json') return JSON.stringify({ accepted: false, exitCode: 2, reason: r.reason, message: r.message });
  return `devai: ${r.reason} — ${r.message}\nexit 2`;
}

export function formatOf(opts: { format?: string | undefined }): Format {
  if (opts.format === undefined || opts.format === 'text') return 'text';
  if (opts.format === 'json') return 'json';
  throw new CommandRefusal('usage', `--format ${opts.format}: expected text or json`);
}

/** The `devai` program. Subcommands register here as their waves land (R6 plan W1–W8). */
export function buildProgram(state: { exitCode: number; argv: readonly string[] } = { exitCode: 0, argv: [] }): Command {
  const program = new Command('devai')
    .version(cliVersion(), '--version', 'print the CLI version')
    .option('--format <text|json>', 'output format (07 §3)', 'text')
    .showHelpAfterError(false)
    .configureOutput({ writeErr: (s) => process.stderr.write(s) })
    .exitOverride();
  // A.3. The command prints its own refusals: its --format may follow options the program does not know.
  program
    .command('check')
    .description('run the check DAG over the candidate (08 A.3)')
    .argument('[args...]', '--hook commit-msg message file; --hook pre-push remote name and url')
    .option('--packet <path>', 'packet file (05)')
    .option('--full', 'every applicable node')
    .option('--only <node>', 'named node and its prerequisites (repeatable)', (v: string, acc: string[]) => [...acc, v], [] as string[])
    .option('--hook <stage>', 'pre-commit | pre-push | commit-msg')
    .option('--expect-red', "restate a test packet's observations.unimplemented")
    .option('--summary', 'print the PR summary')
    .option('--format <text|json>', 'output format (07 §3)')
    .option('--prune', 'prune .devai/cache')
    .exitOverride()
    .action(async (args: string[], opts: { format?: string } & Parameters<typeof check>[1]) => {
      // A.7: the pre-push hook receives git's ref lines on stdin.
      const stdin = opts.hook === 'pre-push' ? readStdin() : undefined;
      await run(opts, (format) => check(state.argv.slice(state.argv.indexOf('check') + 1), { ...opts, args, ...(stdin !== undefined ? { stdin } : {}) }, format, process.cwd()));
    });
  // A.2.
  program
    .command('new')
    .description('write from an approved spec (08 A.2)')
    .exitOverride()
    .command('module')
    .description('render one module from one approved spec (09 §2)')
    .requiredOption('--spec <path>', 'repo path of an approved spec (06 §6)')
    .option('--web', 'add web/** (04 §2)')
    .option('--out <dir>', 'destination, default domain/<module.slug>')
    .option('--regenerate', 'rewrite the mode: generated files of an existing module (A.2)')
    .option('--format <text|json>', 'output format (07 §3)')
    .exitOverride()
    .action(async (opts: { format?: string } & Parameters<typeof newModule>[0]) => run(opts, (format) => newModule(opts, format, process.cwd())));
  // A.4.
  const packet = program.command('packet').description('author a task packet (08 A.4)').exitOverride();
  packet
    .command('new')
    .description('render a new packet (05 §2)')
    .requiredOption('--kind <kind>', 'spec | generate | test | code | fix | standards')
    .option('--spec <path>', 'the pinned spec, or the output path for kind: spec')
    .option('--campaign <id>', 'campaign folder under packets/')
    .option('--format <text|json>', 'output format (07 §3)')
    .exitOverride()
    .action(async (opts: { format?: string } & Parameters<typeof packetNew>[0]) => run(opts, (format) => packetNew(opts, format, process.cwd())));
  packet
    .command('lint')
    .description('evaluate the 05 §5 rules that need no DAG run')
    .argument('<path>', 'packet file')
    .option('--format <text|json>', 'output format (07 §3)')
    .exitOverride()
    .action(async (path: string, opts: { format?: string }) => run(opts, (format) => packetLint(path, format, process.cwd())));
  packet
    .command('rebase')
    .description("advance the packet's base (05 §4, PL-05)")
    .argument('<path>', 'packet file')
    .requiredOption('--to <commit>', 'the new base, a descendant of the current one')
    .option('--format <text|json>', 'output format (07 §3)')
    .exitOverride()
    .action(async (path: string, opts: { format?: string; to: string }) => run(opts, (format) => packetRebase(path, opts.to, format, process.cwd())));
  // A.5.
  program
    .command('packets')
    .description('packet states derived from git (08 A.5)')
    .exitOverride()
    .command('status')
    .description('one line per packet: id, kind, state, evidence')
    .option('--campaign <id>', 'campaign folder under packets/')
    .option('--format <text|json>', 'output format (07 §3)')
    .exitOverride()
    .action(async (opts: { format?: string; campaign?: string }) => run(opts, (format) => packetsStatus(opts, format, process.cwd())));

  /** Runs one command action: its --format (or the program's), its stdout, its refusal (exit 2). */
  async function run(opts: { format?: string }, f: (format: Format) => Promise<{ stdout: string; exitCode: 0 | 1 | 2 }>): Promise<void> {
    let format: Format = 'text';
    try {
      format = formatOf({ format: opts.format ?? program.opts<{ format?: string }>().format });
      const r = await f(format);
      process.stdout.write(r.stdout);
      state.exitCode = r.exitCode;
    } catch (e) {
      if (!(e instanceof CommandRefusal)) throw e;
      process.stdout.write(renderRefusal(e, format) + '\n');
      state.exitCode = 2;
    }
  }
  return program;
}

export async function main(argv: string[]): Promise<number> {
  const state = { exitCode: 0, argv };
  const program = buildProgram(state);
  let format: Format = 'text';
  try {
    program.parseOptions(argv);
    format = formatOf(program.opts<{ format?: string }>());
    await program.parseAsync(argv, { from: 'user' });
    return state.exitCode;
  } catch (e) {
    if (e instanceof CommanderError) {
      if (e.code === 'commander.version' || e.code === 'commander.helpDisplayed' || e.code === 'commander.help') return 0;
      const r = new CommandRefusal('usage', e.message.trim());
      process.stdout.write(renderRefusal(r, format) + '\n');
      return 2;
    }
    if (e instanceof CommandRefusal) {
      process.stdout.write(renderRefusal(e, format) + '\n');
      return 2;
    }
    throw e;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
