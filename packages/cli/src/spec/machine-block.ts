// 06 §2 spec machine block and 06 §3 use-case object as zod definitions (D-056: closed, no coercion;
// uniqueness by superRefine, which does not project), and the 07 §3 YAML reader: positions, YAML 1.2
// core, `uniqueKeys: true`, aliases/tags/non-string keys rejected by a walk before conversion.
// Shared by `spec-lint` (08 B.8), the generator (09 §2) and `spec-tests` (08 B.21).
import { isAlias, isScalar, LineCounter, parseDocument, visit } from 'yaml';
import { z } from 'zod';

// ---- primitives (06 §2 notation comments) --------------------------------------------------------

const NonemptyString = z.string().regex(/\S/, 'whitespace-only string');
const SpecIdPattern = /^SPEC-[A-Z][A-Z0-9]*-[0-9]{3}$/;
export const SpecId = z.string().regex(SpecIdPattern);
export const RuleId = z.string().regex(/^RN-[A-Z][A-Z0-9]*-[0-9]{3}$/);
export const UseCaseId = z.string().regex(/^UC-[A-Z][A-Z0-9]*-[0-9]{3}$/);
export const RequirementId = z.string().regex(/^R-[1-9][0-9]*$/);
const Slug = z.string().regex(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
const SqlIdentifier = z.string().regex(/^[a-z][a-z0-9_]*$/).max(48);
const PascalCase = z.string().regex(/^[A-Z][A-Za-z0-9]*$/);
const Hex64 = z.string().regex(/^[0-9a-f]{64}$/);
const UpperSnakeIdentifier = z.string().regex(/^[A-Z][A-Z0-9_]*$/);
const I18nKey = z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/);
const QualifiedQueryName = z.string().regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/);
const ColumnRef = z.string().regex(/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/);
const Int = z.number().int();
const PositiveInteger = Int.positive();
const Int32 = Int.min(-2147483648).max(2147483647);
const RFC3339UTC = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/).refine((s) => !Number.isNaN(Date.parse(s)), 'not a date');
/** Repository-relative POSIX path: no `..`, absolute path or URL (symlink escape is SL02's, against the candidate). */
export const RepoPath = z.string().min(1).refine((p) => !p.startsWith('/') && !p.includes('\\') && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(p) && !p.split('/').some((s) => s === '..' || s === '.' || s === ''), 'not a repository-relative POSIX path');
const Locale = z.string().refine((l) => { try { return Intl.getCanonicalLocales(l)[0] === l; } catch { return false; } }, 'canonical BCP 47 tag');
/** `:name` parameters; includes the mounted prefix. */
const AbsoluteRoutePath = z.string().regex(/^\/$|^(\/([A-Za-z0-9_-]+|:[A-Za-z_][A-Za-z0-9_]*))+$/);
export const Method = z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);

/** PostgreSQL reserved key words (PostgreSQL 16 Appendix C, "reserved" in the PostgreSQL column): 06 §2 `namespace` is non-reserved. */
/** STYNX's reserved schema set, unchanged (09 §5) [fact: `stynx:packages/cli/src/generate-module.ts:13-16,118-119`]; matching is exact. */
const PLATFORM_SCHEMAS = new Set(['archive', 'audit', 'auth', 'core', 'data', 'demo', 'flow', 'jobs', 'notifications', 'offline', 'outbox', 'sample', 'storage', 'tenancy', 'worklist']);
const reservedSchema = (n: string): boolean => n.startsWith('pg_') || n === 'public' || n === 'information_schema' || PLATFORM_SCHEMAS.has(n);
const PG_RESERVED = new Set(('all analyse analyze and any array as asc asymmetric both case cast check collate column constraint create current_catalog ' +
  'current_date current_role current_time current_timestamp current_user default deferrable desc distinct do else end except false fetch for foreign ' +
  'from grant group having in initially intersect into lateral leading limit localtime localtimestamp not null offset on only or order placing primary ' +
  'references returning select session_user some symmetric system_user table then to trailing true union unique user using variadic when where window with').split(' '));

// ---- the machine block ---------------------------------------------------------------------------

