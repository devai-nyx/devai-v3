// 02 §2's table as data: latency class, `needs`, and the edge list of 08 C.1 step 3. The 28 ids are
// the closed enum of C.2 (Part D: no registry).
import type { z } from 'zod';
import { NodeId as NodeIdSchema } from '../report.js';

export type NodeId = z.infer<typeof NodeIdSchema>;
export const NODE_IDS: readonly NodeId[] = NodeIdSchema.options;
export const dagIndex = (id: NodeId): number => NODE_IDS.indexOf(id);
export const byDag = (a: NodeId, b: NodeId): number => dagIndex(a) - dagIndex(b);

/** 02 §2 column "Lat." (rule e). `A/B` is `sql-typed`: A static, B DB. */
export type Latency = 'A' | 'A-B' | 'A/B' | 'B' | 'B-C' | 'C' | 'C+tokens';
export type Need = 'postgres' | 'model';

export const LATENCY: Record<NodeId, Latency> = {
  inventory: 'A', format: 'A', lint: 'B', 'lint-tests': 'A-B', typecheck: 'B', layout: 'A', 'sql-lint': 'A', 'spec-lint': 'A',
  'route-contract': 'B', 'sql-typed': 'A/B', unit: 'B', 'test-integrity': 'A', i18n: 'A', actionlint: 'A', commitlint: 'A',
  generated: 'B', boundary: 'B', deadcode: 'B-C', openapi: 'B-C', 'db-apply': 'C', 'spec-tests': 'B-C', integration: 'C', e2e: 'C',
  'permissions-pattern': 'C+tokens', 'protected-paths': 'A', 'packet-scope': 'A', review: 'C+tokens', accept: 'A',
};

/** Part B row "Needs"; `sql-typed` needs postgres in its DB part only. */
export function needsOf(id: NodeId, sqlTypedPhase: 'static' | 'db'): Need[] {
  if (id === 'db-apply' || id === 'spec-tests' || id === 'integration') return ['postgres'];
  if (id === 'sql-typed') return sqlTypedPhase === 'db' ? ['postgres'] : [];
  if (id === 'permissions-pattern' || id === 'review') return ['model'];
  return [];
}

export const MODEL_NODES: readonly NodeId[] = ['permissions-pattern', 'review'];
/** "every deterministic node → review": every node but the two model nodes and `accept`. */
export const isDeterministic = (id: NodeId): boolean => !MODEL_NODES.includes(id) && id !== 'accept';

/** C.1 step 6 lanes: model nodes run alone; class C (and B–C) and `needs: postgres` nodes one at a time. */
export function lane(id: NodeId, sqlTypedPhase: 'static' | 'db'): 'exclusive' | 'serial' | 'pool' {
  if (MODEL_NODES.includes(id)) return 'exclusive';
  const lat = LATENCY[id];
  if (lat === 'C' || lat === 'B-C' || needsOf(id, sqlTypedPhase).includes('postgres')) return 'serial';
  return 'pool';
}

/** D-047: the edit-loop classes, whose wall time `accept` records as `details.editLoopMs`. */
export const isEditLoopClass = (id: NodeId): boolean => ['A', 'B', 'A-B', 'A/B'].includes(LATENCY[id]);

/**
 * Direct prerequisites of `id` (C.1 step 3), before restriction to the plan:
 * inventory→*, db-apply→sql-typed(DB), sql-typed(DB)→spec-tests, sql-typed(DB)→integration,
 * typecheck→route-contract, typecheck→openapi, route-contract→permissions-pattern,
 * every deterministic node→review, permissions-pattern→review, *→accept.
 */
export function directPrerequisites(id: NodeId, sqlTypedPhase: 'static' | 'db'): NodeId[] {
  if (id === 'inventory') return [];
  const pre: NodeId[] = ['inventory'];
  switch (id) {
    case 'sql-typed': if (sqlTypedPhase === 'db') pre.push('db-apply'); break;
    case 'spec-tests': case 'integration': pre.push('sql-typed'); break;
    case 'route-contract': case 'openapi': pre.push('typecheck'); break;
    case 'permissions-pattern': pre.push('route-contract'); break;
    case 'review': pre.push(...NODE_IDS.filter((n) => n !== 'inventory' && isDeterministic(n)), 'permissions-pattern'); break;
    case 'accept': pre.push(...NODE_IDS.filter((n) => n !== 'inventory' && n !== 'accept')); break;
    default: break;
  }
  return pre;
}
