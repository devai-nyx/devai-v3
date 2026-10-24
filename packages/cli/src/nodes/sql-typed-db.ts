// 08 B.10 `sql-typed`, DB part (R6 W3): describe every changed `defineQuery` site on `db-apply`'s scratch
// database as `<product>_app`, then compare `parameterDescription` with the tuple, each OID with 02 §3's
// explicit zod-leaf table, `rowDescription` with the `row` keys, and the bound columns' limits
// (`information_schema.columns`, CHECK `char_length` bounds, integer ranges, nullability of insert and
// update targets). Never `bind`/`execute`.
import type pg from 'pg';
import { bindingsOf, type Column, loadParser } from '../db/bindings.js';
import { adapterBinding, type Described, describe } from '../db/describe.js';
import { connect } from '../db/provide.js';
import type { RunContext } from '../runner/run.js';
import type { Finding, Unknown } from '../ts/outcome.js';
import { ts } from '../ts/program.js';
import { HINTS } from '../text/hints.js';
import { type QuerySite, zodChain } from './sql-typed.js';

/** 02 §3 step 2: the explicit OID → zod-leaf table (PostgreSQL 16 built-in OIDs). */
interface Leaf { typname: string; leaf: string; accepts: (base: string, methods: readonly string[]) => boolean }
const str = (b: string) => b === 'string' || b === 'enum' || b === 'literal';
const LEAVES: Record<number, Leaf> = {
  2950: { typname: 'uuid', leaf: 'z.string().uuid()', accepts: (b, m) => b === 'uuid' || (b === 'string' && m.includes('uuid')) },
  21: { typname: 'int2', leaf: 'z.number().int()', accepts: (b, m) => b === 'int' || (b === 'number' && m.includes('int')) },
  23: { typname: 'int4', leaf: 'z.number().int()', accepts: (b, m) => b === 'int' || (b === 'number' && m.includes('int')) },
  20: { typname: 'int8', leaf: 'z.bigint()', accepts: (b) => b === 'bigint' },
  25: { typname: 'text', leaf: 'z.string()', accepts: str },
  1043: { typname: 'varchar', leaf: 'z.string()', accepts: str },
  1042: { typname: 'bpchar', leaf: 'z.string()', accepts: str },
  1184: { typname: 'timestamptz', leaf: 'z.date()', accepts: (b) => b === 'date' },
  1114: { typname: 'timestamp', leaf: 'z.date()', accepts: (b) => b === 'date' },
  1082: { typname: 'date', leaf: 'z.string().date()', accepts: (b, m) => b === 'string' && m.includes('date') },
  16: { typname: 'bool', leaf: 'z.boolean()', accepts: (b) => b === 'boolean' },
  1700: { typname: 'numeric', leaf: 'z.string()', accepts: (b) => b === 'string' },
  114: { typname: 'json', leaf: 'a declared object schema', accepts: (b) => ['object', 'strictObject', 'looseObject', 'record', 'array'].includes(b) },
  3802: { typname: 'jsonb', leaf: 'a declared object schema', accepts: (b) => ['object', 'strictObject', 'looseObject', 'record', 'array'].includes(b) },
};
/** `_<type>` → `z.array(leaf)`. */
const ARRAYS: Record<number, number> = { 2951: 2950, 1005: 21, 1007: 23, 1016: 20, 1009: 25, 1015: 1043, 1014: 1042, 1185: 1184, 1115: 1114, 1182: 1082, 1000: 16, 1231: 1700, 199: 114, 3807: 3802 };
/** The constructors the table can judge; any other expression (an identifier, a helper) is not compared. */
const JUDGED = new Set(['string', 'number', 'int', 'bigint', 'date', 'boolean', 'uuid', 'object', 'strictObject', 'looseObject', 'record', 'array', 'enum', 'literal']);

const LIMIT_HINT = "keep the zod bound within the column's limits; in a generated module, equal to the spec's data bound";
const INT_RANGE: Record<string, [number, number]> = { smallint: [-32768, 32767], integer: [-2147483648, 2147483647], bigint: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER] };

/** The zod chain of a `z.…` call expression, or null for anything the table cannot judge. */
function judged(e: ts.Expression): { base: string; methods: string[]; chain: ReturnType<typeof zodChain> } | null {
  const chain = zodChain(e);
  if (chain.length === 0) return null;
  // The receiver of the first call must be `z` (or `z.coerce`).
  let cur: ts.Expression = e;
  while (ts.isCallExpression(cur) && ts.isPropertyAccessExpression(cur.expression)) cur = cur.expression.expression;
  const root = ts.isPropertyAccessExpression(cur) ? cur.expression : cur;
  if (!ts.isIdentifier(root) || root.text !== 'z') return null;
  const base = chain[0]!.method;
  return JUDGED.has(base) ? { base, methods: chain.map((c) => c.method), chain } : null;
}

