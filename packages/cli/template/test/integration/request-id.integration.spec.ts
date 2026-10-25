// S-70, D-072: a request without a UUIDv7 X-Request-Id is rejected with 400; an id-less GET /healthz or
// /readyz probe is answered.
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { databaseUrl, roleUrl } from '../support/utils/runtime.js';

let app: INestApplication;
let base = '';

beforeAll(async () => {
  process.env['DATABASE_URL'] = databaseUrl();
  process.env['DATABASE_APP_URL'] = await roleUrl('app');
  process.env['DATABASE_READER_URL'] = await roleUrl('reader');
  // The module reads its connection strings when it loads, so it loads after they are set.
  const { AppModule } = await import('../../apps/api/src/app.module.js');
  app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0, '127.0.0.1');
  base = await app.getUrl();
});

afterAll(async () => {
  await app.close();
});

describe('X-Request-Id (S-70)', () => {
  it('rejects a request without X-Request-Id with 400', async () => {
    expect((await fetch(`${base}/request-id-probe`)).status).toBe(400);
  });

  it('rejects a non-UUIDv7 X-Request-Id with 400', async () => {
    const res = await fetch(`${base}/request-id-probe`, {
      headers: { 'X-Request-Id': '00000000-0000-4000-8000-000000000000' },
    });
    expect(res.status).toBe(400);
  });

  it('answers an id-less GET /healthz with 200 (D-072)', async () => {
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
  });

  it('answers an id-less GET /readyz with 200 (D-072)', async () => {
    expect((await fetch(`${base}/readyz`)).status).toBe(200);
  });
});
