// 08 B.17 `boundary`: `.stynxrc.json` validated by DEVAI (D-087), then `stynx verify-stynx-boundary
// --json`; one observation per `*.ts` under the configured roots, reconciled against the tool's
// `scanned` census. Never SKIPPED; a missing `.stynxrc.json` is FAIL.
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { readStynxRc, STYNXRC } from '../stynxrc.js';
import { crashed, type Exited, type Finding, jsonOf, type Reason, runTool, toolingMissing, unknown } from './tool-local.js';
import { ReasonCode } from '../report.js';

/** The published command's defaults when `boundary.roots` is absent [fact: `P:@stynx-nyx/cli@3.0.0/engines/stynx-boundary.mjs:24`]. */
const DEFAULT_ROOTS = ['reference', 'domain', 'packages', 'packages-web'];
/** Directories the command does not descend into [fact: `stynx-boundary.mjs:95`]. */
const SKIPPED_DIRS = ['node_modules', 'dist', 'coverage'];
export const STYNX_INSTALL = 'pnpm add -w -D @stynx-nyx/cli@3.0.0 && pnpm install';

interface ToolReport {
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  reason?: string;
  findings: { locator: string; message: string; standard?: string; hint?: string }[];
  scanned?: string[];
}

/** The D-071 report shape the six `stynx` checks print [fact: `P:@stynx-nyx/cli@3.0.0/dist/cli/src/checks.js:274-284`]. */
export function stynxReport(r: Exited, command: string): ToolReport | null {
  const j = jsonOf(r) as Partial<ToolReport> & { command?: unknown } | null;
  if (!j || typeof j !== 'object' || j.command !== command || !['PASS', 'FAIL', 'UNKNOWN'].includes(String(j.status)) || !Array.isArray(j.findings)) return null;
  if (!j.findings.every((f) => f && typeof f.locator === 'string' && typeof f.message === 'string')) return null;
  return j as ToolReport;
}

/** A `stynx` UNKNOWN keeps its reason when C.2 knows it, else `runner-crashed`. */
export const stynxReason = (reason: string | undefined): Reason => {
  const r = ReasonCode.safeParse(reason);
  return r.success ? r.data : 'runner-crashed';
};

export const passThrough = (f: ToolReport['findings'][number], standard: string, hint: string): Finding =>
  ({ locator: f.locator, message: f.message, standard: f.standard ?? standard, hint: (f.hint ?? hint).slice(0, 160) });

export const isListed = (ctx: RunContext, path: string): boolean => ctx.listing.entries.some((e) => e.path === path);

/** Pre-flight of `.stynxrc.json` (D-087): `null` when valid, else the node's outcome. */
export function stynxRcOutcome(ctx: RunContext, standard: string): { outcome: NodeOutcome | null; roots: { boundary: string[] } } {
  const rc = readStynxRc(ctx.root, isListed(ctx, STYNXRC));
  const zero = { expected: 0, observed: 0, evaluated: 0 };
  const hint = 'fix .stynxrc.json: boundary, apiCoverage.sourceRoots, publicApi.packageRoots (D-087)';
  if (rc.kind === 'unreadable') return { outcome: unknown('io', [{ locator: `${STYNXRC}:1`, message: rc.message, standard, hint: 'make the path readable (permissions, broken or escaping symlink), then re-run' }], zero), roots: { boundary: [] } };
  if (rc.kind === 'invalid') return { outcome: unknown('config-invalid', [{ locator: `${STYNXRC}:1`, message: rc.message, standard, hint }], zero), roots: { boundary: [] } };
  if (rc.kind === 'absent') return { outcome: null, roots: { boundary: [] } };
  return { outcome: null, roots: { boundary: rc.value.boundary.roots ?? DEFAULT_ROOTS } };
}

const underRoots = (path: string, roots: readonly string[]): boolean =>
  roots.some((r) => path.startsWith(`${r}/`)) && !path.split('/').slice(0, -1).some((s) => SKIPPED_DIRS.includes(s));

