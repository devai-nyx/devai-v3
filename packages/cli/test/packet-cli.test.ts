// W4 commands end to end on the built binary (D-057) in a temp git workspace: `devai packet new | lint
// | rebase` (A.4), `devai packets status` (A.5), and `devai check --packet` with `packet-scope`,
// `protected-paths` and `commitlint` (B.25, B.26, B.15), `--summary` and `--expect-red` (A.3). Every
// `devai check --format json` stdout is validated against C.2.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { packetPreflight } from '../src/commands/check.js';
import { modelPacket } from '../src/model/packet.js';
import { Report } from '../src/report.js';
import { gates } from '../src/runner/gating.js';
import { templateConfig } from './fixtures.js';
import { commitPacket, PACKET, packetText, packetWorkspace, SPEC_PATH } from './packets.js';
import { commitAll, gitIn, write } from './repo.js';

const bin = resolve(import.meta.dirname, '../dist/main.js');
const devai = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', env: { ...process.env, DEVAI_RUNTIME: '' } });
const json = (cwd: string, ...args: string[]) => {
  const r = devai(cwd, ...args, '--format', 'json');
  expect(r.stderr).toBe('');
  return { status: r.status, out: JSON.parse(r.stdout) as Record<string, unknown> };
};
const checkJson = (cwd: string, ...args: string[]) => {
  const r = json(cwd, 'check', ...args);
  const report = Report.parse(r.out);
  expect(report.exitCode).toBe(r.status);
  return report;
};

describe('devai packet new (A.4)', () => {
  it('renders the next id, base = HEAD, the pinned digest and the kind globs; exit 0, no commit', () => {
    const { dir, base, sha } = packetWorkspace();
    const r = json(dir, 'packet', 'new', '--kind', 'test', '--spec', SPEC_PATH);
    expect(r).toEqual({ status: 0, out: { path: PACKET, id: 'PKT-DEMO-005', rules: [], accepted: false, exitCode: 0 } });
    const text = readFileSync(resolve(dir, PACKET), 'utf8');
    expect(text).toBe([
      '---', 'id: PKT-DEMO-005', 'title: <title>', 'kind: test', 'spec:', '  id: SPEC-DEMO-001', `  path: ${SPEC_PATH}`, `  sha256: "${sha}"`, `base: ${base}`,
      'paths:', '  allowed:', '    - domain/notes/api/test/acceptance/**', `    - ${PACKET}`, 'protected: []', 'observations:', '  unimplemented: [R-1, R-2, R-4]', '---', '',
      '## Intent', '', '## Deliverables', '',
    ].join('\n'));
    expect(gitIn(dir, 'status', '--porcelain')).toBe(`?? ${PACKET}\n`);
    // the next one counts the untracked file (HEAD plus untracked, D-050); text output is the path
    const t = devai(dir, 'packet', 'new', '--kind', 'standards');
    expect([t.status, t.stdout]).toEqual([0, 'packets/CMP-DEMO-001/PKT-DEMO-006.md\n']);
  });

  it('refuses: --spec for standards (usage), a draft or superseded spec, a spec not in HEAD, no single campaign', () => {
    const { dir } = packetWorkspace();
    const refuse = (...args: string[]) => json(dir, 'packet', 'new', ...args);
    expect(refuse('--kind', 'standards', '--spec', SPEC_PATH)).toMatchObject({ status: 2, out: { reason: 'usage', message: '--spec is rejected for kind: standards (PL-03)' } });
    expect(refuse('--kind', 'code')).toMatchObject({ status: 2, out: { reason: 'usage' } });
    expect(refuse('--kind', 'code', '--spec', 'specs/notes/SPEC-DEMO-009.md')).toMatchObject({ status: 2, out: { reason: 'spec-invalid' } });
    write(dir, SPEC_PATH, readFileSync(resolve(dir, SPEC_PATH), 'utf8').replace('status: approved', 'status: draft'));
    commitAll(dir, 'docs(specs): draft');
    expect(refuse('--kind', 'code', '--spec', SPEC_PATH)).toMatchObject({ status: 2, out: { reason: 'spec-not-approved', message: 'spec SPEC-DEMO-001 status draft: the pilot approves it; note it under ## Notes and stop' } });
    write(dir, SPEC_PATH, readFileSync(resolve(dir, SPEC_PATH), 'utf8').replace('status: draft', 'status: "superseded-by: SPEC-DEMO-002"'));
    commitAll(dir, 'docs(specs): superseded');
    expect(refuse('--kind', 'fix', '--spec', SPEC_PATH)).toMatchObject({ status: 2, out: { reason: 'spec-superseded' } });
    write(dir, 'packets/CMP-DEMO-002/campaign.md', '# two\n');
    expect(refuse('--kind', 'standards')).toMatchObject({ status: 2, out: { reason: 'usage', message: '--campaign is required: packets/ holds 2 campaign folders' } });
    expect(refuse('--kind', 'standards', '--campaign', 'CMP-DEMO-002')).toMatchObject({ status: 0, out: { path: 'packets/CMP-DEMO-002/PKT-DEMO-005.md' } });
  });
});

