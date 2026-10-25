// 08 B.9 `route-contract`: `stynx list-routes --json --roots domain/*/api/src,apps/*/src` (published
// `@stynx-nyx/cli` 3.0.0, declaration-only parser) restricted to `inventory`'s mounted controllers
// (D-058), against the spec machine block's `routes[]` per module. The TypeScript library reads the five
// contract decorators, `parseDto` on boundary parameters, and the app root modules' imports.
// D-087: a route bound by `@RequireRoles` while `list-routes` reports no role binding for it is
// `UNKNOWN: tooling-missing`. D-086: a `stynx` exit without the JSON report is `runner-crashed`.
import { z } from 'zod';
import { spawn } from '../proc/spawn.js';
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { bin, crashed, env, type Finding, outcome, type Unknown } from '../ts/outcome.js';
import { classNamed, decoratorsOf, type Decorator, literal, type Literal, NOT_LITERAL, parseFile, ts, walk } from '../ts/program.js';
import { specForModule, type SpecRoute } from '../ts/spec.js';

const ROOTS = 'domain/*/api/src,apps/*/src';
const ListRoutes = z.object({
  status: z.enum(['PASS', 'FAIL', 'UNKNOWN']),
  reason: z.string().optional(),
  findings: z.array(z.object({ locator: z.string(), message: z.string(), standard: z.string().optional(), hint: z.string().optional() })),
  routes: z.array(z.object({ controller: z.string(), handler: z.string(), method: z.string(), path: z.string(), permissions: z.string(), locator: z.string() })),
});
type Route = z.infer<typeof ListRoutes>['routes'][number];

/** `(method, normalised path)`: duplicate and trailing slashes dropped, parameter names erased. */
export const pairKey = (method: string, path: string): string =>
  `${method.toUpperCase()} ${('/' + path).replace(/\/+/g, '/').replace(/(.)\/$/, '$1').replace(/:[^/]+/g, ':')}`;

const fileOf = (locator: string): string => locator.replace(/:\d+(:\d+)?$/, '');
const moduleOf = (file: string): string | null => /^domain\/([^/]+)\/api\/src\//.exec(file)?.[1] ?? null;

