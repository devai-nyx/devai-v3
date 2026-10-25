// SPDX-License-Identifier: Apache-2.0
// Provenance: the DDL renderer and the `Map<path, bytes>` shape derive from
// `stynx:packages/cli/src/generate-module.ts` @ 63e5f788 (`renderDdl` :277-302, `renderFiles` :430-444),
// relicensed to Apache-2.0 by NYXK (D-067).
//
// 09 §2: the pure `render(specBytes, options, version) → Map<path, bytes>` of `devai new module`, with
// the 09 §2.1 mapping and the controller lowering; the `generated` replay (08 B.16, 09 §3) calls the
// same function. No clock, no environment, no file system: identical inputs give identical bytes
// (INV-CLI-002). Every file but SQL is then passed through Prettier 3.9.6 with the template's prettier
// block, so the output is `format`-clean (09 §2, D-096) [fact: `stynx:package.json:130-135`].
import { format as prettierFormat } from 'prettier';
import { sha256 } from '../candidate/digest.js';
import type { MachineBlock } from '../spec/machine-block.js';
import { parseSpec } from '../spec/parse-spec.js';

export interface RenderOptions {
  web: boolean;
  locales: string[];
  lgpd: boolean;
  productPrefix: string;
}
export type FileMode = 'generated' | 'seed';
export interface RenderedFile { mode: FileMode; bytes: Buffer }
/** Module-relative path → file, sorted by path. */
export type Rendered = Map<string, RenderedFile>;

export class RenderError extends Error {}

type Column = MachineBlock['data']['tables'][number]['columns'][number];
type Route = MachineBlock['routes'][number];
type Bindings = Route['request']['body'];

const WIDTH = 100;

// ---- names ---------------------------------------------------------------------------------------

const words = (s: string): string[] => s.split(/[-_]/).filter((w) => w.length > 0);
const cap = (w: string): string => w.charAt(0).toUpperCase() + w.slice(1);
export const pascal = (s: string): string => words(s).map(cap).join('');
export const camel = (s: string): string => { const p = pascal(s); return p.charAt(0).toLowerCase() + p.slice(1); };
const kebab = (s: string): string => s.replace(/_/g, '-');
/** `en-US` → `EnUs` (catalog identifiers); `en-US` → `en-us` (catalog file names, 09 §2). */
const localeName = (l: string): string => l.split('-').map((w) => cap(w.toLowerCase())).join('');
export const catalogFile = (slug: string, locale: string): string => `api/src/${slug}.i18n.${locale.toLowerCase()}.ts`;
export const headerOf = (specId: string): string => `@generated from ${specId} do not edit`;

// ---- printing (the prettier shapes the generator emits) ------------------------------------------

