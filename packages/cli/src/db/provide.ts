// 02 §6 `provide('postgres')` and 07 §4's runtime preflight for the `needs: postgres` nodes: bare reads the
// admin URL from the environment variable `devai.json` names (`env:DATABASE_URL`); docker runs
// `docker compose up -d <service>` from the product's `compose.yaml` and connects to the published port.
// A missing prerequisite is `UNKNOWN` with the remedy, never a fallback to the other mode (02 §6).
import pg from 'pg';
import type { DevaiConfig } from '../config.js';
import { firstLine, unknown, type Unknown } from '../proc/tool.js';
import { spawn } from '../proc/spawn.js';

export type Runtime = 'bare' | 'docker';

/** The admin connection on the declared server (CREATE DATABASE privilege expected, B.20). */
export interface Server {
  host: string;
  port: number;
  user: string;
  password: string | undefined;
  /** The database the admin URL names (never written to; scratch databases are created beside it). */
  database: string;
}

export type Provided = { kind: 'ok'; server: Server } | { kind: 'unknown'; unknown: Unknown };

const STANDARD = '02 §6';
const CONNECT_TIMEOUT_MS = 5000;

const unreachable = (runtime: Runtime, detail: string): Unknown =>
  unknown('postgres-unreachable', 'devai.json:1', `postgres-unreachable (${runtime}): ${detail}`, STANDARD);
const dockerDown = (detail: string): Unknown => unknown('docker-unreachable', 'compose.yaml:1', `docker-unreachable: ${detail}`, STANDARD);

/** A `postgres://` URL as connection fields; libpq defaults (OS user, port 5432) fill the gaps. */
export function serverOf(url: string): Server {
  const u = new URL(url);
  return {
    host: decodeURIComponent(u.hostname) || 'localhost',
    port: u.port ? Number(u.port) : 5432,
    user: decodeURIComponent(u.username) || process.env['PGUSER'] || process.env['USER'] || 'postgres',
    password: u.password ? decodeURIComponent(u.password) : process.env['PGPASSWORD'],
    database: decodeURIComponent(u.pathname.replace(/^\//, '')) || 'postgres',
  };
}

/** The URL of `database` on `server` (credentials included: never printed, never put on argv). */
export function urlOf(server: Server, database: string): string {
  const auth = encodeURIComponent(server.user) + (server.password !== undefined ? `:${encodeURIComponent(server.password)}` : '');
  return `postgresql://${auth}@${server.host.includes(':') ? `[${server.host}]` : server.host}:${server.port}/${encodeURIComponent(database)}`;
}

/** The libpq environment of `database` on `server` (B.20: `PGHOST`…`PGDATABASE`, so no URL reaches argv or the xtrace). */
export function pgEnv(server: Server, database: string): Record<string, string> {
  return {
    PGHOST: server.host, PGPORT: String(server.port), PGUSER: server.user, PGDATABASE: database,
    ...(server.password !== undefined ? { PGPASSWORD: server.password } : {}),
  };
}

/** A connected `pg` Client with the mandatory `'error'` listener (D-068 ruling 2); `onError` sees a dropped backend. */
export async function connect(server: Server, database: string, onError: (e: Error) => void = () => undefined): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: urlOf(server, database), connectionTimeoutMillis: CONNECT_TIMEOUT_MS });
  client.on('error', onError);
  await client.connect();
  return client;
}

async function probe(server: Server): Promise<string | null> {
  try {
    const c = await connect(server, server.database);
    await c.end();
    return null;
  } catch (e) {
    return (e as Error).message || String(e);
  }
}

const serviceName = (spec: string): string => spec.replace(/^compose:/, '');

async function docker(root: string, args: string[], timeoutMs = 60_000) {
  return spawn({ argv: ['docker', ...args], cwd: root, env: process.env, timeoutMs });
}

