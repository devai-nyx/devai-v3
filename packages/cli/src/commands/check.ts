// 08 A.3 `devai check`, R6 W1 slice: `--only`, `--format`, `--prune`. The other A.3 flags parse and
// refuse with exit 2 `usage` naming the wave that brings them; a plan containing a node without an
// adapter refuses with "node <id> arrives in a later wave" (W1-only behaviour).
import { realpathSync } from 'node:fs';
import { CandidateIo, commitTree, digestOf, workingTree } from '../candidate/digest.js';
import { CacheStore, prune } from '../cache/store.js';
import type { DevaiConfig } from '../config.js';
import { GitFailed, GitMissing, revParse, topLevel } from '../git/git.js';
import { CommandRefusal, cliVersion, type Format, loadConfig, resolveRuntime } from '../main.js';
import { acceptOutcome } from '../nodes/accept.js';
import { actionlint } from '../nodes/actionlint.js';
import { boundary } from '../nodes/boundary.js';
import { commitlint } from '../nodes/commitlint.js';
import { deadcode } from '../nodes/deadcode.js';
import { format } from '../nodes/format.js';
import { i18n } from '../nodes/i18n.js';
import { runInventory } from '../nodes/inventory.js';
import { layout } from '../nodes/layout.js';
import { lint } from '../nodes/lint.js';
import { lintTests } from '../nodes/lint-tests.js';
import { openapi } from '../nodes/openapi.js';
import { permissionsPattern } from '../nodes/permissions-pattern.js';
import { review } from '../nodes/review.js';
import { routeContract } from '../nodes/route-contract.js';
import { specLint } from '../nodes/spec-lint.js';
import { sqlLint } from '../nodes/sql-lint.js';
import { sqlTyped } from '../nodes/sql-typed.js';
import { testIntegrity } from '../nodes/test-integrity.js';
import { typecheck } from '../nodes/typecheck.js';
import { Report } from '../report.js';
import { type NodeId, NODE_IDS } from '../runner/edges.js';
import { exitCodeOf } from '../runner/gating.js';
import { plan } from '../runner/plan.js';
import { type NodeAdapter, runPlan } from '../runner/run.js';
import { renderText } from '../text/report.js';

export interface CheckFlags {
  packet?: string;
  full?: boolean;
  only?: string[];
  hook?: string;
  expectRed?: boolean;
  summary?: boolean;
  prune?: boolean;
}

/** Node adapters by id (Part D: the closed enum, no registry); inventory and accept are the runner's. */
export const ADAPTERS: Partial<Record<NodeId, NodeAdapter>> = {
  format,
  lint,
  'lint-tests': lintTests,
  typecheck,
  layout,
  'sql-lint': sqlLint,
  'spec-lint': specLint,
  'route-contract': routeContract,
  'sql-typed': sqlTyped,
  'test-integrity': testIntegrity,
  i18n,
  actionlint,
  commitlint,
  boundary,
  deadcode,
  openapi,
  'permissions-pattern': permissionsPattern,
  review,
};

/** A.3: the packet-bound nodes `--only` refuses without `--packet` (D-084 item 19). */
const PACKET_ONLY: readonly string[] = ['review', 'permissions-pattern', 'packet-scope', 'spec-tests'];

/** W1: flags whose behaviour arrives with a later R6 wave. */
const LATER: [keyof CheckFlags, string, string][] = [
  ['packet', '--packet', 'R6 W4'],
  ['full', '--full', 'R6 W2–W5, with the nodes it selects'],
  ['hook', '--hook', 'R6 W4'],
  ['expectRed', '--expect-red', 'R6 W4'],
  ['summary', '--summary', 'R6 W4'],
];

export interface CheckResult {
  stdout: string;
  exitCode: 0 | 1 | 2;
}

async function repositoryRoot(cwd: string): Promise<{ root: string; head: string }> {
  const top = await topLevel(cwd);
  if (top === null) throw new CommandRefusal('not-a-repository', `${cwd}: not inside a git work tree`);
  if (realpathSync(top) !== realpathSync(cwd)) throw new CommandRefusal('not-a-repository', `${cwd}: run devai at the repository root ${top}`);
  const head = await revParse(cwd, 'HEAD');
  if (head === null) throw new CommandRefusal('not-a-repository', `${cwd}: HEAD has no commit`);
  return { root: cwd, head };
}

