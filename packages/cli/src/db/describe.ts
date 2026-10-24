// 08 B.10 DB part, the R2 adapter (D-068): one pg Submittable per query passed to `client.query()` (public
// API) whose `submit(connection)` sends parse, describe, close and one sync, so nothing is bound or
// executed. The Client routes `rowDescription`/`errorMessage`/`readyForQuery` to it; `parameterDescription`
// and `noData` are read from `connection` only while it is the active query [fact: `Client` registers no
// listener for them, `pg@8.23.1 lib/client.js:249-270`]. A Submittable answered by `handleError` without
// `submit()` means the client is no longer queryable (postgres-unreachable).
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import type pg from 'pg';

export interface Described {
  kind: 'described';
  params: number[];
  /** null for `noData` (a statement that returns no rows). */
  fields: { name: string; dataTypeID: number; dataTypeModifier: number; tableID: number; columnID: number }[] | null;
}
export type Description = Described | { kind: 'error'; sqlstate: string; message: string } | { kind: 'unreachable'; message: string };

type Connection = {
  parse(q: { name: string; text: string; types: number[] }): void;
  describe(q: { type: 'S'; name: string }): void;
  close(q: { type: 'S'; name: string }): void;
  sync(): void;
  on(ev: string, f: (msg: unknown) => void): void;
  removeListener(ev: string, f: (msg: unknown) => void): void;
};

const STATEMENT = 'devai_q';

class Describe {
  private submitted = false;
  private params: number[] = [];
  private fields: Described['fields'] = null;
  private error: { sqlstate: string; message: string } | null = null;
  private con: Connection | null = null;
  private resolve!: (d: Description) => void;
  readonly done = new Promise<Description>((r) => (this.resolve = r));
  private readonly onParams = (msg: unknown) => { this.params = [...((msg as { dataTypeIDs?: number[] }).dataTypeIDs ?? [])]; };
  private readonly onNoData = () => { this.fields = null; };

  constructor(private readonly text: string) {}

  submit(con: Connection): void {
    this.submitted = true;
    this.con = con;
    con.on('parameterDescription', this.onParams);
    con.on('noData', this.onNoData);
    con.parse({ name: STATEMENT, text: this.text, types: [] });
    con.describe({ type: 'S', name: STATEMENT });
    con.close({ type: 'S', name: STATEMENT });
    con.sync();
  }

  private detach(): void {
    this.con?.removeListener('parameterDescription', this.onParams);
    this.con?.removeListener('noData', this.onNoData);
  }

  handleRowDescription(msg: { fields: Described['fields'] }): void {
    this.fields = (msg.fields ?? []).map((f) => ({ name: f.name, dataTypeID: f.dataTypeID, dataTypeModifier: f.dataTypeModifier, tableID: f.tableID, columnID: f.columnID }));
  }

  /** The Client nulls the active query before this call; the readyForQuery that follows is the Client's. */
  handleError(err: Error & { code?: string }): void {
    this.detach();
    if (!this.submitted || !err.code) {
      this.resolve({ kind: 'unreachable', message: err.message });
      return;
    }
    this.error = { sqlstate: err.code, message: err.message };
    this.resolve({ kind: 'error', ...this.error });
  }

  handleReadyForQuery(): void {
    this.detach();
    this.resolve(this.error ? { kind: 'error', ...this.error } : { kind: 'described', params: this.params, fields: this.fields });
  }

  // Messages a describe never receives; present because the Client may route them to any active query.
  handleDataRow(): void {}
  handleCommandComplete(): void {}
  handleEmptyQuery(): void {}
  handlePortalSuspended(): void {}
  handleCopyInResponse(): void {}
  handleCopyData(): void {}
}

/** Describe `text` on `client` without binding or executing it. */
export function describe(client: pg.Client, text: string, dropped: () => string | null): Promise<Description> {
  const d = new Describe(text);
  const gone = dropped();
  if (gone !== null) return Promise.resolve({ kind: 'unreachable', message: gone });
  client.query(d as unknown as pg.Submittable);
  return d.done;
}

/** B.10: the adapter is version-bound; `pg` ≠ 8.23.1 or `pg-protocol` ∉ ^1.16.1 at load is `adapter-unbound`. */
export function adapterBinding(): string | null {
  const req = createRequire(import.meta.url);
  try {
    const pgPkg = req.resolve('pg/package.json');
    const pgVersion = (req(pgPkg) as { version: string }).version;
    if (pgVersion !== '8.23.1') return `pg ${pgVersion} is not 8.23.1`;
    // pg-protocol's `exports` hide its package.json: find it above the entry pg itself resolves.
    let dir = dirname(createRequire(pgPkg).resolve('pg-protocol'));
    while (!existsSync(resolve(dir, 'package.json')) || (JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as { name?: string }).name !== 'pg-protocol') {
      if (dirname(dir) === dir) return 'pg-protocol not resolvable from pg';
      dir = dirname(dir);
    }
    const proto = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as { version: string };
    const m = /^1\.(\d+)\.(\d+)$/.exec(proto.version);
    if (!m || Number(m[1]) < 16 || (Number(m[1]) === 16 && Number(m[2]) < 1)) return `pg-protocol ${proto.version} is not ^1.16.1`;
    return null;
  } catch (e) {
    return (e as Error).message.split('\n')[0] ?? 'pg not resolvable';
  }
}