/** `docker compose port <service> 5432` → host and port; null when the service publishes nothing. */
async function publishedPort(root: string, service: string): Promise<{ host: string; port: number } | null> {
  const r = await docker(root, ['compose', 'port', service, '5432']);
  if (r.kind !== 'exited' || r.code !== 0) return null;
  const m = /^(.*):(\d+)\s*$/.exec(r.stdout.toString('utf8').trim().split('\n')[0] ?? '');
  if (!m) return null;
  const host = m[1] === '0.0.0.0' || m[1] === '' || m[1] === '[::]' ? 'localhost' : m[1]!.replace(/^\[|\]$/g, '');
  return { host, port: Number(m[2]) };
}

/** docker mode credentials: the compose service reads them from the environment (09 §1.1 `compose.yaml`). */
const dockerServer = (at: { host: string; port: number }): Server => ({
  ...at, user: process.env['POSTGRES_USER'] || 'postgres', password: process.env['POSTGRES_PASSWORD'], database: process.env['POSTGRES_DB'] || 'postgres',
});

/** 02 §6 `provide('postgres')`, starting the compose service in docker mode. */
export async function provide(root: string, config: DevaiConfig, runtime: Runtime): Promise<Provided> {
  const spec = config.runtime.services.postgres[runtime];
  if (runtime === 'bare') {
    const name = spec.replace(/^env:/, '');
    const url = process.env[name];
    if (!url) return { kind: 'unknown', unknown: unreachable('bare', `${name} is not set`) };
    let server: Server;
    try {
      server = serverOf(url);
    } catch {
      return { kind: 'unknown', unknown: unreachable('bare', `${name} is not a postgres URL`) };
    }
    const err = await probe(server);
    return err === null ? { kind: 'ok', server } : { kind: 'unknown', unknown: unreachable('bare', err) };
  }
  // docker: 07 §4 preflight (`docker compose version`, `docker info`), then up and the published port.
  const version = await docker(root, ['compose', 'version']);
  if (version.kind === 'missing') return { kind: 'unknown', unknown: dockerDown('docker is not on PATH') };
  if (version.code !== 0) return { kind: 'unknown', unknown: dockerDown(firstLine(version.stderr.toString('utf8')) || 'docker compose version failed') };
  const info = await docker(root, ['info', '--format', '{{.ServerVersion}}']);
  if (info.kind !== 'exited' || info.code !== 0) return { kind: 'unknown', unknown: dockerDown(info.kind === 'exited' ? firstLine(info.stderr.toString('utf8')) || 'docker info failed' : 'docker is not on PATH') };
  const service = serviceName(spec);
  const up = await docker(root, ['compose', 'up', '-d', service], 300_000);
  if (up.kind !== 'exited' || up.code !== 0) return { kind: 'unknown', unknown: dockerDown(up.kind === 'exited' ? firstLine(up.stderr.toString('utf8')) || `docker compose up -d ${service} failed` : 'docker is not on PATH') };
  const at = await publishedPort(root, service);
  if (!at) return { kind: 'unknown', unknown: unreachable('docker', `service ${service} publishes no port 5432`) };
  const server = dockerServer(at);
  let err: string | null = null;
  for (let i = 0; i < 30; i++) { // the healthcheck may still be starting
    err = await probe(server);
    if (err === null) return { kind: 'ok', server };
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { kind: 'unknown', unknown: unreachable('docker', err ?? 'not ready') };
}

/** The declared server when it answers without DEVAI starting anything (bare: the URL; docker: an already published port). */
export async function running(root: string, config: DevaiConfig, runtime: Runtime): Promise<Server | null> {
  const spec = config.runtime.services.postgres[runtime];
  let server: Server;
  if (runtime === 'bare') {
    const url = process.env[spec.replace(/^env:/, '')];
    if (!url) return null;
    try {
      server = serverOf(url);
    } catch {
      return null;
    }
  } else {
    const at = await publishedPort(root, serviceName(spec));
    if (!at) return null;
    server = dockerServer(at);
  }
  return (await probe(server)) === null ? server : null;
}

/** A.3: `provide('postgres')` succeeds without starting anything (decides whether `sql-typed` DB joins the edit loop). */
export const reachable = async (root: string, config: DevaiConfig, runtime: Runtime): Promise<boolean> => (await running(root, config, runtime)) !== null;