const WrittenStatus = z.union([z.literal('draft'), z.literal('approved'), z.string().regex(/^superseded-by: SPEC-[A-Z][A-Z0-9]*-[0-9]{3}$/)]);
const InputBinding = z.strictObject({ column: ColumnRef, required: z.boolean() });
const Bindings = z.record(SqlIdentifier, InputBinding);
const Idempotency = z.discriminatedUnion('mode', [
  z.strictObject({ mode: z.literal('none'), reason: NonemptyString }),
  z.strictObject({ mode: z.literal('key'), header: NonemptyString, ttlMs: PositiveInteger }),
]);
export const Route = z.strictObject({
  method: Method,
  path: AbsoluteRoutePath,
  idempotency: Idempotency,
  roles: z.array(Slug).min(1),
  errorContract: z.array(z.strictObject({ status: Int.min(400).max(599), code: UpperSnakeIdentifier, messageKey: I18nKey })).min(1),
  useCase: UseCaseId,
  slo: z.strictObject({ metric: z.literal('http.server.duration'), percentile: Int.min(1).max(99), maxMs: PositiveInteger }),
  request: z.strictObject({ body: Bindings, query: Bindings, params: Bindings }),
  response: z.strictObject({ status: Int.min(200).max(299), columns: z.array(ColumnRef).min(1) }),
});
const Pii = z.strictObject({ basis: NonemptyString, retention: NonemptyString });
const columnOf = <T extends string, L extends z.ZodType>(type: T, limits: L) => z.strictObject({
  name: SqlIdentifier,
  type: z.literal(type),
  limits,
  nullable: z.boolean(),
  default: z.enum(['generated-uuid', 'tenant-context', 'transaction-time']).optional(),
  pii: Pii.optional(),
});
export const Column = z.discriminatedUnion('type', [
  columnOf('uuid', z.strictObject({ format: z.literal('uuid') })),
  columnOf('varchar', z.strictObject({ minLength: Int.min(0), maxLength: Int.min(1) })),
  columnOf('integer', z.strictObject({ minimum: Int32, maximum: Int32 })),
  columnOf('boolean', z.strictObject({ values: z.tuple([z.literal(false), z.literal(true)]) })),
  columnOf('timestamptz', z.strictObject({ minimum: RFC3339UTC, maximum: RFC3339UTC })),
]);
export const Table = z.strictObject({ name: SqlIdentifier, primaryKey: z.array(SqlIdentifier).min(1), columns: z.array(Column).min(1) });
export const Query = z.strictObject({
  name: QualifiedQueryName,
  operation: z.enum(['insert', 'select-one']),
  table: SqlIdentifier,
  params: z.array(ColumnRef),
  returns: z.array(ColumnRef).min(1),
  expects: z.enum(['one', 'zero-or-one', 'many', 'none']),
});

/** The rule a semantic refinement belongs to (06 §4); spec-lint prints it, other consumers ignore it. */
export interface RuleParams { rule: 'SL03' | 'SL04' | 'SL05' | 'SL06' | 'SL08'; subject: string }

const productSegment = (product: string): string => product.toUpperCase().replace(/-/g, '');
const segmentOf = (id: string): string => id.split('-').slice(1, -1).join('-');
/** Routes collide when equal after parameter names are erased (06 §4 SL06: "equal parameterized route patterns also collide"). */
export const routePattern = (method: string, path: string): string => `${method} ${path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, ':')}`;

