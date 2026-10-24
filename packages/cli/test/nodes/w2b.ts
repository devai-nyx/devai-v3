// W2b node fixtures (beside W2c's helpers.ts): run one node through the real runner (inventory first, SKIPPED from its
// populations, the no-observations rewrite) in a temp workspace, and give the workspace the product's
// `node_modules` toolchain (TypeScript 6.0.3, `@stynx-nyx/tsconfig` and `@stynx-nyx/cli` 3.0.0, as
// published) through wrappers, since only `<root>/node_modules/.bin` is consulted (08 B.1, D-057).
import { chmodSync, mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import type { NodeRow } from '../../src/cache/result-digest.js';
import { CacheStore } from '../../src/cache/store.js';
import { workingTree } from '../../src/candidate/digest.js';
import { acceptOutcome } from '../../src/nodes/accept.js';
import { runInventory } from '../../src/nodes/inventory.js';
import type { NodeId } from '../../src/runner/edges.js';
import { plan } from '../../src/runner/plan.js';
import { type NodeAdapter, runPlan } from '../../src/runner/run.js';
import { ADAPTERS } from '../../src/commands/check.js';
import { NodeResult } from '../../src/report.js';
import { templateConfig } from '../fixtures.js';
import { gitIn } from '../repo.js';

const require = createRequire(import.meta.url);
const cliDir = resolve(import.meta.dirname, '../..');
const repoRoot = resolve(cliDir, '../..');

/** Install wrappers for `tsc` and `stynx` and links for the tsconfig chain into `<dir>/node_modules`. */
export function linkToolchain(dir: string, which: { tsc?: boolean; stynx?: boolean } = { tsc: true, stynx: true }): void {
  const nm = resolve(dir, 'node_modules');
  mkdirSync(resolve(nm, '.bin'), { recursive: true });
  mkdirSync(resolve(nm, '@stynx-nyx'), { recursive: true });
  mkdirSync(resolve(nm, '@types'), { recursive: true });
  const wrap = (name: string, js: string) => {
    const p = resolve(nm, '.bin', name);
    writeFileSync(p, `#!/bin/sh\nexec "${process.execPath}" "${js}" "$@"\n`);
    chmodSync(p, 0o755);
  };
  if (which.tsc !== false) wrap('tsc', resolve(dirname(require.resolve('typescript/package.json')), 'bin/tsc'));
  if (which.stynx !== false) wrap('stynx', resolve(realpathSync(resolve(cliDir, 'node_modules/@stynx-nyx/cli')), 'dist/cli/src/main.js'));
  symlinkSync(realpathSync(resolve(repoRoot, 'node_modules/@stynx-nyx/tsconfig')), resolve(nm, '@stynx-nyx/tsconfig'));
  symlinkSync(realpathSync(resolve(repoRoot, 'node_modules/@types/node')), resolve(nm, '@types/node'));
}

/** `devai check --only <id>` through the runner, in process, against the working tree of `dir`. */
export async function runOnly(dir: string, id: NodeId, adapters: Partial<Record<NodeId, NodeAdapter>> = ADAPTERS): Promise<{ row: NodeRow; rows: NodeRow[] }> {
  const head = gitIn(dir, 'rev-parse', 'HEAD').trim();
  const listing = await workingTree(dir, null);
  const p = plan({ packet: false, full: false, only: [id] });
  const ctx = { root: dir, config: templateConfig(), runtime: 'bare' as const, cliVersion: '3.0.0', listing, base: null, head, plan: p };
  const out = await runPlan(ctx, {
    inventory: runInventory,
    adapters,
    accept: (c, rows, timings) => acceptOutcome(c, rows, timings, null),
    redigest: async () => 'same',
    store: new CacheStore(dir),
    diagnostic: (l) => process.stderr.write(l + '\n'),
  }, 'same');
  for (const r of out.rows) NodeResult.parse(r); // every row is C.2-valid (hint ≤ 160, PASS invariants)
  return { row: out.rows.find((r) => r.id === id)!, rows: out.rows };
}
