// 08 B.21 `spec-tests` at the adapter level: `--packet` is W4's, so the packet view (kind, observations,
// pinned spec bytes) is set on the RunContext the way that wave will. The acceptance cases need no
// database, so `ctx.scratch` names an unused one. 09 §4 N7a included; the reference file shape is 09 §4
// step 5's (R-1, R-2, R-4 expected red; R-3, R-5, R-6 rail cases that stay green).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { serverOf } from '../../src/db/provide.js';
import { specTests, type PacketView } from '../../src/nodes/spec-tests.js';
import { NodeResult } from '../../src/report.js';
import { rewriteNoObservations, type RunContext } from '../../src/runner/run.js';
import { templateWorkspace, write } from '../repo.js';
import { contextOf } from './helpers.js';
import { linkModules, VITEST_CONFIG } from './w3.js';

const FILE = 'domain/notes/api/test/acceptance/spec-demo-001.acceptance.spec.ts';

const caseOf = (id: string, body: string) => `it('${id}: ${id.toLowerCase()} case', async () => {\n  ${body}\n});\n`;
const green = (id: string) => caseOf(id, 'expect(1).toBe(1);');
const red = (id: string) => caseOf(id, 'expect(await Promise.resolve(404)).toBe(201);');
const file = (cases: string[], head = "import { expect, it } from 'vitest';\n") => head + cases.join('');
const ALL_GREEN = file(['R-1', 'R-2', 'R-3', 'R-4', 'R-5', 'R-6'].map(green));
const EXPECT_RED = file(['R-1', 'R-2', 'R-4'].map(red).concat(['R-3', 'R-5', 'R-6'].map(green)));

/** W4's RunContext.packet extends this view with the parsed packet; spec-tests reads the view only. */
const view = (v: PacketView) => v as NonNullable<RunContext['packet']>;

async function run(content: string, packet: Partial<PacketView> = {}) {
  const dir = templateWorkspace({ 'vitest.config.ts': VITEST_CONFIG, [FILE]: content });
  linkModules(dir, { vitest: true, stynx: false });
  const ctx = await contextOf(dir, { only: 'unit' });
  const specText = readFileSync(resolve(dir, 'specs/notes/SPEC-DEMO-001.md'), 'utf8');
  ctx.packet = view({ kind: 'code', unimplemented: [], specText, ...packet });
  ctx.scratch = { database: 'devai_000000000000', server: serverOf('postgresql://localhost:1/unused'), url: 'postgresql://localhost:1/unused' };
  const o = rewriteNoObservations(await specTests.run(ctx));
  NodeResult.parse({ id: 'spec-tests', ...o, durationMs: 0, cached: false, needs: ['postgres'] });
  return o;
}

