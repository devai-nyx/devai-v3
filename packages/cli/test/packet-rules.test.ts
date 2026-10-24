// 05 §5 rules that read git, each with a PASS and a FAIL fixture in a committed template workspace:
// the pre-DAG branches (PL-02 uniqueness, PL-05, PL-14, PL-04 absent at base), the `packet-scope`
// rules (PL-04, PL-05, PL-07, PL-09, PL-11, PL-13, PL-17), PL-08's classification (D-078) and
// `accept`'s PL-12 / PL-16. Messages are 05 §5's, verbatim.
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../src/candidate/digest.js';
import { changedSince } from '../src/commands/packet.js';
import { type PacketInvalid, parsePacket } from '../src/packet/packet.js';
import { classify, introducedProtected, introducing, pl12, pl16, preDag, scopeRules, short } from '../src/packet/rules.js';
import { templateConfig } from './fixtures.js';
import { commitPacket, PACKET, type PacketFields, packetText, packetWorkspace, SPEC_PATH } from './packets.js';
import { commitAll, gitIn, write } from './repo.js';

const spec = (dir: string) => readFileSync(resolve(dir, SPEC_PATH), 'utf8');

/** Runs the pre-DAG checks and the scope rules for the packet file as it is on disk; findings by rule. */
async function scope(dir: string, path = PACKET): Promise<Record<string, string[]>> {
  const p = parsePacket(path, readFileSync(resolve(dir, path), 'utf8'));
  await preDag(dir, p, [path]);
  const results = await scopeRules({ root: dir, packet: p, changed: await changedSince(dir, p.base), intro: await introducing(dir, path) });
  return Object.fromEntries(results.filter((r) => r.findings.length > 0 || r.notices.length > 0).map((r) => [r.id, [...r.findings.map((f) => f.message), ...r.notices.map((n) => `notice: ${n}`)]]));
}
async function preDagError(dir: string, text: string): Promise<{ rule: string; reason: string; message: string }> {
  const p = parsePacket(PACKET, text);
  try {
    await preDag(dir, p, [PACKET]);
  } catch (e) {
    const x = e as PacketInvalid;
    return { rule: x.rule, reason: x.reason, message: x.message };
  }
  throw new Error('passed');
}

/** A workspace with the packet committed at a real base pinning the shipped spec. */
function ready(f: PacketFields & { sha?: string } = {}) {
  const ws = packetWorkspace();
  const intro = commitPacket(ws.dir, packetText({ base: ws.base, sha: ws.sha, ...f }));
  return { ...ws, intro };
}

describe('pre-DAG branches that read git (C.1 step 1)', () => {
  it('PASS: a committed packet at a real base', async () => {
    const { dir } = ready();
    expect(await scope(dir)).toEqual({});
  });

  it('PL-05: base 21d6… is not an ancestor of HEAD (exit 2 base-not-ancestor)', async () => {
    const { dir, sha } = packetWorkspace();
    expect(await preDagError(dir, packetText({ base: '21d61edec29f34e42b023ff787610d692c29a6be', sha }))).toEqual({
      rule: 'PL-05', reason: 'base-not-ancestor', message: 'base 21d6… is not an ancestor of HEAD; rebase onto it or run devai packet rebase',
    });
    // a commit on another branch is not an ancestor either
    gitIn(dir, 'checkout', '-q', '-b', 'side');
    write(dir, 'x.md', 'x\n');
    const other = commitAll(dir, 'chore: other');
    gitIn(dir, 'checkout', '-q', 'main');
    expect((await preDagError(dir, packetText({ base: other, sha }))).reason).toBe('base-not-ancestor');
  });

  it('PL-14: context resolves at base and inside the file; the packet is ≤ 200 lines', async () => {
    const { dir, base, sha } = packetWorkspace();
    const ctx = (lines: string, path = 'product/demo/rules/RN-DEMO-001.md') => packetText({ base, sha, extra: `context:\n  - { path: ${path}, lines: "${lines}", why: the limits }` });
    await expect(preDag(dir, parsePacket(PACKET, ctx('1-5')), [PACKET])).resolves.toBeUndefined();
    expect(await preDagError(dir, ctx('1-40'))).toEqual({ rule: 'PL-14', reason: 'packet-invalid', message: 'context[0] product/demo/rules/RN-DEMO-001.md lines 1-40 exceeds the file (5 lines)' });
    expect((await preDagError(dir, ctx('1-2', 'product/nope.md'))).message).toBe(`context[0] product/nope.md does not exist at base ${short(base)}`);
    const long = packetText({ base, sha, body: `## Intent\n${'x\n'.repeat(210)}\n## Deliverables\n- R-1\n` });
    expect((await preDagError(dir, long)).message).toBe(`packet is ${long.split('\n').length - 1} lines (limit 200): move prose to the spec or the module README`);
  });

  it('PL-04: the pinned spec does not exist at base (exit 2 packet-invalid)', async () => {
    const { dir, base, sha } = packetWorkspace();
    const text = packetText({ base, sha, spec: `spec:\n  id: SPEC-DEMO-009\n  path: specs/notes/SPEC-DEMO-009.md\n  sha256: "${sha}"\n` });
    expect(await preDagError(dir, text)).toEqual({ rule: 'PL-04', reason: 'packet-invalid', message: `spec specs/notes/SPEC-DEMO-009.md does not exist at base ${short(base)}` });
  });
});

