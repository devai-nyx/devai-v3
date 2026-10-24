// 08 B.26 `packet-scope`: the 05 §5 rules that need `base` and run inside the DAG (PL-04, PL-05,
// PL-07, PL-09, PL-11, PL-13, PL-17; SL09 = PL-17, SL10 = PL-04's digest, D-054); the pre-DAG rules
// ended the command before the run (C.1 step 1). One observation per changed path (PL-07, the review
// evidence files excluded) plus one per rule; findings are 05 §5's messages verbatim.
import { reviewFiles, scopeRules } from '../packet/rules.js';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';

export const packetScope: NodeAdapter = {
  id: 'packet-scope',
  contract: 1,
  configFiles: () => ['devai.json'],
  inputs: (ctx) => [...(ctx.inventory?.changed ?? []), ...(ctx.packet?.packet ? [ctx.packet.packet.path, ctx.packet.packet.spec?.path ?? ''].filter((p) => p !== '') : [])],
  // Base blobs, the introducing commit and the review history in base..HEAD are commits, not paths.
  keyExtra: async (ctx) => [ctx.base ?? 'none', ctx.head, ctx.packet?.intro?.sha ?? 'none'],
  async run(ctx: RunContext): Promise<NodeOutcome> {
    if (!ctx.packet?.packet) return { status: 'PASS', expected: 0, observed: 0, evaluated: 0, findings: [] }; // deferred by the plan
    const { packet } = ctx.packet;
    const intro = ctx.packet.intro ?? null;
    const skip = new Set(reviewFiles(packet.id));
    const changed = (ctx.inventory?.changed ?? []).filter((c) => !skip.has(c));
    const rules = await scopeRules({ root: ctx.root, packet, changed, intro });
    const expected = changed.length + rules.length;
    const findings = rules.flatMap((r) => r.findings);
    return { status: findings.length > 0 ? 'FAIL' : 'PASS', expected, observed: expected, evaluated: expected, findings };
  },
};