/** A TypeScript single-quoted string literal. */
export const str = (s: string): string => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`;
const fits = (line: string): boolean => line.length <= WIDTH;
/** `head{ a, b }tail` on one line when it fits, else one entry per line with trailing commas. */
function braces(indent: string, head: string, entries: readonly string[], tail: string, json = false): string {
  if (entries.length === 0) return `${indent}${head}{}${tail}`;
  const one = `${indent}${head}{ ${entries.join(', ')} }${tail}`;
  if (fits(one)) return one;
  // JSON takes no trailing comma (prettier's `trailingComma` does not apply to it).
  return [`${indent}${head}{`, ...entries.map((e, i) => `${indent}  ${e}${json && i === entries.length - 1 ? '' : ','}`), `${indent}}${tail}`].join('\n');
}
/** `head[a, b]tail`, broken the same way. */
function brackets(indent: string, head: string, entries: readonly string[], tail: string): string {
  const one = `${indent}${head}[${entries.join(', ')}]${tail}`;
  if (fits(one) || entries.length === 0) return one;
  return [`${indent}${head}[`, ...entries.map((e) => `${indent}  ${e},`), `${indent}]${tail}`].join('\n');
}
/** `head(a, b)tail` (parameters), broken one per line. */
function parens(indent: string, head: string, entries: readonly string[], tail: string): string {
  const one = `${indent}${head}(${entries.join(', ')})${tail}`;
  if (fits(one) || entries.length === 0) return one;
  return [`${indent}${head}(`, ...entries.map((e) => `${indent}  ${e},`), `${indent})${tail}`].join('\n');
}
const importLine = (names: readonly string[], from: string, typeOnly = false): string =>
  braces('', `import ${typeOnly ? 'type ' : ''}`, names, ` from ${str(from)};`);
/** Import names sorted case-insensitively, `type` markers ignored. */
const sortNames = (names: Iterable<string>): string[] =>
  [...new Set(names)].sort((a, b) => a.replace(/^type /, '').toLowerCase().localeCompare(b.replace(/^type /, '').toLowerCase()));
/** An inline object literal `{ k: v, … }` for decorator arguments (always one line: entries are scalars). */
const inline = (o: Record<string, string | number>): string =>
  `{ ${Object.entries(o).map(([k, v]) => `${k}: ${typeof v === 'string' ? str(v) : String(v)}`).join(', ')} }`;
const lines = (...ls: (string | null | false)[]): string => ls.filter((l): l is string => typeof l === 'string').join('\n') + '\n';

// ---- the module model ----------------------------------------------------------------------------

interface Part { kind: 'params' | 'body' | 'query'; decorator: 'Param' | 'Body' | 'Query'; bindings: Bindings; schema: string; shared: boolean }
interface RouteModel {
  route: Route;
  index: number;
  handler: string;
  dto: string; // file base: create-note
  ident: string; // createNote
  parts: Part[];
  response: string;
  responseType: string;
}

const VERB: Record<Route['method'], string> = { POST: 'create', PUT: 'replace', PATCH: 'update', DELETE: 'delete', GET: 'get', HEAD: 'head', OPTIONS: 'options' };
const pathParams = (path: string): string[] => [...path.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]!);
const PART_NAME = { params: 'Params', body: 'Body', query: 'Query' } as const;

function routeModels(block: MachineBlock): RouteModel[] {
  const verbs = block.routes.map((r) => (r.method === 'GET' && pathParams(r.path).length === 0 ? 'list' : VERB[r.method]));
  const taken = new Set<string>();
  const models = block.routes.map((route, index): RouteModel => {
    const table = route.response.columns[0]!.split('.')[0]!;
    let dto = `${verbs[index]}-${kebab(table)}`;
    if (taken.has(dto)) dto = `${dto}-${index + 1}`;
    taken.add(dto);
    const ident = camel(dto);
    const handler = verbs.filter((v) => v === verbs[index]).length === 1 ? verbs[index]! : ident;
    const parts: Part[] = [];
    // 09 §2: every boundary passes parseDto; an absent input is an empty strict object. A path without
    // parameters has no `@Param()`; GET, HEAD and OPTIONS take no `@Body()` unless one is declared.
    if (pathParams(route.path).length > 0) parts.push({ kind: 'params', decorator: 'Param', bindings: route.request.params, schema: '', shared: false });
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.method) || Object.keys(route.request.body).length > 0) parts.push({ kind: 'body', decorator: 'Body', bindings: route.request.body, schema: '', shared: false });
    parts.push({ kind: 'query', decorator: 'Query', bindings: route.request.query, schema: '', shared: false });
    for (const p of parts) {
      p.shared = Object.keys(p.bindings).length === 0;
      p.schema = p.shared ? `empty${PART_NAME[p.kind]}` : `${ident}${PART_NAME[p.kind]}`;
    }
    return { route, index, handler, dto, ident, parts, response: `${ident}Response`, responseType: `${pascal(dto)}Response` };
  });
  return models;
}

/** The DTO file hosting each shared empty schema: the last route (spec order) that uses it (09 §6). */
function emptyHosts(models: readonly RouteModel[]): Map<string, string> {
  const host = new Map<string, string>();
  for (const m of models) for (const p of m.parts) if (p.shared) host.set(p.schema, m.dto);
  return host;
}

function columnsOf(block: MachineBlock): Map<string, Column> {
  const out = new Map<string, Column>();
  for (const t of block.data.tables) for (const c of t.columns) out.set(`${t.name}.${c.name}`, c);
  return out;
}

/** 09 §2 leaves, from the bound column; nothing is coerced. */
function leaf(c: Column): string {
  let s: string;
  const l = c.limits as Record<string, unknown>;
  switch (c.type) {
    case 'varchar': s = `z.string().min(${String(l['minLength'])}).max(${String(l['maxLength'])})`; break;
    case 'uuid': s = 'z.string().uuid()'; break;
    case 'integer': s = `z.number().int().min(${String(l['minimum'])}).max(${String(l['maximum'])})`; break;
    case 'boolean': s = 'z.boolean()'; break;
    case 'timestamptz': s = `z.string().datetime().refine((v) => Date.parse(v) >= ${Date.parse(String(l['minimum']))} && Date.parse(v) <= ${Date.parse(String(l['maximum']))})`; break;
  }
  return c.nullable ? `${s}.nullable()` : s;
}

// ---- files ---------------------------------------------------------------------------------------

function renderDto(spec: Ctx, m: RouteModel, hosted: readonly string[]): string {
  const out: string[] = [`// ${spec.header}`, "import { z } from 'zod';", ''];
  const entries = (b: Bindings) => Object.entries(b).map(([name, binding]) => `${name}: ${leaf(spec.columns.get(binding.column)!)}${binding.required ? '' : '.optional()'}`);
  const types: string[] = [];
  for (const p of m.parts.filter((x) => !x.shared)) {
    out.push(braces('', `export const ${p.schema} = z.strictObject(`, entries(p.bindings), ');'));
    types.push(`export type ${cap(p.schema)} = z.infer<typeof ${p.schema}>;`);
  }
  for (const h of hosted) out.push(`export const ${h} = z.strictObject({});`);
  out.push(braces('', `export const ${m.response} = z.strictObject(`, m.route.response.columns.map((ref) => `${ref.split('.')[1]}: ${leaf(spec.columns.get(ref)!)}`), ');'));
  types.push(`export type ${m.responseType} = z.infer<typeof ${m.response}>;`);
  return lines(...out, '', ...types);
}

