// 08 B.19 `openapi` as amended by D-087 and D-088: `.stynxrc.json` validated as in B.17, then the three
// published check forms and the changeset rule (four observations). STYNX 3.0.0 publishes no write
// pair, so a missing contract file, or a check finding that sends the reader to the write pair, is
// `UNKNOWN: tooling-missing` with the D-088 hint until `stynx api-docs write` and `stynx
// public-api-baselines write` land (S10).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { show } from '../git/git.js';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { readStynxRc, STYNXRC } from '../stynxrc.js';
import { isListed, passThrough, STYNX_INSTALL, stynxRcOutcome, stynxReason, stynxReport } from './boundary.js';
import { crashed, type Finding, type Reason, runTool, toolingMissing } from './tool-local.js';

/** Defaults when `.stynxrc.json` leaves the paths out [fact: `P:@stynx-nyx/cli@3.0.0/dist/cli/src/checks.js:15-16`]. */
const DEFAULT_OPENAPI = 'docs/framework/contracts/openapi.json';
const DEFAULT_BASELINE = 'docs/framework/contracts/public-api-baselines.json';
/** D-088 hint, verbatim; `<v>` is the release that will carry the pair, unknown today. */
export const WRITE_PAIR_HINT = 'openapi: install @stynx-nyx/cli ≥ <v> with the write pair';
/** A finding that can only be resolved by writing a contract file (every 3.0.0 hint naming the write side, `checks.js:138,180,212`). */
const NAMES_WRITE_SIDE = /write pair|api:docs:write|api:baselines:write|write the baselines/;

const CHECKS = [
  { command: 'verify-api-coverage', args: ['--strict', '--json'], standard: 'S-22' },
  { command: 'verify-openapi-contract', args: ['--json'], standard: 'S-23' },
  { command: 'verify-public-api-baselines', args: ['--json'], standard: 'S-40' },
] as const;

interface Baselines { packages?: Record<string, { exports?: unknown; declarationHashes?: Record<string, string> }> }

/** Packages whose public surface lost or changed a declaration (or its exports) between base and head (S-40). */
export function breakingPackages(base: Baselines, head: Baselines): string[] {
  const out: string[] = [];
  for (const [name, b] of Object.entries(base.packages ?? {})) {
    const h = head.packages?.[name];
    const changed = !h
      || JSON.stringify(b.exports ?? {}) !== JSON.stringify(h.exports ?? {})
      || Object.entries(b.declarationHashes ?? {}).some(([file, hash]) => h.declarationHashes?.[file] !== hash);
    if (changed) out.push(name);
  }
  return out.sort();
}

/** Package names a `.changeset/*.md` front matter bumps `major`. */
export function majorBumps(text: string): string[] {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return [];
  return m[1]!.split(/\r?\n/).map((l) => /^\s*["']?([^"':]+)["']?\s*:\s*major\s*$/.exec(l)?.[1]).filter((n): n is string => n !== undefined);
}

