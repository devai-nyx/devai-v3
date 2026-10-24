// 08 B.6 `layout`: 04 §1–§6 path predicates; the finding form `<path>:1 <predicate>: <what> [04 §n] <hint>`.
import { describe, expect, it } from 'vitest';
import { workingTree } from '../../src/candidate/digest.js';
import { ddlBand, layout, tierGlobs } from '../../src/nodes/layout.js';
import { plan } from '../../src/runner/plan.js';
import { templateConfig } from '../fixtures.js';
import { templateWorkspace } from '../repo.js';
import { runOnly } from './helpers.js';

describe('B.6 layout', () => {
  it('PASS on the template workspace; never SKIPPED (the root is the population)', async () => {
    const { row } = await runOnly(templateWorkspace(), 'layout');
    expect(row.status).toBe('PASS');
    expect(row.expected).toBeGreaterThan(0);
    expect(row.observed).toBe(row.expected);
  });

  it("FAIL with 08 B.6's example finding: a layer folder under api/src", async () => {
    const { row } = await runOnly(templateWorkspace({ 'domain/notes/api/src/services/x.ts': 'export {};\n' }), 'layout');
    expect(row.status).toBe('FAIL');
    expect(row.findings).toEqual([{ locator: 'domain/notes/api/src/services/x.ts:1', message: 'module shape: layer folder under api/src', standard: '04 §2', hint: 'flatten to api/src/x.service.ts' }]);
  });

  it.each([
    ['database/migrations/2026-10-24-add.sql', 'migration name: not YYYYMMDD_NN_snake_case.sql', '04 §3'],
    ['database/ddl/35-app-notes.sql', 'ddl band: 35 is not a band', '04 §3'],
    ['database/ddl/notes.sql', 'ddl band: name is not NN-<schema>-<topic>.sql', '04 §3'],
    ['CONTEXT.md', 'root guide: CONTEXT.md is not on the allowlist', '04 §1'],
    ['apps/api/tests/a.spec.ts', 'test singular: tests/ folder', '04 §4'],
    ['test/integration/notes.spec.ts', 'tier suffix: file is not *.integration.spec.ts', '04 §4'],
    ['domain/notes/db/notes.sql', 'module shape: db file is not <ns>_<slug>.sql or <ns>_<slug>_<nn>_<topic>.sql', '04 §3'],
    ['specs/Area_Notes/SPEC-DEMO-009.md', 'spec layout: not specs/<area>-<capability>/<file>.md', '04 §1'],
  ])('FAIL: %s', async (path, message, standard) => {
    const { row } = await runOnly(templateWorkspace({ [path]: 'x\n' }), 'layout');
    expect(row.status).toBe('FAIL');
    expect(row.findings).toHaveLength(1);
    expect(row.findings[0]).toMatchObject({ locator: `${path}:1`, message, standard });
  });

  it('accepts the 04 name forms: migrations, DDL bands, module SQL, acceptance files', async () => {
    const { row } = await runOnly(templateWorkspace({
      'database/migrations/20261024_01_add_notes_body.sql': 'x\n',
      'database/ddl/00-core-bootstrap.sql': 'x\n',
      'database/ddl/21-app-rls.sql': 'x\n',
      'domain/notes/db/demo_notes_notes.sql': 'x\n',
      'domain/notes/db/demo_notes_notes_01_add_body.sql': 'x\n',
      'domain/notes/api/src/dto/create-note.dto.ts': 'export {};\n',
      'domain/notes/api/test/acceptance/spec-demo-001.acceptance.spec.ts': 'export {};\n',
    }), 'layout');
    expect(row).toMatchObject({ status: 'PASS', findings: [] });
  });

  it('a README under law/ or product/ that only links into docs/ is a facade (04 §1)', async () => {
    const { row } = await runOnly(templateWorkspace({ 'law/README.md': '# Law\n\n- [ADRs](../docs/meta/adr.md)\n- [Invariants](../docs/meta/inv.md)\n' }), 'layout');
    expect(row.findings).toEqual([{ locator: 'law/README.md:1', message: 'facade: README only links into docs/', standard: '04 §1', hint: 'put the real content here or delete the README' }]);
  });

  it('every tier glob of vitest.config.ts matches a file (S-62)', async () => {
    const config = "export default { test: { projects: [{ test: { include: ['test/integration/**/*.integration.spec.ts'] } }, { test: { include: ['test/e2e/**/*.e2e.spec.ts'] } }] } };\n";
    expect(tierGlobs(config).map((g) => g.glob)).toEqual(['test/integration/**/*.integration.spec.ts', 'test/e2e/**/*.e2e.spec.ts']);
    const { row } = await runOnly(templateWorkspace({ 'vitest.config.ts': config, 'test/integration/notes.integration.spec.ts': 'export {};\n' }), 'layout');
    expect(row.findings).toEqual([{ locator: 'vitest.config.ts:1', message: 'tier glob: test/e2e/**/*.e2e.spec.ts matches no file', standard: '04 §4', hint: "add the tier's first file or remove the glob (S-62)" }]);
  });

  it('UNKNOWN io when a declared input cannot be read (a listed spec gone from disk)', async () => {
    const dir = templateWorkspace();
    const listing = await workingTree(dir, null);
    listing.entries.push({ tag: 'F', mode: '100644', hash: 'a'.repeat(64), path: 'specs/notes/SPEC-DEMO-404.md' });
    const ctx = { root: dir, config: templateConfig(), runtime: 'bare' as const, cliVersion: '3.0.0', listing, base: null, head: 'b'.repeat(40), plan: plan({ packet: false, full: false, only: ['layout'] }) };
    const o = await layout.run(ctx);
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'io' });
    expect(o.findings[0]).toMatchObject({ locator: 'specs/notes/SPEC-DEMO-404.md:1', message: 'not readable' });
  });

  it('DDL bands (D-017, D-040)', () => {
    expect([0, 8, 11, 14, 21, 24, 80, 89, 90, 91, 94, 98].every(ddlBand)).toBe(true);
    expect([9, 10, 15, 20, 25, 79, 95, 97, 99].some(ddlBand)).toBe(false);
  });
});
