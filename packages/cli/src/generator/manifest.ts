// 02 §7 `generation-manifest.json`: the generator writes it (A.2), the `generated` replay reads it
// (B.16, 09 §3). Two-space JSON, keys in 02 §7's order, no timestamp (INV-CLI-002). Also the replay's
// lookup of the recorded spec bytes: the blob whose sha256 is `specSha256`, never "the spec at HEAD".
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { sha256 } from '../candidate/digest.js';
import { log, show } from '../git/git.js';
import type { FileMode, Rendered, RenderOptions } from './render.js';

const Hex64 = z.string().regex(/^[0-9a-f]{64}$/);
export const Manifest = z.strictObject({
  generator: z.literal('@devai-nyx/cli'),
  generatorVersion: z.string().min(1),
  specId: z.string().regex(/^SPEC-[A-Z][A-Z0-9]*-[0-9]{3}$/),
  specSha256: Hex64,
  machineBlockSha256: Hex64,
  options: z.strictObject({ web: z.boolean(), locales: z.array(z.string()).min(1), lgpd: z.boolean(), productPrefix: z.string().min(1) }),
  files: z.array(z.strictObject({ path: z.string().min(1), sha256: Hex64, mode: z.enum(['generated', 'seed']) })),
});
export type Manifest = z.infer<typeof Manifest>;
export type ManifestEntry = Manifest['files'][number];

export const MANIFEST = 'generation-manifest.json';

/** Two-space JSON; arrays of scalars on one line, as the template's prettier block prints them. */
export function manifestText(m: Manifest): string {
  return JSON.stringify(m, null, 2).replace(/\[\n\s+("[^"\n]*"(?:,\n\s+"[^"\n]*")*)\n\s+\]/g, (_, items: string) => `[${items.split(/,\n\s+/).join(', ')}]`) + '\n';
}

export function manifestOf(spec: { id: string; sha256: string; machineBlockSha256: string }, options: RenderOptions, version: string, files: readonly { path: string; sha256: string; mode: FileMode }[]): Manifest {
  return {
    generator: '@devai-nyx/cli',
    generatorVersion: version,
    specId: spec.id,
    specSha256: spec.sha256,
    machineBlockSha256: spec.machineBlockSha256,
    options: { web: options.web, locales: [...options.locales], lgpd: options.lgpd, productPrefix: options.productPrefix },
    files: [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)).map((f) => ({ path: f.path, sha256: f.sha256, mode: f.mode })),
  };
}

export const entriesOf = (rendered: Rendered): { path: string; sha256: string; mode: FileMode }[] =>
  [...rendered].map(([path, f]) => ({ path, sha256: sha256(f.bytes), mode: f.mode }));

export type ManifestRead = { kind: 'valid'; value: Manifest } | { kind: 'invalid'; message: string };

export function readManifest(text: string): ManifestRead {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { kind: 'invalid', message: (e as Error).message.split('\n')[0]! };
  }
  const r = Manifest.safeParse(json);
  if (!r.success) {
    const i = r.error.issues[0]!;
    return { kind: 'invalid', message: `${i.path.map(String).join('.') || '(root)'} ${i.message}` };
  }
  return { kind: 'valid', value: r.data };
}

/** The spec path a module's manifest implies: `specs/<slug>/<specId>.md` (04 §1, D-054). */
export const specPathOf = (slug: string, specId: string): string => `specs/${slug}/${specId}.md`;

/**
 * 09 §3 step 1: the bytes whose sha256 is `want`, looked for in the candidate file, at HEAD, at the
 * packet base, then in every commit `git log --all -- <path>` names. Null when none matches.
 */
export async function recordedSpec(root: string, path: string, want: string, revs: readonly (string | null)[]): Promise<Buffer | null> {
  try {
    const b = readFileSync(resolve(root, path));
    if (sha256(b) === want) return b;
  } catch {
    // absent in the candidate: look in history
  }
  const tried = new Set<string>();
  const at = async (rev: string): Promise<Buffer | null> => {
    if (tried.has(rev)) return null;
    tried.add(rev);
    const b = await show(root, rev, path);
    return b !== null && sha256(b) === want ? b : null;
  };
  for (const rev of revs) {
    if (rev === null) continue;
    const b = await at(rev);
    if (b) return b;
  }
  let commits: string[] = [];
  try {
    commits = (await log(root, ['--all', '--format=%H', '--', path])).split('\n').filter((l) => l.length > 0);
  } catch {
    commits = [];
  }
  for (const c of commits) {
    const b = await at(c);
    if (b) return b;
  }
  return null;
}
