// 08 B.4 `lint-tests`: `eslint --config <resolved @stynx-nyx/eslint-config/test> --format json
// --max-warnings=0 --no-error-on-unmatched-pattern -- <files…>` over the changed, present `*.spec.ts`
// (B.1 population table). Findings map by `ruleId` and, for `no-restricted-*`, by the message prefix
// (D-086): the published profile emits `no-restricted-syntax` with `WAVE-05A/CW-1:` and
// `no-restricted-imports` with `R19-W06:` [fact: `P:@stynx-nyx/eslint-config@3.0.0/index.mjs:423-455`].
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { candidatePaths, changedPresent, type Finding, unknown, unknownOutcome } from '../proc/tool.js';
import { eslintOutcome, type EslintMessage } from './lint.js';

export const TEST_PROFILE = '@stynx-nyx/eslint-config/test';
const STANDARD = 'S-60';
const spec = (p: string) => p.endsWith('.spec.ts');

/** B.4 Findings, verbatim forms; any other message keeps the B.3 form with S-60. */
export function testFinding(path: string, m: EslintMessage): Finding {
  const locator = `${path}:${m.line ?? 1}:${m.column ?? 1}`;
  if (m.ruleId === 'no-restricted-syntax' && m.message.startsWith('WAVE-05A/CW-1:')) return { locator, message: m.message, standard: STANDARD, hint: 'assert a value, not existence' };
  // ESLint 10.10.0 prints a pattern's message after its own sentence ("'<spec>' import is restricted from being used by a
  // pattern. R19-W06: …"), so the prefix is found where the profile's message starts, and the finding prints from there.
  const r19 = m.ruleId === 'no-restricted-imports' ? m.message.indexOf('R19-W06:') : -1;
  if (r19 >= 0) return { locator, message: m.message.slice(r19), standard: STANDARD, hint: 'import the package, not its src by relative path' };
  return { locator, message: `${m.ruleId}: ${m.message}`, standard: STANDARD, hint: 'fix the test file' };
}

/** The installed `./test` entry point, or null when the published package is absent (D-029). */
function resolveProfile(root: string): string | null {
  try {
    return createRequire(resolve(root, 'package.json')).resolve(TEST_PROFILE);
  } catch {
    return null;
  }
}

export const lintTests: NodeAdapter = {
  id: 'lint-tests',
  contract: 1,
  configFiles: () => [],
  inputs: (ctx) => candidatePaths(ctx, spec),
  async run(ctx: RunContext): Promise<NodeOutcome> {
    const files = changedPresent(ctx, spec);
    const profile = resolveProfile(ctx.root);
    if (files.length > 0 && profile === null) {
      return unknownOutcome(unknown('tooling-missing', 'package.json:1', `${TEST_PROFILE} not resolvable from node_modules`, 'S-19', 'install with pnpm add -D --save-exact @stynx-nyx/eslint-config@3.0.0'), { expected: files.length });
    }
    return eslintOutcome({
      ctx, files, configArgs: ['--config', profile ?? TEST_PROFILE], flags: ['--no-error-on-unmatched-pattern'], configs: [], standard: STANDARD, finding: testFinding,
    });
  },
};
