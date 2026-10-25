// 08 B.18 `deadcode`: knip 6.35.1, depcheck 1.4.7 and madge 8.0.0, all three required (S-42), each
// pointed at every workspace package, so an empty issue list is an observation of that package.
// One observation = one package × tool; verdicts come from parsed JSON, never from exit codes.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { globMatches } from './inventory.js';
import { crashed, type Finding, jsonOf, type Reason, runTool, toolingMissing } from './tool-local.js';

export const KNIP_CONFIG = 'tools/knip.config.ts';
const TOOLS = [
  { bin: 'knip', install: 'pnpm add -w -D knip@6.35.1 && pnpm install' },
  { bin: 'depcheck', install: 'pnpm add -w -D depcheck@1.4.7 && pnpm install' },
  { bin: 'madge', install: 'pnpm add -w -D madge@8.0.0 && pnpm install' },
] as const;

/** Workspace packages: folders with a `package.json` the `pnpm-workspace.yaml` globs match (04 §1; B.1's matcher). */
export function workspacePackages(ctx: RunContext): string[] {
  const paths = ctx.listing.entries.map((e) => e.path);
  let globs: string[] = [];
  try {
    const doc = parseYaml(readFileSync(resolve(ctx.root, 'pnpm-workspace.yaml'), 'utf8')) as { packages?: unknown } | null;
    globs = Array.isArray(doc?.packages) ? doc.packages.filter((g): g is string => typeof g === 'string') : [];
  } catch {
    globs = []; // inventory reports an unparseable or missing workspace file (B.1)
  }
  const pos = globs.filter((g) => !g.startsWith('!'));
  const neg = globs.filter((g) => g.startsWith('!')).map((g) => g.slice(1));
  return paths.filter((p) => p.endsWith('/package.json')).map((p) => p.slice(0, -'/package.json'.length))
    .filter((d) => pos.some((g) => globMatches(g, d)) && !neg.some((g) => globMatches(g, d))).sort();
}

interface KnipIssue { file: string; [k: string]: unknown }
type Named = { name: string; line?: number };

/** knip `--reporter json` → findings (`issues[]`, one entry per file, typed arrays of names). */
function knipFindings(json: unknown): Finding[] | null {
  const issues = (json as { issues?: unknown } | null)?.issues;
  if (!Array.isArray(issues)) return null;
  const out: Finding[] = [];
  const hint = 'remove it or add a knip entry (knip)';
  for (const i of issues as KnipIssue[]) {
    if (typeof i?.file !== 'string') return null;
    const list = (k: string): Named[] => (Array.isArray(i[k]) ? (i[k] as Named[]).filter((n) => typeof n?.name === 'string') : []);
    for (const f of list('files')) out.push({ locator: `${f.name}:1`, message: 'unused file', standard: 'S-42', hint });
    for (const k of ['exports', 'types', 'enumMembers', 'namespaceMembers', 'duplicates']) {
      const label = { exports: 'unused export', types: 'unused type', enumMembers: 'unused enum member', namespaceMembers: 'unused namespace member', duplicates: 'duplicate export' }[k]!;
      for (const n of list(k)) out.push({ locator: `${i.file}:${n.line ?? 1}`, message: `${label} ${n.name}`, standard: 'S-42', hint });
    }
    for (const k of ['dependencies', 'devDependencies', 'optionalPeerDependencies']) for (const n of list(k)) out.push({ locator: `${i.file}:1`, message: `unused dependency ${n.name}`, standard: 'S-42', hint: 'remove it (knip)' });
    for (const n of list('unlisted')) out.push({ locator: `${i.file}:${n.line ?? 1}`, message: `missing dependency ${n.name}`, standard: 'S-42', hint: 'add it to the package.json (knip)' });
    for (const n of [...list('unresolved'), ...list('binaries')]) out.push({ locator: `${i.file}:${n.line ?? 1}`, message: `unresolved ${n.name}`, standard: 'S-42', hint: 'fix the import or add the binary (knip)' });
  }
  return out;
}