/** Literal rendering for hints: `{ metric: 'x', percentile: 95 }`, `['a']`. */
export function render(v: Literal): string {
  if (typeof v === 'string') return `'${v}'`;
  if (Array.isArray(v)) return `[${v.map(render).join(', ')}]`;
  if (v !== null && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${render(x)}`).join(', ')} }`;
  return String(v);
}
/** A hint ≤ 160 characters (C.2): the value when it fits, else the law's placeholder. */
const fit = (hint: string, placeholder: string): string => (hint.length <= 160 ? hint : placeholder);

interface Handler { method: ts.MethodDeclaration; decorators: Map<string, Decorator>; sf: ts.SourceFile }

function findHandler(cache: Map<string, ts.SourceFile | null>, root: string, file: string, controller: string, handler: string): Handler | null {
  if (!cache.has(file)) cache.set(file, parseFile(root, file));
  const sf = cache.get(file);
  if (!sf) return null;
  const cls = classNamed(sf, controller);
  const m = cls?.members.find((x): x is ts.MethodDeclaration => ts.isMethodDeclaration(x) && ts.isIdentifier(x.name) && x.name.text === handler);
  return m ? { method: m, decorators: new Map(decoratorsOf(m).map((d) => [d.name, d])), sf } : null;
}

const arg = (d: Decorator | undefined, i: number): Literal | typeof NOT_LITERAL | undefined => {
  const e = d?.args?.[i];
  return e === undefined ? undefined : literal(e);
};
const sameSet = (a: readonly string[], b: readonly string[]): boolean => {
  const x = new Set(a);
  const y = new Set(b);
  return x.size === y.size && [...x].every((v) => y.has(v));
};

/** The five field comparisons of one pair (06 §5). */
function compare(h: Handler, at: string, label: string, s: SpecRoute): Finding[] {
  const out: Finding[] = [];
  const lacks = (name: string, hint: string, placeholder: string) => out.push({ locator: at, message: `${label} lacks @${name}`, standard: 'S-28', hint: fit(hint, placeholder) });
  const unreadable = (name: string) => out.push({ locator: at, message: `${label} @${name} argument not statically readable`, standard: 'S-28', hint: 'write the decorator argument as a literal' });
  const differs = (name: string, hint: string, placeholder: string) => out.push({ locator: at, message: `${label} @${name} differs from the spec route`, standard: 'S-28', hint: fit(hint, placeholder) });
  const d = h.decorators;

  // Idempotency: mode none ↔ @NoIdempotent(); mode key ↔ @Idempotent({ headerName, ttlMs }).
  const want = s.idempotency.mode === 'key' ? { headerName: s.idempotency.header ?? '', ttlMs: s.idempotency.ttlMs ?? 0 } : null;
  if (want === null) {
    if (!d.has('NoIdempotent')) (d.has('Idempotent') ? differs : lacks)('NoIdempotent', 'add @NoIdempotent()', 'add @NoIdempotent()');
  } else if (!d.has('Idempotent')) {
    (d.has('NoIdempotent') ? differs : lacks)('Idempotent', `add @Idempotent(${render(want)})`, 'add @Idempotent(<value from the spec route>)');
  } else {
    const v = arg(d.get('Idempotent'), 0);
    if (v === NOT_LITERAL) unreadable('Idempotent');
    else if (v === undefined || typeof v !== 'object' || v === null || Array.isArray(v) || v['headerName'] !== want.headerName || v['ttlMs'] !== want.ttlMs) differs('Idempotent', `set @Idempotent(${render(want)})`, 'set @Idempotent(<value from the spec route>)');
  }
  // roles ↔ @RequireRoles([...], 'all') as sets.
  const roles = d.get('RequireRoles');
  if (!roles) lacks('RequireRoles', `add @RequireRoles(${render(s.roles)}, 'all')`, "add @RequireRoles(<roles from the spec route>, 'all')");
  else {
    const r = arg(roles, 0);
    const mode = arg(roles, 1);
    if (r === NOT_LITERAL || mode === NOT_LITERAL) unreadable('RequireRoles');
    else if (!Array.isArray(r) || !r.every((x) => typeof x === 'string') || mode !== 'all' || !sameSet(r as string[], s.roles)) differs('RequireRoles', `set @RequireRoles(${render(s.roles)}, 'all')`, "set @RequireRoles(<roles from the spec route>, 'all')");
  }
  // errorContract ↔ @ErrorContract([...]) as a set of { status, code, messageKey }.
  const ec = d.get('ErrorContract');
  const specEc = s.errorContract.map((e) => ({ status: e.status, code: e.code, messageKey: e.messageKey }));
  const ecKey = (e: { status: unknown; code: unknown; messageKey: unknown }) => `${String(e.status)}|${String(e.code)}|${String(e.messageKey)}`;
  if (!ec) lacks('ErrorContract', `add @ErrorContract(${render(specEc)})`, 'add @ErrorContract(<value from the spec route>)');
  else {
    const v = arg(ec, 0);
    if (v === NOT_LITERAL) unreadable('ErrorContract');
    else if (!Array.isArray(v) || !v.every((x) => x !== null && typeof x === 'object' && !Array.isArray(x)) || !sameSet((v as Record<string, Literal>[]).map((x) => ecKey({ status: x['status'], code: x['code'], messageKey: x['messageKey'] })), specEc.map(ecKey))) {
      differs('ErrorContract', `set @ErrorContract(${render(specEc)})`, 'set @ErrorContract(<value from the spec route>)');
    }
  }
  // useCase ↔ @UseCase('UC-…').
  const uc = d.get('UseCase');
  if (!uc) lacks('UseCase', `add @UseCase('${s.useCase}')`, 'add @UseCase(<use case from the spec route>)');
  else {
    const v = arg(uc, 0);
    if (v === NOT_LITERAL) unreadable('UseCase');
    else if (v !== s.useCase) differs('UseCase', `set @UseCase('${s.useCase}')`, 'set @UseCase(<use case from the spec route>)');
  }
  // slo ↔ @Slo({ metric, percentile, maxMs }); B.9's own finding form for a missing @Slo.
  const slo = d.get('Slo');
  const specSlo = { metric: s.slo.metric, percentile: s.slo.percentile, maxMs: s.slo.maxMs };
  if (!slo) out.push({ locator: at, message: `${label} @Slo missing (spec: p${specSlo.percentile} ${specSlo.maxMs} ms)`, standard: 'S-25', hint: fit(`add @Slo(${render(specSlo)})`, 'add @Slo(<spec slo>)') });
  else {
    const v = arg(slo, 0);
    if (v === NOT_LITERAL) unreadable('Slo');
    else if (v === undefined || v === null || typeof v !== 'object' || Array.isArray(v) || v['metric'] !== specSlo.metric || v['percentile'] !== specSlo.percentile || v['maxMs'] !== specSlo.maxMs) {
      differs('Slo', fit(`set @Slo(${render(specSlo)})`, 'set @Slo(<spec slo>)'), 'set @Slo(<spec slo>)');
    }
  }
  return out;
}

const BOUNDARY = ['Body', 'Query', 'Param', 'Headers'];

/** S-26: each `@Body/@Query/@Param/@Headers` parameter passes a typed pipe or reaches `parseDto(<zod>, <param>)`. */
function boundaryFindings(h: Handler, at: string, label: string): Finding[] {
  const out: Finding[] = [];
  const used = new Set<string>();
  if (h.method.body) {
    walk(h.method.body, (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'parseDto' && n.arguments.length >= 2) {
        for (const a of n.arguments.slice(1)) if (ts.isIdentifier(a)) used.add(a.text);
      }
    });
  }
  for (const p of h.method.parameters) {
    for (const d of decoratorsOf(p).filter((x) => BOUNDARY.includes(x.name))) {
      const pipe = (d.args ?? []).some((a) => !ts.isStringLiteral(a) && !ts.isNoSubstitutionTemplateLiteral(a));
      const name = ts.isIdentifier(p.name) ? p.name.text : null;
      if (pipe || (name !== null && used.has(name))) continue;
      out.push({ locator: at, message: `${label} ${d.node.getText(h.sf)} without parseDto`, standard: 'S-26', hint: `parseDto(<zod schema>, ${name ?? '<param>'})` });
    }
  }
  return out;
}

