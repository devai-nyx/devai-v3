// 08 B.21 `spec-tests` (R6 W3): `vitest run` with the C.5 reporter over the packet's derived acceptance file
// `domain/<m>/api/test/acceptance/<lowercase-spec-id>.acceptance.spec.ts` with `TEST_TIER=acceptance`,
// `DATABASE_URL` = `db-apply`'s scratch database and `DEVAI_RUNTIME`. One observation = one top-level
// `it('R-n: …')` whose R-n is an `acceptance: "yes"` requirement of the pinned spec; expected-red (D-051)
// applies only to a `kind: test` packet with a non-empty `observations.unimplemented`, and a named case
// passes only by failing at a reached assertion (C.5, D-058).
import { MachineBlock, readSpec } from '../spec/machine-block.js';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { type Finding, outcome, type Unknown } from '../ts/outcome.js';
import { lineOf, parseFile, ts } from '../ts/program.js';
import { HINTS } from '../text/hints.js';
import { absolute, type Case, firstMessageLine, reached, runVitest, unresolved, VITEST_CONFIG } from '../vitest/census.js';

/** What `spec-tests` needs from the packet (05 §2); the `--packet` wave (W4) fills it. */
export interface PacketView {
  kind: 'spec' | 'generate' | 'test' | 'code' | 'fix' | 'standards';
  /** `observations.unimplemented`: the requirement ids named expected-red. */
  unimplemented: readonly string[];
  /** The pinned spec's bytes (`git show <base>:<spec.path>`, B.21 Inputs). */
  specText: string;
}

const TAG = /^R-([1-9][0-9]*): /;

/** The derived acceptance file of `specId` at the candidate (04 §4, D-054), or the module-less fallback path. */
export function acceptanceFile(ctx: RunContext, specId: string): string {
  const name = `${specId.toLowerCase()}.acceptance.spec.ts`;
  return ctx.listing.entries.map((e) => e.path).find((p) => /^domain\/[^/]+\/api\/test\/acceptance\/[^/]+$/.test(p) && p.endsWith(`/${name}`)) ?? `domain/<m>/api/test/acceptance/${name}`;
}

interface Ranges { bodies: Map<string, { from: number; to: number }>; hooks: { from: number; to: number }[] }

/** Line ranges of each top-level `it`/`test` body by name, and of every `before*`/`after*` hook (TS AST, as test-integrity parses). */
export function rangesOf(ctx: RunContext, file: string): Ranges {
  const out: Ranges = { bodies: new Map(), hooks: [] };
  const sf = parseFile(ctx.root, file);
  if (!sf) return out;
  const end = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getEnd()).line + 1;
  const callee = (c: ts.CallExpression): string | null => {
    let e: ts.Expression = c.expression;
    while (ts.isPropertyAccessExpression(e)) e = e.expression;
    return ts.isIdentifier(e) ? e.text : null;
  };
  for (const st of sf.statements) {
    if (!ts.isExpressionStatement(st) || !ts.isCallExpression(st.expression)) continue;
    const c = st.expression;
    const name = callee(c);
    const fn = c.arguments.find((a) => ts.isArrowFunction(a) || ts.isFunctionExpression(a)) as ts.ArrowFunction | ts.FunctionExpression | undefined;
    const title = c.arguments[0];
    if ((name === 'it' || name === 'test') && fn && title && (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))) {
      out.bodies.set(title.text, { from: lineOf(sf, fn.body), to: end(fn.body) });
    }
  }
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && /^(before|after)(All|Each)$/.test(n.expression.text)) out.hooks.push({ from: lineOf(sf, n), to: end(n) });
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

const setupFailed = (locator: string, message: string): Unknown => ({ reason: 'setup-failed', finding: { locator, message, standard: 'S-67', hint: HINTS['setup-failed'] } });

/** The acceptance-yes requirement ids of the pinned spec, or null when its machine block does not parse. */
function pinned(p: PacketView): { id: string; yes: string[]; all: Set<string> } | null {
  const read = readSpec(p.specText);
  if (read.kind !== 'document') return null;
  const block = MachineBlock.safeParse(read.value);
  if (!block.success) return null;
  return { id: block.data.id, yes: block.data.requirements.filter((r) => r.acceptance === 'yes').map((r) => r.id), all: new Set(block.data.requirements.map((r) => r.id)) };
}

