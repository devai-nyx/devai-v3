// D-087 (b8): the `.stynxrc.json` keys DEVAI relies on, validated before any `stynx` call (08 B.17,
// B.19). The published command takes a non-object file with default roots [fact:
// `P:@stynx-nyx/cli@3.0.0/engines/stynx-boundary.mjs:9-19,24`], so DEVAI checks the shape itself.
// Keys STYNX reads that DEVAI does not rely on (`openapiContract`, `rlsNegative`) pass through.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { RepoPath } from './spec/machine-block.js';

const Strings = z.array(z.string().min(1));
/** Literal repository-relative roots (STYNX reads them without globbing, D-087 b7). */
const Roots = z.array(RepoPath);

export const StynxRc = z.looseObject({
  boundary: z.strictObject({                                               // stynx-boundary.mjs:22-26
    roots: Roots.min(1).optional(),
    allowedPackages: Strings.optional(),
    forbiddenImports: Strings.optional(),
    requireStynxPackages: Strings.optional(),
  }),
  apiCoverage: z.strictObject({                                            // api-coverage.mjs:19-25
    sourceRoots: Roots,
    openapiPath: RepoPath.optional(),
    routePrefix: z.string().optional(),
  }),
  publicApi: z.strictObject({                                              // checks.js:201-205
    packageRoots: Roots,
    baselinePath: RepoPath.optional(),
  }),
});
export type StynxRc = z.infer<typeof StynxRc>;

export type StynxRcRead =
  | { kind: 'absent' }
  | { kind: 'invalid'; message: string }
  | { kind: 'unreadable'; message: string }
  | { kind: 'valid'; value: StynxRc };

export const STYNXRC = '.stynxrc.json';

/** `present` is the candidate listing's answer: an untracked-ignored or deleted file is absent. */
export function readStynxRc(root: string, present: boolean): StynxRcRead {
  if (!present) return { kind: 'absent' };
  let text: string;
  try {
    text = readFileSync(resolve(root, STYNXRC), 'utf8');
  } catch (e) {
    return { kind: 'unreadable', message: (e as Error).message };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (e) {
    return { kind: 'invalid', message: `not parseable: ${(e as Error).message}` };
  }
  const r = StynxRc.safeParse(json);
  if (!r.success) {
    const i = r.error.issues[0]!;
    return { kind: 'invalid', message: `invalid at /${i.path.join('/')}: ${i.message}` };
  }
  return { kind: 'valid', value: r.data };
}
