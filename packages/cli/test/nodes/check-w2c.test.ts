// `devai check --only <id> --format json` on the template workspace (built binary, D-057) for the W2c
// nodes: a C.2-valid report, the node row and `accept`. `openapi` needs `typecheck` (C.1 step 3), whose
// adapter is W2b's, so it is exercised at the adapter level only (openapi.test.ts).
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Report } from '../../src/report.js';
import { templateWorkspace, write } from '../repo.js';
import { linkTools, PINS, STYNXRC_09, toolsFor } from './helpers.js';

const bin = resolve(import.meta.dirname, '../../dist/main.js');
const devai = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', env: { ...process.env, DEVAI_RUNTIME: '' } });
let tools: string;
beforeAll(() => { tools = toolsFor({ ...PINS.stynx, ...PINS.migrationLinter, ...PINS.deadcode }); }, 300_000);

function check(dir: string, id: string) {
  const r = devai(dir, 'check', '--only', id, '--format', 'json');
  expect(r.stderr).toBe('');
  const report = Report.parse(JSON.parse(r.stdout));
  expect(report.nodes.map((n) => n.id)).toEqual(['inventory', id, 'accept']);
  expect(r.status).toBe(report.exitCode);
  return { report, row: report.nodes[1]! };
}

describe('devai check --only <W2c node> --format json on the template workspace', () => {
  const workspace = () => {
    const dir = templateWorkspace({ '.stynxrc.json': STYNXRC_09 });
    linkTools(dir, tools);
    return dir;
  };

  it('spec-lint: SKIPPED on a clean candidate, PASS with the fixture spec changed', () => {
    const dir = workspace();
    expect(check(dir, 'spec-lint').row).toMatchObject({ status: 'SKIPPED', evidence: 'no changed specs/** or product/**' });
    write(dir, 'specs/notes/SPEC-DEMO-001.md', `${readFileSync(resolve(dir, 'specs/notes/SPEC-DEMO-001.md'), 'utf8')}\n`);
    const { report, row } = check(dir, 'spec-lint');
    expect(row).toMatchObject({ status: 'PASS', expected: 1, observed: 1, evaluated: 1 });
    expect(report.exitCode).toBe(0);
  });

  it('sql-lint: SKIPPED without SQL, PASS with a clean migration', () => {
    const dir = workspace();
    expect(check(dir, 'sql-lint').row).toMatchObject({ status: 'SKIPPED', evidence: 'no changed *.sql' });
    write(dir, 'database/migrations/20261024_01_init.sql', 'SELECT 1;\n');
    expect(check(dir, 'sql-lint').row).toMatchObject({ status: 'PASS', expected: 1, observed: 1 });
  });

  it('boundary: no source under the roots is UNKNOWN no-observations (exit 2); a source makes it PASS', () => {
    const dir = workspace();
    expect(check(dir, 'boundary')).toMatchObject({ report: { exitCode: 2 }, row: { status: 'UNKNOWN', reason: 'no-observations' } });
    write(dir, 'apps/api/src/main.ts', 'export const x = 1;\n');
    expect(check(dir, 'boundary').row).toMatchObject({ status: 'PASS', expected: 1, observed: 1 });
  });

  // D-084 item 7 (W2b): a package-less workspace is an inventory FAIL, so the fixture carries `apps/api`; without
  // the template's `tools/knip.config.ts` (W7) knip exits 2 without a report, which D-086 makes runner-crashed.
  it('deadcode: apps/api without tools/knip.config.ts is UNKNOWN runner-crashed with knip\'s message', () => {
    const { row } = check(workspace(), 'deadcode');
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed' });
    expect(row.findings[0]).toMatchObject({ locator: 'apps/api/package.json:1', message: 'knip (apps/api) exited 2: ERROR: Unable to find tools/knip.config.ts or package.json#knip' });
  });
});