export const specTests: NodeAdapter = {
  id: 'spec-tests',
  contract: 1,
  configFiles: () => [VITEST_CONFIG],
  inputs: (ctx) => ctx.listing.entries.map((e) => e.path).filter((p) => p.endsWith('.acceptance.spec.ts') || /^apps\/[^/]+\/src\//.test(p) || p.startsWith('test/support/') || /^domain\/[^/]+\/api\/src\//.test(p)).sort(),
  async run(ctx): Promise<NodeOutcome> {
    const zero = { expected: 0, observed: 0, evaluated: 0 };
    const packet = ctx.packet;
    if (!packet) throw new Error('spec-tests runs only under --packet'); // planned only with a packet (A.3)
    const spec = pinned(packet);
    if (!spec) return outcome(zero, [], [{ reason: 'io', finding: { locator: 'packet:1', message: 'the pinned spec has no valid machine block', standard: '06 §2', hint: HINTS.io } }]);
    const named = packet.kind === 'test' ? [...packet.unimplemented] : [];
    const file = acceptanceFile(ctx, spec.id);
    const expectedIds = spec.yes;
    const counts = { expected: expectedIds.length, observed: 0, evaluated: 0 };
    const details = (reachedIds: string[], uncovered: string[]) => ({ node: 'spec-tests' as const, expectRed: named, reached: reachedIds, uncovered });
    if (!ctx.listing.entries.some((e) => e.path === file)) {
      return outcome(counts, [{ locator: `${file}:1`, message: `uncovered ${expectedIds.join(', ')}`, standard: 'S-65', hint: `add it('${expectedIds[0] ?? 'R-1'}: …')` }], [], details([], expectedIds));
    }
    if (!ctx.scratch) return outcome(counts, [], [{ reason: 'postgres-unreachable', finding: { locator: 'devai.json:1', message: `postgres-unreachable (${ctx.runtime}): db-apply provided no scratch database`, standard: '02 §6', hint: HINTS['postgres-unreachable'] } }], details([], []));

    const r = await runVitest({ root: ctx.root, tier: 'acceptance', files: [file], env: { DATABASE_URL: ctx.scratch.url, DEVAI_RUNTIME: ctx.runtime } });
    if (r.kind === 'unknown') return outcome(counts, [], [r.unknown], details([], []));
    const m = r.census.modules.get(file);
    // 02 §8: collection error, import failure, beforeAll/beforeEach failure, app or DB setup failure.
    if (!m) return outcome(counts, [], [setupFailed(`${file}:1`, 'not collected: vitest.config.ts did not select the file for TEST_TIER=acceptance')], details([], []));
    if (m.importError) return outcome(counts, [], [setupFailed(`${file}:1`, `collection failed: ${firstMessageLine(m.importError)}`)], details([], []));
    if (m.hookError) return outcome(counts, [], [setupFailed(`${file}:${m.hookError.stacks[0]?.line ?? 1}`, `setup failed: ${firstMessageLine(m.hookError)}`)], details([], []));

    const abs = absolute(ctx.root, file);
    const ranges = rangesOf(ctx, file);
    const inHook = (c: Case) => {
      const top = c.errors[0]?.stacks[0];
      return top !== undefined && top.file === abs && ranges.hooks.some((h) => top.line >= h.from && top.line <= h.to);
    };
    const findings: Finding[] = [];
    const unknowns: Unknown[] = [];
    const seen = new Set<string>();
    const reachedIds: string[] = [];
    for (const c of m.cases) {
      const at = `${file}:${c.line}`;
      const tag = c.top ? TAG.exec(c.name) : null;
      const id = tag ? `R-${tag[1]}` : null;
      if (c.state === undefined) {
        unknowns.push({ reason: 'runner-crashed', finding: { locator: at, message: `${c.fullName}: no result at run end`, standard: 'tests', hint: HINTS['runner-crashed'] } });
        continue;
      }
      if (c.state === 'failed' && inHook(c)) {
        unknowns.push(setupFailed(at, `${c.fullName}: hook failed: ${firstMessageLine(c.errors[0])}`));
        continue;
      }
      if (c.top && !id) findings.push({ locator: at, message: `${c.name} carries no R-n tag`, standard: 'S-63', hint: "name the case it('R-n: …') after its requirement" });
      else if (id && !spec.all.has(id)) {
        findings.push({ locator: at, message: `${id} is not a requirement of ${spec.id}`, standard: 'S-63', hint: 'remove or retag the case' });
        continue;
      } else if (id && seen.has(id)) {
        findings.push({ locator: at, message: `${id} is tagged by more than one case`, standard: 'S-63', hint: 'keep one top-level case per requirement' });
        continue;
      }
      const counted = id !== null && expectedIds.includes(id);
      if (counted) {
        seen.add(id);
        counts.observed++;
      }
      const isNamed = id !== null && named.includes(id);
      const label = id ?? c.fullName;
      if (c.state === 'skipped' || c.state === 'pending') {
        findings.push({ locator: at, message: `${label}: skipped`, standard: 'S-64', hint: 'make it run or delete the case' });
      } else if (c.state === 'passed') {
        if (isNamed) findings.push({ locator: at, message: `${id} expected red but passed`, standard: 'S-67', hint: 'the behaviour exists or the case is vacuous' });
        else if (counted) counts.evaluated++;
      } else if (reached(c, abs, ranges.bodies.get(c.name))) {
        if (counted) counts.evaluated++;
        if (isNamed) reachedIds.push(id);
        else findings.push({ locator: at, message: `${label}: ${firstMessageLine(c.errors[0])}`, standard: 'S-61', hint: 'make the behaviour hold' });
      } else if (isNamed && unresolved(c)) {
        unknowns.push({ reason: 'assertion-unresolved', finding: { locator: at, message: `${id} failure has no AssertionError frame: ${firstMessageLine(c.errors[0])}`, standard: 'S-67', hint: HINTS['assertion-unresolved'] } });
      } else if (isNamed) {
        unknowns.push({ reason: 'expect-red-not-reached', finding: { locator: at, message: `${id} failed before its assertion: ${firstMessageLine(c.errors[0])}`, standard: 'S-67', hint: 'fix the arrange step' } });
      } else {
        findings.push({ locator: at, message: `${label} failed before its assertion: ${firstMessageLine(c.errors[0])}`, standard: 'S-67', hint: 'fix the arrange step' });
      }
    }
    const uncovered = expectedIds.filter((x) => !seen.has(x));
    if (uncovered.length > 0) findings.unshift({ locator: `${file}:1`, message: `uncovered ${uncovered.join(', ')}`, standard: 'S-65', hint: `add it('${uncovered[0]}: …')` });
    return outcome(counts, findings, unknowns, details(reachedIds, uncovered));
  },
};
