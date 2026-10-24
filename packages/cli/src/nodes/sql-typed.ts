// 08 B.10 `sql-typed`, static phase (R6 W2; the DB phase is W3): the TypeScript library over each
// `defineQuery({...})` site of the changed repositories. Checks: `text` is a `sql` tagged template
// with zero expressions; `$n` contiguous from 1 and as many as `z.tuple([...])` elements; `name`
// unique workspace-wide (every `*.repository.ts` is read); in a generated module, each parameter's
// zod bounds equal the spec's `data` bounds (UTF-16 units, D-054).
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { sha256 } from '../candidate/digest.js';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { type Finding, outcome } from '../ts/outcome.js';
import { callsNamed, lineOf, literal, NOT_LITERAL, parseFile, ts } from '../ts/program.js';
import { column, type Spec, specById, type SpecColumn } from '../ts/spec.js';

export interface QuerySite {
  path: string;
  line: number;
  name: string | null;
  /** The cooked SQL text, or null when `text` is not a `sql` template without expressions. */
  text: string | null;
  /** The `z.tuple([...])` element expressions, or null when `params` is not a tuple literal. */
  params: ts.Expression[] | null;
  sf: ts.SourceFile;
}

const prop = (o: ts.ObjectLiteralExpression, key: string): ts.Expression | undefined => {
  const p = o.properties.find((x): x is ts.PropertyAssignment => ts.isPropertyAssignment(x) && (ts.isIdentifier(x.name) || ts.isStringLiteral(x.name)) && x.name.text === key);
  return p?.initializer;
};

/** Every `defineQuery({...})` site of one file. */
export function querySites(root: string, path: string): QuerySite[] | null {
  const sf = parseFile(root, path);
  if (!sf) return null;
  return callsNamed(sf, 'defineQuery').map((call): QuerySite => {
    const arg = call.arguments[0];
    const o = arg && ts.isObjectLiteralExpression(arg) ? arg : null;
    const nameE = o ? prop(o, 'name') : undefined;
    const nameV = nameE ? literal(nameE) : NOT_LITERAL;
    const textE = o ? prop(o, 'text') : undefined;
    const text = textE && ts.isTaggedTemplateExpression(textE) && ts.isIdentifier(textE.tag) && textE.tag.text === 'sql' && ts.isNoSubstitutionTemplateLiteral(textE.template) ? textE.template.text : null;
    const paramsE = o ? prop(o, 'params') : undefined;
    let params: ts.Expression[] | null = null;
    if (paramsE && ts.isCallExpression(paramsE) && ts.isPropertyAccessExpression(paramsE.expression) && paramsE.expression.name.text === 'tuple') {
      const a = paramsE.arguments[0];
      if (a && ts.isArrayLiteralExpression(a) && !a.elements.some(ts.isSpreadElement)) params = [...a.elements];
    }
    return { path, line: lineOf(sf, call), name: typeof nameV === 'string' ? nameV : null, text, params, sf };
  });
}

/** The method calls of a zod chain, outermost last: `z.string().min(1).max(80)` → string, min(1), max(80). */
export function zodChain(e: ts.Expression): { method: string; args: (number | string | null)[] }[] {
  const out: { method: string; args: (number | string | null)[] }[] = [];
  let cur: ts.Expression = e;
  while (ts.isCallExpression(cur) && ts.isPropertyAccessExpression(cur.expression)) {
    out.unshift({
      method: cur.expression.name.text,
      args: cur.arguments.map((a) => {
        const v = literal(a);
        return typeof v === 'number' || typeof v === 'string' ? v : null;
      }),
    });
    cur = cur.expression.expression;
  }
  return out;
}

const LIMIT_HINT = "keep the zod bound within the column's limits; in a generated module, equal to the spec's data bound";

/** Spec-bound comparison of one parameter (generated modules; 06 §2 Limits by type). */
function limitFindings(site: QuerySite, i: number, e: ts.Expression, ref: string, col: SpecColumn): Finding[] {
  const chain = zodChain(e);
  const text = e.getText(site.sf);
  const arg = (m: string): number | string | null | undefined => chain.find((c) => c.method === m)?.args[0];
  const want: [string, string, unknown][] =
    col.type === 'varchar' ? [['min', 'minLength', col.limits['minLength']], ['max', 'maxLength', col.limits['maxLength']]]
      : col.type === 'integer' ? [['min', 'minimum', col.limits['minimum']], ['max', 'maximum', col.limits['maximum']]]
        : [];
  const out: Finding[] = [];
  const at = `${site.path}:${site.line}`;
  for (const [m, key, v] of want) {
    if (arg(m) !== v) out.push({ locator: at, message: `param $${i + 1} ${text} ≠ spec limit ${ref} ${key} ${String(v)}`, standard: 'S-27', hint: LIMIT_HINT });
  }
  if (col.type === 'uuid' && !chain.some((c) => c.method === 'uuid')) out.push({ locator: at, message: `param $${i + 1} ${text} ≠ spec limit ${ref} format uuid`, standard: 'S-27', hint: LIMIT_HINT });
  return out;
}

