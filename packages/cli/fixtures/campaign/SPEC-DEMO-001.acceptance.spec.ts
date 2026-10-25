// SPEC-DEMO-001 acceptance (05 §3): one top-level case per acceptance requirement. R-3, R-5 and R-6 carry
// the rail assertions and stay green; R-1, R-2 and R-4 assert only behaviour the seeds leave out, so a
// test packet may name them expected red (D-058, D-064). The API runs in-process against the scratch
// database `devai check` provides; isolation is observed as demo_app, never as owner (S-18).
import 'reflect-metadata';
import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { type INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { connect, databaseUrl, roleUrl } from '../../../../../test/support/utils/runtime.js';

// Bearer tokens (D-107). StynxAuthModule.forRoot({}) verifies RS256 tokens of its default issuer against
// the JWKS of a SessionJwtSigningService provider; the test supplies that provider with its own key.
const ISSUER = 'https://stynx.local';
const KID = 'spec-demo-001';
const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });

interface Principal {
  tenant: string;
  roles: string[];
}

function bearer(p: Principal): string {
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: ISSUER,
    sub: randomUUID(),
    sid: randomUUID(),
    tenant_id: p.tenant,
    iat: now,
    exp: now + 600,
    perms: [],
    roles: p.roles,
  };
  const part = (v: object) => Buffer.from(JSON.stringify(v)).toString('base64url');
  const input = `${part({ alg: 'RS256', kid: KID, typ: 'JWT' })}.${part(claims)}`;
  const signature = sign('RSA-SHA256', Buffer.from(input), keys.privateKey).toString('base64url');
  return `${input}.${signature}`;
}