export const MachineBlock = z.strictObject({
  id: SpecId,
  status: WrittenStatus,
  'approved-by': NonemptyString.nullable(),
  supersedes: z.strictObject({ id: SpecId, path: RepoPath, sha256: Hex64 }).optional(),
  product: Slug,
  module: z.strictObject({ name: PascalCase, slug: Slug, namespace: SqlIdentifier.refine((n) => !PG_RESERVED.has(n), 'reserved word').refine((n) => !reservedSchema(n), 'reserved schema') }),
  sources: z.array(z.strictObject({ id: z.union([RuleId, UseCaseId]), path: RepoPath, quote: NonemptyString })).min(1),
  requirements: z.array(z.strictObject({
    id: RequirementId,
    text: NonemptyString,
    acceptance: z.enum(['yes', 'no']),
    observable: NonemptyString.nullable(),
    falsifier: NonemptyString.nullable(),
    sources: z.array(z.union([RuleId, UseCaseId])).min(1),
  })).min(1),
  routes: z.array(Route),
  data: z.strictObject({ tables: z.array(Table) }),
  queries: z.array(Query),
  i18n: z.record(I18nKey, z.record(Locale, NonemptyString)),
  unimplemented: z.array(z.strictObject({ requirement: RequirementId, name: NonemptyString.optional() })),
}).superRefine((b, ctx) => {
  const issue = (path: (string | number)[], message: string, params: RuleParams) => ctx.addIssue({ code: 'custom', path, message, params });
  const duplicates = (kind: string, ids: readonly string[], at: (i: number) => (string | number)[]) => {
    const seen = new Set<string>();
    ids.forEach((id, i) => {
      if (seen.has(id)) issue(at(i), `duplicate ${kind} ${id}`, { rule: 'SL06', subject: `${kind} ${id}` });
      seen.add(id);
    });
  };
  // Identity: product segments, approval pair, local id sets (SL06).
  const segment = productSegment(b.product);
  if (segmentOf(b.id) !== segment) issue(['id'], `product segment ≠ ${segment}`, { rule: 'SL06', subject: `spec ${b.id}` });
  b.sources.forEach((s, i) => { if (segmentOf(s.id) !== segment) issue(['sources', i, 'id'], `product segment ≠ ${segment}`, { rule: 'SL06', subject: `source ${s.id}` }); });
  b.routes.forEach((r, i) => { if (segmentOf(r.useCase) !== segment) issue(['routes', i, 'useCase'], `product segment ≠ ${segment}`, { rule: 'SL06', subject: `useCase ${r.useCase}` }); });
  if (b.status !== 'draft' && b['approved-by'] === null) ctx.addIssue({ code: 'custom', path: ['approved-by'], message: 'non-null for approved/superseded-by' });
  duplicates('source', b.sources.map((s) => s.id), (i) => ['sources', i, 'id']);
  duplicates('requirement', b.requirements.map((r) => r.id), (i) => ['requirements', i, 'id']);
  duplicates('table', b.data.tables.map((t) => t.name), (i) => ['data', 'tables', i, 'name']);
  b.data.tables.forEach((t, ti) => duplicates('column', t.columns.map((c) => `${t.name}.${c.name}`), (i) => ['data', 'tables', ti, 'columns', i, 'name']));
  duplicates('query', b.queries.map((q) => q.name), (i) => ['queries', i, 'name']);
  duplicates('unimplemented', b.unimplemented.map((u) => u.requirement), (i) => ['unimplemented', i, 'requirement']);
  duplicates('route', b.routes.map((r) => routePattern(r.method, r.path)), (i) => ['routes', i, 'path']);
  // Sets (06 §2 "maps have unique keys"; roles are a set).
  b.routes.forEach((r, i) => {
    const subject = `route ${r.method} ${r.path}`;
    if (new Set(r.roles).size !== r.roles.length) issue(['routes', i, 'roles'], 'duplicate role', { rule: 'SL04', subject });
    if (new Set(r.errorContract.map((e) => e.status)).size !== r.errorContract.length) issue(['routes', i, 'errorContract'], 'duplicate status', { rule: 'SL04', subject });
  });
  // Acceptance (SL03).
  b.requirements.forEach((r, i) => {
    if (r.acceptance === 'yes' && (r.observable === null || r.falsifier === null)) issue(['requirements', i], 'observable and falsifier required', { rule: 'SL03', subject: `acceptance ${r.id}` });
  });
  // Columns (SL05): table shape, bounds ordered, default/type pairs.
  const columns = new Map<string, z.infer<typeof Column>>();
  b.data.tables.forEach((t, ti) => {
    for (const c of t.columns) columns.set(`${t.name}.${c.name}`, c);
    const col = (name: string) => t.columns.find((c) => c.name === name);
    const tenant = col('tenant_id');
    if (!tenant || tenant.type !== 'uuid' || tenant.nullable) issue(['data', 'tables', ti, 'columns'], 'non-null UUID tenant_id required', { rule: 'SL05', subject: `column ${t.name}.tenant_id` });
    t.primaryKey.forEach((k, ki) => {
      const c = col(k);
      if (!c || c.nullable) issue(['data', 'tables', ti, 'primaryKey', ki], 'primary key column missing or nullable', { rule: 'SL05', subject: `column ${t.name}.${k}` });
    });
    t.columns.forEach((c, ci) => {
      const at = ['data', 'tables', ti, 'columns', ci];
      const subject = `column ${t.name}.${c.name}`;
      const l = c.limits as Record<string, unknown>;
      if (c.type === 'varchar' && (l['minLength'] as number) > (l['maxLength'] as number)) issue([...at, 'limits'], 'bounds not ordered', { rule: 'SL05', subject });
      if (c.type === 'integer' && (l['minimum'] as number) > (l['maximum'] as number)) issue([...at, 'limits'], 'bounds not ordered', { rule: 'SL05', subject });
      if (c.type === 'timestamptz' && Date.parse(l['minimum'] as string) > Date.parse(l['maximum'] as string)) issue([...at, 'limits'], 'bounds not ordered', { rule: 'SL05', subject });
      const pairs: Record<string, string> = { 'generated-uuid': 'uuid', 'tenant-context': 'uuid', 'transaction-time': 'timestamptz' };
      if (c.default !== undefined && pairs[c.default] !== c.type) issue([...at, 'default'], `default ${c.default} needs type ${pairs[c.default]}`, { rule: 'SL05', subject });
    });
  });
  // Route bindings (SL04): column refs resolve; path params are declared, bound and required.
  b.routes.forEach((r, i) => {
    const subject = `route ${r.method} ${r.path}`;
    const bad = (field: string, message: string) => issue(['routes', i, field], message, { rule: 'SL04', subject: `${subject}: missing or invalid ${field}` });
    for (const part of ['body', 'query', 'params'] as const) {
      for (const [name, binding] of Object.entries(r.request[part])) {
        if (!columns.has(binding.column)) bad('request', `${part}.${name}: unresolved column ${binding.column}`);
      }
    }
    const pathParams = [...r.path.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]!);
    const declared = Object.keys(r.request.params);
    if (pathParams.length !== declared.length || pathParams.some((p) => !declared.includes(p))) bad('request', 'params differ from the path parameters');
    for (const [name, binding] of Object.entries(r.request.params)) if (!binding.required) bad('request', `params.${name}: path params are always required`);
    for (const c of r.response.columns) if (!columns.has(c)) bad('response', `unresolved column ${c}`);
    if (new Set(r.response.columns).size !== r.response.columns.length) bad('response', 'duplicate column');
  });
  // Queries (SL08): table and refs resolve within it; no tenant argument; operation/cardinality pairs.
  b.queries.forEach((q, i) => {
    const subject = `query ${q.name}`;
    const bad = (message: string) => issue(['queries', i], message, { rule: 'SL08', subject });
    const table = b.data.tables.find((t) => t.name === q.table);
    const [ns, tableSegment] = q.name.split('.');
    if (ns !== b.module.namespace || tableSegment !== q.table) bad('name is not <namespace>.<table>.<label>');
    if (!table) return bad(`unresolved table ${q.table}`);
    for (const ref of [...q.params, ...q.returns]) if (!ref.startsWith(`${q.table}.`) || !columns.has(ref)) bad(`unresolved column ${ref}`);
    if (q.params.some((p) => p === `${q.table}.tenant_id`)) bad('tenant is never a parameter');
    if (q.operation === 'insert' && q.expects !== 'one') bad('insert permits expects: one');
    if (q.operation === 'select-one') {
      if (q.expects !== 'one' && q.expects !== 'zero-or-one') bad('select-one permits one|zero-or-one');
      if (!table.primaryKey.every((k) => q.params.includes(`${q.table}.${k}`))) bad('select-one requires a primary-key predicate');
    }
  });
});
export type MachineBlock = z.infer<typeof MachineBlock>;

