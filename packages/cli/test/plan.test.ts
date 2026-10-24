// 08 C.1 steps 2–3 and A.3 subset selection: closure over the 02 §2 edges, deferral, Kahn order.
import { describe, expect, it } from 'vitest';
import { NODE_IDS, type NodeId } from '../src/runner/edges.js';
import { EDIT_LOOP, PACKET_BOUND, plan } from '../src/runner/plan.js';

const P = (f: Partial<Parameters<typeof plan>[0]> = {}) => plan({ packet: false, full: false, only: [], ...f });
const before = (order: NodeId[], a: NodeId, b: NodeId) => expect(order.indexOf(a)).toBeLessThan(order.indexOf(b));

describe('plan (C.1 2–3, A.3)', () => {
  it('--only inventory plans inventory and accept; the other 26 are deferred', () => {
    const p = P({ only: ['inventory'] });
    expect(p.nodes).toEqual(['inventory', 'accept']);
    expect(p.deferred).toHaveLength(26);
    expect(p.prerequisites.get('accept')).toEqual(['inventory']);
  });

  it('every selection includes inventory and accept, inventory first and accept last', () => {
    for (const only of [['format'], ['review'], ['e2e']] as NodeId[][]) {
      const p = P({ only });
      expect(p.nodes[0]).toBe('inventory');
      expect(p.nodes[p.nodes.length - 1]).toBe('accept');
    }
  });

  it('--only pulls prerequisites: typecheck→route-contract→permissions-pattern', () => {
    const p = P({ only: ['permissions-pattern'] });
    expect(p.nodes).toEqual(['inventory', 'typecheck', 'route-contract', 'permissions-pattern', 'accept']);
    expect(P({ only: ['openapi'] }).nodes).toEqual(['inventory', 'typecheck', 'openapi', 'accept']);
  });

  it('db-apply→sql-typed(DB)→integration; Kahn order puts db-apply before sql-typed', () => {
    const p = P({ only: ['integration'] });
    expect(p.sqlTypedPhase).toBe('db');
    expect(p.nodes).toEqual(['inventory', 'db-apply', 'sql-typed', 'integration', 'accept']);
    expect(p.prerequisites.get('sql-typed')).toEqual(['inventory', 'db-apply']);
  });

  it('sql-typed alone is static and pulls no db-apply', () => {
    const p = P({ only: ['sql-typed'] });
    expect(p.sqlTypedPhase).toBe('static');
    expect(p.nodes).toEqual(['inventory', 'sql-typed', 'accept']);
  });

  it('no flags: the edit-loop subset of 02 §2; postgres reachable makes sql-typed DB', () => {
    const p = P();
    expect(new Set(p.nodes)).toEqual(new Set<NodeId>(['inventory', ...EDIT_LOOP, 'accept']));
    expect(p.sqlTypedPhase).toBe('static');
    const db = P({ postgresReachable: true });
    expect(db.sqlTypedPhase).toBe('db');
    expect(db.nodes).toContain('db-apply');
  });

  it('--packet adds packet-scope and spec-tests with their closure; review stays deferred', () => {
    const p = P({ packet: true });
    for (const n of ['packet-scope', 'spec-tests', 'db-apply', 'sql-typed'] as NodeId[]) expect(p.nodes).toContain(n);
    expect(p.deferred).toContain('review');
    before(p.nodes, 'db-apply', 'sql-typed');
    before(p.nodes, 'sql-typed', 'spec-tests');
  });

  it('--full alone defers the three packet-bound nodes; --packet --full plans all 28', () => {
    expect(P({ full: true }).deferred).toEqual([...PACKET_BOUND].sort((a, b) => NODE_IDS.indexOf(a) - NODE_IDS.indexOf(b)));
    const all = P({ packet: true, full: true });
    expect(all.nodes).toHaveLength(28);
    expect(all.deferred).toEqual([]);
    // review after every deterministic node and permissions-pattern; accept last.
    for (const n of all.nodes.filter((x) => x !== 'review' && x !== 'accept')) before(all.nodes, n, 'review');
    expect(all.prerequisites.get('review')).not.toContain('accept');
  });

  it('without --packet, spec-tests and packet-scope are deferred even when named', () => {
    const p = P({ only: ['spec-tests', 'packet-scope'] });
    expect(p.nodes).not.toContain('spec-tests');
    expect(p.nodes).not.toContain('packet-scope');
    expect(p.deferred).toEqual(expect.arrayContaining(['spec-tests', 'packet-scope', 'review']));
  });

  it('hook subsets (A.7)', () => {
    expect(P({ hook: 'pre-commit' }).nodes).toEqual(['inventory', 'format', 'lint', 'lint-tests', 'sql-lint', 'accept']);
    expect(P({ hook: 'commit-msg' }).nodes).toEqual(['inventory', 'commitlint', 'accept']);
    const push = P({ hook: 'pre-push' });
    for (const n of ['generated', 'boundary', 'deadcode', 'openapi', 'actionlint', 'protected-paths', 'typecheck'] as NodeId[]) expect(push.nodes).toContain(n);
    expect(push.nodes).not.toContain('db-apply');
    const data = P({ hook: 'pre-push', dataLayerChanged: true });
    expect(data.sqlTypedPhase).toBe('db');
    for (const n of ['db-apply', 'sql-typed', 'integration'] as NodeId[]) expect(data.nodes).toContain(n);
  });
});