function renderController(spec: Ctx): string {
  const { models, cls, block } = spec;
  const nest = new Set<string>(['Controller']);
  const idem = new Set<string>();
  const dtoImports = new Map<string, Set<string>>();
  const want = (file: string, name: string) => { const s = dtoImports.get(file) ?? new Set<string>(); s.add(name); dtoImports.set(file, s); };
  const hosts = emptyHosts(models);
  for (const m of models) {
    nest.add(cap(m.route.method.toLowerCase())).add('HttpCode');
    for (const p of m.parts) { nest.add(p.decorator); want(p.shared ? hosts.get(p.schema)! : m.dto, p.schema); }
    want(m.dto, `type ${m.responseType}`);
    idem.add(m.route.idempotency.mode === 'key' ? 'Idempotent' : 'NoIdempotent');
  }
  const head = [importLine(sortNames(nest), '@nestjs/common')];
  if (models.length > 0) {
    head.push(importLine(['parseDto'], '@stynx-nyx/flow'), importLine(['RequireRoles'], '@stynx-nyx/backend'), importLine(['ErrorContract', 'Slo', 'UseCase'], '@devai-nyx/decorators'), importLine(sortNames(idem), '@stynx-nyx/idempotency'));
    for (const [file, names] of [...dtoImports].sort(([a], [b]) => a.localeCompare(b))) head.push(importLine(sortNames(names), `./dto/${file}.dto.js`));
  }
  head.push(importLine([`${cls}Service`], `./${block.module.slug}.service.js`));
  const body: string[] = [];
  for (const m of models) {
    const r = m.route;
    const idemDecorator = r.idempotency.mode === 'key' ? `@Idempotent(${inline({ headerName: r.idempotency.header, ttlMs: r.idempotency.ttlMs })})` : '@NoIdempotent()';
    body.push(
      '',
      `  @${cap(r.method.toLowerCase())}(${str(r.path)})`,
      `  @HttpCode(${r.response.status})`,
      `  ${idemDecorator}`,
      `  @RequireRoles([${r.roles.map(str).join(', ')}], 'all')`,
      brackets('  ', '@ErrorContract(', r.errorContract.map((e) => inline({ status: e.status, code: e.code, messageKey: e.messageKey })), ')'),
      `  @UseCase(${str(r.useCase)})`,
      `  @Slo(${inline({ metric: r.slo.metric, percentile: r.slo.percentile, maxMs: r.slo.maxMs })})`,
      parens('  ', `async ${m.handler}`, m.parts.map((p) => `@${p.decorator}() ${p.kind}: unknown`), `: Promise<${m.responseType}> {`),
    );
    const args: string[] = [];
    for (const p of m.parts) {
      if (p.shared) body.push(`    parseDto(${p.schema}, ${p.kind});`);
      else { const v = `parsed${PART_NAME[p.kind]}`; body.push(`    const ${v} = parseDto(${p.schema}, ${p.kind});`); args.push(v); }
    }
    body.push(parens('    ', `return this.service.${m.handler}`, args, ';'), '  }');
  }
  return lines(
    ...head,
    '',
    '@Controller()',
    `export class ${cls}Controller {`,
    `  constructor(private readonly service: ${cls}Service) {}`,
    ...body,
    '}',
  );
}

