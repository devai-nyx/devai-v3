// S-18: two tenants' rows under a forced RLS policy; isolation is observed as __PRODUCT___app, never as owner.
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, databaseUrl, roleUrl } from '../support/utils/runtime.js';

const A = '00000000-0000-7000-8000-00000000000a';
const B = '00000000-0000-7000-8000-00000000000b';
let owner: pg.Client;
let app: pg.Client;

beforeAll(async () => {
  owner = await connect(databaseUrl());
  await owner.query(`
    CREATE SCHEMA rls_probe;
    CREATE TABLE rls_probe.note (tenant_id uuid NOT NULL, body text NOT NULL);
    ALTER TABLE rls_probe.note ENABLE ROW LEVEL SECURITY;
    ALTER TABLE rls_probe.note FORCE ROW LEVEL SECURITY;
    CREATE POLICY note_tenant ON rls_probe.note FOR ALL
      USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
      WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
    GRANT USAGE ON SCHEMA rls_probe TO __PRODUCT___app;
    GRANT SELECT, INSERT ON rls_probe.note TO __PRODUCT___app;
  `);
  app = await connect(await roleUrl('app'));
  for (const tenant of [A, B]) {
    await app.query("SELECT set_config('app.tenant_id', $1, false)", [tenant]);
    await app.query('INSERT INTO rls_probe.note (tenant_id, body) VALUES ($1, $2)', [
      tenant,
      `note of ${tenant}`,
    ]);
  }
});

afterAll(async () => {
  await app?.end();
  await owner?.query('DROP SCHEMA IF EXISTS rls_probe CASCADE');
  await owner?.end();
});

describe('RLS isolation as __PRODUCT___app (S-18)', () => {
  it('runs the session as __PRODUCT___app', async () => {
    expect(
      (await app.query<{ current_user: string }>('SELECT current_user')).rows[0]?.current_user,
    ).toBe('__PRODUCT___app');
  });

  it("sees only the current tenant's rows", async () => {
    await app.query("SELECT set_config('app.tenant_id', $1, false)", [A]);
    const rows = (await app.query<{ tenant_id: string }>('SELECT tenant_id FROM rls_probe.note'))
      .rows;
    expect(rows.map((r) => r.tenant_id)).toEqual([A]);
  });

  it("cannot write another tenant's row", async () => {
    await app.query("SELECT set_config('app.tenant_id', $1, false)", [A]);
    // 42501 insufficient_privilege: the policy's WITH CHECK refused the row.
    await expect(
      app.query('INSERT INTO rls_probe.note (tenant_id, body) VALUES ($1, $2)', [
        B,
        'cross-tenant',
      ]),
    ).rejects.toMatchObject({ code: '42501' });
  });
});