describe('packet-scope rules (findings, exit 1)', () => {
  it('PL-04: digest moved · status draft · edited in the candidate · superseded-by pin vs notice', async () => {
    const moved = ready({ sha: 'c'.repeat(64) });
    expect((await scope(moved.dir))['PL-04']).toEqual([`spec SPEC-DEMO-001 at base is ${short(moved.sha)} ≠ packet cccc…: the setpoint moved; write a successor packet`]);

    const draft = packetWorkspace();
    write(draft.dir, SPEC_PATH, spec(draft.dir).replace('status: approved', 'status: draft'));
    const draftBase = commitAll(draft.dir, 'docs(specs): draft');
    commitPacket(draft.dir, packetText({ base: draftBase, sha: sha256(readFileSync(resolve(draft.dir, SPEC_PATH))) }));
    expect((await scope(draft.dir))['PL-04']).toEqual(['spec SPEC-DEMO-001 status draft: the pilot approves it; note it under ## Notes and stop']);

    const edited = ready();
    write(edited.dir, SPEC_PATH, spec(edited.dir).replace('Two API routes', 'Three API routes'));
    expect((await scope(edited.dir))['PL-04']).toEqual(['spec SPEC-DEMO-001 edited in the candidate: a spec is a successor, not an edit']);

    // superseded-by in the candidate: a packet introduced after its base may not keep the pin …
    const late = ready();
    write(late.dir, SPEC_PATH, spec(late.dir).replace('status: approved', 'status: "superseded-by: SPEC-DEMO-002"'));
    expect((await scope(late.dir))['PL-04']).toEqual(['spec SPEC-DEMO-001 is superseded-by SPEC-DEMO-002: pin the successor']);
    // … one introduced at or below base keeps hashing its blob, with a notice (D-053).
    const early = ready();
    write(early.dir, PACKET, packetText({ base: early.intro, sha: early.sha }));
    commitAll(early.dir, 'chore(packets): advance base');
    write(early.dir, SPEC_PATH, spec(early.dir).replace('status: approved', 'status: "superseded-by: SPEC-DEMO-002"'));
    expect((await scope(early.dir))['PL-04']).toEqual(["notice: spec SPEC-DEMO-001 is superseded-by SPEC-DEMO-002 in the candidate (D-053's one permitted edit)"]);
  });

  it('PL-05: base may advance, never move back', async () => {
    const { dir, base, sha } = packetWorkspace();
    write(dir, 'docs/a.md', 'a\n');
    const b2 = commitAll(dir, 'docs: a');
    commitPacket(dir, packetText({ base: b2, sha }));
    expect(await scope(dir)).toEqual({});
    write(dir, PACKET, packetText({ base, sha }));
    expect((await scope(dir))['PL-05']).toEqual([`base moved backwards (introduced ${short(b2)}, now ${short(base)})`]);
  });

  it('PL-07: out of scope · forbidden wins inside allowed (D-052) · generation-manifest by a code packet · review evidence excluded', async () => {
    const { dir } = ready({ forbidden: ['domain/notes/api/src/dto/**'] });
    write(dir, 'domain/notes/api/src/notes.service.ts', 'export {};\n');
    write(dir, '.devai/review/PKT-DEMO-005.json', '{}\n');
    gitIn(dir, 'add', '-f', '.devai/review/PKT-DEMO-005.json');
    expect(await scope(dir)).toEqual({});
    write(dir, 'apps/api/src/app.module.ts', 'export {};\n');
    write(dir, 'domain/notes/api/src/dto/create-note.dto.ts', 'export {};\n');
    write(dir, 'domain/notes/generation-manifest.json', '{"files":[]}\n');
    expect((await scope(dir))['PL-07']).toEqual([
      'out of scope: apps/api/src/app.module.ts (edit paths.allowed to widen, then re-run)',
      'forbidden path touched: domain/notes/api/src/dto/create-note.dto.ts (regenerate or move the logic to a seed)',
      'out of scope: domain/notes/generation-manifest.json (edit paths.allowed to widen, then re-run)',
      'generation-manifest.json changed by a code packet',
    ]);
  });

  it('PL-07: a generate packet owns the manifest', async () => {
    const { dir } = ready({ kind: 'generate', allowed: ['domain/notes/**', PACKET] });
    write(dir, 'domain/notes/generation-manifest.json', '{"files":[]}\n');
    expect(await scope(dir)).toEqual({});
  });

  it('PL-09: dispositions bind to exactly one fingerprint in the committed review history', async () => {
    const fp = (c: string) => `ac9f878d7da8${c.repeat(52)}`;
    const review = JSON.stringify({ findings: [
      { fingerprint: fp('1'), requirement: 'R-4', locator: 'domain/notes/api/src/notes.service.ts:41' },
      { fingerprint: fp('2'), requirement: 'R-2', locator: 'domain/notes/api/src/notes.service.ts:9' },
      { fingerprint: `bb${'0'.repeat(62)}`, requirement: 'R-1', locator: 'domain/notes/api/src/notes.service.ts:3' },
    ] });
    const body = (lines: string[]) => `## Intent\nx\n\n## Deliverables\n- R-1\n\n## Review dispositions\n${lines.join('\n')}\n`;
    const ok = ready({ body: body([`RV bb0000000000 · R-1 · domain/notes/api/src/notes.service.ts:3 · not-a-defect · the reviewer misread R-1`]) });
    write(ok.dir, '.devai/review/PKT-DEMO-005.json', review);
    expect(await scope(ok.dir)).toEqual({});

    const bad = ready({ body: body([
      'RV ac9f878d7da8 · R-4 · domain/notes/api/src/notes.service.ts:41 · not-a-defect · x',
      'RV dddddddddddd · R-4 · x.ts:1 · accepted-risk · y',
      'RV bb0000000000 · R-3 · domain/notes/api/src/notes.service.ts:3 · not-a-defect · z',
      'RV bb00 · R-1 · x · fixed · nope',
    ]) });
    write(bad.dir, '.devai/review/PKT-DEMO-005.json', review);
    expect((await scope(bad.dir))['PL-09']).toEqual([
      'RV ac9f… ambiguous (2 findings); use a longer prefix',
      'RV dddddddddddd not found in .devai/review/PKT-DEMO-005.json or its history since base: dispositions bind to fingerprints; copy one from the report',
      'RV bb00… names R-3 · domain/notes/api/src/notes.service.ts:3; the finding is R-1 · domain/notes/api/src/notes.service.ts:3',
      'RV line does not parse: RV <fingerprint> · R-n · <locator> · not-a-defect|accepted-risk · <reason>',
    ]);
    // the history since base counts: a committed version, later removed from the working tree, still resolves
    gitIn(bad.dir, 'add', '-f', '.devai/review/PKT-DEMO-005.json');
    gitIn(bad.dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'chore(review): evidence');
    rmSync(resolve(bad.dir, '.devai/review/PKT-DEMO-005.json'));
    expect((await scope(bad.dir))['PL-09']).toHaveLength(4);
  });

  it("PL-11: a test packet's expected red names the spec's unimplemented acceptance cases only", async () => {
    const ok = ready({ kind: 'test', unimplemented: ['R-1', 'R-2', 'R-4'], allowed: ['domain/notes/api/test/acceptance/**', PACKET] });
    expect(await scope(ok.dir)).toEqual({});
    const bad = ready({ kind: 'test', unimplemented: ['R-9', 'R-3'], allowed: ['domain/notes/api/test/acceptance/**', PACKET] });
    expect((await scope(bad.dir))['PL-11']).toEqual([
      'R-9 is not a requirement of SPEC-DEMO-001',
      'R-3 is not in SPEC-DEMO-001 unimplemented[]: a test packet may expect red only for cases the spec declares unimplemented',
    ]);
  });

  it('PL-13: id, kind, spec.* and supersedes are frozen at the introducing commit', async () => {
    const { dir, base, sha, intro } = ready();
    write(dir, PACKET, packetText({ base, sha, kind: 'fix', extra: 'supersedes: PKT-DEMO-004' }));
    expect((await scope(dir))['PL-13']).toEqual([
      `frozen field 'kind' changed since ${short(intro)}; write a successor packet`,
      `frozen field 'supersedes' changed since ${short(intro)}; write a successor packet`,
    ]);
  });

  it('PL-17: spec transitions bounded to the blob at base (SL09)', async () => {
    const { dir, sha } = ready({ allowed: ['specs/**', PACKET] });
    const original = spec(dir);
    const successor = original.replace('id: SPEC-DEMO-001', 'id: SPEC-DEMO-002').replace('approved-by: DemoPilot', `approved-by: DemoPilot\nsupersedes: {id: SPEC-DEMO-001, path: ${SPEC_PATH}, sha256: ${sha}}`);
    // added as draft: legal; approved → superseded-by with a successor carrying the base digest: legal
    write(dir, 'specs/notes/SPEC-DEMO-003.md', original.replace('id: SPEC-DEMO-001', 'id: SPEC-DEMO-003').replace('status: approved', 'status: draft'));
    write(dir, 'specs/notes/SPEC-DEMO-002.md', successor);
    write(dir, SPEC_PATH, original.replace('status: approved', 'status: "superseded-by: SPEC-DEMO-002"'));
    const ok = await scope(dir);
    expect(ok['PL-17']).toBeUndefined();
    // the successor's supersedes.sha256 is not the blob at base
    write(dir, 'specs/notes/SPEC-DEMO-002.md', successor.replace(sha, 'e'.repeat(64)));
    expect((await scope(dir))['PL-17']).toEqual(['spec SPEC-DEMO-001 superseded-by SPEC-DEMO-002 but SPEC-DEMO-002.supersedes.sha256 ≠ blob at base']);
    // approved → draft, and added as approved without approved-by: illegal
    rmSync(resolve(dir, 'specs/notes/SPEC-DEMO-002.md'));
    write(dir, SPEC_PATH, original.replace('status: approved', 'status: draft'));
    write(dir, 'specs/notes/SPEC-DEMO-003.md', original.replace('id: SPEC-DEMO-001', 'id: SPEC-DEMO-003').replace('approved-by: DemoPilot', 'approved-by: null'));
    expect((await scope(dir))['PL-17']).toEqual([
      'spec SPEC-DEMO-001: illegal transition approved → draft; write a successor',
      'spec SPEC-DEMO-003: illegal transition absent → approved without approved-by; write a successor',
    ]);
  });
});