describe('B.21 spec-tests', () => {
  it('PASS (code packet): every acceptance:yes requirement observed and green', async () => {
    const o = await run(ALL_GREEN);
    expect(o).toMatchObject({ status: 'PASS', expected: 6, observed: 6, evaluated: 6, details: { node: 'spec-tests', expectRed: [], reached: [], uncovered: [] } });
  });

  it('PASS (test packet, --expect-red): R-1, R-2, R-4 fail at a reached assertion, the rail cases stay green (09 §4 step 6)', async () => {
    const o = await run(EXPECT_RED, { kind: 'test', unimplemented: ['R-1', 'R-2', 'R-4'] });
    expect(o).toMatchObject({ status: 'PASS', expected: 6, observed: 6, evaluated: 6, details: { expectRed: ['R-1', 'R-2', 'R-4'], reached: ['R-1', 'R-2', 'R-4'], uncovered: [] } });
  });

  it('09 §4 N7a: one it(\'R-3: …\') removed is FAIL uncovered R-3 [S-65]', async () => {
    const o = await run(file(['R-1', 'R-2', 'R-4', 'R-5', 'R-6'].map(green)));
    expect(o).toMatchObject({ status: 'FAIL', expected: 6, observed: 5, evaluated: 5 });
    expect(o.findings).toEqual([{ locator: `${FILE}:1`, message: 'uncovered R-3', standard: 'S-65', hint: "add it('R-3: …')" }]);
  });

  it('FAIL: a named expected-red case that passes (06 §5)', async () => {
    const o = await run(ALL_GREEN, { kind: 'test', unimplemented: ['R-1', 'R-2', 'R-4'] });
    expect(o.status).toBe('FAIL');
    expect(o.findings.map((f) => f.message)).toEqual(['R-1 expected red but passed', 'R-2 expected red but passed', 'R-4 expected red but passed']);
    expect(o.findings[0]).toMatchObject({ standard: 'S-67', hint: 'the behaviour exists or the case is vacuous' });
  });

  it('FAIL: a non-named case failing at its assertion, B.21 form [S-61]', async () => {
    const o = await run(file(['R-1', 'R-2', 'R-3', 'R-4', 'R-5'].map(green).concat([red('R-6')])));
    expect(o.status).toBe('FAIL');
    expect(o.findings).toEqual([{ locator: `${FILE}:17`, message: 'R-6: expected 404 to be 201 // Object.is equality', standard: 'S-61', hint: 'make the behaviour hold' }]);
  });

  it('UNKNOWN expect-red-not-reached: a named case failing outside its assertion (TypeError in the arrange step)', async () => {
    const o = await run(file([caseOf('R-1', 'const r = (null as unknown as { status: number }).status; expect(r).toBe(201);'), red('R-2'), green('R-3'), red('R-4'), green('R-5'), green('R-6')]), { kind: 'test', unimplemented: ['R-1', 'R-2', 'R-4'] });
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'expect-red-not-reached' });
    expect(o.findings[0]).toMatchObject({ locator: `${FILE}:2`, standard: 'S-67', hint: 'fix the arrange step' });
    expect(o.findings[0]!.message).toMatch(/^R-1 failed before its assertion: Cannot read properties of null/);
  });

  it('UNKNOWN assertion-unresolved: a named case failing with an error that carries no name', async () => {
    const o = await run(file([caseOf('R-1', 'throw Object.assign(Object.create(null), { message: "bare" });'), red('R-2'), green('R-3'), red('R-4'), green('R-5'), green('R-6')]), { kind: 'test', unimplemented: ['R-1', 'R-2', 'R-4'] });
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'assertion-unresolved' });
  });

  it('FAIL: foreign, duplicate and untagged top-level cases are findings (06 §5)', async () => {
    const o = await run(ALL_GREEN + green('R-9') + green('R-2') + "it('no tag', () => {});\n");
    expect(o.status).toBe('FAIL');
    expect(o.findings.map((f) => `${f.message} [${f.standard}]`)).toEqual([
      'R-9 is not a requirement of SPEC-DEMO-001 [S-63]', 'R-2 is tagged by more than one case [S-63]', 'no tag carries no R-n tag [S-63]',
    ]);
    expect(o).toMatchObject({ expected: 6, observed: 6 });
  });

  it('UNKNOWN setup-failed: a beforeAll failure (02 §8)', async () => {
    const o = await run(file(['R-1', 'R-2', 'R-3', 'R-4', 'R-5', 'R-6'].map(green), "import { beforeAll, expect, it } from 'vitest';\nbeforeAll(() => { throw new Error('app did not start'); });\n"));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'setup-failed', findings: [{ locator: `${FILE}:2`, message: 'setup failed: app did not start' }] });
  });

  it('UNKNOWN setup-failed: an import failure of the acceptance file', async () => {
    const o = await run(`import './missing-support.js';\n${ALL_GREEN}`);
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'setup-failed' });
    expect(o.findings[0]!.message).toMatch(/^collection failed: /);
  });

  it('FAIL: the derived acceptance file absent while another acceptance file populates the node', async () => {
    const dir = templateWorkspace({ 'vitest.config.ts': VITEST_CONFIG, 'domain/other/api/test/acceptance/spec-demo-009.acceptance.spec.ts': ALL_GREEN });
    const ctx = await contextOf(dir, { only: 'unit' });
    ctx.packet = view({ kind: 'code', unimplemented: [], specText: readFileSync(resolve(dir, 'specs/notes/SPEC-DEMO-001.md'), 'utf8') });
    const o = await specTests.run(ctx);
    expect(o).toMatchObject({ status: 'FAIL', findings: [{ locator: 'domain/<m>/api/test/acceptance/spec-demo-001.acceptance.spec.ts:1', message: 'uncovered R-1, R-2, R-3, R-4, R-5, R-6' }] });
  });

  it('UNKNOWN tooling-missing: no node_modules/.bin/vitest', async () => {
    const dir = templateWorkspace({ 'vitest.config.ts': VITEST_CONFIG, [FILE]: ALL_GREEN });
    write(dir, '.git/info/exclude', '');
    const ctx = await contextOf(dir, { only: 'unit' });
    ctx.packet = view({ kind: 'code', unimplemented: [], specText: readFileSync(resolve(dir, 'specs/notes/SPEC-DEMO-001.md'), 'utf8') });
    ctx.scratch = { database: 'devai_000000000000', server: serverOf('postgresql://localhost:1/x'), url: 'postgresql://localhost:1/x' };
    expect(await specTests.run(ctx)).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing' });
  });
});
