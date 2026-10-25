// SPDX-License-Identifier: Apache-2.0
// Provenance: the staged write (`wx`, one `rename`) and the symlink guard derive from
// `stynx:packages/cli/src/generate-module.ts` @ 63e5f788 (:458-472, :492-508), relicensed to Apache-2.0
// by NYXK (D-067).
//
// 08 A.2 `devai new module --spec <path> [--web] [--out <dir>] [--regenerate]`: admission through
// parse-spec (the zod parse `spec-lint` uses, D-056), the pure renderer (09 §2), the staged write, the
// `database/seed/modules.txt` append (D-023) and the mount lines it prints without acting on them
// (09 §2, D-087). `--regenerate` per A.2, 09 §3, D-033, D-053, D-074. Exit 0 written; 2 refusals.
import { appendFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { sha256 } from '../candidate/digest.js';
import { entriesOf, MANIFEST, manifestOf, manifestText, readManifest, type ManifestEntry } from '../generator/manifest.js';
import { type FileMode, pascal, renderBlock, type RenderOptions, sqlPath } from '../generator/render.js';
import { show } from '../git/git.js';
import { CommandRefusal, cliVersion, type Format, loadConfig, resolveRuntime } from '../main.js';
import { ruleOf } from '../nodes/spec-lint.js';
import { noOpenQuestions, parseSpec } from '../spec/parse-spec.js';

export interface NewModuleFlags {
  spec: string;
  web?: boolean;
  out?: string;
  regenerate?: boolean;
}

export const MODULES_TXT = 'database/seed/modules.txt';

type Action = 'written' | 'unchanged' | 'left-alone';
interface FileLine { path: string; mode: FileMode; sha256: string; action: Action; note?: string }

const inside = (rel: string): boolean => rel !== '' && !rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith('/');
const rel = (root: string, path: string): string => relative(root, resolve(root, path)).split(sep).join('/');
const isLink = (p: string): boolean => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };
const exists = (p: string): boolean => { try { lstatSync(p); return true; } catch { return false; } };
const readOr = (p: string): Buffer | null => { try { return readFileSync(p); } catch { return null; } };

/** The nearest existing ancestor of `abs` resolves inside the repository (an escaping link is refused). */
function guard(root: string, abs: string): void {
  let dir = abs;
  while (!existsSync(dir)) dir = dirname(dir);
  const real = relative(realpathSync(root), realpathSync(dir));
  if (real === '..' || real.startsWith(`..${sep}`) || isAbsolute(real)) throw new CommandRefusal('usage', `${relative(root, abs)}: resolves outside the repository through a symlink`);
}

/** One file replaced atomically: a sibling temporary file, then `rename` (a symlink is never followed). */
function replaceFile(abs: string, bytes: Buffer): void {
  if (isLink(abs)) throw new CommandRefusal('usage', `${abs}: is a symlink; the generator does not write through links`);
  mkdirSync(dirname(abs), { recursive: true });
  const tmp = `${abs}.devai-${process.pid}.tmp`;
  writeFileSync(tmp, bytes, { flag: 'wx' });
  renameSync(tmp, abs);
}

/** 08 A.2 Refuses, in order: unreadable or invalid spec (`spec-invalid`), then approval (`spec-not-approved`). */
function admit(root: string, specRel: string, locales: readonly string[]) {
  if (!inside(specRel)) throw new CommandRefusal('spec-invalid', `${specRel}: not a repository path`);
  const bytes = readOr(resolve(root, specRel));
  if (bytes === null) throw new CommandRefusal('spec-invalid', `${specRel}: not found`);
  const parsed = parseSpec(bytes.toString('utf8'));
  if (parsed.kind === 'malformed') {
    const p = parsed.problems[0]!;
    throw new CommandRefusal('spec-invalid', `${specRel}:${p.line} SL01 invalid contract at ${p.pointer}: ${p.reason}`);
  }
  if (parsed.kind === 'invalid') {
    const i = parsed.issues[0]!;
    const r = ruleOf(i, parsed.value);
    throw new CommandRefusal('spec-invalid', `${specRel}:${parsed.lineOf(i.path)} ${r.rule} ${r.text}`);
  }
  if (parsed.problems.length > 0) {
    const p = parsed.problems[0]!;
    throw new CommandRefusal('spec-invalid', `${specRel}:${p.line} SL01 invalid contract at ${p.pointer}: ${p.reason}`);
  }
  const b = parsed.block;
  // SL12: the catalogs need every configured locale for every key, and every error key resolves.
  for (const [key, byLocale] of Object.entries(b.i18n)) {
    if (locales.some((l) => !(l in byLocale))) throw new CommandRefusal('spec-invalid', `${specRel}:${parsed.lineOf(['i18n', key])} SL12 i18n ${key}: missing locale or unresolved error message`);
  }
  for (const [i, r] of b.routes.entries()) for (const [j, e] of r.errorContract.entries()) {
    if (!(e.messageKey in b.i18n)) throw new CommandRefusal('spec-invalid', `${specRel}:${parsed.lineOf(['routes', i, 'errorContract', j, 'messageKey'])} SL12 i18n ${e.messageKey}: missing locale or unresolved error message`);
  }
  if (b.status !== 'approved') throw new CommandRefusal('spec-not-approved', `spec ${b.id} status ${b.status}: the pilot approves it; note it under ## Notes and stop`);
  if (b['approved-by'] === null) throw new CommandRefusal('spec-not-approved', `spec ${b.id} has no approved-by: the pilot approves it; note it under ## Notes and stop`);
  if (!noOpenQuestions(parsed.openQuestions)) throw new CommandRefusal('spec-not-approved', `spec ${b.id} has open questions: the pilot answers them; note it under ## Notes and stop`);
  return { bytes, parsed };
}

