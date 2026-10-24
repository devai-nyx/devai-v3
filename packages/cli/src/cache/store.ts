// 08 C.4 Layout, Reuse, Invalidation and `--prune` (A.3). Gitignored; `rm -rf .devai/cache` is always safe.
//   .devai/cache/nodes/<nodeId>/<key>.json   → { resultDigest }
//   .devai/cache/results/<resultDigest>.json → NodeResult (PASS only)
//   .devai/cache/reports/<candidateDigest>.json → Report
//   .devai/cache/agentic/<node>/<digest>.json (W5) · .devai/cache/scratch/ (W3, W4)
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { NodeResult } from '../report.js';
import { type NodeRow, resultDigest } from './result-digest.js';

export const CACHE_DIR = '.devai/cache';
export const PRUNE_KEEP = 200;

export class CacheStore {
  readonly dir: string;
  /** Files written during this run, discarded on `candidate-changed` (C.1 step 10). */
  private readonly written: string[] = [];

  constructor(root: string) {
    this.dir = resolve(root, CACHE_DIR);
  }

  private write(path: string, text: string): void {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
    this.written.push(path);
  }

  /** A PASS stored under `key`, or null: absent, corrupt, unparseable or not PASS is a miss. */
  lookup(nodeId: string, key: string): NodeRow | null {
    try {
      const entry = JSON.parse(readFileSync(resolve(this.dir, 'nodes', nodeId, `${key}.json`), 'utf8')) as { resultDigest?: unknown };
      if (typeof entry.resultDigest !== 'string' || !/^[0-9a-f]{64}$/.test(entry.resultDigest)) return null;
      const parsed = NodeResult.safeParse(JSON.parse(readFileSync(resolve(this.dir, 'results', `${entry.resultDigest}.json`), 'utf8')));
      if (!parsed.success || parsed.data.status !== 'PASS' || parsed.data.id !== nodeId) return null;
      if (resultDigest(parsed.data) !== entry.resultDigest) return null;
      return parsed.data;
    } catch {
      return null;
    }
  }

  /** Only PASS is written (C.4 Reuse; C.1 step 9). */
  store(nodeId: string, key: string, row: NodeRow): void {
    if (row.status !== 'PASS') return;
    const digest = resultDigest(row);
    this.write(resolve(this.dir, 'results', `${digest}.json`), JSON.stringify(row) + '\n');
    this.write(resolve(this.dir, 'nodes', nodeId, `${key}.json`), JSON.stringify({ resultDigest: digest }) + '\n');
  }

  writeReport(candidateDigest: string, report: unknown): string {
    const path = resolve(this.dir, 'reports', `${candidateDigest}.json`);
    this.write(path, JSON.stringify(report, null, 2) + '\n');
    return path;
  }

  /** `candidate-changed`: the run's cache writes are discarded. */
  discard(): void {
    for (const p of this.written.splice(0)) rmSync(p, { force: true });
  }
}

const listJson = (dir: string): string[] => {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
};

/**
 * `--prune`: keeps the newest 200 entries per node (by mtime) under `nodes/` and `agentic/`, then drops
 * `results/` files no remaining entry names. Returns the number of entries removed. Scratch-database
 * descriptors are W3's (B.20); none exist before `db-apply` does.
 */
export function prune(root: string, keep = PRUNE_KEEP): number {
  const dir = resolve(root, CACHE_DIR);
  let removed = 0;
  const referenced = new Set<string>();
  for (const area of ['nodes', 'agentic']) {
    let nodeDirs: string[];
    try {
      nodeDirs = readdirSync(resolve(dir, area));
    } catch {
      continue;
    }
    for (const node of nodeDirs) {
      const nodeDir = resolve(dir, area, node);
      const files = listJson(nodeDir)
        .map((f) => ({ path: resolve(nodeDir, f), mtime: statSync(resolve(nodeDir, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      for (const f of files.slice(keep)) {
        rmSync(f.path, { force: true });
        removed++;
      }
      if (area === 'nodes') {
        for (const f of files.slice(0, keep)) {
          try {
            const d = (JSON.parse(readFileSync(f.path, 'utf8')) as { resultDigest?: unknown }).resultDigest;
            if (typeof d === 'string') referenced.add(d);
          } catch {
            // a corrupt entry is a miss (C.4); it holds nothing alive
          }
        }
      }
    }
  }
  for (const f of listJson(resolve(dir, 'results'))) {
    if (!referenced.has(f.slice(0, -'.json'.length))) rmSync(resolve(dir, 'results', f), { force: true });
  }
  return removed;
}
