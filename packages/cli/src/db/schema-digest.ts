// 08 C.4 `schemaDigest`: sha256 over the sorted, length-framed rows of the catalog views C.4 lists, for
// non-system schemas, with OIDs, owners, timestamps, statistics and the scratch database name excluded
// and references rendered as qualified names, so both runtimes produce the same digest (D-039).
import type pg from 'pg';
import { sha256 } from '../candidate/digest.js';
import { frame, frameList } from '../cache/key.js';

const SYSTEM = `('pg_catalog', 'information_schema', 'pg_toast')`;
const userSchema = (col: string) => `${col} NOT IN ${SYSTEM} AND ${col} NOT LIKE 'pg\\_temp\\_%' AND ${col} NOT LIKE 'pg\\_toast\\_temp\\_%'`;

/** One query per C.4 section; each selected column is rendered as text (null as the empty marker below). */
const sections = (roles: readonly string[]): [string, string, unknown[]][] => [
  ['columns', `SELECT table_schema, table_name, column_name, ordinal_position, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable, column_default
     FROM information_schema.columns WHERE ${userSchema('table_schema')}`, []],
  ['constraints', `SELECT n.nspname, r.relname, c.conname, pg_get_constraintdef(c.oid)
     FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace WHERE ${userSchema('n.nspname')}`, []],
  ['indexes', `SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes WHERE ${userSchema('schemaname')}`, []],
  ['policies', `SELECT schemaname, tablename, policyname, permissive, array_to_string(roles, ','), cmd, qual, with_check FROM pg_policies WHERE ${userSchema('schemaname')}`, []],
  ['functions', `SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid), CASE WHEN p.prokind IN ('f', 'p', 'w') THEN pg_get_functiondef(p.oid) END
     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE ${userSchema('n.nspname')}`, []],
  ['rls', `SELECT n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
     FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relkind IN ('r', 'p') AND ${userSchema('n.nspname')}`, []],
  ['roles', `SELECT rolname, rolbypassrls, rolsuper, rolcanlogin FROM pg_roles WHERE rolname = ANY($1)`, [roles]],
  ['grants', `SELECT grantee, table_schema, table_name, privilege_type, is_grantable FROM information_schema.role_table_grants WHERE grantee = ANY($1)`, [roles]],
];

const NULL = '\u0000null';

/** `schemaDigest` of the database `client` is connected to; roles = `<product>_{owner,app,reader}`. */
export async function schemaDigest(client: pg.Client, productPrefix: string): Promise<string> {
  const roles = ['owner', 'app', 'reader'].map((r) => `${productPrefix}_${r}`);
  const parts: Buffer[] = [];
  for (const [name, text, values] of sections(roles)) {
    const res = await client.query({ text, values, rowMode: 'array' });
    const rows = (res.rows as unknown[][]).map((r) => frameList(r.map((v) => (v === null ? NULL : String(v)))).toString('utf8')).sort();
    parts.push(frame(name), frame(frameList(rows)));
  }
  return sha256(Buffer.concat(parts));
}