/** Appends `<sha256>  <path>` unless the path is already listed (09 §1: lines are appended, never edited). */
function appendModulesTxt(root: string, path: string, digest: string): boolean {
  const abs = resolve(root, MODULES_TXT);
  const text = readOr(abs)?.toString('utf8') ?? '';
  if (text.split('\n').some((l) => l.replace(/^[0-9a-f]{64} {2}/, '') === path)) return false;
  guard(root, abs);
  mkdirSync(dirname(abs), { recursive: true });
  appendFileSync(abs, `${text.length > 0 && !text.endsWith('\n') ? '\n' : ''}${digest}  ${path}\n`);
  return true;
}

export async function newModule(flags: NewModuleFlags, format: Format, root: string): Promise<{ stdout: string; exitCode: 0 }> {
  const config = loadConfig(root);
  resolveRuntime(config);
  const version = cliVersion();
  const specRel = rel(root, flags.spec);
  const { bytes, parsed } = admit(root, specRel, config.locales);
  const block = parsed.block;
  const options: RenderOptions = { web: flags.web === true, locales: [...config.locales], lgpd: config.lgpd, productPrefix: config.productPrefix };
  const out = rel(root, flags.out ?? `domain/${block.module.slug}`);
  if (!inside(out)) throw new CommandRefusal('usage', `--out ${flags.out}: not a repository path`);
  const outAbs = resolve(root, out);
  guard(root, outAbs);
  const rendered = renderBlock(block, options, version);
  const spec = { id: block.id, sha256: sha256(bytes), machineBlockSha256: parsed.machineBlockSha256 };
  const sql = sqlPath(block);
  const lines: FileLine[] = [];
  const notes: string[] = [];
  let manifestEntries: { path: string; sha256: string; mode: FileMode }[];

  if (!flags.regenerate) {
    if (exists(outAbs)) throw new CommandRefusal('output-exists', `${out} exists; regenerate with --regenerate (A.2)`);
    manifestEntries = entriesOf(rendered);
    const parent = dirname(outAbs);
    mkdirSync(parent, { recursive: true });
    guard(root, parent);
    const stage = mkdtempSync(join(realpathSync(parent), '.devai-generate-'));
    try {
      for (const [path, f] of rendered) {
        const abs = join(stage, path);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, f.bytes, { flag: 'wx' });
      }
      writeFileSync(join(stage, MANIFEST), manifestText(manifestOf(spec, options, version, manifestEntries)), { flag: 'wx' });
      if (exists(outAbs)) throw new CommandRefusal('output-exists', `${out} exists; regenerate with --regenerate (A.2)`);
      renameSync(stage, outAbs);
    } catch (e) {
      rmSync(stage, { recursive: true, force: true });
      throw e;
    }
    for (const e of manifestEntries) lines.push({ ...e, action: 'written' });
  } else {
    const current = readOr(join(outAbs, MANIFEST));
    if (current === null) throw new CommandRefusal('usage', `--regenerate needs an existing module: ${out}/${MANIFEST} not found`);
    const m = readManifest(current.toString('utf8'));
    if (m.kind === 'invalid') throw new CommandRefusal('usage', `${out}/${MANIFEST}: ${m.message}; restore it from git before regenerating`);
    const old = m.value;
    // D-053, D-074: same id, or the successor whose supersedes.id names the manifest's spec.
    if (old.specId !== block.id && block.supersedes?.id !== old.specId) {
      throw new CommandRefusal('spec-mismatch', `${out} was generated from ${old.specId}; ${block.id} is neither it nor its successor (supersedes.id)`);
    }
    const before = new Map<string, ManifestEntry>(old.files.map((f) => [f.path, f]));
    manifestEntries = [];
    for (const [path, f] of rendered) {
      const abs = join(outAbs, path);
      const disk = readOr(abs);
      const fresh = sha256(f.bytes);
      const prior = before.get(path);
      if (f.mode === 'generated') {
        // D-033, LINT013: a module SQL file present at HEAD is applied history; never rewritten.
        if (path === sql && (await show(root, 'HEAD', `${out}/${path}`)) !== null) {
          manifestEntries.push(prior ?? { path, sha256: disk ? sha256(disk) : fresh, mode: 'generated' });
          lines.push({ path, mode: 'generated', sha256: prior?.sha256 ?? fresh, action: 'left-alone', note: 'base-present, never rewritten (LINT013)' });
          if (disk === null || !disk.equals(f.bytes)) {
            notes.push(`write ${out}/db/${block.module.namespace}_${block.module.slug}_<nn>_<topic>.sql by hand and append it to ${MODULES_TXT}`);
          }
          continue;
        }
        const same = disk !== null && disk.equals(f.bytes);
        if (!same) replaceFile(abs, f.bytes);
        manifestEntries.push({ path, sha256: fresh, mode: 'generated' });
        lines.push({ path, mode: 'generated', sha256: fresh, action: same ? 'unchanged' : 'written' });
        continue;
      }
      // A seed is never written once it exists; the manifest keeps its initial digest (02 §7).
      if (prior === undefined && disk === null) {
        replaceFile(abs, f.bytes);
        manifestEntries.push({ path, sha256: fresh, mode: 'seed' });
        lines.push({ path, mode: 'seed', sha256: fresh, action: 'written' });
        continue;
      }
      const initial = prior?.sha256 ?? fresh;
      const unchanged = disk !== null && sha256(disk) === initial;
      manifestEntries.push({ path, sha256: initial, mode: 'seed' });
      lines.push({ path, mode: 'seed', sha256: initial, action: unchanged ? 'unchanged' : 'left-alone', note: unchanged ? 'seed unchanged, safe to overwrite' : 'seed edited, left alone' });
    }
    // A.2: rewrites the manifest's generatorVersion to the installed version.
    replaceFile(join(outAbs, MANIFEST), Buffer.from(manifestText(manifestOf(spec, options, version, manifestEntries)), 'utf8'));
  }

  const sqlEntry = manifestEntries.find((e) => e.path === sql);
  const sqlBytes = readOr(join(outAbs, sql));
  const appended = sqlEntry !== undefined && sqlBytes !== null && appendModulesTxt(root, `${out}/${sql}`, sha256(sqlBytes));
  const cls = `${pascal(config.productPrefix)}${block.module.name}`;
  const pkg = `@${config.productPrefix}/${block.module.slug}`;
  // 09 §2, D-087: printed, never acted on; mounting is the generate packet's job.
  const mount = [
    `mount: add "${pkg}-api": "workspace:*" to apps/api/package.json and ${cls}Module to apps/api/src/app.module.ts imports, then pnpm install`,
    `mount: add "${out}/api/src" to .stynxrc.json apiCoverage.sourceRoots`,
    `mount: add "${out}" to .stynxrc.json publicApi.packageRoots`,
    ...(options.web ? [`mount: add "${pkg}-web": "workspace:*" to apps/web/package.json and ${cls.charAt(0).toLowerCase()}${cls.slice(1)}Routes to apps/web/src/app/app.routes.ts, then pnpm install`] : []),
  ];
  if (format === 'json') {
    const doc = { specId: spec.id, specSha256: spec.sha256, machineBlockSha256: spec.machineBlockSha256, out, files: lines.map(({ path, mode, sha256: s, action }) => ({ path, mode, sha256: s, action })), accepted: false, exitCode: 0 };
    return { stdout: JSON.stringify(doc) + '\n', exitCode: 0 };
  }
  const text = [
    ...lines.map((l) => `${l.mode} ${out}/${l.path}${l.note ? `: ${l.note}` : ''}`),
    ...(appended ? [`appended ${MODULES_TXT}`] : []),
    ...notes,
    ...mount,
  ];
  return { stdout: text.join('\n') + '\n', exitCode: 0 };
}
