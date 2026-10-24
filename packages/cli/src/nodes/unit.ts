// 08 B.11 `unit` as amended by D-081 (R6 W3): `vitest run --config vitest.config.ts --reporter <C.5 module>`
// with `TEST_TIER=unit` over the population's files (`*.spec.ts` outside the tier suffixes in a
// `typecheck`-affected package, B.1 table), counted per case: a skipped or pending case is a shortfall
// `FAIL` naming it, a module that fails to import is `FAIL`, a collected case without a result is
// `runner-crashed`.
import { unitFiles } from './inventory.js';
import { runVitest, VITEST_CONFIG } from '../vitest/census.js';
import { countsOf, emptyTally, tally } from '../vitest/tier.js';
import { firstMessageLine } from '../vitest/census.js';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { outcome } from '../ts/outcome.js';

/** The population's files (inventory's predicate, B.1), sorted. */
export const unitPopulation = (ctx: RunContext): string[] =>
  unitFiles(ctx.listing.entries.map((e) => e.path), ctx.inventory?.changed ?? [], ['.', ...(ctx.inventory?.packageDirs ?? [])]).sort();

export const unit: NodeAdapter = {
  id: 'unit',
  contract: 1,
  configFiles: () => [VITEST_CONFIG],
  // The selected files and the sources of the packages they test (the `tsc -b` closure's files at the candidate).
  inputs: (ctx) => {
    const files = unitPopulation(ctx);
    const dirs = new Set((ctx.inventory?.packageDirs ?? []).filter((d) => files.some((f) => f.startsWith(`${d}/`))));
    return ctx.listing.entries.map((e) => e.path).filter((p) => files.includes(p) || ([...dirs].some((d) => p.startsWith(`${d}/`)) && /\.(ts|mts|cts|json)$/.test(p))).sort();
  },
  async run(ctx): Promise<NodeOutcome> {
    const files = unitPopulation(ctx);
    const r = await runVitest({ root: ctx.root, tier: 'unit', files });
    if (r.kind === 'unknown') return outcome({ expected: 0, observed: 0, evaluated: 0 }, [], [r.unknown]);
    const t = emptyTally();
    tally(t, ctx.root, r.census, files, (file, c) => ({
      locator: `${file}:${c.line}`, message: `${c.fullName}: ${firstMessageLine(c.errors[0])}`, standard: 'tests', hint: 'fix the behaviour or the case through its packet',
    }));
    return outcome(countsOf(t), t.findings, t.unknowns);
  },
};
