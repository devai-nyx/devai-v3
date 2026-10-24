// The in-process TypeScript 6.0.3 library (07 §2, D-057, D-058): it parses, it does not type-check
// (only `typecheck` type-checks, through the `tsc` binary). Five consumers (08 Part B preamble):
// `inventory` (mount census, `tsc -b` project closure), `route-contract`, `sql-typed` static,
// `test-integrity` and, in W5, `permissions-pattern`.
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import ts from 'typescript';

export { ts };

const toPosix = (p: string): string => p.split('\\').join('/');
/** `abs` relative to `root`, POSIX separators. */
export const rel = (root: string, abs: string): string => toPosix(relative(root, abs));

/** One file parsed with the TypeScript parser (no program, no type checker). */
export function parse(path: string, text: string): ts.SourceFile {
  const kind = path.endsWith('.mts') || path.endsWith('.cts') ? ts.ScriptKind.TS : path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(path, text, ts.ScriptTarget.ES2022, true, kind);
}

/** `parse` from the working tree; null when the file cannot be read. */
export function parseFile(root: string, path: string): ts.SourceFile | null {
  try {
    return parse(path, readFileSync(resolve(root, path), 'utf8'));
  } catch {
    return null;
  }
}

/** 1-based line of a node. */
export const lineOf = (sf: ts.SourceFile, node: ts.Node): number => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;

/** Every node of `sf`, depth first. */
export function walk(sf: ts.Node, visit: (n: ts.Node) => void): void {
  const go = (n: ts.Node): void => {
    visit(n);
    n.forEachChild(go);
  };
  go(sf);
}

// ---- literal extraction ----------------------------------------------------------------------

/** Returned by `literal` when an expression is not statically readable (08 B.9 `not statically readable`). */
export const NOT_LITERAL: unique symbol = Symbol('not-literal');
export type Literal = string | number | boolean | null | Literal[] | { [k: string]: Literal };

/**
 * The value of a literal expression: strings (incl. templates without substitutions), numbers (with a
 * leading `-`), booleans, `null`, arrays and object literals of those with plain keys; `as const`,
 * `satisfies` and parentheses are looked through. Anything else is `NOT_LITERAL`.
 */
export function literal(e: ts.Expression): Literal | typeof NOT_LITERAL {
  if (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) return literal(e.expression);
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
  if (ts.isNumericLiteral(e)) return Number(e.text);
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(e.operand)) return -Number(e.operand.text);
  if (e.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (e.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (e.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(e)) {
    const out: Literal[] = [];
    for (const el of e.elements) {
      if (ts.isSpreadElement(el)) return NOT_LITERAL;
      const v = literal(el);
      if (v === NOT_LITERAL) return NOT_LITERAL;
      out.push(v);
    }
    return out;
  }
  if (ts.isObjectLiteralExpression(e)) {
    const out: Record<string, Literal> = {};
    for (const p of e.properties) {
      if (!ts.isPropertyAssignment(p)) return NOT_LITERAL;
      const key = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) || ts.isNumericLiteral(p.name) ? p.name.text : null;
      if (key === null) return NOT_LITERAL;
      const v = literal(p.initializer);
      if (v === NOT_LITERAL) return NOT_LITERAL;
      out[key] = v;
    }
    return out;
  }
  return NOT_LITERAL;
}

// ---- decorators and calls ----------------------------------------------------------------------

export interface Decorator {
  /** The decorator's identifier (`Slo` for `@Slo({...})`, `X` for `@ns.X()`). */
  name: string;
  /** Arguments when the decorator is a call, else null (`@Foo`). */
  args: readonly ts.Expression[] | null;
  node: ts.Decorator;
}

const calleeName = (e: ts.Expression): string | null =>
  ts.isIdentifier(e) ? e.text : ts.isPropertyAccessExpression(e) ? e.name.text : null;

export function decoratorsOf(node: ts.Node): Decorator[] {
  if (!ts.canHaveDecorators(node)) return [];
  return (ts.getDecorators(node) ?? []).flatMap((d): Decorator[] => {
    const e = d.expression;
    if (ts.isCallExpression(e)) {
      const name = calleeName(e.expression);
      return name ? [{ name, args: e.arguments, node: d }] : [];
    }
    const name = calleeName(e);
    return name ? [{ name, args: null, node: d }] : [];
  });
}

/** Call expressions whose callee is `name` or `<x>.name`. */
export function callsNamed(root: ts.Node, name: string): ts.CallExpression[] {
  const out: ts.CallExpression[] = [];
  walk(root, (n) => {
    if (ts.isCallExpression(n) && calleeName(n.expression) === name) out.push(n);
  });
  return out;
}

/** Named imports of a file: local name → module specifier. */
export function importsOf(sf: ts.SourceFile): Map<string, string> {
  const out = new Map<string, string>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const from = st.moduleSpecifier.text;
    const clause = st.importClause;
    if (!clause) continue;
    if (clause.name) out.set(clause.name.text, from);
    const nb = clause.namedBindings;
    if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) out.set(el.name.text, from);
    if (nb && ts.isNamespaceImport(nb)) out.set(nb.name.text, from);
  }
  return out;
}