describe('devai packet lint (A.4)', () => {
  it('exit 0 clean, PL-08 as a notice, PL-10/12/15/16 deferred', () => {
    const { dir, base, sha } = packetWorkspace();
    commitPacket(dir, packetText({ base, sha }));
    const r = json(dir, 'packet', 'lint', PACKET);
    expect(r.status).toBe(0);
    expect(r.out).toMatchObject({ path: PACKET, id: 'PKT-DEMO-005', accepted: false, exitCode: 0 });
    const rules = r.out['rules'] as { id: string; status: string; message?: string }[];
    expect(rules.map((x) => `${x.id} ${x.status}`)).toEqual([
      'PL-01 pass', 'PL-02 pass', 'PL-03 pass', 'PL-04 pass', 'PL-05 pass', 'PL-06 pass', 'PL-07 pass', 'PL-08 pass', 'PL-09 pass',
      'PL-10 deferred', 'PL-11 pass', 'PL-12 deferred', 'PL-13 pass', 'PL-14 pass', 'PL-15 deferred', 'PL-16 deferred', 'PL-17 pass',
    ]);
    expect(rules.find((x) => x.id === 'PL-08')).toEqual({ id: 'PL-08', status: 'pass', message: `protected:spec — ${PACKET} (packet declares: no)` });
  });

  it('exit 1 for a violation (PL-07 line), exit 2 packet-invalid / base-not-ancestor; text form', () => {
    const { dir, base, sha } = packetWorkspace();
    commitPacket(dir, packetText({ base, sha }));
    write(dir, 'apps/api/src/app.module.ts', 'export {};\n');
    const t = devai(dir, 'packet', 'lint', PACKET);
    expect(t.status).toBe(1);
    expect(t.stdout).toContain('PL-07  fail  apps/api/src/app.module.ts:1  out of scope: apps/api/src/app.module.ts (edit paths.allowed to widen, then re-run)\n');
    write(dir, PACKET, packetText({ base, sha, kind: 'implement' }));
    expect(json(dir, 'packet', 'lint', PACKET)).toEqual({ status: 2, out: { path: PACKET, rules: [{ id: 'PL-03', status: 'fail', message: "packet invalid: kind 'implement' (expected spec|generate|test|code|fix|standards)" }], accepted: false, exitCode: 2, reason: 'packet-invalid' } });
    write(dir, PACKET, packetText({ base: '21d61edec29f34e42b023ff787610d692c29a6be', sha }));
    expect(json(dir, 'packet', 'lint', PACKET).out).toMatchObject({ exitCode: 2, reason: 'base-not-ancestor' });
  });
});

