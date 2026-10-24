// 08 B.12 `test-integrity`: the changed test files at the candidate against their `base:` blobs, with
// the TypeScript library (parse only). Four rules: `.skip/.only/.todo` without an issue reference;
// literal verdicts; the assertion count against base; acceptance-file changes and the `R-n` cases of
// `acceptance: yes` requirements. Without `--packet` the base is `HEAD` (A.3's edit-loop base).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { diffNameStatus, show } from '../git/git.js';
import type { NodeAdapter, RunContext } from '../runner/run.js';
import { type Finding, outcome, type Unknown } from '../ts/outcome.js';
import { lineOf, literal, NOT_LITERAL, parse, ts, walk } from '../ts/program.js';
import { specById } from '../ts/spec.js';

export const TEST_PATH = /^(test\/|apps\/[^/]+\/test\/|domain\/[^/]+\/(api|web)\/test\/)/;
const ISSUE = /#\d+|\b[A-Z]+-\d+\b|https?:\/\/\S+/;
const ANNOTATION = /\/\/\s*@acceptance-change:\s*approved-by=\S+/;
const ACCEPTANCE = /\.acceptance\.spec\.ts$/;

export interface Facts {
  /** `.skip/.only/.todo` calls: `it.skip`, line, whether an issue reference is present. */
  focus: { what: string; line: number; referenced: boolean }[];
  /** Literal verdicts: source text and line. */
  literals: { text: string; line: number }[];
  /** `expect(` plus `assert.` call expressions. */
  assertions: number;
  /** `R-n` ids of `it('R-n: …')` cases, with the line. */
  cases: Map<string, number>;
  annotated: boolean;
}

const BASES = ['it', 'describe', 'test'];

/** The facts the four rules read, from one file's text. */
export function factsOf(path: string, text: string): Facts {
  const sf = parse(path, text);
  const lines = text.split('\n');
  const f: Facts = { focus: [], literals: [], assertions: 0, cases: new Map(), annotated: ANNOTATION.test(text) };
  walk(sf, (n) => {
    if (ts.isPropertyAssignment(n) && (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) && n.name.text === 'status' && literal(n.initializer) === 'passed') {
      f.literals.push({ text: n.getText(sf), line: lineOf(sf, n) });
    }
    if (!ts.isCallExpression(n)) return;
    const callee = n.expression;
    if (ts.isIdentifier(callee) && callee.text === 'expect') f.assertions++;
    if (ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && callee.expression.text === 'assert') f.assertions++;
    // it.skip(...) / describe.only(...) / test.todo(...), also it.skip.each(...)(...) through the inner call.
    if (ts.isPropertyAccessExpression(callee) && ['skip', 'only', 'todo'].includes(callee.name.text) && ts.isIdentifier(callee.expression) && BASES.includes(callee.expression.text)) {
      const line = lineOf(sf, n);
      const argsText = n.arguments.map((a) => a.getText(sf)).join(' ');
      const trailing = lines[sf.getLineAndCharacterOfPosition(n.getEnd()).line] ?? '';
      const comment = trailing.slice(trailing.indexOf('//') >= 0 ? trailing.indexOf('//') : trailing.length);
      f.focus.push({ what: `${callee.expression.text}.${callee.name.text}`, line, referenced: ISSUE.test(argsText) || ISSUE.test(comment) });
    }
    // expect(<literal>).toBe(<same literal>)
    if (ts.isPropertyAccessExpression(callee) && callee.name.text === 'toBe' && n.arguments.length === 1) {
      const inner = callee.expression;
      if (ts.isCallExpression(inner) && ts.isIdentifier(inner.expression) && inner.expression.text === 'expect' && inner.arguments.length === 1) {
        const a = literal(inner.arguments[0]!);
        const b = literal(n.arguments[0]!);
        if (a !== NOT_LITERAL && b !== NOT_LITERAL && JSON.stringify(a) === JSON.stringify(b)) f.literals.push({ text: n.getText(sf), line: lineOf(sf, n) });
      }
    }
    // it('R-n: …', …)
    if (ts.isIdentifier(callee) && (callee.text === 'it' || callee.text === 'test') && n.arguments[0]) {
      const t = literal(n.arguments[0]);
      const m = typeof t === 'string' ? /^(R-[1-9][0-9]*):/.exec(t) : null;
      if (m && !f.cases.has(m[1]!)) f.cases.set(m[1]!, lineOf(sf, n));
    }
  });
  return f;
}

const isTs = (p: string): boolean => /\.(ts|mts|cts)$/.test(p);