function jwks(): { keys: object[] } {
  return {
    keys: [{ ...keys.publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256', use: 'sig' }],
  };
}

/** The class token StynxJwtValidator looks up, resolved through the API shell's own dependency graph. */
async function signingServiceToken(): Promise<abstract new (...args: never[]) => unknown> {
  const api = createRequire(new URL('../../../../../apps/api/package.json', import.meta.url));
  const auth = createRequire(api.resolve('@stynx-nyx/auth'));
  const url = pathToFileURL(auth.resolve('@stynx-nyx/sessions')).href;
  const sessions = (await import(url)) as {
    SessionJwtSigningService: abstract new (...args: never[]) => unknown;
  };
  return sessions.SessionJwtSigningService;
}

/** A fresh UUIDv7 X-Request-Id (S-70). */
function requestId(): string {
  const b = randomBytes(16);
  b.writeUIntBE(Date.now(), 0, 6);
  b[6] = (b[6]! & 0x0f) | 0x70;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

const TENANT_A = '0197a000-0000-7000-8000-00000000000a';
const TENANT_B = '0197a000-0000-7000-8000-00000000000b';
const memberA: Principal = { tenant: TENANT_A, roles: ['demo-member'] };
const memberB: Principal = { tenant: TENANT_B, roles: ['demo-member'] };
const roleless: Principal = { tenant: TENANT_A, roles: [] };
const unverifiedTenant: Principal = { tenant: randomUUID(), roles: ['demo-member'] };

let app: INestApplication;
let base = '';
let owner: pg.Client;
let appRole: pg.Client;

interface Reply {
  status: number;
  body: Record<string, unknown>;
}

async function call(
  method: 'GET' | 'POST',
  path: string,
  options: { as?: Principal; authorization?: string; body?: unknown } = {},
): Promise<Reply> {
  const headers: Record<string, string> = { 'X-Request-Id': requestId() };
  if (options.as) headers['Authorization'] = `Bearer ${bearer(options.as)}`;
  if (options.authorization !== undefined) headers['Authorization'] = options.authorization;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  return { status: res.status, body: parsed(await res.text()) };
}

/** A JSON object body, or `{ text }` when the answer is not one, so an assertion fails instead of a parse. */
function parsed(text: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === 'object' && value !== null) return value as Record<string, unknown>;
  } catch {
    // not JSON
  }
  return { text };
}

const create = (as: Principal, body: unknown) => call('POST', '/notes', { as, body });
const read = (as: Principal, id: string) => call('GET', `/notes/${id}`, { as });

async function ownerCount(): Promise<number> {
  const r = await owner.query<{ n: string }>('SELECT count(*) AS n FROM demo_notes.note');
  return Number(r.rows[0]!.n);
}

/** The tenant ids demo_app sees under `tenant` context. */
async function visibleAs(tenant: string): Promise<string[]> {
  await appRole.query("SELECT set_config('app.tenant_id', $1, false)", [tenant]);
  const r = await appRole.query<{ tenant_id: string }>(
    'SELECT tenant_id FROM demo_notes.note ORDER BY tenant_id',
  );
  return r.rows.map((row) => row.tenant_id);
}

const astral = '\u{1F600}';
const ascii = (n: number) => 'n'.repeat(n);

beforeAll(async () => {
  owner = await connect(databaseUrl());
  await owner.query(
    `INSERT INTO tenancy.tenants (id, slug, name) VALUES ($1, 'demo-a', 'Demo A'), ($2, 'demo-b', 'Demo B')
     ON CONFLICT (id) DO NOTHING`,
    [TENANT_A, TENANT_B],
  );
  appRole = await connect(await roleUrl('app'));
  process.env['DATABASE_URL'] = databaseUrl();
  process.env['DATABASE_APP_URL'] = await roleUrl('app');
  process.env['DATABASE_READER_URL'] = await roleUrl('reader');
  // The shell reads its connection strings when it loads, so it loads after they are set.
  const { AppModule } = await import('../../../../../apps/api/src/app.module.js');
  const token = await signingServiceToken();
  class AcceptanceModule {}
  Module({
    imports: [AppModule],
    providers: [{ provide: token, useValue: { getJwks: () => Promise.resolve(jwks()) } }],
  })(AcceptanceModule);
  app = await NestFactory.create(AcceptanceModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});

beforeEach(async () => {
  await owner.query('DELETE FROM demo_notes.note');
});

afterAll(async () => {
  await app?.close();
  await appRole?.end();
  await owner?.query('DELETE FROM demo_notes.note');
  await owner?.end();
});

describe('SPEC-DEMO-001', () => {
  it('R-1: create-and-read', async () => {
    const body = { title: 'Groceries', author_alias: 'Pilot One' };
    const first = await create(memberA, body);
    const second = await create(memberA, body);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body).toEqual({ id: expect.any(String), ...body });
    expect(second.body).toEqual({ id: expect.any(String), ...body });
    expect(first.body['id']).not.toBe(second.body['id']);
    for (const created of [first, second]) {
      const got = await read(memberA, String(created.body['id']));
      expect(got.status).toBe(200);
      expect(got.body).toEqual(created.body);
    }
    expect(await visibleAs(TENANT_A)).toHaveLength(2);
  });

  it('R-2: strict-inputs', async () => {
    const bodies = [
      { title: ascii(1), author_alias: ascii(1) },
      { title: ascii(80), author_alias: ascii(40) },
      { title: ascii(78) + astral, author_alias: ascii(38) + astral },
    ];
    for (const body of bodies) {
      const created = await create(memberA, body);
      expect(created.status).toBe(201);
      expect(created.body).toEqual({ id: expect.any(String), ...body });
      const got = await read(memberA, String(created.body['id']));
      expect(got.body).toEqual(created.body);
    }
  });

  it('R-3: role-boundary', async () => {
    const body = { title: 'Denied', author_alias: 'Nobody' };
    const unauthenticated = { code: 'UNAUTHENTICATED', messageKey: 'demo.notes.unauthenticated' };
    const forbidden = { code: 'FORBIDDEN', messageKey: 'demo.notes.forbidden' };
    const before = await ownerCount();
    for (const path of ['/notes', `/notes/${randomUUID()}`]) {
      const method = path === '/notes' ? 'POST' : 'GET';
      const payload = method === 'POST' ? { body } : {};
      const missing = await call(method, path, payload);
      expect(missing.status).toBe(401);
      expect(missing.body).toMatchObject(unauthenticated);
      const invalid = await call(method, path, { ...payload, authorization: 'Bearer not.a.token' });
      expect(invalid.status).toBe(401);
      expect(invalid.body).toMatchObject(unauthenticated);
      for (const principal of [roleless, unverifiedTenant]) {
        const denied = await call(method, path, { ...payload, as: principal });
        expect(denied.status).toBe(403);
        expect(denied.body).toMatchObject(forbidden);
      }
    }
    expect(await ownerCount()).toBe(before);
  });

  it('R-4: tenant-isolation', async () => {
    const ofA = await create(memberA, { title: 'A only', author_alias: 'Alias A' });
    const ofB = await create(memberB, { title: 'B only', author_alias: 'Alias B' });
    expect(ofA.status).toBe(201);
    expect(ofB.status).toBe(201);
    const idOfA = String(ofA.body['id']);
    const stored = await read(memberB, idOfA);
    const missing = await read(memberB, randomUUID());
    expect(stored.status).toBe(404);
    expect(missing.status).toBe(404);
    const { requestId: _stored, ...storedError } = stored.body;
    const { requestId: _missing, ...missingError } = missing.body;
    expect(storedError).toEqual(missingError);
    expect(storedError).toMatchObject({ code: 'NOT_FOUND', messageKey: 'demo.notes.missing' });
    expect(stored.body).not.toHaveProperty('title');
    expect(stored.body).not.toHaveProperty('author_alias');
    const own = await read(memberA, idOfA);
    expect(own.status).toBe(200);
  });

  it('R-5: input-rejection', async () => {
    const valid = { title: 'Valid', author_alias: 'Alias' };
    const bodies: unknown[] = [
      { title: ascii(79) + astral, author_alias: 'Alias' },
      { author_alias: 'Alias' },
      { title: 'Valid' },
      { title: null, author_alias: 'Alias' },
      { title: 'Valid', author_alias: null },
      { title: 7, author_alias: 'Alias' },
      { title: 'Valid', author_alias: false },
      { ...valid, extra: 'field' },
      { title: '', author_alias: 'Alias' },
      { title: 'Valid', author_alias: '' },
      { title: ascii(81), author_alias: 'Alias' },
      { title: 'Valid', author_alias: ascii(41) },
    ];
    const validation = { code: 'VALIDATION', messageKey: 'demo.notes.invalid' };
    for (const body of bodies) {
      const rejected = await create(memberA, body);
      expect(rejected.status).toBe(400);
      expect(rejected.body).toMatchObject(validation);
    }
    const queried = await call('POST', '/notes?draft=1', { as: memberA, body: valid });
    expect(queried.status).toBe(400);
    expect(queried.body).toMatchObject(validation);
    for (const path of ['/notes/not-a-uuid', `/notes/${randomUUID()}?draft=1`]) {
      const rejected = await call('GET', path, { as: memberA });
      expect(rejected.status).toBe(400);
      expect(rejected.body).toMatchObject(validation);
    }
    expect(await ownerCount()).toBe(0);
  });

  it('R-6: rls-visibility', async () => {
    await owner.query(
      `INSERT INTO demo_notes.note (tenant_id, title, author_alias)
       VALUES ($1, 'Seed A', 'Alias A'), ($2, 'Seed B', 'Alias B')`,
      [TENANT_A, TENANT_B],
    );
    expect(await ownerCount()).toBe(2);
    expect(await visibleAs(TENANT_B)).toEqual([TENANT_B]);
    expect(await visibleAs(TENANT_A)).toEqual([TENANT_A]);
  });
});