function renderService(spec: Ctx): string {
  const { models, cls, block } = spec;
  const types = new Map<string, Set<string>>();
  for (const m of models) {
    const s = types.get(m.dto) ?? new Set<string>();
    for (const p of m.parts) if (!p.shared) s.add(cap(p.schema));
    s.add(m.responseType);
    types.set(m.dto, s);
  }
  const head = [importLine(models.length > 0 ? ['Injectable', 'NotImplementedException'] : ['Injectable'], '@nestjs/common')];
  for (const [file, names] of [...types].sort(([a], [b]) => a.localeCompare(b))) head.push(importLine(sortNames(names), `./dto/${file}.dto.js`, true));
  head.push(importLine([`${cls}Repository`], `./${block.module.slug}.repository.js`));
  // 09 §2: one stub per route naming the requirement a code packet implements; the spec binds no route
  // to a requirement, so every stub names the first unimplemented one (the first requirement otherwise).
  const req = block.unimplemented[0]?.requirement ?? block.requirements[0]!.id;
  const body: string[] = [];
  for (const m of models) {
    body.push(
      '',
      parens('  ', m.handler, m.parts.filter((p) => !p.shared).map((p) => `_${p.kind}: ${cap(p.schema)}`), `: Promise<${m.responseType}> {`),
      `    throw new NotImplementedException(${str(`${block.id} ${req}: implement in a code packet`)});`,
      '  }',
    );
  }
  return lines(...head, '', '@Injectable()', `export class ${cls}Service {`, `  constructor(private readonly repository: ${cls}Repository) {}`, ...body, '}');
}

function renderRepository(spec: Ctx): string {
  const { block, cls } = spec;
  const head = [importLine(['Injectable'], '@nestjs/common')];
  if (block.queries.length > 0) head.push(importLine(['defineQuery', 'sql'], '@stynx-nyx/data'), "import { z } from 'zod';");
  // Row schemas: `<table>Row` for the first returns-set of a table, `<label><Table>Row` for another.
  const rows = new Map<string, string>(); // key: returns joined → const name
  const rowDecls: string[] = [];
  const queries: string[] = [];
  for (const q of block.queries) {
    const label = q.name.split('.')[2]!;
    const key = q.returns.join(',');
    let row = rows.get(key);
    if (!row) {
      row = [...rows.values()].includes(`${camel(q.table)}Row`) ? `${camel(label)}${pascal(q.table)}Row` : `${camel(q.table)}Row`;
      rows.set(key, row);
      rowDecls.push(braces('', `const ${row} = z.strictObject(`, q.returns.map((ref) => `${ref.split('.')[1]}: ${leaf(spec.columns.get(ref)!)}`), ');'));
    }
    const cols = (refs: readonly string[]) => refs.map((r) => r.split('.')[1]).join(', ');
    const table = `${block.module.namespace}.${q.table}`;
    const text = q.operation === 'insert'
      ? `insert into ${table} (${cols(q.params)}) values (${q.params.map((_, i) => `$${i + 1}`).join(', ')}) returning ${cols(q.returns)}`
      : `select ${cols(q.returns)} from ${table} where ${q.params.map((p, i) => `${p.split('.')[1]} = $${i + 1}`).join(' and ')}`;
    const params = brackets('', 'z.tuple(', q.params.map((ref) => leaf(spec.columns.get(ref)!)), ')');
    queries.push(braces('', `export const ${camel(label)}${pascal(q.table)} = defineQuery(`, [
      `name: ${str(q.name)}`, `text: sql\`${text}\``, `params: ${params}`, `row: ${row}`, `expects: ${str(q.expects)}`,
    ], ');'));
  }
  return lines(...head, '', ...(rowDecls.length ? [...rowDecls, ''] : []), ...(queries.length ? [...queries, ''] : []), '@Injectable()', `export class ${cls}Repository {}`);
}