describe('PL-08 classification (B.25, D-078) and accept PL-12 / PL-16', () => {
  it('N13: a class first declared inside the branch stays undeclared', async () => {
    const { dir, base, sha } = ready();
    write(dir, '.github/workflows/x.yml', 'on: push\n');
    write(dir, PACKET, packetText({ base, sha, protected: ['ci'] }));
    const p = parsePacket(PACKET, readFileSync(resolve(dir, PACKET), 'utf8'));
    const declared = introducedProtected(p, await introducing(dir, PACKET));
    expect(declared).toEqual([]);
    expect(classify(templateConfig(), await changedSince(dir, base), declared)).toEqual([
      { class: 'spec', paths: [PACKET], declared: false },
      { class: 'ci', paths: ['.github/workflows/x.yml'], declared: false },
    ]);
    // declared at the introducing commit: declared
    const pre = ready({ protected: ['ci', 'spec'] });
    write(pre.dir, '.github/workflows/x.yml', 'on: push\n');
    const q = parsePacket(PACKET, readFileSync(resolve(pre.dir, PACKET), 'utf8'));
    expect(classify(templateConfig(), await changedSince(pre.dir, pre.base), introducedProtected(q, await introducing(pre.dir, PACKET)))).toEqual([
      { class: 'spec', paths: [PACKET], declared: true },
      { class: 'ci', paths: ['.github/workflows/x.yml'], declared: true },
    ]);
  });

  it('PL-12: after: is merged below base; PL-16: no packet at HEAD supersedes this one', async () => {
    const { dir, base, sha } = packetWorkspace();
    write(dir, 'docs/x.md', 'x\n');
    gitIn(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A');
    gitIn(dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'docs: x', '-m', 'Packet: PKT-DEMO-003');
    const merged = gitIn(dir, 'rev-parse', 'HEAD').trim();
    commitPacket(dir, packetText({ base: merged, sha, extra: 'after: [PKT-DEMO-003, PKT-DEMO-002]' }));
    const p = parsePacket(PACKET, readFileSync(resolve(dir, PACKET), 'utf8'));
    expect((await pl12(dir, p)).map((f) => f.message)).toEqual([`after: PKT-DEMO-002 is not merged below base ${short(merged)}; advance base with devai packet rebase`]);
    expect(base).not.toBe(merged);
    expect(await pl16(dir, p)).toEqual([]);
    commitPacket(dir, packetText({ id: 'PKT-DEMO-006', base: merged, sha, extra: 'supersedes: PKT-DEMO-005' }), 'packets/CMP-DEMO-001/PKT-DEMO-006.md');
    expect(await pl16(dir, p)).toEqual([{ locator: `${PACKET}:1`, message: 'packet PKT-DEMO-005 is superseded by PKT-DEMO-006; work that packet', standard: '05 PL-16', hint: 'work the successor packet; a superseded packet is ended (05 §4)' }]);
  });
});
