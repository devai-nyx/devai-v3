// 08 B.16 `generated` as 09 §3 binds it: per `domain/*/generation-manifest.json`, the recorded spec
// bytes (sha256 = `specSha256`, never "the spec at HEAD"), `machineBlockSha256` verified, the installed
// version = `generatorVersion`, a render to memory with the recorded options, then the generated file
// set and bytes against the candidate; ownership comes from the renderer, not the manifest's `mode`.
// A module SQL file present at the merge base leaves `expected` (LINT013's, D-043). Any `@generated`
// file no manifest lists fails. The three STYNX pairs are `UNKNOWN: tooling-missing` until
// `@stynx-nyx/cli` publishes the write forms (D-088).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256 } from '../candidate/digest.js';
import { MANIFEST, type Manifest, readManifest, recordedSpec, specPathOf } from '../generator/manifest.js';
import { renderBlock, RenderError, sqlPath } from '../generator/render.js';
import { show } from '../git/git.js';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { parseSpec } from '../spec/parse-spec.js';
import type { Finding, Reason } from './tool-local.js';

const STANDARD = 'S-45';
const MANIFEST_PATH = /^domain\/([^/]+)\/generation-manifest\.json$/;
const DIFFERS_HINT = 'regenerate (devai new module --regenerate) or move the logic to a seed file';
/** B.16 Status, D-088: the hint verbatim; `<v>` is the release that will carry the pair, unknown today. */
export const PAIR_HINT = 'generated: install @stynx-nyx/cli ≥ <v> with the write pair';
const OPENAPI = 'docs/framework/contracts/openapi.json';
const BASELINES = 'docs/framework/contracts/public-api-baselines.json';
/** B.16 Invokes: the three STYNX `:write`/`--check` pairs; none has a published write form (D-088, 11 SM-18). */
const PAIRS: readonly Finding[] = [
  { locator: `${OPENAPI}:1`, message: 'stynx api-docs write is not published; the verify-api-coverage pair cannot be checked', standard: STANDARD, hint: PAIR_HINT },
  { locator: `${BASELINES}:1`, message: 'stynx public-api-baselines write is not published; the verify-public-api-baselines pair cannot be checked', standard: STANDARD, hint: PAIR_HINT },
  { locator: `${OPENAPI}:1`, message: 'stynx-sdk-codegen (@stynx-nyx/sdk) is not published; the SDK pair cannot be checked', standard: STANDARD, hint: PAIR_HINT },
];

const manifests = (ctx: RunContext): string[] => ctx.listing.entries.map((e) => e.path).filter((p) => MANIFEST_PATH.test(p)).sort();
const readOr = (root: string, path: string): Buffer | null => { try { return readFileSync(resolve(root, path)); } catch { return null; } };
const headed = (b: Buffer): boolean => {
  const nl = b.indexOf(0x0a);
  return b.subarray(0, nl < 0 ? Math.min(b.length, 512) : nl).toString('utf8').includes('@generated');
};

interface ModuleResult {
  expected: number;
  observed: number;
  evaluated: number;
  failures: Finding[];
  unknowns: { reason: Reason; finding: Finding }[];
  listed: string[];
}