function renderDdl(spec: Ctx): string {
  const { block, options } = spec;
  const q = (n: string) => `"${n}"`;
  const ns = q(block.module.namespace);
  const p = options.productPrefix;
  const tenant = "NULLIF(current_setting('app.tenant_id', true), '')::uuid";
  const out: string[] = [`-- ${spec.header}`, `CREATE SCHEMA ${ns} AUTHORIZATION ${p}_owner;`, `REVOKE ALL ON SCHEMA ${ns} FROM PUBLIC;`, `GRANT USAGE ON SCHEMA ${ns} TO ${p}_owner, ${p}_app, ${p}_reader;`];
  for (const t of block.data.tables) {
    const table = `${ns}.${q(t.name)}`;
    const cols: string[] = [];
    for (const c of t.columns) {
      const l = c.limits as Record<string, unknown>;
      const type = c.type === 'varchar' ? `VARCHAR(${String(l['maxLength'])})` : c.type.toUpperCase();
      const dflt = c.default === 'generated-uuid' ? ' DEFAULT gen_random_uuid()' : c.default === 'tenant-context' ? ` DEFAULT ${tenant}` : c.default === 'transaction-time' ? ' DEFAULT now()' : '';
      const fk = c.name === 'tenant_id' ? ` REFERENCES ${q('tenancy')}.${q('tenants')}(${q('id')})` : '';
      const check = c.type === 'varchar' ? ` CHECK (char_length(${q(c.name)}) BETWEEN ${String(l['minLength'])} AND ${String(l['maxLength'])})`
        : c.type === 'integer' ? ` CHECK (${q(c.name)} BETWEEN ${String(l['minimum'])} AND ${String(l['maximum'])})`
        : c.type === 'timestamptz' ? ` CHECK (${q(c.name)} BETWEEN '${String(l['minimum'])}' AND '${String(l['maximum'])}')` : '';
      // LINT012: the annotation sits on the line immediately above the column (09 §2).
      if (options.lgpd && c.pii) cols.push(`  -- @pii: basis=${c.pii.basis}, retention=${c.pii.retention}`);
      cols.push(`  ${q(c.name)} ${type}${c.nullable ? '' : ' NOT NULL'}${dflt}${fk}${check},`);
    }
    const index = `${block.module.namespace}_${t.name}_tenant_id_idx`;
    out.push(
      '',
      `CREATE TABLE ${table} (`,
      ...cols,
      `  PRIMARY KEY (${t.primaryKey.map(q).join(', ')})`,
      ');',
      `ALTER TABLE ${table} OWNER TO ${p}_owner;`,
      `REVOKE ALL ON TABLE ${table} FROM PUBLIC;`,
      `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${table} TO ${p}_app;`,
      `GRANT SELECT ON TABLE ${table} TO ${p}_reader;`,
      `CREATE INDEX ${q(index.length <= 63 ? index : `${index.slice(0, 54)}_${sha256(index).slice(0, 8)}`)} ON ${table} (${q('tenant_id')});`,
      `ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`,
      `ALTER TABLE ${table} FORCE ROW LEVEL SECURITY;`,
      `CREATE POLICY ${q(`${t.name}_tenant_policy`)} ON ${table} FOR ALL USING (${q('tenant_id')} = ${tenant}) WITH CHECK (${q('tenant_id')} = ${tenant});`,
    );
  }
  return lines(...out);
}

function renderCatalog(spec: Ctx, locale: string): string {
  const keys = Object.keys(spec.block.i18n).sort();
  const name = `${camel(spec.options.productPrefix)}${spec.block.module.name}${localeName(locale)}`;
  return lines(`// ${spec.header}`, braces('', `export const ${name} = `, keys.map((k) => `${str(k)}: ${str(spec.block.i18n[k]![locale]!)}`), ' as const;'));
}

