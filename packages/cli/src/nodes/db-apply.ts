// 08 B.20 `db-apply` (R6 W3): preflight (`sh`, `psql --version`, docker per 07 §4), resolve the declared
// server (02 §6), create the scratch database `devai_<digest12>` and its descriptor, run the product's
// `sh -x database/apply.sh` with the scratch connection in `PG*` variables and `PSQL="psql -v
// ON_ERROR_STOP=1"`, read the xtrace as the file-run census, run `database/checks.sql`, then `stynx
// verify-rls-negative`, then read the C.4 `schemaDigest`. In the edit loop the database is kept and its
// descriptor records it for reuse; `--prune` drops it (A.3).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { connect, pgEnv, provide, type Server } from '../db/provide.js';
import { schemaDigest } from '../db/schema-digest.js';
import {
  createScratch, databaseOf, descriptor, exists, inputDigestOf, newNonce, readDescriptor, scratchOf, writeDescriptor,
} from '../db/scratch.js';
import { firstLine, runTool, unknown, type Unknown } from '../proc/tool.js';
import { spawn } from '../proc/spawn.js';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { type Finding, outcome } from '../ts/outcome.js';

const APPLY = 'database/apply.sh';
const CHECKS = 'database/checks.sql';
const MANIFEST = 'database/seed/modules.txt';
/** B.20: `--ddl` takes comma-separated roots, `*` matching one directory. */
const RLS_ROOTS = 'database/ddl,database/migrations,domain/*/db';
const APPLY_TIMEOUT_MS = 600_000;
const HINT_STATEMENT = 'fix the statement';

const isInput = (p: string): boolean =>
  /^database\/(ddl|migrations)\//.test(p) || /^domain\/[^/]+\/db\//.test(p) || p.startsWith('database/seed/') || p === APPLY || p === CHECKS;

/** B.20 Observation: the files the root and seed manifests order, in 09 §1's apply order (step 2 is `stynx migrate`, no file). */
export function expectedFiles(ctx: RunContext): string[] {
  const paths = ctx.listing.entries.map((e) => e.path);
  const inDir = (dir: string) => paths.filter((p) => p.startsWith(`${dir}/`) && !p.slice(dir.length + 1).includes('/') && p.endsWith('.sql')).sort();
  const modules: string[] = [];
  try {
    for (const line of readFileSync(resolve(ctx.root, MANIFEST), 'utf8').split('\n')) {
      const m = /^[0-9a-f]{64} [ *](.+)$/.exec(line.trimEnd());
      if (m) modules.push(m[1]!);
    }
  } catch {
    // no manifest: no module files are ordered
  }
  return [...inDir('database/ddl'), ...modules, ...inDir('database/migrations'), ...inDir('database/seed')];
}

/** The xtrace census: every `psql … -f <file>` the shell ran, in order (09 §1: `$PSQL -f`). */
export function tracedFiles(stderr: string): string[] {
  const out: string[] = [];
  for (const line of stderr.split('\n')) {
    const m = /^\++\s+(?:\S*\/)?psql\s(?:.*\s)?-f\s+'?([^'\s]+)'?/.exec(line);
    if (m) out.push(m[1]!.replace(/^\.\//, ''));
  }
  return out;
}

