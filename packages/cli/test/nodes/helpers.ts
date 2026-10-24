// Node-adapter fixtures (R6 W2c): the pinned tools from the registry (07 §2) installed once per tool
// set into the OS temp dir and linked into each temp workspace as `node_modules`, and a RunContext
// built the way `devai check` builds it (candidate listing, then `inventory` for the changed set).
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { expect } from 'vitest';
import { workingTree } from '../../src/candidate/digest.js';
import type { DevaiConfig } from '../../src/config.js';
import { revParse } from '../../src/git/git.js';
import { runInventory } from '../../src/nodes/inventory.js';
import { NodeResult } from '../../src/report.js';
import type { NodeId } from '../../src/runner/edges.js';
import { plan } from '../../src/runner/plan.js';
import { type NodeAdapter, type NodeOutcome, rewriteNoObservations, type RunContext } from '../../src/runner/run.js';
import { templateConfig } from '../fixtures.js';

const repoRoot = resolve(import.meta.dirname, '../../../..');

/** 07 §2 pins (and the STYNX 3.0.0 deliverables) the W2c nodes invoke. */
export const PINS = {
  stynx: { '@stynx-nyx/cli': '3.0.0' },
  migrationLinter: { '@stynx-nyx/migration-linter': '3.0.0' },
  deadcode: { knip: '6.35.1', depcheck: '1.4.7', madge: '8.0.0', typescript: '6.0.3' },
} as const;

/** 09 §1.1 row `.stynxrc.json` (D-087); the template file in this repository predates it. */
export const STYNXRC_09 = '{ "boundary": { "roots": ["apps","domain"], "allowedPackages": ["@stynx-nyx/"], "forbiddenImports": [] }, "apiCoverage": { "sourceRoots": ["apps/api/src"] }, "publicApi": { "packageRoots": [] } }\n';

/**
 * `pnpm install` of `deps` into `<tmp>/devai-w2c-tools/<hash>`, reused while it exists (the cache spans
 * test files and runs); the registry needs NODE_AUTH_TOKEN for @stynx-nyx/* (repository `.npmrc`).
 */
export function toolsFor(deps: Record<string, string>): string {
  const hash = createHash('sha256').update(JSON.stringify(Object.entries(deps).sort())).digest('hex').slice(0, 16);
  const home = resolve(tmpdir(), 'devai-w2c-tools');
  const dir = resolve(home, hash);
  if (existsSync(resolve(dir, 'node_modules/.modules.yaml'))) return dir;
  mkdirSync(home, { recursive: true });
  const work = mkdtempSync(resolve(home, `${hash}-`));
  writeFileSync(resolve(work, 'package.json'), JSON.stringify({ name: 'devai-w2c-tools', private: true, type: 'module', devDependencies: deps }, null, 2));
  cpSync(resolve(repoRoot, '.npmrc'), resolve(work, '.npmrc'));
  try {
    execFileSync('pnpm', ['install', '--no-frozen-lockfile', '--reporter=silent'], { cwd: work, stdio: ['ignore', 'ignore', 'inherit'], env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' } });
  } catch (e) {
    rmSync(work, { recursive: true, force: true });
    throw e;
  }
  try {
    renameSync(work, dir);
  } catch {
    rmSync(work, { recursive: true, force: true }); // another test file won the race
  }
  return dir;
}

/**
 * Links an installed tool set into the workspace. The template's `node_modules/` ignore line does not
 * match a symlink, so the link is excluded locally (`.git/info/exclude`), as a real install is ignored.
 */
export function linkTools(dir: string, tools: string): void {
  symlinkSync(resolve(tools, 'node_modules'), resolve(dir, 'node_modules'), 'dir');
  appendFileSync(resolve(dir, '.git/info/exclude'), '/node_modules\n');
}

export interface CtxOptions {
  config?: Partial<DevaiConfig>;
  base?: string | null;
  only?: NodeId;
  /** Runs after the candidate is listed and before the adapter (an edit the listing must not see). */
  beforeRun?: () => void;
}

export async function contextOf(dir: string, opts: CtxOptions = {}): Promise<RunContext> {
  const listing = await workingTree(dir, opts.base ?? null);
  const head = (await revParse(dir, 'HEAD'))!;
  const ctx: RunContext = {
    root: dir, config: { ...templateConfig(), ...opts.config }, runtime: 'bare', cliVersion: '3.0.0', listing,
    base: opts.base ?? null, head, plan: plan({ packet: false, full: false, only: opts.only ? [opts.only] : [] }),
  };
  ctx.inventory = (await runInventory(ctx)).data;
  return ctx;
}

/** Runs one adapter as the runner does (C.1 step 9 rewrite) and checks the row against C.2. */
export async function runNode(adapter: NodeAdapter, dir: string, opts: CtxOptions = {}): Promise<NodeOutcome> {
  const ctx = await contextOf(dir, { ...opts, only: adapter.id });
  opts.beforeRun?.();
  const o = rewriteNoObservations(await adapter.run(ctx));
  NodeResult.parse({ id: adapter.id, ...o, durationMs: 0, cached: false, needs: [] });
  expect(adapter.inputs(ctx).length).toBeGreaterThanOrEqual(0);
  return o;
}

export const lines = (o: NodeOutcome): string[] => o.findings.map((f) => `${f.locator} ${f.message} [${f.standard}] ${f.hint}`);