function renderReadme(spec: Ctx): string {
  const { block, options } = spec;
  const list = (xs: readonly string[]) => (xs.length ? xs.join(', ') : 'none');
  return lines(
    `<!-- ${spec.header} -->`,
    `# ${block.module.name} — ${block.id}`,
    '',
    `Package \`@${options.productPrefix}/${block.module.slug}-api\`; schema \`${block.module.namespace}\`; locales ${options.locales.join(', ')}; lgpd ${String(options.lgpd)}; web ${String(options.web)}.`,
    '',
    `- Routes: ${list(block.routes.map((r) => `\`${r.method} ${r.path}\``))}`,
    `- Tables: ${list(block.data.tables.map((t) => `\`${t.name}\``))}`,
    `- Queries: ${list(block.queries.map((q) => `\`${q.name}\``))}`,
    `- Requirements: ${list(block.requirements.map((r) => r.id))}`,
    `- Unimplemented: ${list(block.unimplemented.map((u) => u.requirement))}`,
    `- Sources: ${list(block.sources.map((s) => s.id))}`,
    `- Supersedes: ${block.supersedes?.id ?? 'none'}`,
    '',
    'Files with the header above are regenerated by `devai new module --regenerate`; the controller,',
    'service, repository, `package.json` and tests are seeds owned by packets (D-033).',
  );
}

function renderControllerSpec(spec: Ctx): string | null {
  const m = spec.models.find((x) => x.parts.some((p) => p.kind === 'body')) ?? spec.models[0];
  if (!m) return null;
  const target = m.parts.find((p) => p.kind === 'body') ?? m.parts.find((p) => p.kind === 'query')!;
  const label = target.kind === 'body' ? 'body field' : 'query parameter';
  const args = m.parts.map((p) => (p === target ? '{ undeclared: true }' : '{}'));
  const { cls, block } = spec;
  return lines(
    "import { BadRequestException } from '@nestjs/common';",
    "import { describe, expect, it } from 'vitest';",
    importLine([`${cls}Controller`], `../src/${block.module.slug}.controller.js`),
    importLine([`${cls}Service`], `../src/${block.module.slug}.service.js`, true),
    '',
    `describe('${cls}Controller', () => {`,
    `  it(${str(`rejects an undeclared ${label} with 400 VALIDATION`)}, async () => {`,
    `    const controller = new ${cls}Controller({} as ${cls}Service);`,
    parens('    ', `const pending = controller.${m.handler}`, args, ';'),
    '    const error: unknown = await pending.catch((e: unknown) => e);',
    '    expect(error).toBeInstanceOf(BadRequestException);',
    '    expect((error as BadRequestException).getStatus()).toBe(400);',
    '  });',
    '});',
  );
}

// ---- --web (09 §2.1 row `--web`) ---------------------------------------------------------------------

/** 09 §5 pins: Angular 22.2.1; rxjs as the template lock carries it. */
const ANGULAR = '22.2.1';
const RXJS = '7.8.2';

function renderWeb(spec: Ctx, put: (path: string, mode: FileMode, text: string) => void): void {
  const { block, options, models } = spec;
  const P = pascal(options.productPrefix);
  const entity = models[0]?.route.response.columns[0]!.split('.')[0] ?? block.data.tables[0]?.name ?? block.module.slug;
  const e = kebab(entity);
  const E = pascal(entity);
  const routesName = `${camel(options.productPrefix)}${block.module.name}Routes`;
  put('web/package.json', 'seed', [
    '{',
    `  "name": "@${options.productPrefix}/${block.module.slug}-web",`,
    '  "private": true,',
    '  "type": "module",',
    '  "exports": { ".": "./dist/index.js" },',
    '  "dependencies": {',
    `    "@angular/common": "${ANGULAR}",`,
    `    "@angular/core": "${ANGULAR}",`,
    `    "@angular/router": "${ANGULAR}",`,
    `    "rxjs": "${RXJS}"`,
    '  }',
    '}',
  ].join('\n') + '\n');
  put('web/tsconfig.json', 'generated', lines(`// ${spec.header}`, '{', '  "extends": "@stynx-nyx/tsconfig/angular18.json",', '  "compilerOptions": { "rootDir": "src", "outDir": "dist", "composite": true },', '  "include": ["src"]', '}'));
  put('web/src/index.ts', 'generated', lines(`// ${spec.header}`, `export { ${routesName} } from './${block.module.slug}.routes.js';`));
  const detail = models.find((m) => m.route.method === 'GET' && pathParams(m.route.path).length > 0);
  const list = models.find((m) => m.route.method === 'GET' && pathParams(m.route.path).length === 0);
  const components: { kind: 'detail' | 'list'; m: RouteModel }[] = [...(list ? [{ kind: 'list' as const, m: list }] : []), ...(detail ? [{ kind: 'detail' as const, m: detail }] : [])];
  const routeEntries: string[] = [];
  const routeImports: string[] = [importLine(['Routes'], '@angular/router', true)];
  for (const c of components) {
    const name = `${P}${E}${cap(c.kind)}Component`;
    routeImports.push(importLine([name], `./${e}-${c.kind}.component.js`));
    routeEntries.push(inline({ path: c.m.route.path.slice(1) }).replace(/ }$/, `, component: ${name} }`));
    const inputs = pathParams(c.m.route.path).map((x) => `  readonly ${x} = input.required<string>();`);
    put(`web/src/${e}-${c.kind}.component.ts`, 'seed', lines(
      importLine(inputs.length ? ['ChangeDetectionStrategy', 'Component', 'input'] : ['ChangeDetectionStrategy', 'Component'], '@angular/core'),
      '',
      '@Component({',
      `  selector: ${str(`${options.productPrefix}-${e}-${c.kind}`)},`,
      '  standalone: true,',
      '  changeDetection: ChangeDetectionStrategy.OnPush,',
      "  template: '',",
      '})',
      inputs.length ? `export class ${name} {` : `export class ${name} {}`,
      ...(inputs.length ? [...inputs, '}'] : []),
    ));
  }
  put(`web/src/${block.module.slug}.routes.ts`, 'generated', lines(`// ${spec.header}`, ...routeImports, '', brackets('', `export const ${routesName}: Routes = `, routeEntries, ';')));
  const service = `${P}${E}Service`;
  const methods: string[] = [];
  for (const m of models) {
    const params = pathParams(m.route.path);
    const url = params.length ? `\`${m.route.path.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, n: string) => `\${encodeURIComponent(${n})}`)}\`` : str(m.route.path);
    const hasBody = m.parts.some((p) => p.kind === 'body');
    const args = [...params.map((x) => `${x}: string`), ...(hasBody ? ['body: unknown'] : [])];
    const verb = m.route.method.toLowerCase();
    const call = ['post', 'put', 'patch'].includes(verb) ? `this.http.${verb}(${url}, body)` : `this.http.request(${str(m.route.method)}, ${url}${hasBody ? ', { body }' : ''})`;
    methods.push('', parens('  ', m.handler, args, ': Observable<unknown> {'), `    return ${m.route.method === 'GET' ? `this.http.get(${url})` : call};`, '  }');
  }
  put(`web/src/${e}.service.ts`, 'seed', lines(
    "import { HttpClient } from '@angular/common/http';",
    "import { inject, Injectable } from '@angular/core';",
    "import type { Observable } from 'rxjs';",
    '',
    "@Injectable({ providedIn: 'root' })",
    `export class ${service} {`,
    '  private readonly http = inject(HttpClient);',
    ...methods,
    '}',
  ));
  put(`web/test/${e}.service.spec.ts`, 'seed', lines(
    "import { describe, expect, it } from 'vitest';",
    importLine([service], `../src/${e}.service.js`),
    '',
    `describe('${service}', () => {`,
    "  it('declares one method per route', () => {",
    ...models.map((m) => `    expect(typeof ${service}.prototype.${m.handler}).toBe('function');`),
    '  });',
    '});',
  ));
}

// ---- render --------------------------------------------------------------------------------------

/** The template's `prettier` block (`template/package.json`; 09 §1.1 root row). */
export const PRETTIER_OPTIONS = { printWidth: 100, tabWidth: 2, singleQuote: true, trailingComma: 'all', semi: true } as const;

/**
 * D-094: the exact pins of every package emitted module code may import (07 §2 Nest and zod rows; the
 * STYNX fixed group at 3.0.0, D-089, 12 §3); `@devai-nyx/decorators` is pinned at `generatorVersion`.
 */
export const MODULE_PINS: Readonly<Record<string, string>> = {
  '@nestjs/common': '11.2.3',
  '@stynx-nyx/backend': '3.0.0',
  '@stynx-nyx/data': '3.0.0',
  '@stynx-nyx/flow': '3.0.0',
  '@stynx-nyx/idempotency': '3.0.0',
  zod: '4.4.3',
};

/** Bare package names a TypeScript text imports (`from '<pkg>'`), scoped names kept whole. */
function importedPackages(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\bfrom '([^'.][^']*)'/g)) {
    const spec = m[1]!;
    const parts = spec.split('/');
    out.push(spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!);
  }
  return out;
}