describe('devai packet rebase (A.4, PL-05)', () => {
  it('advances base to a descendant with the same spec digest; no other byte changes', () => {
    const { dir, base, sha } = packetWorkspace();
    const text = packetText({ base, sha });
    commitPacket(dir, text);
    write(dir, 'docs/a.md', 'a\n');
    const to = commitAll(dir, 'docs: a');
    const r = devai(dir, 'packet', 'rebase', PACKET, '--to', 'HEAD');
    expect([r.status, r.stdout]).toEqual([0, `${PACKET}\n`]);
    expect(readFileSync(resolve(dir, PACKET), 'utf8')).toBe(text.replace(`base: ${base}`, `base: ${to}`));
  });

  it('judges PL-14 at --to (D-124): a context file that exists only past the old base rebases; one absent at --to is exit 2', () => {
    const { dir, base, sha } = packetWorkspace();
    const extra = 'context:\n  - { path: domain/notes/api/src/notes.repository.ts, lines: "1-2", why: "the seeds" }';
    const text = packetText({ base, sha, extra });
    commitPacket(dir, text);
    write(dir, 'domain/notes/api/src/notes.repository.ts', 'export const a = 1;\nexport const b = 2;\n');
    const to = commitAll(dir, 'feat(notes): seeds');
    expect(json(dir, 'packet', 'rebase', PACKET, '--to', 'HEAD')).toEqual({ status: 0, out: { path: PACKET, id: 'PKT-DEMO-005', rules: [{ id: 'PL-05', status: 'pass' }], accepted: false, exitCode: 0 } });
    expect(readFileSync(resolve(dir, PACKET), 'utf8')).toBe(text.replace(`base: ${base}`, `base: ${to}`));
    commitAll(dir, 'chore(packets): rebase');
    const missing = packetText({ base: to, sha, extra: extra.replace('notes.repository.ts', 'notes.absent.ts') });
    commitPacket(dir, missing);
    const r = json(dir, 'packet', 'rebase', PACKET, '--to', 'HEAD');
    expect(r.status).toBe(2);
    expect(r.out['rules']).toEqual([{ id: 'PL-14', status: 'fail', message: expect.stringMatching(/^context\[0\] domain\/notes\/api\/src\/notes\.absent\.ts does not exist at base [0-9a-f]{4}…$/) }]);
  });

  it('exit 1: --to does not descend from base, or the spec digest differs there; exit 2 usage for a bad --to', () => {
    const { dir, base, sha } = packetWorkspace();
    write(dir, 'docs/a.md', 'a\n');
    const b2 = commitAll(dir, 'docs: a');
    commitPacket(dir, packetText({ base: b2, sha }));
    expect(json(dir, 'packet', 'rebase', PACKET, '--to', base)).toEqual({ status: 1, out: { path: PACKET, id: 'PKT-DEMO-005', rules: [{ id: 'PL-05', status: 'fail', message: `base moved backwards (introduced ${b2.slice(0, 4)}…, now ${base.slice(0, 4)}…)` }], accepted: false, exitCode: 1 } });
    write(dir, SPEC_PATH, readFileSync(resolve(dir, SPEC_PATH), 'utf8').replace('Two API routes', 'Three API routes'));
    const moved = commitAll(dir, 'docs(specs): edit');
    const r = json(dir, 'packet', 'rebase', PACKET, '--to', moved);
    expect(r.status).toBe(1);
    expect((r.out['rules'] as { message: string }[])[0]!.message).toMatch(/^spec SPEC-DEMO-001 at base is [0-9a-f]{4}… ≠ packet [0-9a-f]{4}…: the setpoint moved; write a successor packet$/);
    expect(json(dir, 'packet', 'rebase', PACKET, '--to', 'nope')).toMatchObject({ status: 2, out: { reason: 'usage', message: '--to nope: not a commit' } });
  });
});

