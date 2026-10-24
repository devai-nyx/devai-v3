// 08 B.24 Inputs / 02 §4 "Slice location": mounted routes → global (`APP_GUARD`) and route
// (`@UseGuards`) guards → their predicates and principal construction → transitive calls, including
// `@stynx-nyx/*` package files resolved through their `exports` (`src/**` when shipped, else
// `dist/**.js`). The smaller reading implemented here (PR `## Open`): "transitive calls through concrete
// DI bindings" is the static import closure of every guard file, followed through relative imports,
// workspace packages and `@stynx-nyx/*` packages; other installed packages are not followed. A guard
// that is not a static identifier, or a census element the walk could not follow, is
// `mount-unresolved`; a guard or a relative import with no source is `missing-source`. Both come before
// any model call (02 §4).
import { existsSync, readFileSync } from 'node:fs';
import { posix, resolve } from 'node:path';
import { sha256 } from '../candidate/digest.js';
import { frameList } from '../cache/key.js';
import type { RunContext } from '../runner/run.js';
import { classNamed, decoratorsOf, importsOf, type Decorator, lineOf, literal, parseFile, resolveRelative, ts, walk } from '../ts/program.js';

export interface Entrypoint {
  /** `Controller.handler`, the id the sensor echoes in `inspectedEntrypoints`. */
  id: string;
  /** `GET /notes/:id`. */
  route: string;
  /** `<file>:<line>` of the handler. */
  locator: string;
}

export interface SliceFile { path: string; text: string }
export interface SliceGap { locator: string; message: string }

export interface Slice {
  /** Mounted protected routes (B.24 `expected`). */
  entrypoints: Entrypoint[];
  files: SliceFile[];
  /** sha256 over the framed `<path>:<content sha256>` list, sorted by path. */
  digest: string;
  unresolved: SliceGap[];
  missing: SliceGap[];
}

const HTTP = ['Get', 'Post', 'Put', 'Patch', 'Delete', 'Options', 'Head', 'All'];
const STYNX = /^@stynx-nyx\/[^/]+/;

const str = (d: Decorator | undefined, i = 0): string => {
  const a = d?.args?.[i];
  const v = a ? literal(a) : '';
  return typeof v === 'string' ? v : '';
};
const joinRoute = (prefix: string, path: string): string => ('/' + [prefix, path].filter((x) => x !== '').join('/')).replace(/\/+/g, '/').replace(/(.)\/$/, '$1');

/** Workspace package name → folder (B.1's package folders). */
function workspacePackages(root: string, dirs: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const d of dirs) {
    try {
      const name = (JSON.parse(readFileSync(resolve(root, d, 'package.json'), 'utf8')) as { name?: unknown }).name;
      if (typeof name === 'string') out.set(name, d);
    } catch {
      // a folder without a readable manifest is inventory's finding
    }
  }
  return out;
}

const exportTarget = (v: unknown): string | null => {
  if (typeof v === 'string') return v;
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['import', 'node', 'default', 'require']) {
      const t = exportTarget(o[k]);
      if (t) return t;
    }
  }
  return null;
};

/** `@stynx-nyx/<pkg>[/sub]` → its entry file (repo-relative), `src/**` when shipped, else the `dist/**.js` export. */
function stynxEntry(root: string, spec: string, exists: (p: string) => boolean): string | null {
  const name = STYNX.exec(spec)![0];
  const dir = `node_modules/${name}`;
  let manifest: { exports?: unknown; main?: unknown };
  try {
    manifest = JSON.parse(readFileSync(resolve(root, dir, 'package.json'), 'utf8')) as typeof manifest;
  } catch {
    return null;
  }
  const sub = '.' + spec.slice(name.length);
  const exp = manifest.exports;
  const target = exp && typeof exp === 'object' && !Array.isArray(exp) && Object.keys(exp).some((k) => k.startsWith('.'))
    ? exportTarget((exp as Record<string, unknown>)[sub])
    : sub === '.' ? exportTarget(exp) ?? (typeof manifest.main === 'string' ? manifest.main : null) : null;
  if (!target) return null;
  const dist = posix.normalize(`${dir}/${target}`);
  const src = dist.replace(`${dir}/dist/`, `${dir}/src/`).replace(/\.(m|c)?js$/, '.ts');
  if (src !== dist && exists(src)) return src;
  return exists(dist) ? dist : null;
}

