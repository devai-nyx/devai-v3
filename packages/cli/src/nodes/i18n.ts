// 08 B.13 `i18n`: catalog parity over the generator's `domain/<slug>/api/src/<slug>.i18n.<locale>.ts`
// files (09 §2: locale tag lowercased, one `as const` object literal, read statically and never
// executed), keyed by the en-US catalog ∪ the spec's `i18n` keys, across `devai.json` `locales`; plus
// `eslint --format json --max-warnings=0 -- <templates…>` keeping only `@angular-eslint/template/i18n`.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { candidatePaths, type Finding, unknown, type Unknown } from '../proc/tool.js';
import { ESLINT_CONFIG, eslintOutcome } from './lint.js';

const STANDARD = 'S-16';
const CATALOG = /^domain\/([^/]+)\/api\/src\/([^/]+)\.i18n\.([a-z0-9-]+)\.ts$/;
const template = (p: string) => /(^|\/)web\/src\/.*\.html$/.test(p);
const catalogPath = (slug: string, locale: string) => `domain/${slug}/api/src/${slug}.i18n.${locale.toLowerCase()}.ts`;

type Read<T> = { ok: T } | { unknown: Unknown };

function readText(root: string, path: string): Read<string> {
  try {
    return { ok: readFileSync(resolve(root, path), 'utf8') };
  } catch {
    return { unknown: unknown('io', `${path}:1`, 'catalog is not readable', STANDARD) };
  }
}

/** The keys of the catalog's one exported `{ … } as const` object literal with literal keys and string values. */
export function catalogKeys(path: string, text: string): Read<string[]> {
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.ES2022, false, ts.ScriptKind.TS);
  const unresolved = (why: string, at?: ts.Node): Read<string[]> => {
    const line = at ? sf.getLineAndCharacterOfPosition(at.getStart(sf)).line + 1 : 1;
    return { unknown: unknown('catalog-unresolved', `${path}:${line}`, `catalog not statically readable: ${why}`, STANDARD) };
  };
  const objects: ts.ObjectLiteralExpression[] = [];
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st) || !st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const d of st.declarationList.declarations) {
      const init = d.initializer;
      if (init && ts.isAsExpression(init) && ts.isTypeReferenceNode(init.type) && ts.isIdentifier(init.type.typeName) && init.type.typeName.text === 'const' && ts.isObjectLiteralExpression(init.expression)) objects.push(init.expression);
    }
  }
  if (objects.length !== 1) return unresolved(`${objects.length} exported as const object literals`);
  const keys: string[] = [];
  for (const p of objects[0]!.properties) {
    if (!ts.isPropertyAssignment(p) || !(ts.isStringLiteral(p.name) || ts.isIdentifier(p.name))) return unresolved('a property without a literal key', p);
    if (!ts.isStringLiteral(p.initializer) && !ts.isNoSubstitutionTemplateLiteral(p.initializer)) return unresolved(`value of ${p.name.text} is not a string literal`, p);
    keys.push(p.name.text);
  }
  return { ok: keys };
}

/** The spec `i18n` keys of the module, from the spec its generation manifest names (`specs/<slug>/<specId>.md`). */
function specKeys(root: string, slug: string, present: ReadonlySet<string>): Read<string[]> & { inputs: string[] } {
  const manifest = `domain/${slug}/generation-manifest.json`;
  if (!present.has(manifest)) return { ok: [], inputs: [] };
  const fail = (path: string, why: string) => ({ unknown: unknown('catalog-unresolved', `${path}:1`, why, STANDARD), inputs: [manifest] });
  const m = readText(root, manifest);
  if ('unknown' in m) return { ...m, inputs: [manifest] };
  let specId: unknown;
  try {
    specId = (JSON.parse(m.ok) as { specId?: unknown }).specId;
  } catch {
    return fail(manifest, 'generation manifest does not parse');
  }
  if (typeof specId !== 'string') return fail(manifest, 'generation manifest names no specId');
  const spec = `specs/${slug}/${specId}.md`;
  const inputs = [manifest, spec];
  const s = present.has(spec) ? readText(root, spec) : null;
  if (s === null) return { ...fail(spec, `spec ${specId} not found`), inputs };
  if ('unknown' in s) return { ...s, inputs };
  const block = /^```yaml\n([\s\S]*?)^```/m.exec(s.ok)?.[1];
  try {
    const i18n = (parseYaml(block ?? '') as { i18n?: unknown } | null)?.i18n;
    if (typeof i18n !== 'object' || i18n === null) return { ...fail(spec, 'spec contract has no i18n map'), inputs };
    return { ok: Object.keys(i18n), inputs };
  } catch {
    return { ...fail(spec, 'spec contract does not parse'), inputs };
  }
}

