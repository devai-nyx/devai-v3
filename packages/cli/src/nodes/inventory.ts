// 08 B.1 `inventory`: the package graph from the workspace globs, the engines/Corepack check, the
// `"type": "module"` and effective-tsconfig checks, `toolchainDigest`, the base diff and every
// population Part B names. Runs first and alone (C.1 step 5); never cached, never SKIPPED.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ignore from 'ignore';
import { parse as parseYaml } from 'yaml';
import { sha256 } from '../candidate/digest.js';
import { frame } from '../cache/key.js';
import { diffNameStatus } from '../git/git.js';
import { spawn } from '../proc/spawn.js';
import { type NodeId, NODE_IDS } from '../runner/edges.js';
import type { InventoryData, NodeOutcome, Population, RunContext } from '../runner/run.js';
import { mountCensus } from '../ts/mounts.js';
import { affectedClosure } from '../ts/program.js';

type Finding = NodeOutcome['findings'][number];
type Reason = NonNullable<NodeOutcome['reason']>;

// ---- semver ranges (engines.node): comparator sets joined by `||` -------------------------------

type V = [number, number, number];
const cmpV = (a: V, b: V): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const parseV = (s: string): { v: V; parts: number } | null => {
  const m = /^v?(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:[-+].*)?$/.exec(s.trim());
  if (!m) return null;
  const nums = [m[1], m[2], m[3]].filter((p) => p !== undefined && !/[xX*]/.test(p)).map(Number);
  return { v: [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0], parts: nums.length };
};
const bump = (v: V, parts: number): V => (parts <= 1 ? [v[0] + 1, 0, 0] : parts === 2 ? [v[0], v[1] + 1, 0] : [v[0], v[1], v[2] + 1]);

function comparatorHolds(c: string, host: V): boolean {
  const m = /^(>=|<=|>|<|=|\^|~)?\s*(.+)$/.exec(c);
  if (!m) return false;
  const op = m[1] ?? '';
  const p = parseV(m[2]!);
  if (!p) return false;
  const d = cmpV(host, p.v);
  switch (op) {
    case '>=': return d >= 0;
    case '>': return p.parts < 3 ? cmpV(host, bump(p.v, p.parts)) >= 0 : d > 0;
    case '<=': return p.parts < 3 ? cmpV(host, bump(p.v, p.parts)) < 0 : d <= 0;
    case '<': return d < 0;
    case '^': return d >= 0 && cmpV(host, p.v[0] > 0 || p.parts === 1 ? [p.v[0] + 1, 0, 0] : p.v[1] > 0 || p.parts === 2 ? [0, p.v[1] + 1, 0] : [0, 0, p.v[2] + 1]) < 0;
    case '~': return d >= 0 && cmpV(host, p.parts === 1 ? [p.v[0] + 1, 0, 0] : [p.v[0], p.v[1] + 1, 0]) < 0;
    default: return p.parts === 3 ? d === 0 : d >= 0 && cmpV(host, bump(p.v, p.parts)) < 0;
  }
}

/** `version` satisfies the npm-style `range` (the subset `engines` fields use). */
export function satisfies(version: string, range: string): boolean {
  const host = parseV(version);
  if (!host) return false;
  return range.split('||').some((set) => {
    const comps = set.trim().replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1').split(/\s+/).filter(Boolean);
    return comps.length === 0 || comps.every((c) => c === '*' || comparatorHolds(c, host.v));
  });
}

// ---- workspace globs ------------------------------------------------------------------------------