/** `psql:<file>:<line>: <SEVERITY>:  <message>` (the severity word follows `lc_messages`, D-068). */
export function psqlErrors(stderr: string): { file: string; line: number; message: string }[] {
  const out: { file: string; line: number; message: string }[] = [];
  for (const line of stderr.split('\n')) {
    const m = /^psql:(.+?):(\d+): [^\s:]+:\s+(.*)$/.exec(line);
    if (m) out.push({ file: m[1]!.replace(/^\.\//, ''), line: Number(m[2]), message: m[3]!.trim() });
  }
  return out;
}

const inputs = (ctx: RunContext): string[] => [...ctx.listing.entries.map((e) => e.path).filter(isInput), 'devai.json'].sort();

const zero = { expected: 0, observed: 0, evaluated: 0 };
const fail = (u: Unknown, counts = zero): NodeOutcome => outcome(counts, [], [u]);

async function preflight(ctx: RunContext): Promise<Unknown | null> {
  const sh = await spawn({ argv: ['sh', '-c', ':'], cwd: ctx.root, env: process.env, timeoutMs: 10_000 });
  if (sh.kind === 'missing') return unknown('shell-missing', `${APPLY}:1`, 'sh is not on PATH', '07 §4');
  const psql = await spawn({ argv: ['psql', '--version'], cwd: ctx.root, env: process.env, timeoutMs: 10_000 });
  if (psql.kind === 'missing' || psql.code !== 0) return unknown('psql-missing', `${APPLY}:1`, 'psql is not on PATH', '07 §4');
  if (!existsSync(resolve(ctx.root, APPLY))) return unknown('io', `${APPLY}:1`, `${APPLY} is not readable`, 'S-01');
  return null;
}

/** C.4 Reuse: a stored PASS stands only while its descriptor's database exists and re-reads to the same `schemaDigest`. */
async function reuse(ctx: RunContext, hit: NodeOutcome): Promise<boolean> {
  const d = hit.details;
  if (d?.node !== 'db-apply') return false;
  const desc = readDescriptor(ctx.root, d.database);
  if (!desc || desc.schemaDigest !== d.schemaDigest) return false;
  const provided = await provide(ctx.root, ctx.config, ctx.runtime);
  if (provided.kind !== 'ok') return false;
  const server: Server = { ...provided.server, host: desc.host, port: desc.port };
  if (!(await exists(server, d.database))) return false;
  try {
    const client = await connect(server, d.database);
    try {
      if ((await schemaDigest(client, ctx.config.productPrefix)) !== d.schemaDigest) return false;
    } finally {
      await client.end().catch(() => undefined);
    }
  } catch {
    return false;
  }
  ctx.scratch = scratchOf(server, d.database);
  return true;
}

export const dbApply: NodeAdapter = {
  id: 'db-apply',
  contract: 1,
  configFiles: () => ['devai.json'],
  inputs,
  reuse,
  async run(ctx): Promise<NodeOutcome> {
    const pre = await preflight(ctx);
    if (pre) return fail(pre);
    const provided = await provide(ctx.root, ctx.config, ctx.runtime);
    if (provided.kind === 'unknown') return fail(provided.unknown);
    const server = provided.server;

    const hashes = new Map(ctx.listing.entries.map((e) => [e.path, e.hash]));
    // DEVAI_RUNTIME is an input (B.20) through the resolved mode it selects.
    const named = inputs(ctx).map((path) => ({ path, sha256: hashes.get(path) ?? null }));
    const inputDigest = inputDigestOf(named, ctx.runtime);
    const nonce = newNonce();
    const database = databaseOf(named, ctx.runtime, nonce);
    const created = await createScratch(ctx.root, server, database, inputDigest);
    if (created.kind === 'collision') return fail(unknown('scratch-collision', 'devai.json:1', `${database} exists and no descriptor of this repository names it`, '02 §6'));
    if (created.kind === 'denied') return fail(unknown('postgres-unreachable', 'devai.json:1', `postgres-unreachable (${ctx.runtime}): CREATE DATABASE denied: ${created.message}`, '02 §6'));
    if (created.kind === 'unreachable') return fail(unknown('postgres-unreachable', 'devai.json:1', `postgres-unreachable (${ctx.runtime}): ${created.message}`, '02 §6'));
    const desc = created.kind === 'reused' ? readDescriptor(ctx.root, database)! : descriptor(ctx.root, database, inputDigest, ctx.runtime, nonce, server);
    writeDescriptor(ctx.root, desc); // before applying: a crash leaves a database --prune can still find

    const scratch = scratchOf(server, database);
    const env = { ...process.env, ...pgEnv(server, database), DATABASE_URL: scratch.url, PSQL: 'psql -v ON_ERROR_STOP=1' };
    const expected = expectedFiles(ctx);
    const findings: Finding[] = [];
    const unknowns: Unknown[] = [];

    const applied = await spawn({ argv: ['sh', '-x', APPLY], cwd: ctx.root, env, timeoutMs: APPLY_TIMEOUT_MS });
    if (applied.kind === 'missing') return fail(unknown('shell-missing', `${APPLY}:1`, 'sh is not on PATH', '07 §4'));
    if (applied.timedOut) return fail(unknown('timeout', `${APPLY}:1`, `${APPLY} exceeded its wall time`, 'S-01'), { expected: expected.length, observed: 0, evaluated: 0 });
    const stderr = applied.stderr.toString('utf8');
    const traced = [...new Set(tracedFiles(stderr))];
    const errors = psqlErrors(stderr);
    const failedFiles = new Set(errors.map((e) => e.file));
    for (const e of errors) findings.push({ locator: `${e.file}:${e.line}`, message: `ERROR: ${e.message}`, standard: 'S-02', hint: HINT_STATEMENT });
    const observedSet = new Set(traced.filter((f) => expected.includes(f)));
    const observed = observedSet.size;
    const evaluated = [...observedSet].filter((f) => !failedFiles.has(f)).length;
    // B.20: observed < expected (a manifest file never reached) is FAIL, naming each file.
    for (const f of expected) if (!observedSet.has(f)) findings.push({ locator: `${f}:1`, message: `never applied: ${APPLY} did not run psql -f ${f}`, standard: 'S-01', hint: 'fix the failure above, or apply the file from database/apply.sh in manifest order' });
    if (applied.code !== 0 && errors.length === 0) findings.push({ locator: `${APPLY}:1`, message: `${APPLY} exited ${applied.code ?? applied.signal}: ${firstLine(stderr.split('\n').filter((l) => !l.startsWith('+')).join('\n')) || 'no message'}`, standard: 'S-01', hint: 'fix database/apply.sh (09 §1)' });

    // checks.sql only over a database that applied cleanly (its assertions read the applied schema).
    if (findings.length === 0 && existsSync(resolve(ctx.root, CHECKS))) {
      const checks = await spawn({ argv: ['psql', '-v', 'ON_ERROR_STOP=1', '-f', CHECKS], cwd: ctx.root, env, timeoutMs: APPLY_TIMEOUT_MS });
      if (checks.kind === 'missing') return fail(unknown('psql-missing', `${CHECKS}:1`, 'psql is not on PATH', '07 §4'));
      const out = checks.stderr.toString('utf8');
      for (const e of psqlErrors(out)) findings.push({ locator: `${e.file}:${e.line}`, message: `ERROR: ${e.message}`, standard: 'S-17', hint: 'fix the DDL the assertion names, in the file that creates it' });
      if (checks.code !== 0 && psqlErrors(out).length === 0) findings.push({ locator: `${CHECKS}:1`, message: `psql exited ${checks.code ?? checks.signal}: ${firstLine(out) || 'no message'}`, standard: 'S-17', hint: 'fix database/checks.sql (09 §1.1)' });
    }

    // stynx verify-rls-negative (published entry point; D-089).
    const rls = await runTool({
      root: ctx.root, bin: 'stynx', install: 'pnpm add -D @stynx-nyx/cli@3.0.0', args: ['verify-rls-negative', '--json', '--ddl', RLS_ROOTS],
      locator: `${APPLY}:1`, standard: 'S-02',
      parse: (stdout) => {
        try {
          const j = JSON.parse(stdout) as { command?: unknown; findings?: unknown };
          return j.command === 'verify-rls-negative' && Array.isArray(j.findings) ? (j.findings as Finding[]) : null;
        } catch {
          return null;
        }
      },
    });
    if (rls.kind === 'unknown') {
      unknowns.push(rls.unknown.reason === 'tooling-missing' ? { ...rls.unknown, finding: { ...rls.unknown.finding, message: `tooling-missing — db-apply: stynx not resolvable from node_modules/.bin (rls-negative)` } } : rls.unknown);
    } else {
      for (const f of rls.value) {
        const force = /missing FORCE ROW LEVEL SECURITY/.test(f.message);
        findings.push({ locator: f.locator, message: f.message, standard: f.standard || 'S-02', hint: force ? 'add FORCE in the same file' : (f.hint || HINT_STATEMENT).slice(0, 160) });
      }
    }

    // The C.4 schema digest, read through pg (also over a failed apply: details always name the database).
    let digest: string;
    try {
      const client = await connect(server, database);
      try {
        digest = await schemaDigest(client, ctx.config.productPrefix);
      } finally {
        await client.end().catch(() => undefined);
      }
    } catch (e) {
      return fail(unknown('postgres-unreachable', 'devai.json:1', `postgres-unreachable (${ctx.runtime}): ${(e as Error).message}`, '02 §6'), { expected: expected.length, observed, evaluated });
    }
    writeDescriptor(ctx.root, { ...desc, schemaDigest: digest });
    ctx.scratch = scratch;
    return outcome({ expected: expected.length, observed, evaluated }, findings, unknowns, { node: 'db-apply', schemaDigest: digest, database, dropped: false });
  },
};