const REQUIRE_ROLES_MISSING = 'tooling-missing — route-contract: install @stynx-nyx/cli ≥ <v> whose list-routes reads RequireRoles';

export const routeContract: NodeAdapter = {
  id: 'route-contract',
  contract: 1,
  configFiles: () => [],
  inputs: (ctx) => {
    const paths = ctx.listing.entries.map((e) => e.path);
    const census = ctx.inventory?.mounts;
    return [...new Set([
      ...(census?.read ?? []),
      ...(census?.controllers.map((c) => c.file) ?? []),
      ...paths.filter((p) => /^(domain\/[^/]+\/api\/src|apps\/[^/]+\/src)\/.*\.controller\.ts$/.test(p) || /^specs\/.+\.md$/.test(p) || /^product\/use-cases\/[^/]+\.json$/.test(p)),
    ])].sort();
  },
  async run(ctx: RunContext): Promise<NodeOutcome> {
    const paths = ctx.listing.entries.map((e) => e.path);
    const present = new Set(paths);
    const census = ctx.inventory?.mounts ?? { apps: [], controllers: [], read: [], unresolved: [] };
    const zero = { expected: 0, observed: 0, evaluated: 0 };

    const r = await spawn({ argv: [bin(ctx, 'stynx'), 'list-routes', '--json', '--roots', ROOTS], cwd: ctx.root, env, timeoutMs: 120_000 });
    if (r.kind === 'missing') {
      return outcome(zero, [], [{ reason: 'tooling-missing', finding: { locator: 'package.json:1', message: 'stynx not resolvable from node_modules/.bin', standard: 'S-28', hint: 'install with pnpm add -w -D @stynx-nyx/cli@3.0.0 && pnpm install' } }]);
    }
    let list: z.infer<typeof ListRoutes>;
    try {
      list = ListRoutes.parse(JSON.parse(r.stdout.toString('utf8')));
    } catch {
      return outcome(zero, [], [crashed('package.json:1', r.stderr, r.code, 'S-28')]);
    }
    const findings: Finding[] = [];
    const unknown: Unknown[] = [];
    if (list.status === 'UNKNOWN') unknown.push({ reason: 'runner-crashed', finding: { locator: 'package.json:1', message: `stynx list-routes UNKNOWN ${list.reason ?? ''}`.trim(), standard: 'S-28', hint: 'the tool exited abnormally; re-run once, then put the output under ## Notes' } });
    for (const f of list.findings) findings.push({ locator: f.locator, message: f.message, standard: f.standard ?? 'S-25', hint: (f.hint ?? 'write the route selector as a literal').slice(0, 160) });

    const mounted = list.routes.filter((x) => census.controllers.some((c) => c.file === fileOf(x.locator) && c.name === x.controller));
    const handlers = new Map<string, ts.SourceFile | null>();
    const handlerOf = (x: Route) => findHandler(handlers, ctx.root, fileOf(x.locator), x.controller, x.handler);

    // Every mounted route: role binding, boundary validation, use-case ids, the D-087 tooling gap.
    for (const x of mounted) {
      const h = handlerOf(x);
      const label = `${x.method} ${x.path}`;
      if (!h) continue;
      const roles = h.decorators.has('RequireRoles');
      if (!roles && x.permissions === '') findings.push({ locator: x.locator, message: `${label} neither role-bound nor @Public()`, standard: 'S-11', hint: "add @RequireRoles([...], 'all') or @Public()" });
      if (roles && x.permissions === '') unknown.push({ reason: 'tooling-missing', finding: { locator: x.locator, message: `${label}: ${REQUIRE_ROLES_MISSING}`, standard: 'S-28', hint: 'install @stynx-nyx/cli ≥ <v> whose list-routes reads RequireRoles (D-087)' } });
      findings.push(...boundaryFindings(h, x.locator, label));
      const uc = arg(h.decorators.get('UseCase'), 0);
      if (typeof uc === 'string' && !present.has(`product/use-cases/${uc}.json`)) findings.push({ locator: x.locator, message: `${label} @UseCase('${uc}') absent from product/use-cases/`, standard: 'S-28', hint: 'use an existing use-case id or add the use case in a spec packet' });
    }

    // Pairs per domain module: spec routes ∪ mounted routes (06 §5, bidirectional).
    const modules = new Set<string>([
      ...mounted.map((x) => moduleOf(fileOf(x.locator))).filter((m): m is string => m !== null),
      ...paths.filter((p) => /^domain\/[^/]+\/api\/src\/.*\.controller\.ts$/.test(p)).map((p) => moduleOf(p)!),
    ]);
    let expected = 0;
    let observed = 0;
    let evaluated = 0;
    for (const m of [...modules].sort()) {
      const spec = specForModule(ctx.root, paths, m);
      const mine = mounted.filter((x) => moduleOf(fileOf(x.locator)) === m);
      const specRoutes = spec?.routes ?? [];
      const keys = new Set([...mine.map((x) => pairKey(x.method, x.path)), ...specRoutes.map((s) => pairKey(s.method, s.path))]);
      expected += keys.size;
      for (const k of [...keys].sort()) {
        const x = mine.find((y) => pairKey(y.method, y.path) === k);
        const s = specRoutes.find((y) => pairKey(y.method, y.path) === k);
        if (x && !s) {
          findings.push({ locator: x.locator, message: `${x.method} ${x.path} mounted route absent from the spec`, standard: 'S-25', hint: 'add the route to the spec in a spec packet or remove the handler' });
          continue;
        }
        if (s && !x) {
          findings.push({ locator: `${spec!.path}:${s.line}`, message: `${s.method} ${s.path} spec route not mounted`, standard: 'S-25', hint: 'add the handler or remove the spec route' });
          continue;
        }
        observed++;
        const h = handlerOf(x!);
        if (!h) {
          findings.push({ locator: x!.locator, message: `${x!.method} ${x!.path} handler ${x!.controller}.${x!.handler} not found`, standard: 'S-25', hint: 'declare the handler as a method of the controller class' });
          continue;
        }
        findings.push(...compare(h, x!.locator, `${x!.method} ${x!.path}`, s!));
        evaluated++;
      }
    }

    // S-70: every app root module imports StynxCoreModule from @stynx-nyx/core (it mounts the request-id middleware).
    for (const app of census.apps) {
      if (!app.imports.some((i) => i.name === 'StynxCoreModule' && i.from === '@stynx-nyx/core')) {
        findings.push({ locator: `${app.file}:1`, message: 'request-id middleware not mounted', standard: 'S-70', hint: 'import StynxCoreModule' });
      }
    }
    if (list.status !== 'UNKNOWN' && r.code !== 0 && list.status !== 'FAIL') unknown.push(crashed('package.json:1', r.stderr, r.code, 'S-28'));
    return outcome({ expected, observed, evaluated }, findings, unknown);
  },
};
