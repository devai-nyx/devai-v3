// 08 A.3 `devai check`: `--only`, `--format`, `--prune` (W1); `--packet`, `--hook`, `--expect-red`,
// `--summary` (W4). `--full` still refuses with exit 2 `usage` naming the waves that bring its nodes;
// a plan containing a node without an adapter refuses with "node <id> arrives in a later wave".
import { readFileSync, realpathSync, rmSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { CandidateIo, commitTree, digestOf, type Listing, staged, workingTree } from '../candidate/digest.js';
import { CacheStore, prune } from '../cache/store.js';
import type { DevaiConfig } from '../config.js';
import { reachable, running } from '../db/provide.js';
import { pruneScratch } from '../db/scratch.js';
import { diffNameStatus, GitFailed, GitMissing, lsFilesTracked, lsFilesUntracked, revParse, show, topLevel } from '../git/git.js';
import { CommandRefusal, cliVersion, type Format, loadConfig, resolveRuntime } from '../main.js';
import { acceptOutcome } from '../nodes/accept.js';
import { actionlint } from '../nodes/actionlint.js';
import { boundary } from '../nodes/boundary.js';
import { commitlint } from '../nodes/commitlint.js';
import { dbApply } from '../nodes/db-apply.js';
import { deadcode } from '../nodes/deadcode.js';
import { e2e } from '../nodes/e2e.js';
import { format } from '../nodes/format.js';
import { generated } from '../nodes/generated.js';
import { i18n } from '../nodes/i18n.js';
import { integration } from '../nodes/integration.js';
import { runInventory } from '../nodes/inventory.js';
import { layout } from '../nodes/layout.js';
import { lint } from '../nodes/lint.js';
import { lintTests } from '../nodes/lint-tests.js';
import { openapi } from '../nodes/openapi.js';
import { packetScope } from '../nodes/packet-scope.js';
import { protectedPaths } from '../nodes/protected-paths.js';
import { permissionsPattern } from '../nodes/permissions-pattern.js';
import { review } from '../nodes/review.js';
import { routeContract } from '../nodes/route-contract.js';
import { specLint } from '../nodes/spec-lint.js';
import { specTests } from '../nodes/spec-tests.js';
import { sqlLint } from '../nodes/sql-lint.js';
import { sqlTyped } from '../nodes/sql-typed.js';
import { testIntegrity } from '../nodes/test-integrity.js';
import { typecheck } from '../nodes/typecheck.js';
import { unit } from '../nodes/unit.js';
import { type Packet, PacketInvalid, sectionBullets } from '../packet/packet.js';
import { type Introduced, introducing, loadPacket, pl12, pl16, specMeta } from '../packet/rules.js';
import { Report } from '../report.js';
import { type NodeId, NODE_IDS } from '../runner/edges.js';
import { exitCodeOf } from '../runner/gating.js';
import { type HookStage, plan } from '../runner/plan.js';
import { type NodeAdapter, type RunContext, runPlan } from '../runner/run.js';
import { renderText } from '../text/report.js';
import { renderSummary } from '../text/summary.js';
import { readSpecText } from '../ts/spec.js';
import { dataLayerChanged, fetchedBase, HOOK_STAGES, materialiseStaged, stageLine } from './hook.js';

export interface CheckFlags {
  packet?: string;
  full?: boolean;
  only?: string[];
  hook?: string;
  expectRed?: boolean;
  summary?: boolean;
  prune?: boolean;
  /** Positional arguments: the commit-msg message file; pre-push's `<remote name> <remote url>`. */
  args?: string[];
  /** `--hook pre-push`: the ref lines git writes on stdin. */
  stdin?: string;
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
  generated,
  boundary,
  deadcode,
  openapi,
  'protected-paths': protectedPaths,
  'packet-scope': packetScope,
  'db-apply': dbApply,
  'spec-tests': specTests,
  integration,
  e2e,
  unit,
  'permissions-pattern': permissionsPattern,
  review,
};

/** A.3: the packet-bound nodes `--only` refuses without `--packet` (D-084 item 19). */
const PACKET_ONLY: readonly string[] = ['review', 'permissions-pattern', 'packet-scope', 'spec-tests'];

/** Flags whose behaviour arrives with a later R6 wave. */
const LATER: [keyof CheckFlags, string, string][] = [
  ['full', '--full', 'R6 W2–W5, with the nodes it selects'],
];

export interface CheckResult {
  stdout: string;
  exitCode: 0 | 1 | 2;
}

export async function repositoryRoot(cwd: string): Promise<{ root: string; head: string }> {
  const top = await topLevel(cwd);
  if (top === null) throw new CommandRefusal('not-a-repository', `${cwd}: not inside a git work tree`);
  if (realpathSync(top) !== realpathSync(cwd)) throw new CommandRefusal('not-a-repository', `${cwd}: run devai at the repository root ${top}`);
  const head = await revParse(cwd, 'HEAD');
  if (head === null) throw new CommandRefusal('not-a-repository', `${cwd}: HEAD has no commit`);
  return { root: cwd, head };
}

/** A repo-relative POSIX path for a command-line path given relative to the root. */
export const repoPath = (root: string, path: string): string => relative(root, resolve(root, path)).split('\\').join('/');

/** `packets/**` at HEAD (the index) plus untracked: the PL-02 id population (D-050). */
export async function packetPopulation(root: string): Promise<string[]> {
  const all = [...(await lsFilesTracked(root)), ...(await lsFilesUntracked(root))];
  return [...new Set(all.filter((p) => p.startsWith('packets/') && p.endsWith('.md')))].sort();
}

/** C.1 step 1 for `--packet`: PL-01..03, 06, 14 and the pre-DAG branches of PL-04/05 (exit 2). */
export async function packetPreflight(root: string, path: string, full = false): Promise<NonNullable<RunContext['packet']> & { packet: Packet; intro: Introduced | null }> {
  try {
    const packet = await loadPacket(root, path, await packetPopulation(root));
    // W3's view for `spec-tests` (B.21 Inputs): the pinned spec's bytes at base, empty for unpinned kinds.
    const pin = packet.spec?.sha256 ? packet.spec : null;
    const specText = pin ? ((await show(root, packet.base, pin.path))?.toString('utf8') ?? '') : '';
    // W5's facts for the model nodes (B.24, B.27): `kind: spec` cites the context and the candidate spec's sources[].
    let sources: string[] = [];
    if (packet.kind === 'spec' && packet.spec) {
      let candidate: string | null = null;
      try {
        candidate = readFileSync(resolve(root, packet.spec.path), 'utf8');
      } catch {
        candidate = null;
      }
      sources = [...new Set([...packet.context.map((c) => c.path), ...(candidate ? readSpecText(packet.spec.path, candidate)?.sources ?? [] : [])])];
    }
    return {
      packet, intro: await introducing(root, packet.path), kind: packet.kind, unimplemented: packet.unimplemented, specText,
      id: packet.id, path: packet.path, base: packet.base, text: packet.text, specPath: pin?.path ?? null, specSha256: pin?.sha256 ?? null,
      sources, deliverables: sectionBullets(packet.text, 'Deliverables'), full,
    };
  } catch (e) {
    if (e instanceof PacketInvalid) throw new CommandRefusal(e.reason, e.message);
    throw e;
  }
}

function validate(flags: CheckFlags): { only: NodeId[]; hook: HookStage | undefined } {
  const only = flags.only ?? [];
  const args = flags.args ?? [];
  if (flags.prune && (flags.packet || flags.full || only.length > 0 || flags.hook || flags.expectRed || flags.summary || args.length > 0)) {
    throw new CommandRefusal('usage', '--prune combines with nothing else (A.3)');
  }
  for (const n of only) if (!(NODE_IDS as readonly string[]).includes(n)) throw new CommandRefusal('usage', `--only ${n}: not one of the 28 nodes of 02 §2`);
  // A.3 (D-084 item 19): `--only` on a packet-bound node needs `--packet`.
  for (const n of only) if (PACKET_ONLY.includes(n) && !flags.packet) throw new CommandRefusal('usage', `${n} needs --packet`);
  for (const [key, flag, wave] of LATER) if (flags[key]) throw new CommandRefusal('usage', `${flag} arrives in a later wave (${wave})`);
  let hook: HookStage | undefined;
  if (flags.hook !== undefined) {
    if (!(HOOK_STAGES as readonly string[]).includes(flags.hook)) throw new CommandRefusal('usage', `--hook ${flags.hook}: expected pre-commit, pre-push or commit-msg`);
    hook = flags.hook as HookStage;
    if (flags.packet || flags.full || only.length > 0 || flags.summary || flags.expectRed) throw new CommandRefusal('usage', '--hook combines with --format only (A.7)');
    if (hook === 'commit-msg' && args.length !== 1) throw new CommandRefusal('usage', '--hook commit-msg needs the message file');
  }
  if (args.length > 0 && hook !== 'commit-msg' && hook !== 'pre-push') throw new CommandRefusal('usage', `unexpected argument ${args[0]}`);
  if (flags.summary && !flags.packet) throw new CommandRefusal('usage', '--summary needs --packet');
  if (flags.expectRed && !flags.packet) throw new CommandRefusal('expect-red-nothing-named', '--expect-red given without --packet');
  return { only: only as NodeId[], hook };
}

export async function check(argv: readonly string[], flags: CheckFlags, format: Format, cwd: string): Promise<CheckResult> {
  const started = Date.now();
  const config: DevaiConfig = loadConfig(cwd);
  const runtime = resolveRuntime(config).mode;
  const { only, hook } = validate(flags);

  let scratch: string | null = null;
  try {
    const { root, head } = await repositoryRoot(cwd);
    if (flags.prune) {
      await pruneScratch(root, await running(root, config, runtime), (line) => process.stderr.write(line + '\n')); // B.20: descriptor-named databases only
      const removed = prune(root);
      return format === 'json'
        ? { stdout: JSON.stringify({ pruned: removed, accepted: false, exitCode: 0 }) + '\n', exitCode: 0 }
        : { stdout: `pruned ${removed} cache entries\nexit 0\n`, exitCode: 0 };
    }

    // C.1 step 1: the packet's pre-DAG rules; A.3 `--expect-red` must agree with it (PL-11, D-051).
    const pk = flags.packet ? await packetPreflight(root, repoPath(root, flags.packet), flags.full === true) : null;
    if (flags.expectRed && pk && (pk.packet.kind !== 'test' || pk.packet.unimplemented.length === 0)) {
      throw new CommandRefusal('expect-red-nothing-named', '--expect-red given but observations.unimplemented is empty');
    }

    // A.7 pre-push: the fetched base from git's ref lines; unresolvable → protected-paths base-unreadable.
    let base: string | null = pk?.packet.base ?? null;
    let baseUnresolved = false;
    if (hook === 'pre-push') {
      base = await fetchedBase(root, flags.stdin ?? '');
      baseUnresolved = base === null;
    }

    // C.1 step 4: candidateDigest₀ (the index snapshot under --hook pre-commit).
    const listingOf = (): Promise<Listing> => (hook === 'pre-commit' ? staged(root, null) : workingTree(root, pk?.packet.base ?? null));
    const listing = await listingOf();
    const digest0 = digestOf(listing);
    const store = new CacheStore(root);

    if (flags.summary && pk) return summaryOf(store, pk.packet, digest0, head, config, format);

    let pushChanged: string[] = [];
    if (hook === 'pre-push') {
      pushChanged = [...(await diffNameStatus(root, { from: 'HEAD' })), ...(base ? await diffNameStatus(root, { from: base, to: 'HEAD' }) : [])].map((d) => d.path);
    }
    const p = plan({ packet: pk !== null, full: false, only, ...(hook ? { hook } : {}), dataLayerChanged: dataLayerChanged(pushChanged),
      postgresReachable: !hook && (only.length === 0 || only.includes('sql-typed')) && (await reachable(root, config, runtime)) });
    const missing = p.nodes.find((n) => n !== 'inventory' && n !== 'accept' && !ADAPTERS[n]);
    if (missing) throw new CommandRefusal('usage', `node ${missing} arrives in a later wave`);

    if (hook === 'pre-commit') scratch = await materialiseStaged(root, listing, digest0);
    const ctx: RunContext = {
      root: scratch ?? root, config, runtime, cliVersion: cliVersion(), listing, base, head, plan: p,
      ...(pk ? { packet: pk } : {}),
      ...(hook ? { hook } : {}),
      ...(hook === 'commit-msg' ? { messageFile: flags.args![0]! } : {}),
      ...(baseUnresolved ? { baseUnresolved } : {}),
    };
    // B.28: PL-16 (and PL-12 under --full) are read from git before the run; accept stays synchronous.
    const packetFindings = pk ? [...(await pl16(root, pk.packet)), ...(flags.full ? await pl12(root, pk.packet) : [])] : [];
    const meta = pk?.specText ? specMeta(pk.specText) : null;
    const out = await runPlan(ctx, {
      inventory: runInventory,
      adapters: ADAPTERS,
      accept: (c, rows, timings) => acceptOutcome(c, rows, timings, pk ? {
        path: pk.packet.path, kind: pk.packet.kind, spec: meta ? { routes: meta.routes, queries: meta.queries } : null,
        diff: c.inventory?.changed ?? [], findings: packetFindings,
      } : null),
      redigest: async () => digestOf(await listingOf()),
      store,
      diagnostic: (line) => process.stderr.write(line + '\n'),
    }, digest0);

    const exitCode = exitCodeOf(out.rows, config, out.candidateChanged);
    const report = Report.parse({
      schemaVersion: '3',
      command: ['devai', 'check', ...argv].join(' '),
      packetId: pk?.packet.id ?? null, kind: pk?.packet.kind ?? null, specId: pk?.packet.spec?.id ?? null, specSha256: pk?.packet.spec?.sha256 ?? null,
      base, head, candidateDigest: digest0, toolchainDigest: out.toolchainDigest, runtime,
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
    if (listing.untracked.length > 0 && digestOf(await commitTree(root, head, listing.base)) !== digest0) untracked = listing.untracked[0]!;
    const hookLine = hook ? stageLine(hook, report) : undefined;
    return { stdout: renderText(report, { config, untracked, ...(hookLine ? { hookLine } : {}) }).join('\n') + '\n', exitCode };
  } catch (e) {
    if (e instanceof CandidateIo) throw new CommandRefusal('io', e.message);
    if (e instanceof GitMissing) throw new CommandRefusal('tooling-missing', e.message);
    if (e instanceof GitFailed && e.message.includes('not a git repository')) throw new CommandRefusal('not-a-repository', e.message);
    throw e;
  } finally {
    if (scratch) rmSync(scratch, { recursive: true, force: true });
  }
}

/**
 * A.3 `--summary` without `--full`: the C.3 summary of the report under `.devai/cache/reports/` whose
 * `candidateDigest` is the current candidate's (and whose packet is this one), else exit 2 `no-report`.
 */
function summaryOf(store: CacheStore, packet: Packet, digest: string, head: string, config: DevaiConfig, format: Format): CheckResult {
  let report: Report | null = null;
  try {
    const parsed = Report.safeParse(JSON.parse(readFileSync(resolve(store.dir, 'reports', `${digest}.json`), 'utf8')));
    if (parsed.success && parsed.data.packetId === packet.id && parsed.data.candidateDigest === digest) report = parsed.data;
  } catch {
    report = null;
  }
  if (!report) throw new CommandRefusal('no-report', `no acceptance report for head ${head}; run --full`);
  if (format === 'json') return { stdout: JSON.stringify(report, null, 2) + '\n', exitCode: report.exitCode };
  return { stdout: renderSummary({ report, config, title: packet.title }).join('\n') + '\n', exitCode: report.exitCode };
}