// ---- 06 §3 use-case object -----------------------------------------------------------------------

const Text = z.string().min(1);
const unique = <T extends z.ZodArray<z.ZodType>>(arr: T, key: (v: z.infer<T>[number]) => string = (v) => JSON.stringify(v)) =>
  arr.superRefine((items, ctx) => {
    if (new Set(items.map(key)).size !== items.length) ctx.addIssue({ code: 'custom', message: 'items are not unique' });
  });
export const UseCase = z.strictObject({
  id: z.string().regex(/^UC-[A-Z][A-Z0-9]*-[0-9]{3}$/),
  product: z.string().regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/),
  title: Text,
  actor: z.strictObject({ name: Text, roles: unique(z.array(z.string().regex(/^[a-z][a-z0-9-]*$/)).min(1)) }),
  preconditions: z.array(Text).min(1),
  postconditions: z.array(Text).min(1),
  rules: unique(z.array(z.string().regex(/^RN-[A-Z][A-Z0-9]*-[0-9]{3}$/)).min(1)),
  endpoints: unique(z.array(z.strictObject({ method: Method, path: z.string().regex(/^\/[A-Za-z0-9/:_-]*$/) })).min(1), (e) => `${e.method} ${e.path}`),
});
export type UseCase = z.infer<typeof UseCase>;

// ---- reading a spec file -------------------------------------------------------------------------

/** Required human sections (06 §1) plus `## Contract`, which holds the block. */
export const REQUIRED_SECTIONS = ['Purpose', 'Scope', 'Contract', 'Contract notes', 'Acceptance notes', 'Open questions'] as const;