/** The changed test paths (B.1 population) with their status against the base. */
async function changedTests(ctx: RunContext): Promise<{ path: string; status: 'A' | 'M' | 'D' | '?' }[]> {
  const base = ctx.base ?? 'HEAD';
  const present = new Set(ctx.listing.entries.map((e) => e.path));
  let diff: Map<string, string> | null;
  try {
    diff = new Map((await diffNameStatus(ctx.root, { from: base })).map((d) => [d.path, d.status]));
  } catch {
    diff = null; // the base is not readable: every file is `base-unreadable`
  }
  return (ctx.inventory?.changed ?? []).filter((p) => TEST_PATH.test(p)).map((path) => {
    const s = diff?.get(path);
    const status = diff === null ? '?' : !present.has(path) ? 'D' : s === 'M' || s === 'T' ? 'M' : s === 'D' ? 'D' : 'A';
    return { path, status };
  });
}

export const testIntegrity: NodeAdapter = {
  id: 'test-integrity',
  contract: 1,
  configFiles: () => [],
  inputs: (ctx) => {
    const paths = ctx.listing.entries.map((e) => e.path);
    return [...(ctx.inventory?.changed ?? []).filter((p) => TEST_PATH.test(p)), ...paths.filter((p) => /^specs\/.+\.md$/.test(p))].sort();
  },
  async run(ctx) {
    const base = ctx.base ?? 'HEAD';
    const files = await changedTests(ctx);
    const paths = ctx.listing.entries.map((e) => e.path);
    const findings: Finding[] = [];
    const unknown: Unknown[] = [];
    let observed = 0;
    for (const { path, status } of files) {
      let head: string | null = null;
      if (status !== 'D') {
        try {
          head = readFileSync(resolve(ctx.root, path), 'utf8');
        } catch {
          unknown.push({ reason: 'io', finding: { locator: `${path}:1`, message: 'not readable', standard: 'S-64', hint: 'make the path readable (permissions, broken or escaping symlink), then re-run' } });
          continue;
        }
      }
      let baseText: string | null = null;
      if (status !== 'A') {
        const blob = status === '?' ? null : await show(ctx.root, base, path);
        if (blob === null) {
          unknown.push({ reason: 'base-unreadable', finding: { locator: `${path}:1`, message: `${base}:${path} not readable`, standard: 'S-64', hint: 'git fetch origin, then re-run' } });
          continue;
        }
        baseText = blob.toString('utf8');
      }
      observed++;
      if (!isTs(path)) continue;
      const h = head === null ? null : factsOf(path, head);
      const b = baseText === null ? null : factsOf(path, baseText);
      // Rule 1: .skip/.only/.todo without an issue reference.
      for (const x of h?.focus ?? []) if (!x.referenced) findings.push({ locator: `${path}:${x.line}`, message: `${x.what} without issue reference`, standard: 'S-64', hint: 'link the issue or delete the case' });
      // Rule 2: literal verdicts.
      for (const x of h?.literals ?? []) findings.push({ locator: `${path}:${x.line}`, message: `literal verdict ${x.text}`, standard: 'S-64', hint: 'assert on observed behaviour, never on a literal' });
      // Rule 3: assertion count at head < 80 % of base, unless annotated.
      const before = b?.assertions ?? 0;
      const after = h?.assertions ?? 0;
      if (b && before > 0 && after < 0.8 * before && !h?.annotated) {
        findings.push({ locator: `${path}:1`, message: `assertions ${before} → ${after} (−${Math.round(((before - after) / before) * 100)} %)`, standard: 'S-64', hint: 'add // @acceptance-change: approved-by=<pilot> in a test packet' });
      }
      // Rule 4: acceptance files.
      if (ACCEPTANCE.test(path) && b) {
        if (!h?.annotated) findings.push({ locator: `${path}:1`, message: 'acceptance file changed without @acceptance-change', standard: 'S-63', hint: 'add the annotation in a test packet' });
        // `acceptance file edited by a code packet` needs the packet kind: it arrives with --packet (R6 W4).
        const specId = /([a-z0-9-]+)\.acceptance\.spec\.ts$/.exec(path)![1]!.toUpperCase();
        const spec = specById(ctx.root, paths, specId);
        const yes = new Set((spec?.requirements ?? []).filter((r) => r.acceptance === 'yes').map((r) => r.id));
        for (const [id, line] of b.cases) {
          if (yes.has(id) && !h?.cases.has(id)) findings.push({ locator: `${path}:${h ? 1 : line}`, message: `it('${id}: …') removed for an acceptance: yes requirement`, standard: 'S-63', hint: `restore the ${id} case; a test packet owns it` });
        }
      }
    }
    return outcome({ expected: files.length, observed, evaluated: observed }, findings, unknown);
  },
};