type Verdict = { kind: 'ok' } | { kind: 'mismatch'; leaf: Leaf } | { kind: 'unsupported' };
function compatible(oid: number, e: ts.Expression | undefined): Verdict {
  const arrayOf = ARRAYS[oid];
  const leaf = LEAVES[oid] ?? (arrayOf !== undefined ? LEAVES[arrayOf] : undefined);
  if (!leaf) return { kind: 'unsupported' };
  const j = e ? judged(e) : null;
  if (!j) return { kind: 'ok' };
  if (arrayOf !== undefined) return j.base === 'array' ? { kind: 'ok' } : { kind: 'mismatch', leaf: { ...leaf, leaf: `z.array(${leaf.leaf})`, typname: `_${leaf.typname}` } };
  return leaf.accepts(j.base, j.methods) ? { kind: 'ok' } : { kind: 'mismatch', leaf };
}

/** `row: z.object({...})` (or an identifier bound to one in the same file) → key → expression. */
function rowShape(site: QuerySite): Map<string, ts.Expression> | null {
  const call = site.call;
  const arg = call?.arguments[0];
  if (!arg || !ts.isObjectLiteralExpression(arg)) return null;
  const p = arg.properties.find((x): x is ts.PropertyAssignment => ts.isPropertyAssignment(x) && ts.isIdentifier(x.name) && x.name.text === 'row');
  let e: ts.Expression | undefined = p?.initializer;
  if (e && ts.isIdentifier(e)) {
    const name = e.text;
    let init: ts.Expression | undefined;
    const visit = (n: ts.Node): void => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name && n.initializer) init = n.initializer;
      else ts.forEachChild(n, visit);
    };
    visit(site.sf);
    e = init;
  }
  if (!e || !ts.isCallExpression(e) || !ts.isPropertyAccessExpression(e.expression) || !['object', 'strictObject', 'looseObject'].includes(e.expression.name.text)) return null;
  const o = e.arguments[0];
  if (!o || !ts.isObjectLiteralExpression(o)) return null;
  const out = new Map<string, ts.Expression>();
  for (const prop of o.properties) {
    if (!ts.isPropertyAssignment(prop)) return null;
    const k = ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name) ? prop.name.text : null;
    if (k === null) return null;
    out.set(k, prop.initializer);
  }
  return out;
}

interface ColumnInfo { data_type: string; character_maximum_length: number | null; is_nullable: 'YES' | 'NO'; checks: string[] }

async function columnInfo(client: pg.Client, c: Column, cache: Map<string, ColumnInfo | null>): Promise<ColumnInfo | null> {
  const key = `${c.schema}.${c.table}.${c.column}`;
  if (cache.has(key)) return cache.get(key)!;
  const col = await client.query<{ data_type: string; character_maximum_length: number | null; is_nullable: 'YES' | 'NO' }>(
    'SELECT data_type, character_maximum_length, is_nullable FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3',
    [c.schema, c.table, c.column]);
  const checks = await client.query<{ def: string }>(
    `SELECT pg_get_constraintdef(con.oid) AS def FROM pg_constraint con JOIN pg_class r ON r.oid = con.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace
      WHERE con.contype = 'c' AND n.nspname = $1 AND r.relname = $2`, [c.schema, c.table]);
  const row = col.rows[0];
  const info = row ? { ...row, checks: checks.rows.map((r) => r.def) } : null;
  cache.set(key, info);
  return info;
}

/** `char_length(col)` bounds from CHECK definitions (`BETWEEN a AND b` or `>= a AND <= b`; PostgreSQL renders the former as the latter). */
export function charLengthBounds(defs: readonly string[], column: string): { min: number | null; max: number | null } {
  let min: number | null = null;
  let max: number | null = null;
  const col = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ref = `char_length\\(\\(*"?${col}"?\\)*(?:::[a-z ]+)?\\)*`;
  for (const def of defs) {
    for (const m of def.matchAll(new RegExp(`${ref}\\s*BETWEEN\\s+(\\d+)\\s+AND\\s+(\\d+)`, 'gi'))) { min = Number(m[1]); max = Number(m[2]); }
    for (const m of def.matchAll(new RegExp(`${ref}\\s*(>=|>|<=|<)\\s*\\(?(\\d+)`, 'gi'))) {
      const v = Number(m[2]);
      if (m[1] === '>=') min = v; else if (m[1] === '>') min = v + 1; else if (m[1] === '<=') max = v; else max = v - 1;
    }
  }
  return { min, max };
}