/** One pnpm workspace glob against a package folder, with `ignore` (07 §3): anchored, one level per `*`. */
export function globMatches(glob: string, dir: string): boolean {
  const g = glob.replace(/^\.\//, '').replace(/\/$/, '');
  const ig = ignore().add(g.startsWith('/') ? g : `/${g}`);
  if (!ig.ignores(dir)) return false;
  if (g.includes('**')) return true;
  const parts = dir.split('/');
  for (let i = 1; i < parts.length; i++) if (ig.ignores(parts.slice(0, i).join('/'))) return false;
  return true;
}

export interface Manifest {
  dir: string;
  path: string;
  json: Record<string, unknown> | null;
}

// ---- populations (Part B row "Population") -------------------------------------------------------

const ext = (p: string, ...e: string[]) => e.some((x) => p.endsWith(x));
const TEST_TIER = /\.(acceptance|integration|db|e2e)\.spec\.ts$/;

interface PopulationFacts {
  paths: readonly string[];
  changed: readonly string[];
  /** Changed and present at the candidate. */
  changedPresent: readonly string[];
  packageDirs: readonly string[];
  manifests: readonly Manifest[];
  locales: number;
  commitsSinceBase: number;
  packet: boolean;
}

const packageOf = (dirs: readonly string[], path: string): string =>
  [...dirs].filter((d) => d !== '.' && path.startsWith(`${d}/`)).sort((a, b) => b.length - a.length)[0] ?? '.';

/**
 * Every population Part B names, with its predicate string and count. Counts are path-based; the
 * TypeScript-backed ones (mounted routes, `tsc -b` project closure, test census per tier) arrive with
 * their nodes (R6 W2/W3) and are approximated here by the declared files they range over.
 */
export function populations(f: PopulationFacts): Record<NodeId, Population> {
  const n = (predicate: string, count: number, skippable = true): Population => ({ predicate, count, skippable });
  const always = (predicate = 'always applies', count = 1) => n(predicate, count, false);
  const cp = f.changedPresent;
  const ts = (p: string) => ext(p, '.ts', '.mts', '.cts') || /(^|\/)tsconfig[^/]*\.json$/.test(p);
  const affected = new Set(f.changed.filter(ts).map((p) => packageOf(f.packageDirs, p)));
  const controllers = f.paths.filter((p) => /^(domain\/[^/]+\/api\/src|apps\/[^/]+\/src)\/.*\.controller\.ts$/.test(p));
  const angular = f.manifests.filter((m) => {
    const deps = { ...(m.json?.['dependencies'] as object | undefined), ...(m.json?.['devDependencies'] as object | undefined) };
    return '@angular/core' in deps;
  }).length;
  const unitFiles = f.paths.filter((p) => p.endsWith('.spec.ts') && !TEST_TIER.test(p) && affected.has(packageOf(f.packageDirs, p)));
  const surface = f.changed.filter((p) => /\.controller\.ts$|\/dto\/|(^|\/)index\.ts$|^apps\/[^/]+\/src\/.*\.module\.ts$/.test(p));
  const testPath = (p: string) => /^(test\/|apps\/[^/]+\/test\/|domain\/[^/]+\/(api|web)\/test\/)/.test(p);
  return {
    inventory: always('always applies', f.manifests.filter((m) => m.dir !== '.').length),
    format: n('no changed *.{ts,mjs,json,md}', cp.filter((p) => ext(p, '.ts', '.mjs', '.json', '.md')).length),
    lint: n('no changed *.ts, *.mts or *.html', cp.filter((p) => ext(p, '.ts', '.mts', '.html')).length),
    'lint-tests': n('no changed *.spec.ts', cp.filter((p) => p.endsWith('.spec.ts')).length),
    typecheck: n('no affected project', affected.size),
    layout: always('always applies', f.paths.length),
    'sql-lint': n('no changed *.sql', cp.filter((p) => p.endsWith('.sql')).length),
    'spec-lint': n('no changed specs/** or product/**', f.changed.filter((p) => p.startsWith('specs/') || p.startsWith('product/')).length),
    'route-contract': n('no mounted routes in domain/<m>', controllers.filter((p) => p.startsWith('domain/')).length),
    'sql-typed': n('no *.repository.ts changed', cp.filter((p) => p.endsWith('.repository.ts')).length),
    unit: n('no unit test files in affected projects', unitFiles.length),
    'test-integrity': n('no changed test/**', f.changed.filter(testPath).length),
    i18n: n('no opted-in locale beyond en-US and no Angular app', f.locales - 1 + angular),
    actionlint: n('no changed .github/**', cp.filter((p) => p.startsWith('.github/') && ext(p, '.yml', '.yaml')).length),
    commitlint: n('no commits between base and HEAD', f.commitsSinceBase),
    generated: n('no generation-manifest.json under domain/', f.paths.filter((p) => /^domain\/[^/]+\/generation-manifest\.json$/.test(p)).length),
    boundary: always(),
    deadcode: always('always applies', f.manifests.filter((m) => m.dir !== '.').length),
    openapi: n('no app binding changed and no public-API surface changed', surface.length),
    'db-apply': n('no database/', f.paths.filter((p) => p.startsWith('database/')).length),
    'spec-tests': n('no acceptance file for <spec id>', f.paths.filter((p) => p.endsWith('.acceptance.spec.ts')).length),
    integration: n('no test/integration or test/db files affected', f.paths.filter((p) => /(^|\/)test\/integration\/.*\.integration\.spec\.ts$|(^|\/)test\/db\/.*\.db\.spec\.ts$/.test(p)).length),
    e2e: n('no test/e2e files', f.paths.filter((p) => /(^|\/)test\/e2e\/.*(\.e2e\.spec\.ts|\.playwright\.ts)$/.test(p)).length),
    'permissions-pattern': n('no mounted routes', controllers.length),
    'protected-paths': always(),
    'packet-scope': always('always applies under --packet', f.packet ? 1 : 0),
    review: always('always applies under --packet --full', f.packet ? 1 : 0),
    accept: always(),
  };
}

// ---- the node ------------------------------------------------------------------------------------

const env = { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' }; // Part D: no interactive prompt

async function version(root: string, bin: string): Promise<string | null> {
  const r = await spawn({ argv: [bin, '--version'], cwd: root, env, timeoutMs: 30_000, maxBytes: 1024 * 1024 });
  if (r.kind === 'missing' || r.code !== 0) return null;
  return r.stdout.toString('utf8').trim().replace(/^v/, '');
}

const readText = (root: string, path: string): string | null => {
  try {
    return readFileSync(resolve(root, path), 'utf8');
  } catch {
    return null;
  }
};

/** B.1 Findings, effective-options rows (S-31, S-32; 07 §1). */
function tsconfigFindings(path: string, options: Record<string, unknown>, angular: boolean): Finding[] {
  const out: Finding[] = [];
  const lc = (k: string) => String(options[k] ?? '(unset)').toLowerCase();
  const want: [string, string][] = angular ? [['module', 'es2022'], ['moduleResolution', 'bundler']] : [['module', 'nodenext'], ['moduleResolution', 'nodenext']];
  const extendHint = angular ? 'extend @stynx-nyx/tsconfig/angular18.json' : 'extend @stynx-nyx/tsconfig/node24.json';
  for (const [k, v] of want) if (lc(k) !== v) out.push({ locator: `${path}:1`, message: `effective ${k} ${lc(k)} ≠ ${v}`, standard: 'S-31', hint: extendHint });
  if (lc('target') !== 'es2022') out.push({ locator: `${path}:1`, message: `effective target ${lc('target')} ≠ es2022`, standard: 'S-32', hint: 'restore the published chain' });
  for (const k of ['strict', 'noUncheckedIndexedAccess', 'exactOptionalPropertyTypes', 'isolatedModules', 'forceConsistentCasingInFileNames']) {
    if (options[k] !== true) out.push({ locator: `${path}:1`, message: `effective ${k} is ${options[k] === undefined ? 'unset' : String(options[k])}`, standard: 'S-32', hint: 'restore the published chain' });
  }
  return out;
}

export async function runInventory(ctx: RunContext): Promise<{ outcome: NodeOutcome; data: InventoryData }> {
  const { root, listing } = ctx;
  const paths = listing.entries.map((e) => e.path);
  const present = new Set(paths);
  const findings: Finding[] = [];
  const unknown: { reason: Reason; finding: Finding }[] = [];

  // Workspace globs → package folders (real packages only, 04 §1).
  const wsText = present.has('pnpm-workspace.yaml') ? readText(root, 'pnpm-workspace.yaml') : null;
  let globs: string[] = [];
  if (wsText !== null) {
    try {
      const doc = parseYaml(wsText) as { packages?: unknown } | null;
      globs = Array.isArray(doc?.packages) ? doc.packages.filter((g): g is string => typeof g === 'string') : [];
    } catch (e) {
      findings.push({ locator: 'pnpm-workspace.yaml:1', message: `unparseable: ${(e as Error).message.split('\n')[0]}`, standard: 'S-06', hint: 'fix the YAML' });
    }
  }
  const candidates = paths.filter((p) => p.endsWith('/package.json')).map((p) => p.slice(0, -'/package.json'.length));
  const positive = globs.filter((g) => !g.startsWith('!'));
  const negative = globs.filter((g) => g.startsWith('!')).map((g) => g.slice(1));
  const packageDirs = candidates.filter((d) => positive.some((g) => globMatches(g, d)) && !negative.some((g) => globMatches(g, d))).sort();
  const wsLines = (wsText ?? '').split('\n');
  for (const g of positive) {
    if (!candidates.some((d) => globMatches(g, d))) {
      const line = wsLines.findIndex((l) => l.includes(g)) + 1 || 1;
      findings.push({ locator: `pnpm-workspace.yaml:${line}`, message: `glob ${g} matches no package`, standard: 'S-06', hint: 'remove it' });
    }
  }
  // D-084 item 7: a workspace whose globs match no package is FAIL, never `observed 0`. With no glob at
  // all there is no `<g>` to name; the finding says so (open: the law gives no form for it).
  if (packageDirs.length === 0 && positive.length === 0 && !findings.some((f) => f.locator === 'pnpm-workspace.yaml:1')) {
    findings.push({ locator: 'pnpm-workspace.yaml:1', message: 'no workspace glob matches a package', standard: 'S-06', hint: 'name the real packages in pnpm-workspace.yaml (04 §1)' });
  }

  // Manifests: every package the globs name (the observations) and the root manifest, which is read and
  // checked for engines, `"type"` and its tsconfig but is not an observation (D-084 item 7).
  const manifests: Manifest[] = [];
  let observed = 0;
  let evaluated = 0;
  const expected = packageDirs.length;
  const tscBin = resolve(root, 'node_modules/.bin/tsc'); // the product's installed binary (D-057)
  for (const dir of ['.', ...packageDirs]) {
    const path = dir === '.' ? 'package.json' : `${dir}/package.json`;
    const isRoot = dir === '.';
    const text = present.has(path) ? readText(root, path) : null;
    if (text === null) {
      findings.push({ locator: `${path}:1`, message: 'manifest not readable', standard: 'S-06', hint: 'restore the package.json' });
      manifests.push({ dir, path, json: null });
      continue;
    }
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch (e) {
      findings.push({ locator: `${path}:1`, message: `manifest not parseable: ${(e as Error).message}`, standard: 'S-06', hint: 'fix the JSON' });
      manifests.push({ dir, path, json: null });
      continue;
    }
    if (!isRoot) observed++;
    manifests.push({ dir, path, json });
    if (json['type'] !== 'module') findings.push({ locator: `${path}:1`, message: '"type" is not "module"', standard: 'S-31', hint: 'set "type": "module"' });
    const tsconfig = dir === '.' ? 'tsconfig.json' : `${dir}/tsconfig.json`;
    if (present.has(tsconfig)) {
      const r = await spawn({ argv: [tscBin, '--showConfig', '-p', tsconfig], cwd: root, env, timeoutMs: 60_000 });
      if (r.kind === 'missing') {
        unknown.push({ reason: 'tooling-missing', finding: { locator: `${tsconfig}:1`, message: 'tsc not resolvable from node_modules/.bin', standard: 'S-31', hint: 'install with pnpm install' } });
        continue;
      }
      let options: Record<string, unknown> | null = null;
      try {
        options = (JSON.parse(r.stdout.toString('utf8')) as { compilerOptions?: Record<string, unknown> }).compilerOptions ?? {};
      } catch {
        options = null;
      }
      if (r.code !== 0 || options === null) {
        unknown.push({ reason: 'runner-crashed', finding: { locator: `${tsconfig}:1`, message: `tsc --showConfig exited ${r.code}`, standard: 'S-31', hint: 'the tool exited abnormally; re-run once, then put the output under ## Notes' } });
        continue;
      }
      const deps = { ...(json['dependencies'] as object | undefined), ...(json['devDependencies'] as object | undefined) };
      findings.push(...tsconfigFindings(tsconfig, options, '@angular/core' in deps));
    }
    if (!isRoot) evaluated++;
  }

  // Engines, packageManager, Corepack (UNKNOWN engines-mismatch; no pin file, D-057).
  const rootJson = manifests[0]?.json ?? null;
  const [nodeV, pnpmV, corepackV] = await Promise.all([version(root, 'node'), version(root, 'pnpm'), version(root, 'corepack')]);
  const engines = (rootJson?.['engines'] as { node?: unknown } | undefined)?.node;
  const pm = typeof rootJson?.['packageManager'] === 'string' ? (rootJson['packageManager'] as string) : null;
  const pmVersion = pm?.match(/^pnpm@(\d+\.\d+\.\d+)/)?.[1] ?? null;
  const enginesHint = `corepack use ${pm ?? 'pnpm@<version>'}; Node must satisfy engines (>=24 <25)`;
  const mismatch = (message: string) => unknown.push({ reason: 'engines-mismatch', finding: { locator: 'package.json:1', message, standard: 'S-07', hint: enginesHint } });
  if (typeof engines !== 'string') mismatch('engines.node is not declared');
  else if (nodeV === null || !satisfies(nodeV, engines)) mismatch(`host node ${nodeV ?? 'absent'} ∉ engines.node ${engines}`);
  if (pmVersion === null) mismatch('packageManager does not name pnpm@<x.y.z>');
  else if (pnpmV !== pmVersion) mismatch(`host pnpm ${pnpmV ?? 'absent'} ≠ packageManager ${pm}`);
  if (corepackV === null) mismatch('corepack is absent');

  // Mounted-route census (D-058, D-084 item 9): app root modules through static imports/controllers.
  const packageNames = new Map<string, string>();
  for (const m of manifests) if (m.dir !== '.' && typeof m.json?.['name'] === 'string') packageNames.set(m.json['name'] as string, m.dir);
  const mounts = mountCensus(root, paths, packageNames);
  for (const u of mounts.unresolved) unknown.push({ reason: 'mount-unresolved', finding: { locator: u.locator, message: u.message, standard: 'S-06', hint: "make the module's imports/controllers arrays static at the locator" } });

  // toolchainDigest = sha256(node version ‖ pnpm version ‖ pnpm-lock.yaml), framed as C.4's components.
  let lock: Buffer = Buffer.alloc(0);
  try {
    if (present.has('pnpm-lock.yaml')) lock = readFileSync(resolve(root, 'pnpm-lock.yaml'));
  } catch {
    lock = Buffer.alloc(0);
  }
  const toolchainDigest = sha256(Buffer.concat([frame(nodeV ?? ''), frame(pnpmV ?? ''), frame(lock)]));

  // Base diff plus working-tree changes (adds, deletes, untracked; --no-renames).
  const changedSet = new Set<string>([
    ...(await diffNameStatus(root, { from: 'HEAD' })).map((d) => d.path),
    ...listing.untracked,
    ...(ctx.base ? (await diffNameStatus(root, { from: ctx.base, to: 'HEAD' })).map((d) => d.path) : []),
  ]);
  const changed = [...changedSet].sort();
  const commitsSinceBase = 0; // `git log <base>..HEAD` counts arrive with `--packet` (R6 W4)
  // The affected `tsc -b` closure (B.1 side product; B.5 builds it): package tsconfigs as projects.
  const projectRoots = packageDirs.map((d) => `${d}/tsconfig.json`).filter((t) => present.has(t));
  if (present.has('tsconfig.json')) projectRoots.unshift('tsconfig.json');
  const projects = affectedClosure(root, projectRoots, changed).map((p) => p.tsconfig);
  const data: InventoryData = {
    toolchainDigest,
    changed,
    mounts,
    projects,
    packageDirs,
    populations: populations({
      paths, changed, changedPresent: changed.filter((p) => present.has(p)), packageDirs: ['.', ...packageDirs], manifests,
      locales: ctx.config.locales.length, commitsSinceBase, packet: ctx.base !== null,
    }),
  };
  const details = {
    node: 'inventory' as const,
    toolchainDigest,
    populations: Object.fromEntries(NODE_IDS.map((id) => [id, { predicate: data.populations[id].predicate, count: data.populations[id].count }])) as Record<NodeId, { predicate: string; count: number }>,
  };
  const counts = { expected, observed, evaluated };
  const all = [...findings, ...unknown.map((u) => u.finding)];
  let outcome: NodeOutcome;
  if (findings.length > 0 || observed < expected) outcome = { status: 'FAIL', ...counts, findings: all, details };
  else if (unknown.length > 0) outcome = { status: 'UNKNOWN', reason: unknown[0]!.reason, ...counts, findings: all, details };
  else outcome = { status: 'PASS', ...counts, findings: [], details };
  return { outcome, data };
}

