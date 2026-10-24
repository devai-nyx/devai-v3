// 02 §2 `inventory` row, 08 B.1 Observation and Part B preamble (D-058): the mounted-route census.
// Each app's root module (`apps/<app>/src/app.module.ts`) is walked through its static `@Module`
// `imports` and `controllers` arrays with the TypeScript parser. Workspace modules are followed (a
// relative import, or a workspace package's `src/index.ts` barrel); modules of installed packages are
// not ours and are not followed. A dynamic module factory, a computed array or an element the walk
// cannot follow inside the workspace is `mount-unresolved` with the element's locator.
import ts from 'typescript';
import { classNamed, decoratorsOf, importsOf, lineOf, parseFile, reExportsOf, resolveRelative } from './program.js';

export interface MountedController {
  app: string;
  /** Repo-relative controller file. */
  file: string;
  name: string;
}

export interface AppRoot {
  app: string;
  /** Repo-relative root module file. */
  file: string;
  /** The root module's `imports` elements: identifier and its import specifier ('' when local). */
  imports: { name: string; from: string; line: number }[];
}

export interface MountCensus {
  apps: AppRoot[];
  controllers: MountedController[];
  /** Module files the walk read (B.1 Inputs). */
  read: string[];
  unresolved: { locator: string; message: string }[];
}

export const ROOT_MODULE = /^apps\/([^/]+)\/src\/app\.module\.ts$/;

interface Ctx {
  root: string;
  exists: (p: string) => boolean;
  /** Workspace package name → folder. */
  packages: ReadonlyMap<string, string>;
  out: MountCensus;
  seen: Set<string>;
}

/** A class `name` referenced from `file`: its declaring file in the workspace, `external`, or null. */
function locateClass(c: Ctx, file: string, sf: ts.SourceFile, name: string): { file: string } | 'external' | null {
  if (classNamed(sf, name)) return { file };
  const from = importsOf(sf).get(name);
  if (from === undefined) return null;
  if (from.startsWith('.')) {
    const target = resolveRelative(file, from, c.exists);
    return target ? followExport(c, target, name, 0) : null;
  }
  const pkg = [...c.packages.entries()].find(([n]) => from === n || from.startsWith(`${n}/`));
  if (!pkg) return 'external';
  const barrel = `${pkg[1]}/src/index.ts`;
  return c.exists(barrel) ? followExport(c, barrel, name, 0) : null;
}

/** Follow `export { X } from` / `export * from` from `file` to the file declaring class `name`. */
function followExport(c: Ctx, file: string, name: string, depth: number): { file: string } | null {
  if (depth > 16) return null;
  const sf = parseFile(c.root, file);
  if (!sf) return null;
  if (classNamed(sf, name)) return { file };
  const { named, star } = reExportsOf(sf);
  for (const spec of named.has(name) ? [named.get(name)!] : star) {
    if (!spec.startsWith('.')) continue;
    const t = resolveRelative(file, spec, c.exists);
    const hit = t ? followExport(c, t, name, depth + 1) : null;
    if (hit) return hit;
  }
  return null;
}

const elementName = (e: ts.Expression): string | null => (ts.isIdentifier(e) ? e.text : null);

function walkModule(c: Ctx, app: string, file: string, name: string, root?: AppRoot): void {
  const seenKey = `${file}#${name}`;
  if (c.seen.has(seenKey)) return;
  c.seen.add(seenKey);
  const sf = parseFile(c.root, file);
  if (!sf) return void c.out.unresolved.push({ locator: `${file}:1`, message: `module file not readable` });
  if (!c.out.read.includes(file)) c.out.read.push(file);
  const cls = classNamed(sf, name);
  const mod = cls ? decoratorsOf(cls).find((d) => d.name === 'Module') : undefined;
  if (!cls || !mod) return void c.out.unresolved.push({ locator: `${file}:1`, message: `@Module class ${name} not found` });
  const arg = mod.args?.[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) {
    return void c.out.unresolved.push({ locator: `${file}:${lineOf(sf, mod.node)}`, message: `@Module argument is not an object literal` });
  }
  for (const prop of arg.properties) {
    if (!ts.isPropertyAssignment(prop) || !ts.isIdentifier(prop.name)) {
      if (ts.isSpreadAssignment(prop)) c.out.unresolved.push({ locator: `${file}:${lineOf(sf, prop)}`, message: '@Module spreads a computed value' });
      continue;
    }
    const key = prop.name.text;
    if (key !== 'imports' && key !== 'controllers') continue;
    if (!ts.isArrayLiteralExpression(prop.initializer)) {
      c.out.unresolved.push({ locator: `${file}:${lineOf(sf, prop)}`, message: `${key} is not a static array` });
      continue;
    }
    for (const el of prop.initializer.elements) {
      const loc = `${file}:${lineOf(sf, el)}`;
      const id = elementName(el);
      if (key === 'imports' && root) {
        const n = id ?? (ts.isCallExpression(el) && ts.isPropertyAccessExpression(el.expression) && ts.isIdentifier(el.expression.expression) ? el.expression.expression.text : null);
        if (n) root.imports.push({ name: n, from: importsOf(sf).get(n) ?? '', line: lineOf(sf, el) });
      }
      if (id === null) {
        // `X.forRoot(...)` of an installed package is not ours; of a workspace module it is a dynamic factory.
        const owner = ts.isCallExpression(el) && ts.isPropertyAccessExpression(el.expression) && ts.isIdentifier(el.expression.expression) ? el.expression.expression.text : null;
        if (owner && locateClass(c, file, sf, owner) === 'external') continue;
        c.out.unresolved.push({ locator: loc, message: `${key} element ${el.getText(sf)} is not a static reference` });
        continue;
      }
      const where = locateClass(c, file, sf, id);
      if (where === 'external') continue;
      if (where === null) {
        c.out.unresolved.push({ locator: loc, message: `${key} element ${id} does not resolve to a workspace class` });
        continue;
      }
      if (key === 'controllers') {
        if (!c.out.controllers.some((m) => m.app === app && m.file === where.file && m.name === id)) c.out.controllers.push({ app, file: where.file, name: id });
      } else walkModule(c, app, where.file, id);
    }
  }
}

/** The census over every `apps/<app>/src/app.module.ts` in `paths`, root class `AppModule`. */
export function mountCensus(root: string, paths: readonly string[], packages: ReadonlyMap<string, string>): MountCensus {
  const present = new Set(paths);
  const out: MountCensus = { apps: [], controllers: [], read: [], unresolved: [] };
  for (const file of paths.filter((p) => ROOT_MODULE.test(p)).sort()) {
    const app = ROOT_MODULE.exec(file)![1]!;
    const appRoot: AppRoot = { app, file, imports: [] };
    out.apps.push(appRoot);
    walkModule({ root, exists: (p) => present.has(p), packages, out, seen: new Set() }, app, file, 'AppModule', appRoot);
  }
  out.read.sort();
  return out;
}
