// 08 B.10 column binding by `pg-query-emscripten` 5.1.0 parse: INSERT target list ↔ `$n` in `VALUES`,
// `UPDATE … SET col = $n`, `WHERE col = $n`. A `$n` under a cast, a function call or another expression is
// `unsupported-binding`; a `$n` that is bound to no column (e.g. `LIMIT $1`) has no limit obligation.
const PARSER: string = 'pg-query-emscripten'; // untyped package; imported by name (as sql-lint.ts does)

export interface Column { schema: string; table: string; column: string }
export interface Bindings {
  /** `$n` → the column it is written to or compared with. */
  bound: Map<number, Column & { target: boolean }>;
  /** `$n` reached only through an expression the binder cannot resolve. */
  unsupported: Set<number>;
}

type Node = Record<string, unknown>;
interface Parser { parse(text: string): { parse_tree?: { stmts?: { stmt: Node }[] }; error: { message: string } | null } }

let parser: Promise<Parser> | null = null;
/** Loads the parser once; a load failure rejects (the node reports `parser-unavailable`). */
export function loadParser(): Promise<Parser> {
  parser ??= import(PARSER).then(async (m: { default: unknown }) => {
    const mod = m.default as (() => Promise<Parser>) | Parser;
    return typeof mod === 'function' ? await mod() : mod;
  });
  return parser;
}

const paramOf = (n: unknown): number | null => {
  const p = (n as Node | undefined)?.['ParamRef'] as { number?: number } | undefined;
  return p?.number ?? null;
};
const columnName = (n: unknown): { qualifier: string | null; name: string } | null => {
  const fields = ((n as Node | undefined)?.['ColumnRef'] as { fields?: Node[] } | undefined)?.fields;
  if (!fields || fields.length === 0) return null;
  const names = fields.map((f) => (f['String'] as { sval?: string } | undefined)?.sval ?? null);
  if (names.some((s) => s === null)) return null;
  return names.length === 1 ? { qualifier: null, name: names[0]! } : { qualifier: names[names.length - 2]!, name: names[names.length - 1]! };
};

interface Relation { schema: string; table: string; alias: string | null }
const relationOf = (n: unknown): Relation | null => {
  const r = (n as Node | undefined)?.['RangeVar'] as { schemaname?: string; relname?: string; alias?: { aliasname?: string } } | undefined;
  if (!r?.relname) return null;
  return { schema: r.schemaname ?? 'public', table: r.relname, alias: r.alias?.aliasname ?? null };
};
const rawRelation = (r: { schemaname?: string; relname?: string; alias?: { aliasname?: string } } | undefined): Relation | null =>
  r?.relname ? { schema: r.schemaname ?? 'public', table: r.relname, alias: r.alias?.aliasname ?? null } : null;

/** Every ParamRef number under `n`, with whether it sits directly in `n` or deeper (inside an expression). */
function params(n: unknown, out: Set<number> = new Set()): Set<number> {
  if (Array.isArray(n)) for (const x of n) params(x, out);
  else if (n && typeof n === 'object') {
    const p = paramOf(n);
    if (p !== null) out.add(p);
    else for (const v of Object.values(n as Node)) params(v, out);
  }
  return out;
}

function resolveColumn(c: { qualifier: string | null; name: string }, rels: readonly Relation[]): Column | null {
  const rel = c.qualifier === null ? (rels.length === 1 ? rels[0]! : null) : rels.find((r) => r.alias === c.qualifier || r.table === c.qualifier) ?? null;
  return rel ? { schema: rel.schema, table: rel.table, column: c.name } : null;
}

