// 05 §2 packet file and the static pre-DAG rules (PL-01, PL-02 grammar/stem, PL-03, PL-06), messages
// verbatim from 05 §5 where 05 gives them; `devai packet new`'s rendering (08 A.4) parses back clean.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { defaultGlobs, renderPacket } from '../src/commands/packet.js';
import { checkUnique, inRootSet, KINDS, type PacketInvalid, parsePacket } from '../src/packet/packet.js';
import { statusOnlySuccessor } from '../src/packet/rules.js';
import { PACKET, packetText } from './packets.js';
import { templateDir } from './repo.js';

const refused = (text: string, path = PACKET): { rule: string; reason: string; message: string } => {
  try {
    parsePacket(path, text);
  } catch (e) {
    const p = e as PacketInvalid;
    return { rule: p.rule, reason: p.reason, message: p.message };
  }
  throw new Error('parsed');
};

describe('05 §2 / PL-01: front matter and sections', () => {
  it('PASS: the 05 §7 example and every shipped template packet parse', () => {
    for (const n of ['001', '002', '003', '004']) {
      const path = `packets/CMP-DEMO-001/PKT-DEMO-${n}.md`;
      const p = parsePacket(path, readFileSync(resolve(templateDir, path), 'utf8'));
      expect(p.id).toBe(`PKT-DEMO-${n}`);
    }
    const p = parsePacket(PACKET, packetText({ forbidden: ['domain/notes/api/src/dto/**'], extra: 'after: [PKT-DEMO-003]' }));
    expect(p).toMatchObject({ id: 'PKT-DEMO-005', kind: 'code', spec: { id: 'SPEC-DEMO-001', path: 'specs/notes/SPEC-DEMO-001.md' }, after: ['PKT-DEMO-003'], forbidden: ['domain/notes/api/src/dto/**'], protected: [] });
    expect(p.lineOf(['base'])).toBe(9);
  });

  it('after and supersedes admit packet ids only, so a CMP- trailer value never satisfies PL-12 (D-122)', () => {
    expect(refused(packetText({ extra: 'after: [CMP-DEMO-001]' }))).toMatchObject({ reason: 'packet-invalid' });
    expect(refused(packetText({ extra: 'supersedes: CMP-DEMO-001' }))).toMatchObject({ reason: 'packet-invalid' });
  });

  it('FAIL: packet invalid: <path>:<line> <yaml error | unknown field | blank | missing section>', () => {
    expect(refused(packetText({ extra: 'owner: me' }))).toEqual({ rule: 'PL-01', reason: 'packet-invalid', message: `packet invalid: ${PACKET}:10 unknown field 'owner'` });
    expect(refused(packetText({ base: '' })).message).toBe(`packet invalid: ${PACKET}:9 blank 'base'`);
    expect(refused(packetText({ title: '<title>' })).message).toBe(`packet invalid: ${PACKET}:3 blank 'title'`);
    expect(refused(packetText({ spec: 'spec:\n  id: SPEC-DEMO-001\n  path: specs/notes/SPEC-DEMO-001.md\n  sha256:\n' })).message).toBe(`packet invalid: ${PACKET}:8 blank 'spec.sha256'`);
    expect(refused(packetText({ body: '## Deliverables\n- R-1\n' })).message).toBe(`packet invalid: ${PACKET}:18 missing '## Intent'`);
    expect(refused(packetText({ body: '## Deliverables\nx\n\n## Intent\ny\n' })).message).toBe(`packet invalid: ${PACKET}:22 '## Intent' out of order`);
    expect(refused(packetText({ extra: 'base: x' })).message).toMatch(new RegExp(`^packet invalid: ${PACKET}:10 Map keys must be unique`));
    expect(refused('# no front matter\n').message).toBe(`packet invalid: ${PACKET}:1 missing front matter (--- … ---)`);
    expect(refused(packetText({ base: 'main' })).message).toBe(`packet invalid: ${PACKET}:9 'base' is not a 40-hex commit`);
    expect(refused(packetText({ protected: ['secrets'] })).message).toBe(`packet invalid: ${PACKET}:14 'protected.0' is not one of spec product decisions standards infra ci acceptance`);
    expect(refused(packetText({ spec: 'spec:\n  id: SPEC-DEMO-001\n  path: specs/notes/SPEC-DEMO-001.md\n  sha256: "a"\n  owner: x\n' })).message).toBe(`packet invalid: ${PACKET}:9 unknown field 'spec.owner'`);
  });
});