export function permissionSlice(ctx: RunContext): Slice {
  const root = ctx.root;
  const census = ctx.inventory?.mounts ?? { apps: [], controllers: [], read: [], unresolved: [] };
  const listed = new Set(ctx.listing.entries.map((e) => e.path));
  const exists = (p: string): boolean => listed.has(p) || (p.startsWith('node_modules/') && existsSync(resolve(root, p)));
  const packages = workspacePackages(root, ctx.inventory?.packageDirs ?? []);
  const unresolved: SliceGap[] = census.unresolved.map((u) => ({ ...u }));
  const missing: SliceGap[] = [];
  const entrypoints: Entrypoint[] = [];
  const seeds = new Set<string>();
  const guards: { file: string; name: string; locator: string }[] = [];

  const guardArgs = (sf: ts.SourceFile, file: string, d: Decorator) => {
    for (const a of d.args ?? []) {
      if (ts.isIdentifier(a)) guards.push({ file, name: a.text, locator: `${file}:${lineOf(sf, a)}` });
      else unresolved.push({ locator: `${file}:${lineOf(sf, a)}`, message: `guard ${a.getText(sf)} is not a static reference` });
    }
  };

  // Mounted routes and their route guards.
  for (const c of census.controllers) {
    const sf = parseFile(root, c.file);
    const cls = sf ? classNamed(sf, c.name) : undefined;
    if (!sf || !cls) {
      missing.push({ locator: `${c.file}:1`, message: `controller ${c.name} not readable` });
      continue;
    }
    seeds.add(c.file);
    const classDecorators = decoratorsOf(cls);
    const classPublic = classDecorators.some((d) => d.name === 'Public');
    const prefix = str(classDecorators.find((d) => d.name === 'Controller'));
    for (const d of classDecorators.filter((x) => x.name === 'UseGuards')) guardArgs(sf, c.file, d);
    for (const m of cls.members) {
      if (!ts.isMethodDeclaration(m) || !ts.isIdentifier(m.name)) continue;
      const ds = decoratorsOf(m);
      const http = ds.find((d) => HTTP.includes(d.name));
      if (!http) continue;
      for (const d of ds.filter((x) => x.name === 'UseGuards')) guardArgs(sf, c.file, d);
      if (classPublic || ds.some((d) => d.name === 'Public')) continue;
      entrypoints.push({ id: `${c.name}.${m.name.text}`, route: `${http.name.toUpperCase()} ${joinRoute(prefix, str(http))}`, locator: `${c.file}:${lineOf(sf, m)}` });
    }
  }

  // Global guards: `{ provide: APP_GUARD, useClass | useExisting: X }` in the modules the census read.
  for (const file of census.read) {
    const sf = parseFile(root, file);
    if (!sf) continue;
    walk(sf, (n) => {
      if (!ts.isObjectLiteralExpression(n)) return;
      const prop = (k: string) => n.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === k);
      const provide = prop('provide');
      if (!provide || !ts.isIdentifier(provide.initializer) || provide.initializer.text !== 'APP_GUARD') return;
      seeds.add(file);
      const use = prop('useClass') ?? prop('useExisting');
      if (use && ts.isIdentifier(use.initializer)) guards.push({ file, name: use.initializer.text, locator: `${file}:${lineOf(sf, use)}` });
      else unresolved.push({ locator: `${file}:${lineOf(sf, n)}`, message: 'APP_GUARD provider is not a static useClass/useExisting reference' });
    });
  }

  /** A module specifier from `file` → the file it names in the slice's universe, 'external', or null (missing). */
  const resolveSpec = (file: string, spec: string): string | 'external' | null => {
    if (spec.startsWith('.')) {
      if (file.startsWith('node_modules/')) {
        const p = posix.normalize(posix.join(posix.dirname(file), spec));
        for (const c of [p, `${p}.js`, `${p}.ts`, p.replace(/\.js$/, '.ts'), `${p}/index.js`, `${p}/index.ts`]) if (exists(c)) return c;
        return null;
      }
      return resolveRelative(file, spec, exists);
    }
    if (STYNX.test(spec)) return stynxEntry(root, spec, exists) ?? null;
    const pkg = [...packages.entries()].find(([n]) => spec === n || spec.startsWith(`${n}/`));
    if (pkg) {
      const barrel = `${pkg[1]}/src/index.ts`;
      return exists(barrel) ? barrel : null;
    }
    return 'external';
  };

  for (const g of guards) {
    const sf = parseFile(root, g.file);
    if (!sf) continue;
    if (classNamed(sf, g.name)) continue; // declared in a seed file
    const from = importsOf(sf).get(g.name);
    const target = from === undefined ? null : resolveSpec(g.file, from);
    if (target === 'external') missing.push({ locator: g.locator, message: `guard ${g.name} comes from ${from}, whose source the slice does not follow` });
    else if (target === null) missing.push({ locator: g.locator, message: `guard ${g.name} has no source${from ? ` (${from})` : ''}` });
    else seeds.add(target);
  }

  // The import closure (static `import`/`export … from`/`import()` with a literal specifier).
  const files = new Map<string, string>();
  const queue = [...seeds].sort();
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (files.has(file)) continue;
    let text: string;
    try {
      text = readFileSync(resolve(root, file), 'utf8');
    } catch {
      missing.push({ locator: `${file}:1`, message: 'source file not readable' });
      continue;
    }
    files.set(file, text);
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.ES2022, true, file.endsWith('.js') ? ts.ScriptKind.JS : ts.ScriptKind.TS);
    const specs: { spec: string; line: number }[] = [];
    for (const st of sf.statements) {
      if ((ts.isImportDeclaration(st) || ts.isExportDeclaration(st)) && st.moduleSpecifier && ts.isStringLiteral(st.moduleSpecifier)) {
        if (ts.isImportDeclaration(st) && st.importClause?.isTypeOnly) continue;
        specs.push({ spec: st.moduleSpecifier.text, line: lineOf(sf, st) });
      }
    }
    walk(sf, (n) => {
      if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) specs.push({ spec: n.arguments[0].text, line: lineOf(sf, n) });
    });
    for (const { spec, line } of specs) {
      const t = resolveSpec(file, spec);
      if (t === null) missing.push({ locator: `${file}:${line}`, message: `import ${spec} has no source` });
      else if (t !== 'external' && !files.has(t)) queue.push(t);
    }
  }
  const sorted = [...files.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([path, text]) => ({ path, text }));
  return {
    entrypoints: entrypoints.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    files: sorted,
    digest: sha256(frameList(sorted.map((f) => `${f.path}:${sha256(f.text)}`))),
    unresolved,
    missing,
  };
}

/** The `{{slice}}` text: the entrypoints, then each file with numbered lines (locators are `path:line`). */
export function renderSlice(s: Slice): string {
  const head = ['Mounted protected routes (inspectedEntrypoints ids):', ...s.entrypoints.map((e) => `- ${e.id} (${e.route}) ${e.locator}`)];
  const body = s.files.map((f) => [`=== ${f.path}`, ...f.text.replace(/\n$/, '').split('\n').map((l, i) => `${i + 1}: ${l}`)].join('\n'));
  return [head.join('\n'), ...body].join('\n\n');
}

/** Line count of a slice file (a finding's `line` must fall inside it). */
export const linesOf = (text: string): number => text.replace(/\n$/, '').split('\n').length;