/** depcheck `--json` → findings (`dependencies`, `devDependencies`, `missing`). */
function depcheckFindings(json: unknown, dir: string): Finding[] | null {
  const j = json as { dependencies?: unknown; devDependencies?: unknown; missing?: unknown } | null;
  if (!j || !Array.isArray(j.dependencies) || !Array.isArray(j.devDependencies) || typeof j.missing !== 'object' || j.missing === null) return null;
  const manifest = `${dir}/package.json:1`;
  return [
    ...[...j.dependencies, ...j.devDependencies].map((n) => ({ locator: manifest, message: `unused dependency ${String(n)}`, standard: 'S-42', hint: 'remove it (depcheck)' })),
    ...Object.keys(j.missing).map((n) => ({ locator: manifest, message: `missing dependency ${n}`, standard: 'S-42', hint: 'add it to the package.json (depcheck)' })),
  ];
}

/** madge `--circular --json` → one finding per cycle; paths are relative to the scanned folder. */
function madgeFindings(json: unknown, src: string): Finding[] | null {
  if (!Array.isArray(json) || !json.every((c) => Array.isArray(c) && c.every((f) => typeof f === 'string'))) return null;
  return (json as string[][]).filter((c) => c.length > 0).map((c) => {
    const files = c.map((f) => `${src}/${f}`);
    return { locator: `${files[0]}:1`, message: `cycle: ${[...files, files[0]].join(' → ')}`, standard: 'S-42', hint: 'break the cycle (madge)' };
  });
}

async function run(ctx: RunContext): Promise<NodeOutcome> {
  const dirs = workspacePackages(ctx);
  const paths = ctx.listing.entries.map((e) => e.path);
  const expected = dirs.length * TOOLS.length;
  let observed = 0;
  const findings: Finding[] = [];
  const unknowns: { reason: Reason; finding: Finding }[] = [];
  for (const tool of TOOLS) {
    for (const dir of dirs) {
      const src = paths.some((p) => p.startsWith(`${dir}/src/`)) ? `${dir}/src` : dir;
      const args = {
        knip: ['--reporter', 'json', '--no-config-hints', '--config', KNIP_CONFIG, '--workspace', dir],
        depcheck: [dir, '--json', '--ignore-patterns=**/*.spec.ts'],
        madge: ['--circular', '--json', '--extensions', 'ts,mjs', '--', src],
      }[tool.bin];
      const r = await runTool(ctx.root, tool.bin, args);
      if (r.kind === 'missing') {
        unknowns.push({ reason: 'tooling-missing', finding: toolingMissing(tool.bin, tool.install, 'S-42') });
        break; // one line per missing binary; its other pairs are unobserved too
      }
      const json = r.timedOut || r.overflow ? null : jsonOf(r);
      const parsed = json === null ? null : tool.bin === 'knip' ? knipFindings(json) : tool.bin === 'depcheck' ? depcheckFindings(json, dir) : madgeFindings(json, src);
      if (parsed === null) {
        unknowns.push({ reason: 'runner-crashed', finding: crashed(`${tool.bin} (${dir})`, r, 'S-42', `${dir}/package.json:1`) });
        continue;
      }
      observed++;
      findings.push(...parsed);
    }
  }
  const counts = { expected, observed, evaluated: observed };
  if (findings.length > 0) return { status: 'FAIL', ...counts, findings: [...findings, ...unknowns.map((u) => u.finding)] };
  if (unknowns.length > 0) return { status: 'UNKNOWN', reason: unknowns[0]!.reason, ...counts, findings: unknowns.map((u) => u.finding) };
  return { status: 'PASS', ...counts, findings: [] };
}

export const deadcode: NodeAdapter = {
  id: 'deadcode',
  contract: 1,
  configFiles: () => [KNIP_CONFIG, 'pnpm-workspace.yaml'],
  // B.18 Inputs: the workspace (every manifest, every source).
  inputs: (ctx) => ctx.listing.entries.map((e) => e.path).filter((p) => !p.startsWith('.devai/')),
  run,
};