export interface BlockProblem { line: number; pointer: string; reason: string }

export type ReadSpec =
  | { kind: 'malformed'; problems: BlockProblem[] }
  | { kind: 'document'; value: unknown; lineOf: (path: readonly PropertyKey[]) => number; sections: string[]; problems: BlockProblem[]; block: string };

const FENCE = /^(`{3,}|~{3,})\s*([A-Za-z0-9_-]*)\s*$/;

/** JSON pointer (RFC 6901) of a zod/yaml path. */
export const pointer = (path: readonly PropertyKey[]): string => (path.length === 0 ? '/' : path.map((p) => `/${String(p).replace(/~/g, '~0').replace(/\//g, '~1')}`).join(''));

/**
 * Locates the sole `yaml` fence under `## Contract` and parses it per 07 §3. `malformed` covers readable
 * bytes that are not one valid machine block (06 §4 SL01: FAIL); line numbers are the spec file's.
 */
export function readSpec(text: string): ReadSpec {
  const lines = text.split('\n');
  const sections: string[] = [];
  const fences: { start: number; end: number; section: string | null }[] = [];
  let section: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const open = FENCE.exec(lines[i]!);
    if (open) {
      const marker = open[1]!;
      let j = i + 1;
      const close = new RegExp(`^\\${marker[0]}{${marker.length},}\\s*$`);
      while (j < lines.length && !close.test(lines[j]!)) j++;
      if (open[2] === 'yaml') fences.push({ start: i, end: j, section });
      i = j;
      continue;
    }
    const h = /^## (.+?)\s*$/.exec(lines[i]!);
    if (h) {
      section = h[1]!;
      sections.push(section);
    }
  }
  const problems: BlockProblem[] = [];
  for (const s of REQUIRED_SECTIONS) if (!sections.includes(s)) problems.push({ line: 1, pointer: '/', reason: `missing section ## ${s}` });
  const inContract = fences.filter((f) => f.section === 'Contract');
  for (const f of fences.filter((x) => x.section !== 'Contract')) problems.push({ line: f.start + 1, pointer: '/', reason: 'yaml block outside ## Contract' });
  if (inContract.length !== 1) {
    problems.push({ line: ((inContract[1] ?? inContract[0])?.start ?? 0) + 1, pointer: '/', reason: `${inContract.length} yaml blocks under ## Contract; exactly one is required` });
    return { kind: 'malformed', problems };
  }
  const fence = inContract[0]!;
  const offset = fence.start + 1; // spec line of the block's first line, minus one
  const source = lines.slice(fence.start + 1, fence.end).join('\n');
  const lc = new LineCounter();
  const doc = parseDocument(source, { version: '1.2', schema: 'core', uniqueKeys: true, lineCounter: lc, prettyErrors: false, keepSourceTokens: false });
  const at = (pos: number | undefined) => (pos === undefined ? offset + 1 : offset + lc.linePos(pos).line);
  const yamlProblems: BlockProblem[] = [...doc.errors, ...doc.warnings].map((e) => ({ line: at(e.pos[0]), pointer: '/', reason: e.message.split('\n')[0]! }));
  visit(doc, {
    Alias(_k, n) { yamlProblems.push({ line: at(n.range?.[0]), pointer: '/', reason: 'alias' }); },
    Node(_k, n) { if (n.tag) yamlProblems.push({ line: at(n.range?.[0]), pointer: '/', reason: `tag ${n.tag}` }); },
    Pair(_k, p) {
      if (!isScalar(p.key) || typeof p.key.value !== 'string') yamlProblems.push({ line: at(isScalar(p.key) || isAlias(p.key) ? p.key.range?.[0] : undefined), pointer: '/', reason: 'non-string key' });
    },
  });
  if (yamlProblems.length > 0) return { kind: 'malformed', problems: [...problems, ...yamlProblems] };
  const lineOf = (path: readonly PropertyKey[]): number => {
    for (let n = path.length; n >= 0; n--) {
      const node = doc.getIn(path.slice(0, n) as unknown[], true) as { range?: [number, number, number] } | undefined;
      if (node && typeof node === 'object' && node.range) return at(node.range[0]);
    }
    return offset + 1;
  };
  // `block`: the fenced YAML's bytes, every line newline-terminated (09 §2 `machineBlockSha256`).
  return { kind: 'document', value: doc.toJS(), lineOf, sections, problems, block: source + '\n' };
}