export async function check(argv: readonly string[], flags: CheckFlags, format: Format, cwd: string): Promise<CheckResult> {
  const started = Date.now();
  const config: DevaiConfig = loadConfig(cwd);
  const runtime = resolveRuntime(config).mode;
  const only = flags.only ?? [];
  if (flags.prune && (flags.packet || flags.full || only.length > 0 || flags.hook || flags.expectRed || flags.summary)) {
    throw new CommandRefusal('usage', '--prune combines with nothing else (A.3)');
  }
  for (const n of only) if (!(NODE_IDS as readonly string[]).includes(n)) throw new CommandRefusal('usage', `--only ${n}: not one of the 28 nodes of 02 §2`);
  // A.3 (D-084 item 19): `--only` on a packet-bound node needs `--packet`.
  for (const n of only) if (PACKET_ONLY.includes(n) && !flags.packet) throw new CommandRefusal('usage', `${n} needs --packet`);
  for (const [key, flag, wave] of LATER) if (flags[key]) throw new CommandRefusal('usage', `${flag} arrives in a later wave (${wave})`);

  try {
    const { root, head } = await repositoryRoot(cwd);
    if (flags.prune) {
      const removed = prune(root);
      return format === 'json'
        ? { stdout: JSON.stringify({ pruned: removed, accepted: false, exitCode: 0 }) + '\n', exitCode: 0 }
        : { stdout: `pruned ${removed} cache entries\nexit 0\n`, exitCode: 0 };
    }

    const p = plan({ packet: false, full: false, only: only as NodeId[] });
    const missing = p.nodes.find((n) => n !== 'inventory' && n !== 'accept' && !ADAPTERS[n]);
    if (missing) throw new CommandRefusal('usage', `node ${missing} arrives in a later wave`);

    // C.1 step 4: candidateDigest₀ (working tree; the index snapshot under --hook pre-commit, W4).
    const listing = await workingTree(root, null);
    const digest0 = digestOf(listing);
    const store = new CacheStore(root);
    const ctx = { root, config, runtime, cliVersion: cliVersion(), listing, base: null, head, plan: p };
    const out = await runPlan(ctx, {
      inventory: runInventory,
      adapters: ADAPTERS,
      accept: (c, rows, timings) => acceptOutcome(c, rows, timings, null),
      redigest: async () => digestOf(await workingTree(root, null)),
      store,
      diagnostic: (line) => process.stderr.write(line + '\n'),
    }, digest0);

    const exitCode = exitCodeOf(out.rows, config, out.candidateChanged);
    const report = Report.parse({
      schemaVersion: '3',
      command: ['devai', 'check', ...argv].join(' '),
      packetId: null, kind: null, specId: null, specSha256: null, base: null,
      head, candidateDigest: digest0, toolchainDigest: out.toolchainDigest, runtime,
      accepted: false,
      exitCode,
      ...(out.candidateChanged ? { reason: 'candidate-changed' as const } : {}),
      nodes: out.rows,
      durationMs: Date.now() - started,
    });
    // A.3 Writes: every --format json run (and every --full run); a candidate-changed result is discarded.
    if (format === 'json' && !out.candidateChanged) store.writeReport(digest0, report);
    if (format === 'json') return { stdout: JSON.stringify(report, null, 2) + '\n', exitCode };

    // C.3 line 2 (D-076): the first untracked path, when the working-tree digest differs from HEAD's tree.
    let untracked: string | null = null;
    if (listing.untracked.length > 0 && digestOf(await commitTree(root, head, null)) !== digest0) untracked = listing.untracked[0]!;
    return { stdout: renderText(report, { config, untracked }).join('\n') + '\n', exitCode };
  } catch (e) {
    if (e instanceof CandidateIo) throw new CommandRefusal('io', e.message);
    if (e instanceof GitMissing) throw new CommandRefusal('tooling-missing', e.message);
    if (e instanceof GitFailed && e.message.includes('not a git repository')) throw new CommandRefusal('not-a-repository', e.message);
    throw e;
  }
}