const num = (chain: ReturnType<typeof zodChain>, m: string): number | null => {
  const v = chain.find((c) => c.method === m)?.args[0];
  return typeof v === 'number' ? v : null;
};
const typeLabel = (i: ColumnInfo): string =>
  i.data_type === 'character varying' ? `varchar(${i.character_maximum_length})` : i.data_type === 'character' ? `char(${i.character_maximum_length})` : i.data_type;

async function limitFindings(client: pg.Client, site: QuerySite, n: number, e: ts.Expression, c: Column & { target: boolean }, cache: Map<string, ColumnInfo | null>): Promise<Finding[]> {
  const info = await columnInfo(client, c, cache);
  const j = judged(e);
  if (!info || !j) return [];
  const at = `${site.path}:${site.line}`;
  const text = e.getText(site.sf);
  const ref = `${c.schema}.${c.table}.${c.column}`;
  const out: Finding[] = [];
  const max = num(j.chain, 'max');
  const min = num(j.chain, 'min');
  if (info.character_maximum_length !== null && j.base === 'string' && (max === null || max > info.character_maximum_length)) {
    out.push({ locator: at, message: `param $${n} ${text} exceeds ${ref} ${typeLabel(info)}`, standard: 'S-27', hint: LIMIT_HINT });
  }
  const b = charLengthBounds(info.checks, c.column);
  if ((b.min !== null || b.max !== null) && j.base === 'string' && ((b.min !== null && (min ?? 0) < b.min) || (b.max !== null && (max === null || max > b.max)))) {
    out.push({ locator: at, message: `param $${n} ${text} outside CHECK char_length BETWEEN ${b.min ?? 0} AND ${b.max ?? '∞'}`, standard: 'S-27', hint: LIMIT_HINT });
  }
  const range = INT_RANGE[info.data_type];
  if (range && (j.base === 'number' || j.base === 'int') && (min === null || min < range[0] || max === null || max > range[1])) {
    out.push({ locator: at, message: `param $${n} ${text} outside ${ref} ${info.data_type} range ${range[0]}..${range[1]}`, standard: 'S-27', hint: LIMIT_HINT });
  }
  if (c.target && info.is_nullable === 'NO' && j.methods.some((m) => m === 'nullable' || m === 'optional' || m === 'nullish')) {
    out.push({ locator: at, message: `param $${n} ${text} accepts null but ${ref} is NOT NULL`, standard: 'S-27', hint: LIMIT_HINT });
  }
  return out;
}

const unsupportedOid = (site: QuerySite, what: string, oid: number): Unknown =>
  ({ reason: 'unsupported-oid', finding: { locator: `${site.path}:${site.line}`, message: `${what} unsupported-oid ${oid}`, standard: 'S-21', hint: HINTS['unsupported-oid'] } });
const unreachable = (ctx: RunContext, detail: string): Unknown =>
  ({ reason: 'postgres-unreachable', finding: { locator: 'devai.json:1', message: `postgres-unreachable (${ctx.runtime}): ${detail}`, standard: '02 §6', hint: HINTS['postgres-unreachable'] } });