/** Re-exports of a barrel: exported name → module specifier (`export { X } from './x.js'`, `export * from`). */
export function reExportsOf(sf: ts.SourceFile): { named: Map<string, string>; star: string[] } {
  const named = new Map<string, string>();
  const star: string[] = [];
  for (const st of sf.statements) {
    if (!ts.isExportDeclaration(st) || !st.moduleSpecifier || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const from = st.moduleSpecifier.text;
    if (!st.exportClause) star.push(from);
    else if (ts.isNamedExports(st.exportClause)) for (const el of st.exportClause.elements) named.set(el.name.text, from);
  }
  return { named, star };
}

/** The class declaration named `name` in `sf`. */
export const classNamed = (sf: ts.SourceFile, name: string): ts.ClassDeclaration | undefined =>
  sf.statements.find((s): s is ts.ClassDeclaration => ts.isClassDeclaration(s) && s.name?.text === name);

/**
 * A relative specifier resolved to a source file in the listing: `./x.js` → `x.ts`, `./x` → `x.ts` or
 * `x/index.ts` (the NodeNext convention of emitted `.js` specifiers for `.ts` sources).
 */
export function resolveRelative(fromFile: string, spec: string, exists: (p: string) => boolean): string | null {
  const base = toPosix(resolve('/', dirname(fromFile), spec)).slice(1);
  const stem = base.replace(/\.(m|c)?js$/, '');
  for (const c of [`${stem}.ts`, `${stem}.mts`, `${stem}.cts`, base, `${stem}/index.ts`]) if (exists(c)) return c;
  return null;
}

// ---- tsconfig projects ------------------------------------------------------------------------

export interface Project {
  /** Repo-relative tsconfig path. */
  tsconfig: string;
  options: ts.CompilerOptions;
  /** Repo-relative root files of the project. */
  files: string[];
  /** Repo-relative tsconfig paths of the project's `references`. */
  references: string[];
  /** Repo-relative path of the project's `.tsbuildinfo`, or null when it emits none. */
  buildInfo: string | null;
  /** Config errors, first line each. */
  errors: string[];
}

const host = (root: string): ts.ParseConfigFileHost => ({
  ...ts.sys,
  getCurrentDirectory: () => root,
  onUnRecoverableConfigFileDiagnostic: () => undefined,
});

const flatten = (d: ts.Diagnostic): string => ts.flattenDiagnosticMessageText(d.messageText, '\n').split('\n')[0]!;

/** The effective configuration of one tsconfig (what `tsc --showConfig -p` prints), parsed in process. */
export function loadProject(root: string, tsconfig: string): Project {
  const abs = resolve(root, tsconfig);
  const parsed = ts.getParsedCommandLineOfConfigFile(abs, undefined, host(root));
  if (!parsed) return { tsconfig, options: {}, files: [], references: [], buildInfo: null, errors: [`${tsconfig}: unreadable`] };
  const refs = (parsed.projectReferences ?? []).map((r) => {
    const p = ts.resolveProjectReferencePath(r);
    return rel(root, p);
  });
  const bi = ts.getTsBuildInfoEmitOutputFilePath(parsed.options);
  return {
    tsconfig,
    options: parsed.options,
    files: parsed.fileNames.map((f) => rel(root, f)),
    references: refs,
    buildInfo: bi ? rel(root, bi) : null,
    errors: parsed.errors.map(flatten),
  };
}

/** `tsc -b` closure of `start`: the projects and every project they reference, transitively, sorted. */
export function projectClosure(root: string, start: readonly string[], cache = new Map<string, Project>()): Project[] {
  const load = (t: string): Project => {
    let p = cache.get(t);
    if (!p) cache.set(t, (p = loadProject(root, t)));
    return p;
  };
  const seen = new Map<string, Project>();
  const queue = [...start];
  while (queue.length > 0) {
    const t = queue.shift()!;
    if (seen.has(t)) continue;
    const p = load(t);
    seen.set(t, p);
    queue.push(...p.references);
  }
  return [...seen.values()].sort((a, b) => (a.tsconfig < b.tsconfig ? -1 : a.tsconfig > b.tsconfig ? 1 : 0));
}

/**
 * The affected projects of a change (B.1 "the project closure (`tsc -b` references) of each changed
 * file"): every project among `projects` whose root files contain a changed path or whose folder
 * holds a changed `tsconfig*.json`, closed over `references`.
 */
export function affectedClosure(root: string, projects: readonly string[], changed: readonly string[]): Project[] {
  const cache = new Map<string, Project>();
  const changedSet = new Set(changed);
  const hit = projects.filter((t) => {
    let own = cache.get(t);
    if (!own) cache.set(t, (own = loadProject(root, t)));
    const dir = dirname(t) === '.' ? '' : `${dirname(t)}/`;
    return own.files.some((f) => changedSet.has(f)) || changed.some((c) => c.startsWith(dir) && /(^|\/)tsconfig[^/]*\.json$/.test(c) && !c.slice(dir.length).includes('/'));
  });
  return projectClosure(root, hit, cache);
}
