// 08 B.7 `sql-lint` as amended by D-085: ONE `stynx-migration-lint` invocation over every root present
// (`database/ddl`, `database/migrations`, `domain/*/db`) with `--format=json`, the context flags, a
// scratch `--base-dir` holding the base blobs and the applied-migration `--manifest`; one observation
// per SQL file across the roots; issue paths re-rooted by the root passed (disambiguated by `files[]`).
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { show } from '../git/git.js';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { crashed, firstLine, type Finding, jsonOf, runTool, toolingMissing, unknown } from './tool-local.js';

export const MIGRATION_LINT_INSTALL = 'pnpm add -w -D @stynx-nyx/migration-linter@3.0.0 && pnpm install';
/** 09 §1.1 `database/seed/modules.txt`: the D-023 root manifest LINT013 reads (`<sha256>  <path>`). */
const PARSER: string = 'pg-query-emscripten'; // untyped package; imported by name
export const APPLIED_MANIFEST = 'database/seed/modules.txt';

/** The roots in 08 B.7's order, as present at the candidate; `domain/*\/db` sorted by module. */
export function rootsOf(paths: readonly string[]): string[] {
  const has = (prefix: string) => paths.some((p) => p.startsWith(`${prefix}/`));
  const modules = [...new Set(paths.map((p) => /^domain\/([^/]+)\/db\//.exec(p)?.[1]).filter((m): m is string => m !== undefined))].sort();
  return [...['database/ddl', 'database/migrations'].filter(has), ...modules.map((m) => `domain/${m}/db`)];
}

interface LintJson {
  files: string[];
  issues: { code: string; file: string; message: string; line: number; suggestion?: string }[];
  parserIssues: { file: string; message: string }[];
}

const isLintJson = (j: unknown): j is LintJson => {
  const o = j as Partial<LintJson> | null;
  return !!o && Array.isArray(o.files) && Array.isArray(o.issues) && Array.isArray(o.parserIssues)
    && o.files.every((f) => typeof f === 'string')
    && o.issues.every((i) => i && typeof i.code === 'string' && typeof i.file === 'string' && typeof i.message === 'string' && typeof i.line === 'number')
    && o.parserIssues.every((i) => i && typeof i.file === 'string' && typeof i.message === 'string');
};

/**
 * D-085 b3 (a): `issues[].file` and `parserIssues[].file` are relative to their target root; DEVAI
 * prefixes the root it passed whose `<root>/<file>` is in `files[]`. A path already in `files[]` or
 * already under a root (LINT013's manifest entries are cwd-relative) is kept.
 */
export function reroot(file: string, roots: readonly string[], files: ReadonlySet<string>): string {
  if (files.has(file)) return file;
  const hit = roots.find((r) => files.has(`${r}/${file}`));
  if (hit) return `${hit}/${file}`;
  return file;
}

async function run(ctx: RunContext): Promise<NodeOutcome> {
  const paths = ctx.listing.entries.map((e) => e.path);
  const roots = rootsOf(paths);
  const population = paths.filter((p) => p.endsWith('.sql') && roots.some((r) => p.startsWith(`${r}/`)));
  const expected = population.length;
  const zero = { expected, observed: 0, evaluated: 0 };
  if (roots.length === 0) return { status: 'PASS', expected: 0, observed: 0, evaluated: 0, findings: [] }; // no root: nothing to observe (the runner rewrites it, C.1 step 9)

  // B.7: the node loads the parser itself first (DEVAI's own pg-query-emscripten 5.1.0, 07 §2), as the linter does (`parser.js:17-21`).
  try {
    const PgQuery = ((await import(PARSER)) as { default: new () => Promise<unknown> }).default;
    await new PgQuery();
  } catch (e) {
    return unknown('parser-unavailable', [{ locator: 'package.json:1', message: `pg-query-emscripten could not be loaded: ${(e as Error).message.split('\n')[0]}`, standard: 'S-24', hint: 'the SQL parser did not load: pnpm install --force' }], zero);
  }

  // Scratch base dir: the population's blobs at the base (the packet's, else HEAD, A.3), at cwd-relative paths.
  const base = ctx.base ?? ctx.head;
  const scratch = mkdtempSync(resolve(tmpdir(), 'devai-sql-lint-base-'));
  try {
    for (const p of population) {
      const blob = await show(ctx.root, base, p);
      if (blob === null) continue; // absent at base: a new file
      mkdirSync(dirname(resolve(scratch, p)), { recursive: true });
      writeFileSync(resolve(scratch, p), blob);
    }
    const manifest = paths.includes(APPLIED_MANIFEST) ? ['--manifest', APPLIED_MANIFEST] : [];
    const args = [...roots, '--format=json', ...(ctx.config.lgpd ? ['--lgpd'] : []), '--base-dir', scratch, ...manifest];
    const r = await runTool(ctx.root, 'stynx-migration-lint', args);
    if (r.kind === 'missing') return unknown('tooling-missing', [toolingMissing('stynx-migration-lint', MIGRATION_LINT_INSTALL, 'S-24')], zero);
    if (r.timedOut || r.overflow || r.code === null || ![0, 1, 2].includes(r.code)) return unknown('runner-crashed', [crashed('stynx-migration-lint', r, 'S-24')], zero);
    const json = jsonOf(r);
    if (!isLintJson(json)) {
      if (r.code === 2 && r.stdout.toString('utf8').trim() === '') {
        // D-085: input errors print one stderr line, nothing on stdout.
        const line = firstLine(r.stderr);
        const reason = /does not exist|not a directory/.test(line) ? 'lint-config-failed' : 'io';
        return unknown(reason, [{ locator: manifest.length > 0 && line.includes('--manifest') ? `${APPLIED_MANIFEST}:1` : 'package.json:1', message: line, standard: 'S-24', hint: reason === 'io' ? 'make the path readable (permissions, broken or escaping symlink), then re-run' : 'the config at the locator did not load; fix it in a standards packet' }], zero);
      }
      return unknown('runner-crashed', [crashed('stynx-migration-lint', r, 'S-24')], zero);
    }
    const files = new Set(json.files);
    const observed = json.files.length;
    const parserFiles = new Set(json.parserIssues.map((i) => reroot(i.file, roots, files)));
    const evaluated = observed - [...parserFiles].filter((f) => files.has(f)).length;
    const counts = { expected, observed, evaluated: Math.max(0, evaluated) };
    const findings: Finding[] = [
      ...json.issues.map((i) => ({
        locator: `${reroot(i.file, roots, files)}:${i.line}`,
        message: `${i.code} ${i.message}`,
        standard: 'S-24',
        hint: (i.suggestion?.split('\n')[0] ?? 'see the migration-linter rule').slice(0, 160) || 'see the migration-linter rule',
      })),
      ...json.parserIssues.map((i) => ({ locator: `${reroot(i.file, roots, files)}:1`, message: `parser: ${i.message}`, standard: 'S-24', hint: 'fix the SQL syntax' })),
    ];
    // A pg-query-emscripten load failure inside the tool is reported per file (`parser.js:27-30`).
    if (json.parserIssues.length > 0 && json.parserIssues.every((i) => i.message.startsWith('pg-query-emscripten could not be loaded'))) {
      return unknown('parser-unavailable', findings, counts);
    }
    // 08 §0: observed < expected names the missing units.
    for (const p of population) if (!files.has(p)) findings.push({ locator: `${p}:1`, message: 'not linted by stynx-migration-lint', standard: 'S-24', hint: 'keep migration files as regular *.sql files under their root' });
    return findings.length > 0 ? { status: 'FAIL', ...counts, findings } : { status: 'PASS', ...counts, findings: [] };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

export const sqlLint: NodeAdapter = {
  id: 'sql-lint',
  contract: 1,
  configFiles: () => ['devai.json', APPLIED_MANIFEST],
  // B.7 Inputs: the migration population and every changed *.sql (base blobs are keyed by the packet base in the C.4 key).
  inputs: (ctx) => {
    const changed = new Set(ctx.inventory?.changed ?? []);
    return ctx.listing.entries.map((e) => e.path).filter((p) => /^(database\/ddl|database\/migrations|domain\/[^/]+\/db)\//.test(p) || (p.endsWith('.sql') && changed.has(p)));
  },
  run,
};