async function run(ctx: RunContext): Promise<NodeOutcome> {
  const pre = stynxRcOutcome(ctx, 'S-22');
  if (pre.outcome) return pre.outcome;
  const zero = { expected: 4, observed: 0, evaluated: 0 };
  const rc = readStynxRc(ctx.root, isListed(ctx, STYNXRC));
  if (rc.kind !== 'valid') {
    return { status: 'UNKNOWN', reason: 'config-invalid', ...zero, findings: [{ locator: `${STYNXRC}:1`, message: '.stynxrc.json is missing; the API roots are undeclared', standard: 'S-22', hint: 'fix .stynxrc.json: boundary, apiCoverage.sourceRoots, publicApi.packageRoots (D-087)' }] };
  }
  const openapiPath = rc.value.apiCoverage.openapiPath ?? DEFAULT_OPENAPI;
  const baselinePath = rc.value.publicApi.baselinePath ?? DEFAULT_BASELINE;

  const failures: Finding[] = [];
  const unknowns: { reason: Reason; finding: Finding }[] = [];
  const writeSide = (f: Finding) => unknowns.push({ reason: 'tooling-missing', finding: { ...f, hint: WRITE_PAIR_HINT } });
  for (const [path, standard] of [[openapiPath, 'S-22'], [baselinePath, 'S-40']] as const) {
    if (!isListed(ctx, path)) writeSide({ locator: `${path}:1`, message: `${path} is missing and no published write pair produces it`, standard, hint: WRITE_PAIR_HINT });
  }

  let observed = 0;
  for (const check of CHECKS) {
    const r = await runTool(ctx.root, 'stynx', [check.command, ...check.args]);
    if (r.kind === 'missing') return { status: 'UNKNOWN', reason: 'tooling-missing', ...zero, findings: [toolingMissing('stynx', STYNX_INSTALL, 'S-22')] };
    const report = stynxReport(r, check.command);
    if (!report) {
      unknowns.push({ reason: 'runner-crashed', finding: crashed(`stynx ${check.command}`, r, check.standard) });
      continue;
    }
    if (report.status === 'UNKNOWN') {
      for (const f of report.findings) unknowns.push({ reason: stynxReason(report.reason), finding: passThrough(f, check.standard, 'the tool exited abnormally; re-run once, then put the output under ## Notes') });
      if (report.findings.length === 0) unknowns.push({ reason: stynxReason(report.reason), finding: { locator: `${STYNXRC}:1`, message: `stynx ${check.command}: UNKNOWN ${report.reason ?? ''}`.trim(), standard: check.standard, hint: 'the tool exited abnormally; re-run once, then put the output under ## Notes' } });
      continue;
    }
    observed++;
    for (const f of report.findings) {
      const finding = passThrough(f, check.standard, 'see the stynx check');
      if (NAMES_WRITE_SIDE.test(`${f.message} ${f.hint ?? ''}`)) writeSide(finding);
      else failures.push(finding);
    }
    if (report.status === 'FAIL' && report.findings.length === 0) failures.push({ locator: `${STYNXRC}:1`, message: `stynx ${check.command} reported FAIL without a finding`, standard: check.standard, hint: 'the tool exited abnormally; re-run once, then put the output under ## Notes' });
  }

  // Changeset rule (S-40): a breaking baseline needs a major changeset in the candidate.
  const base = ctx.base ?? ctx.head;
  let baseText: Buffer | null | undefined;
  try {
    baseText = await show(ctx.root, base, baselinePath);
  } catch {
    unknowns.push({ reason: 'base-unreadable', finding: { locator: `${baselinePath}:1`, message: `git show ${base}:${baselinePath} failed`, standard: 'S-40', hint: 'git fetch origin, then re-run' } });
  }
  if (baseText !== undefined) {
    let breaking: string[] = [];
    let ok = true;
    if (baseText !== null && isListed(ctx, baselinePath)) {
      try {
        breaking = breakingPackages(JSON.parse(baseText.toString('utf8')) as Baselines, JSON.parse(readFileSync(resolve(ctx.root, baselinePath), 'utf8')) as Baselines);
      } catch (e) {
        ok = false;
        unknowns.push({ reason: 'base-unreadable', finding: { locator: `${baselinePath}:1`, message: `baseline not parseable: ${(e as Error).message}`, standard: 'S-40', hint: 'git fetch origin, then re-run' } });
      }
    }
    if (ok) {
      observed++;
      if (breaking.length > 0) {
        const majors = new Set(ctx.listing.entries.map((e) => e.path).filter((p) => /^\.changeset\/[^/]+\.md$/.test(p) && p !== '.changeset/README.md')
          .flatMap((p) => { try { return majorBumps(readFileSync(resolve(ctx.root, p), 'utf8')); } catch { return []; } }));
        if (!breaking.some((n) => majors.has(n))) failures.push({ locator: `${baselinePath}:1`, message: 'breaking change without major changeset', standard: 'S-40', hint: 'pnpm changeset (major)' });
      }
    }
  }

  const counts = { expected: 4, observed, evaluated: observed };
  if (failures.length > 0) return { status: 'FAIL', ...counts, findings: [...failures, ...unknowns.map((u) => u.finding)] };
  if (unknowns.length > 0) return { status: 'UNKNOWN', reason: unknowns[0]!.reason, ...counts, findings: unknowns.map((u) => u.finding) };
  return { status: 'PASS', ...counts, findings: [] };
}

const API_SOURCE = /^(apps\/[^/]+\/src|domain\/[^/]+\/api\/src|packages\/[^/]+\/src)\//;

export const openapi: NodeAdapter = {
  id: 'openapi',
  contract: 1,
  configFiles: () => [STYNXRC, '.changeset/config.json'],
  // B.19 Inputs: sources under the API roots, the contract files, changesets, every workspace manifest (package discovery).
  inputs: (ctx) => ctx.listing.entries.map((e) => e.path).filter((p) => API_SOURCE.test(p) || p.startsWith('docs/framework/contracts/') || /^\.changeset\/[^/]+\.md$/.test(p) || p.endsWith('package.json')),
  run,
};
