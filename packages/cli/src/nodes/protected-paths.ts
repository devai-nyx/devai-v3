// 08 B.25 `protected-paths`: classifies the whole change (old and new paths, `--no-renames`) by the
// devai.json `protected` globs, one `ignore` 7.0.5 matcher per class (02 §5). `declared` is judged
// against the packet's `protected` at its introducing commit (D-078); without a packet it is null.
// A notice, never a refusal: PASS with `details.touched`; `UNKNOWN: base-unreadable` when the base
// is not fetched (A.7 pre-push).
import { classify, introducedProtected } from '../packet/rules.js';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';

export const protectedPaths: NodeAdapter = {
  id: 'protected-paths',
  contract: 1,
  configFiles: () => ['devai.json'],
  inputs: (ctx) => [...(ctx.inventory?.changed ?? []), ...(ctx.packet ? [ctx.packet.packet.path] : [])],
  // The diff is `base..HEAD` plus the working tree and the declaration is read at the introducing commit.
  keyExtra: (ctx) => [ctx.base ?? 'none', ctx.head, ctx.packet?.intro?.sha ?? 'none'],
  async run(ctx: RunContext): Promise<NodeOutcome> {
    if (ctx.baseUnresolved) {
      return {
        status: 'UNKNOWN', reason: 'base-unreadable', expected: 1, observed: 0, evaluated: 0,
        findings: [{ locator: 'HEAD', message: 'the pushed range has no fetched base', standard: '02 §5', hint: 'git fetch origin, then re-run' }],
      };
    }
    const declared = ctx.packet ? introducedProtected(ctx.packet.packet, ctx.packet.intro) : null;
    const touched = classify(ctx.config, ctx.inventory?.changed ?? [], declared);
    return { status: 'PASS', expected: 1, observed: 1, evaluated: 1, findings: [], details: { node: 'protected-paths', touched } };
  },
};
