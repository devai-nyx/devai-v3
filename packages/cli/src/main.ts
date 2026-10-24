#!/usr/bin/env node
// 08 Part A preamble: every command reads devai.json first (A.8), resolves the runtime once (02 §6),
// prints text or one JSON document (07 §3) and exits with 02 §8's three codes. Commands are added per
// R6 wave; this file carries only what every command shares.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Command, CommanderError } from 'commander';
import type { z } from 'zod';
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

/** The command-level refusal as 08 C.3 prints it: `devai: <reason> — <hint>` or the JSON envelope. */
export function renderRefusal(r: CommandRefusal, format: Format): string {
  if (format === 'json') return JSON.stringify({ accepted: false, exitCode: 2, reason: r.reason, message: r.message });
  return `devai: ${r.reason} — ${r.message}\nexit 2`;
}

export function formatOf(opts: { format?: string }): Format {
  if (opts.format === undefined || opts.format === 'text') return 'text';
  if (opts.format === 'json') return 'json';
  throw new CommandRefusal('usage', `--format ${opts.format}: expected text or json`);
}

/** The `devai` program. Subcommands register here as their waves land (R6 plan W1–W8). */
export function buildProgram(): Command {
  const program = new Command('devai')
    .version(cliVersion(), '--version', 'print the CLI version')
    .option('--format <text|json>', 'output format (07 §3)', 'text')
    .showHelpAfterError(false)
    .configureOutput({ writeErr: (s) => process.stderr.write(s) })
    .exitOverride();
  return program;
}

export async function main(argv: string[]): Promise<number> {
  const program = buildProgram();
  let format: Format = 'text';
  try {
    program.parseOptions(argv);
    format = formatOf(program.opts<{ format?: string }>());
    await program.parseAsync(argv, { from: 'user' });
    return 0;
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