/** The spec of a generated module (its `generation-manifest.json` names it), cached per module. */
function generatedSpec(ctx: RunContext, path: string, cache: Map<string, Spec | null>): Spec | null {
  const m = /^domain\/([^/]+)\//.exec(path);
  if (!m) return null;
  if (cache.has(m[1]!)) return cache.get(m[1]!)!;
  const manifest = `domain/${m[1]}/generation-manifest.json`;
  let spec: Spec | null = null;
  if (existsSync(resolve(ctx.root, manifest))) {
    try {
      const id = (JSON.parse(readFileSync(resolve(ctx.root, manifest), 'utf8')) as { specId?: unknown }).specId;
      if (typeof id === 'string') spec = specById(ctx.root, ctx.listing.entries.map((e) => e.path), id);
    } catch {
      spec = null;
    }
  }
  cache.set(m[1]!, spec);
  return spec;
}

const repositories = (ctx: RunContext): string[] => ctx.listing.entries.map((e) => e.path).filter((p) => p.endsWith('.repository.ts'));
const changedRepositories = (ctx: RunContext): string[] => {
  const present = new Set(ctx.listing.entries.map((e) => e.path));
  return (ctx.inventory?.changed ?? []).filter((p) => p.endsWith('.repository.ts') && present.has(p));
};

export const sqlTyped: NodeAdapter = {
  id: 'sql-typed',
  contract: 1,
  configFiles: () => [],
  inputs: (ctx) => {
    const paths = ctx.listing.entries.map((e) => e.path);
    return [...repositories(ctx), ...paths.filter((p) => /^domain\/[^/]+\/generation-manifest\.json$/.test(p) || /^specs\/.+\.md$/.test(p))].sort();
  },
  async run(ctx): Promise<NodeOutcome> {
    if (ctx.plan.sqlTypedPhase === 'db') throw new Error('sql-typed DB phase arrives in R6 W3'); // the runner reports runner-crashed
    const changed = changedRepositories(ctx);
    const findings: Finding[] = [];
    // Name uniqueness sees every repository (08 Part B preamble, rule f).
    const all = new Map<string, QuerySite[]>();
    for (const p of repositories(ctx)) all.set(p, querySites(ctx.root, p) ?? []);
    const firstByName = new Map<string, QuerySite>();
    for (const p of [...all.keys()].sort()) for (const s of all.get(p)!) if (s.name !== null && !firstByName.has(s.name)) firstByName.set(s.name, s);

    const specs = new Map<string, Spec | null>();
    const queries: { name: string; path: string; textSha256: string }[] = [];
    let expected = 0;
    let observed = 0;
    let evaluated = 0;
    for (const path of changed) {
      const sites = all.get(path) ?? null;
      if (sites === null) continue;
      expected += sites.length;
      for (const s of sites) {
        observed++;
        const at = `${s.path}:${s.line}`;
        if (s.name === null) {
          findings.push({ locator: at, message: 'defineQuery name is not statically readable', standard: 'S-21', hint: 'write name as a string literal' });
          continue;
        }
        evaluated++;
        if (s.text === null) findings.push({ locator: at, message: `${s.name} text is not a sql template without expressions`, standard: 'S-21', hint: 'write the SQL as one sql`…` literal with $n parameters' });
        else queries.push({ name: s.name, path: s.path, textSha256: sha256(s.text) });
        const ns = s.text === null ? [] : [...new Set([...s.text.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])))].sort((a, b) => a - b);
        const max = ns.length > 0 ? ns[ns.length - 1]! : 0;
        for (let k = 1; k <= max; k++) if (!ns.includes(k)) findings.push({ locator: at, message: `$${k} missing: parameters must be contiguous from $1`, standard: 'S-21', hint: 'number the parameters $1…$n without gaps' });
        if (s.params === null) findings.push({ locator: at, message: `${s.name} params is not a z.tuple([...]) literal`, standard: 'S-21', hint: 'declare params as z.tuple([...]), one schema per $n' });
        else if (s.text !== null && max !== s.params.length) findings.push({ locator: at, message: `$${max} declared but tuple has ${s.params.length} params`, standard: 'S-21', hint: 'make z.tuple([...]) list one schema per $n' });
        const first = firstByName.get(s.name)!;
        if (first !== s) findings.push({ locator: at, message: `name ${s.name} duplicates ${first.path}:${first.line}`, standard: 'S-21', hint: 'rename one query' });
        else {
          const later = [...all.values()].flat().find((o) => o !== s && o.name === s.name);
          if (later) findings.push({ locator: at, message: `name ${s.name} duplicates ${later.path}:${later.line}`, standard: 'S-21', hint: 'rename one query' });
        }
        const spec = generatedSpec(ctx, s.path, specs);
        const sq = spec?.queries.find((q) => q.name === s.name);
        if (spec && sq && s.params) {
          sq.params.forEach((ref, i) => {
            const col = column(spec, ref);
            const e = s.params![i];
            if (col && e) findings.push(...limitFindings(s, i, e, ref, col));
          });
        }
      }
    }
    return outcome({ expected, observed, evaluated }, findings, [], { node: 'sql-typed', phase: 'static', queries });
  },
};
