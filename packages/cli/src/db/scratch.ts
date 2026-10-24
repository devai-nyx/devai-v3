// 08 B.20 scratch databases: `devai_<digest12>`, digest12 = first 12 hex of sha256(sorted input paths and
// contents ‖ runtime mode ‖ a per-run nonce); the nonce lives only in memory and in the descriptor
// `.devai/cache/scratch/<digest12>.json`. A `42P04` on CREATE is reused only when a descriptor of this
// repository names the database with the same input digest, else `scratch-collision`, never a DROP.
// `--prune` drops exactly the databases descriptors name (A.3), and a failed drop keeps the descriptor.
import { randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { sha256 } from '../candidate/digest.js';
import { frame, frameList } from '../cache/key.js';
import { CACHE_DIR } from '../cache/store.js';
import { connect, type Server, urlOf } from './provide.js';

export const SCRATCH_DIR = `${CACHE_DIR}/scratch`;

/** What a consumer of `db-apply` needs (B.21, B.22, B.10 DB part). */
export interface Scratch {
  database: string;
  server: Server;
  /** The scratch database's URL, passed to consumers as `DATABASE_URL`. */
  url: string;
}

const Descriptor = z.strictObject({
  database: z.string().regex(/^devai_[0-9a-f]{12}$/),
  /** realpath of the repository root: a descriptor of another repository never authorises reuse. */
  repository: z.string().min(1),
  inputDigest: z.string().regex(/^[0-9a-f]{64}$/),
  runtime: z.enum(['bare', 'docker']),
  nonce: z.string().regex(/^[0-9a-f]{32}$/),
  host: z.string(),
  port: z.number().int(),
  user: z.string(),
  schemaDigest: z.string().regex(/^[0-9a-f]{64}$/).nullable(),
});
export type Descriptor = z.infer<typeof Descriptor>;

export type Inputs = readonly { path: string; sha256: string | null }[];

/** The sorted inputs (`<path>:<content sha256>`, length-framed as C.4 frames lists) ‖ the runtime mode. */
function named(inputs: Inputs, runtime: string): Buffer[] {
  const sorted = [...inputs].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return [frame(frameList(sorted.map((i) => `${i.path}:${i.sha256 ?? 'absent'}`))), frame(runtime)];
}

/** The nonce-free digest a descriptor records, so the edit loop can recognise its own database (B.20 reuse). */
export const inputDigestOf = (inputs: Inputs, runtime: string): string => sha256(Buffer.concat(named(inputs, runtime)));

/** `devai_<digest12>`, digest12 = first 12 hex of sha256(sorted inputs ‖ runtime mode ‖ nonce). */
export const databaseOf = (inputs: Inputs, runtime: string, nonce: string): string =>
  `devai_${sha256(Buffer.concat([...named(inputs, runtime), frame(nonce)])).slice(0, 12)}`;
export const newNonce = (): string => randomBytes(16).toString('hex');

const repositoryOf = (root: string): string => realpathSync(root);
const pathOf = (root: string, database: string): string => resolve(root, SCRATCH_DIR, `${database.slice('devai_'.length)}.json`);

export function readDescriptor(root: string, database: string): Descriptor | null {
  try {
    const d = Descriptor.parse(JSON.parse(readFileSync(pathOf(root, database), 'utf8')));
    return d.database === database && d.repository === repositoryOf(root) ? d : null;
  } catch {
    return null;
  }
}

export function writeDescriptor(root: string, d: Descriptor): void {
  mkdirSync(resolve(root, SCRATCH_DIR), { recursive: true });
  writeFileSync(pathOf(root, d.database), JSON.stringify(d, null, 2) + '\n');
}

export function descriptor(root: string, database: string, inputDigest: string, runtime: 'bare' | 'docker', nonce: string, server: Server): Descriptor {
  return { database, repository: repositoryOf(root), inputDigest, runtime, nonce, host: server.host, port: server.port, user: server.user, schemaDigest: null };
}

export const scratchOf = (server: Server, database: string): Scratch => ({ database, server, url: urlOf(server, database) });

export type Created = { kind: 'created' } | { kind: 'reused' } | { kind: 'collision' } | { kind: 'denied'; message: string } | { kind: 'unreachable'; message: string };

/** `CREATE DATABASE devai_<digest12>` on the admin connection (B.20). */
export async function createScratch(root: string, server: Server, database: string, inputDigest: string): Promise<Created> {
  let client;
  try {
    client = await connect(server, server.database);
  } catch (e) {
    return { kind: 'unreachable', message: (e as Error).message };
  }
  try {
    await client.query(`CREATE DATABASE "${database}"`); // the name is [a-z0-9_] by construction
    return { kind: 'created' };
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === '42P04') {
      const d = readDescriptor(root, database);
      return d && d.inputDigest === inputDigest ? { kind: 'reused' } : { kind: 'collision' };
    }
    if (code === '42501') return { kind: 'denied', message: (e as Error).message };
    return { kind: 'unreachable', message: (e as Error).message };
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** True when `database` exists on `server`. */
export async function exists(server: Server, database: string): Promise<boolean> {
  try {
    const client = await connect(server, server.database);
    try {
      return (await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database])).rowCount === 1;
    } finally {
      await client.end().catch(() => undefined);
    }
  } catch {
    return false;
  }
}

/** DROP DATABASE of a descriptor-named database; returns null or the failure message. */
export async function dropScratch(server: Server, database: string): Promise<string | null> {
  if (!/^devai_[0-9a-f]{12}$/.test(database)) return `${database} is not a scratch database name`;
  try {
    const client = await connect(server, server.database);
    try {
      await client.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
      return null;
    } finally {
      await client.end().catch(() => undefined);
    }
  } catch (e) {
    return (e as Error).message;
  }
}

/** A.3 `--prune`: drop the databases this repository's descriptors name (only those), then delete the descriptors. */
export async function pruneScratch(root: string, server: Server | null, diagnostic: (line: string) => void): Promise<number> {
  const dir = resolve(root, SCRATCH_DIR);
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => /^[0-9a-f]{12}\.json$/.test(f));
  } catch {
    return 0;
  }
  let dropped = 0;
  for (const f of files) {
    const d = readDescriptor(root, `devai_${f.slice(0, 12)}`);
    if (!d) continue;
    if (!server) {
      diagnostic(`devai: ${d.database} kept: postgres not reachable for --prune; its descriptor stays`);
      continue;
    }
    const failed = await dropScratch({ ...server, host: d.host, port: d.port }, d.database);
    if (failed !== null) {
      diagnostic(`devai: drop ${d.database} failed: ${failed}; its descriptor stays for the next --prune`);
      continue;
    }
    rmSync(resolve(dir, f), { force: true });
    dropped++;
  }
  return dropped;
}
