// 08 B.22 `integration` (R6 W3): `vitest run` with the C.5 reporter once per populated tier
// (`TEST_TIER=integration` for `test/integration/*.integration.spec.ts`, `TEST_TIER=db` for
// `test/db/*.db.spec.ts`; never an empty tier run) with `DATABASE_URL` = `db-apply`'s scratch database and
// `DEVAI_RUNTIME`; counted as `unit` (D-081).
import { INTEGRATION_FILE } from './inventory.js';
import { firstMessageLine, runVitest, VITEST_CONFIG } from '../vitest/census.js';
import { countsOf, emptyTally, tally } from '../vitest/tier.js';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { outcome } from '../ts/outcome.js';
import { HINTS } from '../text/hints.js';

const files = (ctx: RunContext): string[] => ctx.listing.entries.map((e) => e.path).filter((p) => INTEGRATION_FILE.test(p)).sort();

/** The standard of a failed case: the template-emitted cases' standards by subject (B.22 Observation), else S-02. */
export function standardOf(fullName: string): 'S-02' | 'S-18' | 'S-70' {
  if (/x-request-id|request id|healthz|readyz/i.test(fullName)) return 'S-70';
  if (/\bRLS\b|isolation|_app\b|owner/i.test(fullName)) return 'S-18';
  return 'S-02';
}

export const integration: NodeAdapter = {
  id: 'integration',
  contract: 1,
  configFiles: () => [VITEST_CONFIG],
  inputs: (ctx) => ctx.listing.entries.map((e) => e.path).filter((p) => INTEGRATION_FILE.test(p) || /^apps\/[^/]+\/src\//.test(p) || p.startsWith('test/support/')).sort(),
  async run(ctx): Promise<NodeOutcome> {
    const all = files(ctx);
    if (!ctx.scratch) {
      return outcome({ expected: 0, observed: 0, evaluated: 0 }, [], [{ reason: 'postgres-unreachable', finding: { locator: 'devai.json:1', message: `postgres-unreachable (${ctx.runtime}): db-apply provided no scratch database`, standard: '02 §6', hint: HINTS['postgres-unreachable'] } }]);
    }
    const t = emptyTally();
    for (const [tier, suffix] of [['integration', '.integration.spec.ts'], ['db', '.db.spec.ts']] as const) {
      const tierFiles = all.filter((p) => p.endsWith(suffix));
      if (tierFiles.length === 0) continue;
      const r = await runVitest({ root: ctx.root, tier, files: tierFiles, env: { DATABASE_URL: ctx.scratch.url, DEVAI_RUNTIME: ctx.runtime } });
      if (r.kind === 'unknown') return outcome(countsOf(t), t.findings, [...t.unknowns, r.unknown]);
      tally(t, ctx.root, r.census, tierFiles, (file, c) => ({
        locator: `${file}:${c.line}`, message: `${c.fullName}: ${firstMessageLine(c.errors[0])}`, standard: standardOf(c.fullName), hint: 'fix the behaviour under the application role',
      }));
    }
    return outcome(countsOf(t), t.findings, t.unknowns);
  },
};
