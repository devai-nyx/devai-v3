// 02 §6: the runtime is resolved by `devai check`, which hands every DB-backed tier DATABASE_URL (the
// scratch database) and DEVAI_RUNTIME. Tests connect as the product's _app or _reader role, never as
// owner, to observe isolation (S-18). No testcontainers.
import pg from 'pg';

export type Role = 'app' | 'reader';

export const runtime = (): 'bare' | 'docker' =>
  process.env['DEVAI_RUNTIME'] === 'docker' ? 'docker' : 'bare';

export function databaseUrl(): string {
  const url = process.env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error('DATABASE_URL is not set: run the tier through devai check (02 §6)');
  }
  return url;
}

export async function connect(url: string): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
}

/**
 * The scratch database URL logged in as `__PRODUCT___<role>`. The role gets the scratch server's
 * password first, so the session user is the role itself, as the application's pools require.
 */
export async function roleUrl(role: Role): Promise<string> {
  const url = new URL(databaseUrl());
  const owner = await connect(url.toString());
  try {
    const password = decodeURIComponent(url.password);
    const sql = await owner.query<{ sql: string }>('SELECT format($1, $2::text, $3::text) AS sql', [
      'ALTER ROLE %I LOGIN PASSWORD %L',
      `__PRODUCT___${role}`,
      password,
    ]);
    await owner.query(sql.rows[0]!.sql);
  } finally {
    await owner.end();
  }
  url.username = `__PRODUCT___${role}`;
  return url.toString();
}