/** What the describe step of one site compares (exported for the R2 four-case tests). */
export function compare(site: QuerySite, d: Described): { findings: Finding[]; unknowns: Unknown[] } {
  const findings: Finding[] = [];
  const unknowns: Unknown[] = [];
  const at = `${site.path}:${site.line}`;
  if (site.params && d.params.length !== site.params.length) {
    findings.push({ locator: at, message: `$${d.params.length} declared but tuple has ${site.params.length} params`, standard: 'S-21', hint: 'make z.tuple([...]) list one schema per $n' });
  }
  d.params.forEach((oid, i) => {
    const v = compatible(oid, site.params?.[i]);
    if (v.kind === 'unsupported') unknowns.push(unsupportedOid(site, `param $${i + 1}`, oid));
    else if (v.kind === 'mismatch') findings.push({ locator: at, message: `param $${i + 1} ${site.params![i]!.getText(site.sf)} is not the ${v.leaf.typname} leaf ${v.leaf.leaf}`, standard: 'S-21', hint: `declare $${i + 1} as ${v.leaf.leaf} (02 §3)` });
  });
  const shape = rowShape(site);
  const fields = d.fields ?? [];
  if (shape) {
    for (const f of fields) {
      const e = shape.get(f.name);
      if (!e) {
        findings.push({ locator: at, message: `row column ${f.name} is not a key of row`, standard: 'S-21', hint: 'add the column to row or stop selecting it' });
        continue;
      }
      const v = compatible(f.dataTypeID, e);
      if (v.kind === 'unsupported') unknowns.push(unsupportedOid(site, `row column ${f.name}`, f.dataTypeID));
      else if (v.kind === 'mismatch') findings.push({ locator: at, message: `row key ${f.name} ${e.getText(site.sf)} is not the ${v.leaf.typname} leaf ${v.leaf.leaf}`, standard: 'S-21', hint: `declare ${f.name} as ${v.leaf.leaf} (02 §3)` });
    }
    for (const k of shape.keys()) if (!fields.some((f) => f.name === k)) findings.push({ locator: at, message: `row key ${k} is not returned by the statement`, standard: 'S-21', hint: 'return the column or drop the key' });
  } else {
    for (const f of fields) if (!LEAVES[f.dataTypeID] && ARRAYS[f.dataTypeID] === undefined) unknowns.push(unsupportedOid(site, `row column ${f.name}`, f.dataTypeID));
  }
  return { findings, unknowns };
}

export interface DbResult { findings: Finding[]; unknowns: Unknown[]; described: Set<QuerySite> }

/** The DB part over `sites` (static checks already ran); a could-not-observe cause is returned as the only unknown. */
export async function dbPhase(ctx: RunContext, sites: readonly QuerySite[]): Promise<DbResult> {
  const findings: Finding[] = [];
  const unknowns: Unknown[] = [];
  const described = new Set<QuerySite>();
  const bound = adapterBinding();
  if (bound !== null) return { findings, unknowns: [{ reason: 'adapter-unbound', finding: { locator: 'package.json:1', message: `adapter-unbound: ${bound}`, standard: 'S-21', hint: HINTS['adapter-unbound'] } }], described };
  let parser;
  try {
    parser = await loadParser();
  } catch (e) {
    return { findings, unknowns: [{ reason: 'parser-unavailable', finding: { locator: 'package.json:1', message: `pg-query-emscripten could not be loaded: ${(e as Error).message.split('\n')[0]}`, standard: 'S-21', hint: HINTS['parser-unavailable'] } }], described };
  }
  if (!ctx.scratch) return { findings, unknowns: [unreachable(ctx, 'db-apply provided no scratch database')], described };
  let dropped: string | null = null;
  let client: pg.Client;
  try {
    client = await connect(ctx.scratch.server, ctx.scratch.database, (e) => { dropped = e.message || 'connection lost'; });
  } catch (e) {
    return { findings, unknowns: [unreachable(ctx, (e as Error).message)], described };
  }
  try {
    const role = `${ctx.config.productPrefix}_app`;
    try {
      await client.query(`SET ROLE "${role}"`); // B.10: describe as the application role
    } catch (e) {
      return { findings, unknowns: [unreachable(ctx, `SET ROLE ${role}: ${(e as Error).message}`)], described };
    }
    const cache = new Map<string, ColumnInfo | null>();
    for (const site of sites) {
      if (site.text === null || site.name === null) continue;
      const d = await describe(client, site.text, () => dropped);
      if (d.kind === 'unreachable') return { findings, unknowns: [unreachable(ctx, d.message)], described };
      described.add(site);
      if (d.kind === 'error') {
        findings.push({ locator: `${site.path}:${site.line}`, message: `prepare failed: ${d.sqlstate} ${d.message}`, standard: 'S-21', hint: 'fix the SQL text' });
        continue;
      }
      const c = compare(site, d);
      findings.push(...c.findings);
      unknowns.push(...c.unknowns);
      const b = bindingsOf(parser, site.text);
      if (!b) continue;
      for (const n of [...b.unsupported].sort((x, y) => x - y)) {
        unknowns.push({ reason: 'unsupported-binding', finding: { locator: `${site.path}:${site.line}`, message: `param $${n} unsupported-binding`, standard: 'S-27', hint: HINTS['unsupported-binding'] } });
      }
      for (const [n, col] of [...b.bound].sort((x, y) => x[0] - y[0])) {
        const e = site.params?.[n - 1];
        if (e) findings.push(...(await limitFindings(client, site, n, e, col, cache)));
      }
    }
  } finally {
    await client.end().catch(() => undefined);
  }
  return { findings, unknowns, described };
}