/** `api/package.json` (seed): every package `api/src/**` imports, exact (09 §2, D-094). */
function renderApiPackage(files: Rendered, options: RenderOptions, slug: string, version: string): string {
  const used = new Set<string>(['@devai-nyx/decorators']);
  for (const [path, f] of files) if (path.startsWith('api/src/') && path.endsWith('.ts')) for (const p of importedPackages(f.bytes.toString('utf8'))) used.add(p);
  const deps = [...used].sort().map((name) => {
    const pin = name === '@devai-nyx/decorators' ? version : MODULE_PINS[name];
    if (pin === undefined) throw new RenderError(`emitted code imports ${name}, which has no 07 §2 pin`);
    return `    ${JSON.stringify(name)}: ${JSON.stringify(pin)}`;
  });
  return [
    '{',
    `  "name": "@${options.productPrefix}/${slug}-api",`,
    '  "private": true,',
    '  "type": "module",',
    '  "exports": { ".": "./dist/index.js" },',
    '  "dependencies": {',
    deps.join(',\n'),
    '  }',
    '}',
  ].join('\n') + '\n';
}

/** D-096: every emitted file but SQL, formatted as `prettier --list-different` would accept it. */
async function formatted(files: Rendered, root: string): Promise<Rendered> {
  const out: Rendered = new Map();
  for (const [path, f] of files) {
    if (path.endsWith('.sql')) { out.set(path, f); continue; }
    const text = await prettierFormat(f.bytes.toString('utf8'), { ...PRETTIER_OPTIONS, filepath: `${root}/${path}` });
    out.set(path, { mode: f.mode, bytes: Buffer.from(text, 'utf8') });
  }
  return out;
}

