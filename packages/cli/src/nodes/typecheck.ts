// 08 B.5 `typecheck`: `tsc -b --verbose --pretty false <affected project tsconfigs…>` (TypeScript 6.0.3
// binary from the product's node_modules, D-057) over `inventory`'s affected `tsc -b` closure. One
// observation per project; `--verbose` names each project as built or up to date, and its
// `.tsbuildinfo` must exist afterwards. Diagnostics are read from stdout only (D-086).
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from '../proc/spawn.js';
import type { NodeAdapter, RunContext } from '../runner/run.js';
import { bin, crashed, env, type Finding, outcome, type Unknown } from '../ts/outcome.js';
import { loadProject } from '../ts/program.js';

const DIAGNOSTIC = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/;
const LISTED = /^\s+\* (.+)$/;

/** B.5 Findings: `TS7006`/`any`-family codes map to S-33, the rest to S-32 (the 7xxx implicit-any family). */
export function diagnosticFinding(path: string, line: string, col: string, code: string, message: string): Finding {
  const any = /^TS70\d\d$/.test(code);
  return {
    locator: `${path}:${line}:${col}`,
    message: `${code}: ${message}`,
    standard: any ? 'S-33' : 'S-32',
    hint: any ? 'type the value or parse it with zod' : 'fix the type, not the config',
  };
}

/** B.5 Status: an effective `module: commonjs` or a missing strictness option on an affected project. */
function configFindings(tsconfig: string, o: ReturnType<typeof loadProject>['options']): Finding[] {
  const out: Finding[] = [];
  // ts.ModuleKind.CommonJS = 1
  if (o.module === 1) out.push({ locator: `${tsconfig}:1`, message: 'emits commonjs', standard: 'S-31', hint: 'set module: NodeNext' });
  for (const k of ['strict', 'noUncheckedIndexedAccess', 'exactOptionalPropertyTypes', 'isolatedModules', 'forceConsistentCasingInFileNames'] as const) {
    if (o[k] !== true) out.push({ locator: `${tsconfig}:1`, message: `effective ${k} off`, standard: 'S-32', hint: 'restore the published chain' });
  }
  return out;
}

const projectsOf = (ctx: RunContext): string[] => ctx.inventory?.projects ?? [];

export const typecheck: NodeAdapter = {
  id: 'typecheck',
  contract: 1,
  configFiles: (ctx) => projectsOf(ctx),
  inputs: (ctx) => {
    const tsconfigs = ctx.listing.entries.map((e) => e.path).filter((p) => /(^|\/)tsconfig[^/]*\.json$/.test(p));
    const sources = projectsOf(ctx).flatMap((t) => loadProject(ctx.root, t).files);
    return [...new Set([...tsconfigs, ...sources])].sort();
  },
  async run(ctx) {
    const projects = projectsOf(ctx).map((t) => loadProject(ctx.root, t));
    const counts = { expected: projects.length, observed: 0, evaluated: 0 };
    if (projects.length === 0) return outcome(counts, [], []);
    const findings: Finding[] = projects.flatMap((p) => configFindings(p.tsconfig, p.options));
    const r = await spawn({ argv: [bin(ctx, 'tsc'), '-b', '--verbose', '--pretty', 'false', ...projects.map((p) => p.tsconfig)], cwd: ctx.root, env, timeoutMs: 600_000 });
    if (r.kind === 'missing') {
      return outcome(counts, [], [{ reason: 'tooling-missing', finding: { locator: `${projects[0]!.tsconfig}:1`, message: 'tsc not resolvable from node_modules/.bin', standard: 'S-31', hint: 'install with pnpm install' } }]);
    }
    if (r.timedOut) return outcome(counts, [], [{ reason: 'timeout', finding: { locator: `${projects[0]!.tsconfig}:1`, message: 'tsc -b exceeded its wall time', standard: 'S-32', hint: 're-run once; a repeat goes under ## Notes' } }]);
    const lines = r.stdout.toString('utf8').split(/\r?\n/); // tsc 6.0.3 ends the project list with CRLF
    const start = lines.findIndex((l) => /Projects in this build:/.test(l));
    const listed = new Set<string>();
    for (let i = start + 1; start >= 0 && i < lines.length && LISTED.test(lines[i]!); i++) listed.add(LISTED.exec(lines[i]!)![1]!.trim());
    const diagnostics: Finding[] = [];
    for (const l of lines) {
      const m = DIAGNOSTIC.exec(l.trim());
      if (m) diagnostics.push(diagnosticFinding(m[1]!, m[2]!, m[3]!, m[4]!, m[5]!));
    }
    if (listed.size === 0 && r.code !== 0 && diagnostics.length === 0) return outcome(counts, [], [crashed(`${projects[0]!.tsconfig}:1`, r.stderr.length > 0 ? r.stderr : r.stdout, r.code, 'S-32')]);
    // Observed: projects the verbose output names whose .tsbuildinfo exists afterwards.
    const observed = projects.filter((p) => listed.has(p.tsconfig) && p.buildInfo !== null && existsSync(resolve(ctx.root, p.buildInfo)));
    counts.observed = observed.length;
    counts.evaluated = observed.length;
    const unknown: Unknown[] = [];
    if (r.code !== 0 && diagnostics.length === 0) unknown.push(crashed(`${projects[0]!.tsconfig}:1`, r.stderr.length > 0 ? r.stderr : r.stdout, r.code, 'S-32'));
    for (const p of projects) {
      if (!observed.includes(p)) findings.push({ locator: `${p.tsconfig}:1`, message: 'project not built (no tsbuildinfo after tsc -b)', standard: 'S-32', hint: 'make the project composite and buildable with tsc -b' });
    }
    return outcome(counts, [...findings, ...diagnostics], unknown);
  },
};