describe('devai packets status (A.5)', () => {
  it('drafted, frozen, candidate, merged, superseded with their evidence; JSON shape', () => {
    const { dir, base, sha } = packetWorkspace();
    commitPacket(dir, packetText({ base, sha, extra: 'after: [PKT-DEMO-004]' }));
    const frozen = gitIn(dir, 'rev-parse', 'HEAD').trim();
    write(dir, 'packets/CMP-DEMO-001/PKT-DEMO-006.md', packetText({ id: 'PKT-DEMO-006', base, sha }));
    const r = json(dir, 'packets', 'status');
    expect(r.status).toBe(0);
    const packets = (r.out['campaigns'] as { id: string; packets: { id: string; state: string; evidence: string; after: string[] }[] }[])[0]!.packets;
    expect(packets.find((p) => p.id === 'PKT-DEMO-005')).toEqual({ id: 'PKT-DEMO-005', kind: 'code', state: 'frozen', evidence: `introduced in ${frozen.slice(0, 12)}`, after: ['PKT-DEMO-004'] });
    expect(packets.find((p) => p.id === 'PKT-DEMO-006')).toMatchObject({ state: 'drafted', evidence: 'not in any commit' });
    // the shipped template packets name an illustrative base: committed, not complete
    expect(packets.find((p) => p.id === 'PKT-DEMO-004')).toMatchObject({ state: 'drafted', evidence: expect.stringMatching(/^in a commit, not complete: base 21d6… is not an ancestor of HEAD/) });

    // a commit carrying the trailer on a branch: candidate; once on main: merged
    gitIn(dir, 'checkout', '-q', '-b', 'work');
    write(dir, 'domain/notes/api/src/a.ts', 'export {};\n');
    gitIn(dir, 'add', '-A');
    gitIn(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'feat(notes): a', '-m', 'Packet: PKT-DEMO-005');
    const c = gitIn(dir, 'rev-parse', 'HEAD').trim();
    const line = (id: string) => devai(dir, 'packets', 'status').stdout.split('\n').find((l) => l.startsWith(id));
    expect(line('PKT-DEMO-005')).toBe(`PKT-DEMO-005  code  candidate  1 commit carrying Packet: PKT-DEMO-005, latest ${c.slice(0, 12)}`);
    gitIn(dir, 'checkout', '-q', 'main');
    gitIn(dir, 'merge', '-q', '--ff-only', 'work');
    expect(line('PKT-DEMO-005')).toBe(`PKT-DEMO-005  code  merged  ${c.slice(0, 12)} on main carries Packet: PKT-DEMO-005`);
    commitPacket(dir, packetText({ id: 'PKT-DEMO-006', base, sha, extra: 'supersedes: PKT-DEMO-005' }), 'packets/CMP-DEMO-001/PKT-DEMO-006.md');
    expect(line('PKT-DEMO-005')).toBe('PKT-DEMO-005  code  superseded  superseded by PKT-DEMO-006 (PL-16)');
  });
});

describe('devai packets status: init\'s Packet: CMP-DEMO-001 carries no packet (D-122)', () => {
  it('a packet file whose id is a campaign id never takes the CMP trailer commit as its evidence', () => {
    const { dir, base, sha } = packetWorkspace();
    gitIn(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'chore(packets): seed CMP-DEMO-001', '-m', 'Packet: CMP-DEMO-001');
    commitPacket(dir, packetText({ id: 'CMP-DEMO-001', base, sha }), 'packets/CMP-DEMO-001/PKT-DEMO-007.md');
    const p = (json(dir, 'packets', 'status').out['campaigns'] as { packets: { id: string; state: string; evidence: string }[] }[])[0]!.packets.find((x) => x.id === 'CMP-DEMO-001')!;
    expect(p.state).not.toBe('merged');
    expect(p.state).not.toBe('candidate');
    expect(p.evidence).not.toMatch(/carries Packet: CMP-DEMO-001|carrying Packet/);
  });
});