interface Parity {
  expected: number;
  observed: number;
  findings: Finding[];
  unknowns: Unknown[];
  inputs: string[];
}

/** The catalog half of B.13: one observation per `(key, locale)` pair. */
export function catalogParity(ctx: RunContext): Parity {
  const paths = ctx.listing.entries.map((e) => e.path);
  const present = new Set(paths);
  const slugs = [...new Set(paths.map((p) => CATALOG.exec(p)).filter((m) => m !== null && m[1] === m[2]).map((m) => m![1]!))].sort();
  const out: Parity = { expected: 0, observed: 0, findings: [], unknowns: [], inputs: [] };
  for (const slug of slugs) {
    const enPath = catalogPath(slug, 'en-US');
    out.inputs.push(...ctx.config.locales.map((l) => catalogPath(slug, l)).filter((p) => present.has(p)));
    const spec = specKeys(ctx.root, slug, present);
    out.inputs.push(...spec.inputs);
    if (!present.has(enPath)) {
      out.unknowns.push(unknown('catalog-unresolved', `${enPath}:1`, 'en-US catalog is absent', STANDARD));
      continue;
    }
    const enText = readText(ctx.root, enPath);
    const en = 'ok' in enText ? catalogKeys(enPath, enText.ok) : enText;
    if ('unknown' in en) {
      out.unknowns.push(en.unknown);
      continue;
    }
    if ('unknown' in spec) {
      out.unknowns.push(spec.unknown);
      continue;
    }
    const keys = [...new Set([...en.ok, ...spec.ok])].sort();
    for (const locale of ctx.config.locales) {
      const path = catalogPath(slug, locale);
      out.expected += keys.length;
      let have: Set<string>;
      if (!present.has(path)) have = new Set();
      else {
        const text = readText(ctx.root, path);
        const r = 'ok' in text ? catalogKeys(path, text.ok) : text;
        if ('unknown' in r) {
          out.unknowns.push(r.unknown);
          continue;
        }
        have = new Set(r.ok);
      }
      out.observed += keys.length;
      for (const k of keys) if (!have.has(k)) out.findings.push({ locator: `${path}:1`, message: `missing key ${k}`, standard: STANDARD, hint: `add the ${locale} text` });
    }
  }
  return out;
}

export const i18n: NodeAdapter = {
  id: 'i18n',
  contract: 1,
  configFiles: () => ['devai.json', ESLINT_CONFIG],
  inputs: (ctx) => [...new Set([...catalogParity(ctx).inputs, ...candidatePaths(ctx, template)])].sort(),
  async run(ctx: RunContext): Promise<NodeOutcome> {
    const parity = catalogParity(ctx);
    const r = await eslintOutcome({
      ctx, files: candidatePaths(ctx, template), flags: [], configs: [ESLINT_CONFIG], standard: STANDARD,
      base: { expected: parity.expected, observed: parity.observed, findings: parity.findings },
      finding: (path, m) => m.ruleId === '@angular-eslint/template/i18n'
        ? { locator: `${path}:${m.line ?? 1}:${m.column ?? 1}`, message: `template/i18n: ${m.message}`, standard: STANDARD, hint: 'mark the text i18n' }
        : null,
    });
    if (parity.unknowns.length === 0) return r;
    const unknownFindings = parity.unknowns.map((u) => u.finding);
    // A FAIL and an UNKNOWN cause together are FAIL, keeping every finding (A.3; D-084).
    if (r.status === 'FAIL') return { ...r, findings: [...r.findings, ...unknownFindings] };
    const { status: _status, reason: _reason, ...counts } = r;
    return { ...counts, status: 'UNKNOWN', reason: r.status === 'UNKNOWN' ? r.reason! : parity.unknowns[0]!.reason, findings: [...unknownFindings, ...r.findings] };
  },
};