interface Ctx {
  block: MachineBlock;
  options: RenderOptions;
  header: string;
  cls: string;
  models: RouteModel[];
  columns: Map<string, Column>;
}

/** The module files of one valid machine block (09 §2.1), module-relative, sorted and formatted. */
export async function renderBlock(block: MachineBlock, options: RenderOptions, version: string): Promise<Rendered> {
  for (const [key, byLocale] of Object.entries(block.i18n)) {
    for (const l of options.locales) if (!(l in byLocale)) throw new RenderError(`i18n ${key}: missing locale ${l}`);
  }
  const spec: Ctx = { block, options, header: headerOf(block.id), cls: `${pascal(options.productPrefix)}${block.module.name}`, models: routeModels(block), columns: columnsOf(block) };
  const { slug } = block.module;
  const files = new Map<string, RenderedFile>();
  const put = (path: string, mode: FileMode, text: string) => files.set(path, { mode, bytes: Buffer.from(text, 'utf8') });
  const G = `// ${spec.header}`;

  put('README.md', 'generated', renderReadme(spec));
  put('api/tsconfig.json', 'generated', lines(
    G,
    '{',
    '  "extends": "@stynx-nyx/tsconfig/node24.json",',
    braces('  ', '"compilerOptions": ', ['"rootDir": "src"', '"outDir": "dist"', '"composite": true', '"experimentalDecorators": true', '"emitDecoratorMetadata": true'], ',', true),
    '  "include": ["src"]',
    '}',
  ));
  const catalogs = options.locales.map((l) => `export { ${camel(options.productPrefix)}${block.module.name}${localeName(l)} } from './${slug}.i18n.${l.toLowerCase()}.js';`);
  put('api/src/index.ts', 'generated', lines(G, `export { ${spec.cls}Module } from './${slug}.module.js';`, ...catalogs));
  const providers = [`${spec.cls}Service`, `${spec.cls}Repository`];
  put(`api/src/${slug}.module.ts`, 'generated', lines(
    G,
    "import { Module } from '@nestjs/common';",
    importLine([`${spec.cls}Controller`], `./${slug}.controller.js`),
    importLine([`${spec.cls}Repository`], `./${slug}.repository.js`),
    importLine([`${spec.cls}Service`], `./${slug}.service.js`),
    '',
    braces('', '@Module(', [`controllers: [${spec.cls}Controller]`, `providers: [${providers.join(', ')}]`], ')'),
    `export class ${spec.cls}Module {}`,
  ));
  put(`api/src/${slug}.controller.ts`, 'seed', renderController(spec));
  put(`api/src/${slug}.service.ts`, 'seed', renderService(spec));
  put(`api/src/${slug}.repository.ts`, 'seed', renderRepository(spec));
  const hosts = emptyHosts(spec.models);
  for (const m of spec.models) put(`api/src/dto/${m.dto}.dto.ts`, 'generated', renderDto(spec, m, [...hosts].filter(([, f]) => f === m.dto).map(([s]) => s).sort()));
  for (const l of options.locales) put(catalogFile(slug, l), 'generated', renderCatalog(spec, l));
  const controllerSpec = renderControllerSpec(spec);
  if (controllerSpec) put(`api/test/${slug}.controller.spec.ts`, 'seed', controllerSpec);
  // D-095: no `api/test/acceptance/` folder; the `test` packet creates it with the acceptance file.
  put(`db/${block.module.namespace}_${slug}.sql`, 'generated', renderDdl(spec));
  if (options.web) renderWeb(spec, put);
  put('api/package.json', 'seed', renderApiPackage(files, options, slug, version));
  const sorted: Rendered = new Map([...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return formatted(sorted, `domain/${slug}`);
}

/** 09 §2 `render(specBytes, options, version)`; rejects with `RenderError` on bytes that are not a valid spec. */
export async function render(specBytes: Buffer, options: RenderOptions, version: string): Promise<Rendered> {
  const parsed = parseSpec(specBytes.toString('utf8'));
  if (parsed.kind !== 'valid') throw new RenderError('spec machine block is not valid (06 §2)');
  return renderBlock(parsed.block, options, version);
}

/** The module's SQL baseline path, module-relative (09 §2.1 `data.tables[]`). */
export const sqlPath = (block: Pick<MachineBlock, 'module'>): string => `db/${block.module.namespace}_${block.module.slug}.sql`;