describe('PL-02 / PL-03 / PL-06', () => {
  it('PL-02: id grammar (D-050), file stem, uniqueness under packets/**', () => {
    expect(refused(packetText({ id: 'TASK-0001' }), 'packets/CMP-DEMO-001/TASK-0001.md')).toEqual({ rule: 'PL-02', reason: 'packet-invalid', message: 'packet invalid: id TASK-0001 does not match PKT-<PRODUCT>-nnn (D-050)' });
    expect(refused(packetText({ id: 'PKT-DEMO-004', allowed: ['domain/**', PACKET] })).message).toBe('packet invalid: id PKT-DEMO-004 is not the file stem');
    const p = parsePacket(PACKET, packetText({}));
    expect(() => checkUnique(p, [PACKET, 'packets/CMP-DEMO-002/PKT-DEMO-005.md'])).toThrow('packet invalid: id PKT-DEMO-005 already used by packets/CMP-DEMO-002/PKT-DEMO-005.md');
    expect(() => checkUnique(p, [PACKET, 'packets/CMP-DEMO-001/PKT-DEMO-004.md'])).not.toThrow();
  });

  it("PL-03: kind 'implement' (expected …) · spec iff not standards · sha256 iff pinning · unimplemented for test only (D-051)", () => {
    expect(refused(packetText({ kind: 'implement' }))).toEqual({ rule: 'PL-03', reason: 'packet-invalid', message: "packet invalid: kind 'implement' (expected spec|generate|test|code|fix|standards)" });
    expect(refused(packetText({ unimplemented: ['R-1'] })).message).toBe('observations.unimplemented is for kind: test only (D-051)');
    expect(refused(packetText({ kind: 'standards', allowed: ['tools/**', PACKET] })).message).toBe('packet invalid: spec is for kinds other than standards');
    expect(refused(packetText({ spec: null })).message).toBe("packet invalid: missing 'spec' for kind: code");
    expect(refused(packetText({ spec: `spec:\n  id: SPEC-DEMO-001\n  path: specs/notes/SPEC-DEMO-001.md\n` })).message).toBe("packet invalid: missing 'spec.sha256' for kind: code");
    expect(refused(packetText({ kind: 'spec' })).message).toBe('packet invalid: spec.sha256 is for pinning kinds, not kind: spec');
    expect(parsePacket(PACKET, packetText({ kind: 'test', unimplemented: ['R-1', 'R-2'] })).unimplemented).toEqual(['R-1', 'R-2']);
    expect(parsePacket(PACKET, packetText({ kind: 'standards', spec: null, allowed: ['tools/**', PACKET] })).spec).toBeNull();
  });

  it('PL-06: allowed includes the packet; every allowed glob inside the layout root set (04 §1)', () => {
    expect(refused(packetText({ allowed: ['domain/notes/**'] }))).toEqual({ rule: 'PL-06', reason: 'packet-invalid', message: `paths.allowed must include this packet (${PACKET})` });
    expect(refused(packetText({ allowed: ['lib/**', PACKET] })).message).toBe("paths.allowed 'lib/**' is outside the layout root set (04-layout §1)");
    expect(refused(packetText({ allowed: ['"**/*.ts"', PACKET] })).message).toBe("paths.allowed '**/*.ts' is outside the layout root set (04-layout §1)");
    for (const g of ['domain/notes/api/src/**', 'packets/CMP-DEMO-001/**', 'tsconfig.json', 'eslint.config.*', 'tsconfig*.json', 'pnpm-lock.yaml', '.github/**', 'apps/*/package.json']) expect(inRootSet(g)).toBe(true);
    for (const g of ['lib/**', '.npmrc', 'src/**', '*.ts']) expect(inRootSet(g)).toBe(false);
  });
});

describe('08 A.4 `packet new` rendering', () => {
  it('every kind renders a packet whose only PL-01 violation is the <title> placeholder, and whose globs pass PL-06', () => {
    for (const kind of KINDS) {
      const pinning = kind !== 'spec' && kind !== 'standards';
      const spec = kind === 'standards' ? null : { id: 'SPEC-DEMO-001', path: 'specs/notes/SPEC-DEMO-001.md', sha256: pinning ? 'c'.repeat(64) : null };
      const text = renderPacket({ id: 'PKT-DEMO-005', kind, spec, base: '0123456789'.repeat(4), allowed: [...defaultGlobs(kind, 'notes', spec?.path ?? null), PACKET], unimplemented: kind === 'test' ? ['R-1'] : [] });
      expect(refused(text).message).toBe(`packet invalid: ${PACKET}:3 blank 'title'`);
      const p = parsePacket(PACKET, text.replace('title: <title>', 'title: A title'));
      expect(p.base).toBe('0123456789'.repeat(4)); // an all-digit sha1 is quoted, so it reads back as a string
      expect(p.kind).toBe(kind);
    }
  });
});

describe("D-053's one permitted edit", () => {
  it('only the status line, approved → superseded-by: <SpecId>', () => {
    const a = 'x\nstatus: approved\ny\n';
    expect(statusOnlySuccessor(a, 'x\nstatus: "superseded-by: SPEC-DEMO-002"\ny\n')).toBe('SPEC-DEMO-002');
    expect(statusOnlySuccessor(a, 'x\nstatus: "superseded-by: SPEC-DEMO-002"\nz\n')).toBeNull();
    expect(statusOnlySuccessor(a, 'x\nstatus: draft\ny\n')).toBeNull();
  });
});
