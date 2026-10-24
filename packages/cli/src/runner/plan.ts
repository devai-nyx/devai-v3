// 08 C.1 steps 2–3 (plan) with A.3's subset selection: which nodes run, in which order, which are
// deferred. Step 1 (preflight) and step 4 (candidate digest) are the command's (commands/check.ts).
import { byDag, directPrerequisites, type NodeId, NODE_IDS } from './edges.js';

export type HookStage = 'pre-commit' | 'pre-push' | 'commit-msg';

export interface PlanFlags {
  packet: boolean;
  full: boolean;
  only: readonly NodeId[];
  hook?: HookStage;
  /** A.3: `sql-typed` DB joins the edit loop when `provide('postgres')` succeeds without starting anything (W3). */
  postgresReachable?: boolean;
  /** A.7 pre-push: `database/**`, `domain/*\/db/**` or `*.repository.ts` changed since the fetched base (W4). */
  dataLayerChanged?: boolean;
}

export interface Plan {
  /** Planned nodes in Kahn order, ties broken by 02 §2 order; `inventory` first, `accept` last. */
  nodes: NodeId[];
  /** Nodes outside the plan, listed by `accept` without a status (D-058), in 02 §2 order. */
  deferred: NodeId[];
  sqlTypedPhase: 'static' | 'db';
  /** Direct prerequisites of each planned node, restricted to the plan. */
  prerequisites: Map<NodeId, NodeId[]>;
}

/** A.3 "Subset selection": edit loop of 02 §2. */
export const EDIT_LOOP: readonly NodeId[] = ['format', 'lint', 'lint-tests', 'typecheck', 'layout', 'sql-lint', 'spec-lint', 'route-contract', 'sql-typed', 'unit', 'test-integrity', 'i18n'];
/** A.7 hook subsets. */
export const PRE_COMMIT: readonly NodeId[] = ['format', 'lint', 'lint-tests', 'sql-lint'];
export const PRE_PUSH_ADDS: readonly NodeId[] = ['generated', 'boundary', 'deadcode', 'openapi', 'actionlint', 'protected-paths'];
export const PRE_PUSH_DATA: readonly NodeId[] = ['db-apply', 'sql-typed', 'integration'];
/** `--full` alone runs every node except these (A.3); without `--packet` the first two are deferred (B.21, B.26). */
export const PACKET_BOUND: readonly NodeId[] = ['packet-scope', 'spec-tests', 'review'];

function selection(f: PlanFlags): Set<NodeId> {
  if (f.only.length > 0) return new Set(f.only);
  if (f.hook === 'pre-commit') return new Set(PRE_COMMIT);
  if (f.hook === 'pre-push') return new Set([...PRE_COMMIT, ...PRE_PUSH_ADDS, ...(f.dataLayerChanged ? PRE_PUSH_DATA : [])]);
  if (f.hook === 'commit-msg') return new Set<NodeId>(['commitlint']);
  if (f.full && f.packet) return new Set(NODE_IDS);
  if (f.full) return new Set(NODE_IDS.filter((n) => !PACKET_BOUND.includes(n)));
  if (f.packet) return new Set<NodeId>([...EDIT_LOOP, 'packet-scope', 'spec-tests']);
  return new Set(EDIT_LOOP);
}

/** B.21/B.26: packet-bound without `--packet`; B.27: `review` only under `--packet --full`. */
const deferredByInvocation = (id: NodeId, f: PlanFlags): boolean =>
  ((id === 'packet-scope' || id === 'spec-tests') && !f.packet) || (id === 'review' && !(f.packet && f.full));

export function plan(f: PlanFlags): Plan {
  const selected = selection(f);
  const sqlTypedPhase: 'static' | 'db' =
    f.full || selected.has('spec-tests') || selected.has('integration') || (selected.has('sql-typed') && (f.postgresReachable === true || (f.hook === 'pre-push' && f.dataLayerChanged === true)))
      ? 'db'
      : 'static';
  // C.1 step 2: subset ∪ {inventory, accept} ∪ prerequisites(subset); accept's edges order, they never pull.
  const planned = new Set<NodeId>(['inventory', 'accept']);
  const queue = [...selected];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (planned.has(id)) continue;
    planned.add(id);
    queue.push(...directPrerequisites(id, sqlTypedPhase));
  }
  for (const id of [...planned]) if (deferredByInvocation(id, f)) planned.delete(id);
  const prerequisites = new Map<NodeId, NodeId[]>();
  for (const id of planned) prerequisites.set(id, directPrerequisites(id, sqlTypedPhase).filter((p) => planned.has(p)));
  // Kahn, ties by 02 §2 order.
  const indegree = new Map<NodeId, number>([...planned].map((id) => [id, prerequisites.get(id)!.length]));
  const ready = [...planned].filter((id) => indegree.get(id) === 0).sort(byDag);
  const order: NodeId[] = [];
  while (ready.length > 0) {
    const id = ready.shift()!;
    order.push(id);
    for (const [n, pre] of prerequisites) {
      if (!pre.includes(id)) continue;
      const d = indegree.get(n)! - 1;
      indegree.set(n, d);
      if (d === 0) {
        ready.push(n);
        ready.sort(byDag);
      }
    }
  }
  return { nodes: order, deferred: NODE_IDS.filter((n) => !planned.has(n)), sqlTypedPhase, prerequisites };
}