describe('devai check --packet (A.3, B.25, B.26)', () => {
  it('packet-scope PASS and protected-paths over base..candidate; C.2-valid; exit 0', () => {
    const { dir, base, sha } = packetWorkspace();
    commitPacket(dir, packetText({ base, sha, protected: ['spec'] }));
    write(dir, 'domain/notes/api/src/notes.service.ts', 'export {};\n');
    const report = checkJson(dir, '--packet', PACKET, '--only', 'packet-scope', '--only', 'protected-paths');
    expect(report).toMatchObject({ packetId: 'PKT-DEMO-005', kind: 'code', specId: 'SPEC-DEMO-001', specSha256: sha, base, accepted: false, exitCode: 0 });
    expect(report.nodes.map((n) => [n.id, n.status])).toEqual([['inventory', 'PASS'], ['protected-paths', 'PASS'], ['packet-scope', 'PASS'], ['accept', 'PASS']]);
    // two changed paths (the packet in base..HEAD, the service in the working tree) + seven rules
    expect(report.nodes[2]).toMatchObject({ expected: 9, observed: 9, evaluated: 9, findings: [] });
    expect(report.nodes[1]!.details).toEqual({ node: 'protected-paths', touched: [{ class: 'spec', paths: [PACKET], declared: true }] });
    expect(report.nodes[0]!.details).toMatchObject({ populations: { 'packet-scope': { count: 1 }, commitlint: { count: 1 } } });
  });

  it('packet-scope FAIL is exit 1 with the PL-07 line; N13: an in-branch widening of protected leaves the class undeclared and review gating', () => {
    const { dir, base, sha } = packetWorkspace();
    commitPacket(dir, packetText({ base, sha, protected: [] }));
    gitIn(dir, 'checkout', '-q', '-b', 'n13');
    write(dir, '.github/workflows/ci.yml', 'on: push\n');
    write(dir, PACKET, packetText({ base, sha, protected: ['ci', 'spec'] }));
    commitAll(dir, 'ci: widen');
    const report = checkJson(dir, '--packet', PACKET, '--only', 'packet-scope', '--only', 'protected-paths');
    expect(report.exitCode).toBe(1);
    const scope = report.nodes.find((n) => n.id === 'packet-scope')!;
    expect(scope).toMatchObject({ status: 'FAIL', findings: [{ locator: '.github/workflows/ci.yml:1', message: 'out of scope: .github/workflows/ci.yml (edit paths.allowed to widen, then re-run)', standard: '05 PL-07' }] });
    const pp = report.nodes.find((n) => n.id === 'protected-paths')!;
    expect(pp.details).toEqual({ node: 'protected-paths', touched: [
      { class: 'spec', paths: [PACKET], declared: false },
      { class: 'ci', paths: ['.github/workflows/ci.yml'], declared: false },
    ] });
    // D-078: an undeclared class makes `review` gating while mustRun is false
    const review: Parameters<typeof gates>[0] = { id: 'review', status: 'PASS', expected: 1, observed: 1, evaluated: 1, findings: [], durationMs: 0, cached: false, needs: ['model'] };
    expect(gates(review, templateConfig(), report.nodes)).toBe(true);
    const text = devai(dir, 'check', '--packet', PACKET, '--only', 'protected-paths').stdout;
    expect(text).toContain('protected:ci — .github/workflows/ci.yml (packet declares: no)\n');
  });

  it('pre-DAG refusals: packet-invalid, base-not-ancestor (envelope, exit 2); --expect-red must agree (PL-11)', () => {
    const { dir, base, sha } = packetWorkspace();
    write(dir, PACKET, packetText({ base, sha, title: '<title>' }));
    expect(json(dir, 'check', '--packet', PACKET, '--only', 'packet-scope')).toEqual({ status: 2, out: { accepted: false, exitCode: 2, reason: 'packet-invalid', message: `packet invalid: ${PACKET}:3 blank 'title'` } });
    write(dir, PACKET, packetText({ base: 'f'.repeat(40), sha }));
    expect(json(dir, 'check', '--packet', PACKET, '--only', 'packet-scope').out).toMatchObject({ reason: 'base-not-ancestor', message: 'base ffff… is not an ancestor of HEAD; rebase onto it or run devai packet rebase' });
    write(dir, PACKET, packetText({ base, sha }));
    expect(json(dir, 'check', '--packet', PACKET, '--only', 'packet-scope', '--expect-red').out).toMatchObject({ reason: 'expect-red-nothing-named', message: '--expect-red given but observations.unimplemented is empty' });
    write(dir, PACKET, packetText({ base, sha, kind: 'test', unimplemented: ['R-1'], allowed: ['domain/notes/api/test/acceptance/**', PACKET] }));
    expect(checkJson(dir, '--packet', PACKET, '--only', 'packet-scope', '--expect-red').exitCode).toBe(0);
    expect(json(dir, 'check', '--packet', 'packets/CMP-DEMO-001/PKT-DEMO-404.md').out).toMatchObject({ reason: 'packet-invalid', message: 'packet invalid: packets/CMP-DEMO-001/PKT-DEMO-404.md:1 not readable' });
  });

  it('--summary prints the C.3 summary of the report bound to the current candidate, else exit 2 no-report', () => {
    const { dir, base, sha } = packetWorkspace();
    commitPacket(dir, packetText({ base, sha, protected: ['spec'] }));
    const head = gitIn(dir, 'rev-parse', 'HEAD').trim();
    expect(json(dir, 'check', '--packet', PACKET, '--summary')).toEqual({ status: 2, out: { accepted: false, exitCode: 2, reason: 'no-report', message: `no acceptance report for head ${head}; run --full` } });
    checkJson(dir, '--packet', PACKET, '--only', 'packet-scope', '--only', 'protected-paths');
    const r = devai(dir, 'check', '--packet', PACKET, '--summary');
    expect(r.status).toBe(0);
    expect(r.stdout).toBe([
      `PKT-DEMO-005  Implement note creation   spec SPEC-DEMO-001 @ ${sha.slice(0, 4)}… (frozen)`,
      'acceptance: PASS (4 nodes: 4 pass)   runtime: bare',
      `protected paths: spec (${PACKET}, declared)   packet scope: ok   spec tests: deferred`,
      '',
    ].join('\n'));
    write(dir, 'domain/notes/api/src/a.ts', 'export {};\n'); // a new candidate has no report
    expect(json(dir, 'check', '--packet', PACKET, '--summary').out).toMatchObject({ reason: 'no-report' });
  });

  it('commitlint gets its range population under --packet (B.1: commits in base..HEAD)', () => {
    const { dir, base, sha } = packetWorkspace();
    commitPacket(dir, packetText({ base, sha }));
    write(dir, 'domain/notes/api/src/a.ts', 'export {};\n');
    commitAll(dir, 'feat(notes): a');
    const report = checkJson(dir, '--packet', PACKET, '--only', 'commitlint');
    expect(report.nodes[0]!.details).toMatchObject({ populations: { commitlint: { count: 2 } } });
    // no tools/commitlint.config.mjs in the template workspace: pre-flighted, never invoked (D-086)
    expect(report.nodes.find((n) => n.id === 'commitlint')).toMatchObject({ status: 'UNKNOWN', reason: 'lint-config-failed', expected: 2 });
  });

  it('fills RunContext.packet for the packet-bound nodes: W3\'s view and W5\'s PacketFacts', async () => {
    const { dir, base, sha } = packetWorkspace();
    const text = packetText({ base, sha, kind: 'test', unimplemented: ['R-1'], allowed: ['domain/notes/api/test/acceptance/**', PACKET], body: '## Intent\n\nx\n\n## Deliverables\n\n- R-1 case\n  in acceptance\n- R-2 case\n' });
    commitPacket(dir, text);
    const pk = await packetPreflight(dir, PACKET, true);
    expect(pk).toMatchObject({ kind: 'test', unimplemented: ['R-1'], specText: readFileSync(resolve(dir, SPEC_PATH), 'utf8'), intro: { sha: gitIn(dir, 'rev-parse', 'HEAD').trim() } });
    expect(modelPacket(pk)).toEqual({
      ...pk, id: 'PKT-DEMO-005', kind: 'test', path: PACKET, base, text, specPath: SPEC_PATH, specSha256: sha, sources: [],
      deliverables: ['R-1 case\n  in acceptance', 'R-2 case'], full: true,
    });
  });
});