async function replay(ctx: RunContext, manifestPath: string, present: ReadonlySet<string>): Promise<ModuleResult> {
  const slug = MANIFEST_PATH.exec(manifestPath)![1]!;
  const dir = `domain/${slug}`;
  const r: ModuleResult = { expected: 0, observed: 0, evaluated: 0, failures: [], unknowns: [], listed: [] };
  const unavailable = (message: string, locator = `${manifestPath}:1`) => r.unknowns.push({ reason: 'generator-unavailable', finding: { locator, message, standard: STANDARD, hint: 'regenerate in a generate packet' } });
  const text = readOr(ctx.root, manifestPath);
  if (text === null) { r.unknowns.push({ reason: 'io', finding: { locator: `${manifestPath}:1`, message: `${manifestPath} cannot be read`, standard: STANDARD, hint: 'make the path readable, then re-run' } }); return r; }
  const read = readManifest(text.toString('utf8'));
  if (read.kind === 'invalid') { unavailable(`manifest does not parse: ${read.message}`); return r; }
  const m: Manifest = read.value;
  r.listed = m.files.map((f) => `${dir}/${f.path}`);
  // The decorators pin (D-074).
  const pkgPath = `${dir}/api/package.json`;
  const pkg = readOr(ctx.root, pkgPath);
  if (pkg !== null) {
    let pin: unknown;
    try { pin = (JSON.parse(pkg.toString('utf8')) as { dependencies?: Record<string, unknown> }).dependencies?.['@devai-nyx/decorators']; } catch { pin = undefined; }
    if (typeof pin === 'string' && pin !== m.generatorVersion) {
      r.failures.push({ locator: `${pkgPath}:1`, message: `pins @devai-nyx/decorators ${pin} ≠ generatorVersion ${m.generatorVersion}`, standard: STANDARD, hint: `set the pin to ${m.generatorVersion}, or regenerate with the installed generator` });
    }
  }
  const generatedEntries = m.files.filter((f) => f.mode === 'generated');
  r.expected = generatedEntries.length;
  // Step 3: the installed version must equal the recorded one.
  if (m.generatorVersion !== ctx.cliVersion) {
    r.unknowns.push({ reason: 'generator-version-mismatch', finding: { locator: `${manifestPath}:1`, message: `installed generator ${ctx.cliVersion} ≠ generatorVersion ${m.generatorVersion}`, standard: STANDARD, hint: `pnpm add -D @devai-nyx/cli@${m.generatorVersion}` } });
    return r;
  }
  // Step 1: the recorded bytes, by digest; candidates first, then HEAD, the packet base and history.
  const specPath = specPathOf(slug, m.specId);
  let bytes = await recordedSpec(ctx.root, specPath, m.specSha256, [ctx.head, ctx.base]);
  if (bytes === null) {
    for (const p of [...present].filter((x) => x.startsWith('specs/') && x.endsWith('.md') && x !== specPath).sort()) {
      const b = readOr(ctx.root, p);
      if (b !== null && sha256(b) === m.specSha256) { bytes = b; break; }
    }
  }
  if (bytes === null) { unavailable('recorded spec bytes not found'); return r; }
  // Step 2.
  const parsed = parseSpec(bytes.toString('utf8'));
  if (parsed.kind !== 'valid') { unavailable('recorded spec bytes do not parse as a valid machine block'); return r; }
  if (parsed.machineBlockSha256 !== m.machineBlockSha256) { unavailable(`machineBlockSha256 ${m.machineBlockSha256.slice(0, 12)} ≠ the recorded spec's ${parsed.machineBlockSha256.slice(0, 12)}`); return r; }
  // Step 4: render to memory.
  let rendered;
  try {
    rendered = await renderBlock(parsed.block, m.options, m.generatorVersion);
  } catch (e) {
    if (!(e instanceof RenderError)) throw e;
    unavailable(`recorded options do not render: ${e.message}`);
    return r;
  }
  // Step 5: ownership from the renderer; base-present module SQL is LINT013's (D-043, 09 §3).
  const sql = sqlPath(parsed.block);
  const basePresent = (await show(ctx.root, ctx.base ?? ctx.head, `${dir}/${sql}`)) !== null;
  const generated = [...rendered].filter(([path, f]) => f.mode === 'generated' && !(path === sql && basePresent));
  const listedPaths = new Set(m.files.map((f) => f.path));
  r.expected = generated.length;
  for (const [path, f] of generated) {
    const full = `${dir}/${path}`;
    if (!present.has(full)) { r.failures.push({ locator: `${full}:1`, message: 'generated file missing', standard: STANDARD, hint: DIFFERS_HINT }); continue; }
    const disk = readOr(ctx.root, full);
    if (disk === null) { r.unknowns.push({ reason: 'io', finding: { locator: `${full}:1`, message: `${full} cannot be read`, standard: STANDARD, hint: 'make the path readable, then re-run' } }); continue; }
    r.observed++;
    r.evaluated++;
    if (!listedPaths.has(path)) r.failures.push({ locator: `${full}:1`, message: 'generated file present but not listed in the manifest', standard: STANDARD, hint: DIFFERS_HINT });
    else if (!disk.equals(f.bytes)) r.failures.push({ locator: `${full}:1`, message: 'differs from regeneration', standard: STANDARD, hint: DIFFERS_HINT });
  }
  // The generated path set: a manifest `generated` entry the renderer no longer produces.
  for (const e of generatedEntries) {
    if (!rendered.has(e.path)) r.failures.push({ locator: `${dir}/${e.path}:1`, message: 'listed as generated but not produced by regeneration', standard: STANDARD, hint: DIFFERS_HINT });
  }
  return r;
}

async function run(ctx: RunContext): Promise<NodeOutcome> {
  const present = new Set(ctx.listing.entries.map((e) => e.path));
  let expected = PAIRS.length;
  let observed = 0;
  let evaluated = 0;
  const failures: Finding[] = [];
  const unknowns: { reason: Reason; finding: Finding }[] = [];
  const listed = new Set<string>();
  for (const mp of manifests(ctx)) {
    const r = await replay(ctx, mp, present);
    expected += r.expected;
    observed += r.observed;
    evaluated += r.evaluated;
    failures.push(...r.failures);
    unknowns.push(...r.unknowns);
    for (const p of r.listed) listed.add(p);
  }
  // Step 6: a `@generated` file outside every manifest.
  for (const e of ctx.listing.entries) {
    if (e.tag !== 'F' || listed.has(e.path) || MANIFEST_PATH.test(e.path)) continue;
    const b = readOr(ctx.root, e.path);
    if (b !== null && headed(b)) failures.push({ locator: `${e.path}:1`, message: '@generated file outside every generation-manifest.json', standard: STANDARD, hint: 'remove the header, or regenerate the module that owns the file' });
  }
  for (const f of PAIRS) unknowns.push({ reason: 'tooling-missing', finding: f });
  const counts = { expected, observed, evaluated };
  // A FAIL and an UNKNOWN cause together are FAIL, keeping every finding (A.3; D-084).
  if (failures.length > 0) return { status: 'FAIL', ...counts, findings: [...failures, ...unknowns.map((u) => u.finding)] };
  return { status: 'UNKNOWN', reason: unknowns[0]!.reason, ...counts, findings: unknowns.map((u) => u.finding) };
}

export const generated: NodeAdapter = {
  id: 'generated',
  contract: 1,
  configFiles: () => [],
  // B.16 Inputs: every manifest, every file it lists, each module's api/package.json, the spec files
  // the recorded bytes may come from, and every file whose first line could carry `@generated`.
  inputs: (ctx) => ctx.listing.entries.filter((e) => e.tag === 'F').map((e) => e.path).sort(),
  // The merge base decides which module SQL is LINT013's; history may hold the recorded spec bytes.
  keyExtra: async (ctx) => [ctx.base ?? ctx.head, ctx.head],
  run,
};
