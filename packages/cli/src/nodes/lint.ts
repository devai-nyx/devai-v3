// 08 B.3 `lint`: `eslint --format json --max-warnings=0 --no-warn-ignored -- <files…>` over the
// changed, present `*.ts`, `*.mts`, `*.html` (B.1 population table) with the product's
// `eslint.config.mjs` (published STYNX profiles + the overlay in ./lint-overlay). Any message is `FAIL`;
// an expected file absent from the JSON (ignored by config) is a shortfall `FAIL`; a parser fatal is
// `UNKNOWN: lint-config-failed` at the file. The ESLint JSON reading here is shared with `lint-tests`
// (B.4) and `i18n` (B.13).
import { realpathSync } from 'node:fs';
import { relative } from 'node:path';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { candidatePaths, changedPresent, type Finding, preflight, runTool, unknown, unknownOutcome } from '../proc/tool.js';
import { standardOf } from './lint-overlay/index.js';

export const ESLINT_INSTALL = 'pnpm add -D --save-exact eslint@10.10.0 @stynx-nyx/eslint-config@3.0.0';
export const ESLINT_CONFIG = 'eslint.config.mjs';
const STANDARD = 'S-41';

export interface EslintMessage {
  ruleId: string | null;
  message: string;
  line?: number;
  column?: number;
  fatal?: boolean;
}
interface EslintResult {
  filePath: string;
  messages: EslintMessage[];
  fatalErrorCount?: number;
}

/** ESLint's `--format json` document, or null when stdout is not one. */
export function parseEslintJson(stdout: string): EslintResult[] | null {
  try {
    const doc = JSON.parse(stdout) as unknown;
    if (!Array.isArray(doc)) return null;
    return doc.every((r) => typeof r === 'object' && r !== null && typeof (r as EslintResult).filePath === 'string' && Array.isArray((r as EslintResult).messages)) ? (doc as EslintResult[]) : null;
  } catch {
    return null;
  }
}

export interface EslintRun {
  ctx: RunContext;
  files: readonly string[];
  /** argv between `eslint` and `--format` (e.g. `--config <path>`). */
  configArgs?: readonly string[];
  /** Flags after `--max-warnings=0` (B.3 `--no-warn-ignored`, B.4 `--no-error-on-unmatched-pattern`). */
  flags: readonly string[];
  /** Config files DEVAI pre-flights (08 §0 fifth convention). */
  configs: readonly string[];
  standard: string;
  /** A message as this node's finding, or null when it belongs to another node (B.13 keeps only template/i18n). */
  finding: (path: string, m: EslintMessage) => Finding | null;
  /** Extra observations established before ESLint ran (B.13 catalog pairs). */
  base?: { expected: number; observed: number; findings: Finding[] };
}

const at = (path: string, m: EslintMessage) => `${path}:${m.line ?? 1}:${m.column ?? 1}`;

/** One ESLint invocation as a node outcome: counts per B.3 Observation, findings per the node's map. */
export async function eslintOutcome(e: EslintRun): Promise<NodeOutcome> {
  const { ctx, files } = e;
  const base = e.base ?? { expected: 0, observed: 0, findings: [] };
  const expected = base.expected + files.length;
  if (files.length === 0) {
    const counts = { expected, observed: base.observed, evaluated: base.observed };
    return base.findings.length > 0 ? { status: 'FAIL', ...counts, findings: base.findings } : { status: 'PASS', ...counts, findings: [] };
  }
  const pre = await preflight(ctx.root, { configs: e.configs }, e.standard);
  if (pre) return unknownOutcome(pre, { expected });
  const r = await runTool({
    root: ctx.root, bin: 'eslint', install: ESLINT_INSTALL,
    args: [...(e.configArgs ?? []), '--format', 'json', '--max-warnings=0', ...e.flags, '--', ...files],
    locator: `${e.configs[0] ?? files[0]}:1`, standard: e.standard, parse: parseEslintJson,
  });
  if (r.kind === 'unknown') return unknownOutcome(r.unknown, { expected });
  const roots = [ctx.root, realpathSync(ctx.root)];
  const rel = (abs: string) => roots.map((root) => relative(root, abs)).find((p) => !p.startsWith('..')) ?? abs;
  const byPath = new Map(r.value.map((res) => [rel(res.filePath), res]));
  const findings: Finding[] = [...base.findings];
  const fatal: Finding[] = [];
  let observed = 0;
  let evaluated = 0;
  for (const path of files) {
    const res = byPath.get(path);
    if (!res) {
      findings.push({ locator: `${path}:1`, message: 'not linted: ignored by the ESLint config', standard: e.standard, hint: 'remove it from the config ignores or add it to a profile\'s files' });
      continue;
    }
    observed++;
    if ((res.fatalErrorCount ?? 0) === 0) evaluated++;
    for (const m of res.messages) {
      if (m.fatal || m.ruleId === null) fatal.push(unknown('lint-config-failed', at(path, m), m.message, e.standard).finding);
      else {
        const f = e.finding(path, m);
        if (f) findings.push(f);
      }
    }
  }
  const counts = { expected, observed: base.observed + observed, evaluated: base.observed + evaluated };
  // A FAIL and an UNKNOWN cause together are FAIL, keeping every finding (A.3, as B.1 applies it; D-084).
  if (findings.length > 0) return { status: 'FAIL', ...counts, findings: [...findings, ...fatal] };
  if (fatal.length > 0) return { status: 'UNKNOWN', reason: 'lint-config-failed', ...counts, findings: fatal };
  return { status: 'PASS', ...counts, findings: [] };
}

const lintable = (p: string) => /\.(ts|mts|html)$/.test(p);
const tsconfigs = (ctx: RunContext) => candidatePaths(ctx, (p) => /(^|\/)tsconfig[^/]*\.json$/.test(p));

export const lint: NodeAdapter = {
  id: 'lint',
  contract: 1,
  configFiles: (ctx) => [ESLINT_CONFIG, 'devai.json', ...tsconfigs(ctx)],
  // The project closure of the changed files is approximated by every lintable file (a superset; C.4 misses, never stale hits).
  inputs: (ctx) => candidatePaths(ctx, lintable),
  run: (ctx) => eslintOutcome({
    ctx, files: changedPresent(ctx, lintable), flags: ['--no-warn-ignored'], configs: [ESLINT_CONFIG], standard: STANDARD,
    finding: (path, m) => ({ locator: at(path, m), message: `${m.ruleId}: ${m.message}`, ...standardOf(m.ruleId ?? '', m.message) }),
  }),
};