async function run(ctx: RunContext): Promise<NodeOutcome> {
  const pre = stynxRcOutcome(ctx, 'S-34');
  if (pre.outcome) return pre.outcome;
  if (!isListed(ctx, STYNXRC)) {
    // Absence is FAIL (B.17 Population, D-058); the message is the published command's own [fact: `checks.js:97-106`].
    return { status: 'FAIL', expected: 0, observed: 0, evaluated: 0, findings: [{ locator: `${STYNXRC}:1`, message: '.stynxrc.json is missing; the boundary is undeclared', standard: 'S-34', hint: 'add .stynxrc.json with a boundary block (roots, allowedPackages)' }] };
  }
  const expectedFiles = ctx.listing.entries.map((e) => e.path).filter((p) => p.endsWith('.ts') && underRoots(p, pre.roots.boundary)).sort();
  const expected = expectedFiles.length;
  const r = await runTool(ctx.root, 'stynx', ['verify-stynx-boundary', '--json']);
  if (r.kind === 'missing') return unknown('tooling-missing', [toolingMissing('stynx', STYNX_INSTALL, 'S-34')], { expected, observed: 0, evaluated: 0 });
  const report = stynxReport(r, 'verify-stynx-boundary');
  if (!report || !Array.isArray(report.scanned)) return unknown('runner-crashed', [crashed('stynx verify-stynx-boundary', r, 'S-34')], { expected, observed: 0, evaluated: 0 });
  if (report.status === 'UNKNOWN') return unknown(stynxReason(report.reason), report.findings.map((f) => passThrough(f, 'S-34', 'the tool exited abnormally; re-run once, then put the output under ## Notes')), { expected, observed: 0, evaluated: 0 });
  const scanned = new Set(report.scanned);
  const observed = expectedFiles.filter((p) => scanned.has(p)).length;
  const findings: Finding[] = report.findings.map((f) => {
    const file = f.locator.replace(/:\d+(:\d+)?$/, '');
    const forbidden = /^imports forbidden (.+)$/.exec(f.message);
    if (forbidden) return { locator: `${file}:1`, message: `imports forbidden ${forbidden[1]}`, standard: 'S-44', hint: 'import the public entry point' };
    const seam = /^imports undeclared STYNX seam (.+)$/.exec(f.message);
    if (seam) return { locator: `${file}:1`, message: `imports undeclared STYNX seam ${seam[1]}`, standard: 'S-34', hint: 'add it to .stynxrc.json allowedPackages or import the barrel' };
    return passThrough(f, 'S-34', 'add it to .stynxrc.json allowedPackages or import the barrel');
  });
  // 08 §0 second convention: observed < expected names the missing units.
  for (const p of expectedFiles) if (!scanned.has(p)) findings.push({ locator: `${p}:1`, message: 'not in the verify-stynx-boundary scanned census', standard: 'S-34', hint: 'keep sources under the .stynxrc.json boundary roots as regular files' });
  const counts = { expected, observed, evaluated: observed };
  return findings.length > 0 || report.status === 'FAIL'
    ? { status: 'FAIL', ...counts, findings: findings.length > 0 ? findings : [{ locator: `${STYNXRC}:1`, message: 'verify-stynx-boundary reported FAIL without a finding', standard: 'S-34', hint: 'the tool exited abnormally; re-run once, then put the output under ## Notes' }] }
    : { status: 'PASS', ...counts, findings: [] };
}

export const boundary: NodeAdapter = {
  id: 'boundary',
  contract: 1,
  configFiles: () => [STYNXRC],
  // B.17 Inputs: every workspace package.json, .stynxrc.json, every *.ts under the roots (the roots are config; all *.ts is the superset).
  inputs: (ctx) => ctx.listing.entries.map((e) => e.path).filter((p) => p === 'package.json' || p.endsWith('/package.json') || p.endsWith('.ts') || p === STYNXRC),
  run,
};