/** `col = $n` / `$n = col` comparisons in a WHERE tree (AND/OR walked); other `$n` under it are left to the caller. */
function whereBindings(n: unknown, rels: readonly Relation[], b: Bindings): void {
  if (Array.isArray(n)) return void n.forEach((x) => whereBindings(x, rels, b));
  if (!n || typeof n !== 'object') return;
  const node = n as Node;
  const bool = node['BoolExpr'] as { args?: unknown[] } | undefined;
  if (bool) return void whereBindings(bool.args ?? [], rels, b);
  const expr = node['A_Expr'] as { kind?: string; name?: Node[]; lexpr?: unknown; rexpr?: unknown } | undefined;
  if (expr && expr.kind === 'AEXPR_OP' && (expr.name?.[0]?.['String'] as { sval?: string } | undefined)?.sval === '=') {
    const [col, par] = columnName(expr.lexpr) && paramOf(expr.rexpr) !== null ? [expr.lexpr, expr.rexpr] : columnName(expr.rexpr) && paramOf(expr.lexpr) !== null ? [expr.rexpr, expr.lexpr] : [null, null];
    if (col && par) {
      const c = resolveColumn(columnName(col)!, rels);
      if (c) b.bound.set(paramOf(par)!, { ...c, target: false });
      return;
    }
  }
  for (const v of Object.values(node)) whereBindings(v, rels, b);
}

/** Bindings of the one statement in `text`; null when the text does not parse to one statement. */
export function bindingsOf(p: Parser, text: string): Bindings | null {
  const r = p.parse(text);
  const stmts = r.parse_tree?.stmts;
  if (r.error || !stmts || stmts.length !== 1) return null;
  const stmt = stmts[0]!.stmt;
  const b: Bindings = { bound: new Map(), unsupported: new Set() };
  const ins = stmt['InsertStmt'] as { relation?: Node; cols?: Node[]; selectStmt?: Node } | undefined;
  const upd = stmt['UpdateStmt'] as { relation?: Node; targetList?: Node[]; whereClause?: unknown; fromClause?: unknown[] } | undefined;
  const sel = stmt['SelectStmt'] as { fromClause?: unknown[]; whereClause?: unknown } | undefined;
  const del = stmt['DeleteStmt'] as { relation?: Node; whereClause?: unknown } | undefined;
  if (ins) {
    const rel = rawRelation(ins.relation as never);
    const cols = (ins.cols ?? []).map((c) => (c['ResTarget'] as { name?: string }).name ?? null);
    const values = ((ins.selectStmt?.['SelectStmt'] as { valuesLists?: Node[] } | undefined)?.valuesLists ?? []);
    for (const list of values) {
      ((list['List'] as { items?: unknown[] } | undefined)?.items ?? []).forEach((item, i) => {
        const n = paramOf(item);
        if (n !== null && rel && cols[i]) b.bound.set(n, { schema: rel.schema, table: rel.table, column: cols[i]!, target: true });
      });
    }
  } else if (upd) {
    const rel = rawRelation(upd.relation as never);
    for (const t of upd.targetList ?? []) {
      const rt = t['ResTarget'] as { name?: string; val?: unknown };
      const n = paramOf(rt.val);
      if (n !== null && rel && rt.name) b.bound.set(n, { schema: rel.schema, table: rel.table, column: rt.name, target: true });
    }
    if (rel) whereBindings(upd.whereClause, [rel], b);
  } else if (sel) {
    const rels = (sel.fromClause ?? []).map(relationOf).filter((x): x is Relation => x !== null);
    whereBindings(sel.whereClause, rels, b);
  } else if (del) {
    const rel = rawRelation(del.relation as never);
    if (rel) whereBindings(del.whereClause, [rel], b);
  }
  // A `$n` under a cast or a function call that no rule above bound is not resolvable to a column.
  const wrapped = new Set<number>();
  const walk = (n: unknown, inside: boolean): void => {
    if (Array.isArray(n)) return void n.forEach((x) => walk(x, inside));
    if (!n || typeof n !== 'object') return;
    const p = paramOf(n);
    if (p !== null) {
      if (inside) wrapped.add(p);
      return;
    }
    for (const [k, v] of Object.entries(n as Node)) walk(v, inside || k === 'TypeCast' || k === 'FuncCall' || k === 'CoalesceExpr');
  };
  walk(stmt, false);
  for (const n of params(stmt)) if (!b.bound.has(n) && wrapped.has(n)) b.unsupported.add(n);
  return b;
}
