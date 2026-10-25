// W8 end to end on the built binary (D-057) in a temp workspace: `devai new module` (08 A.2) then
// `devai check --only generated` (B.16, 09 §3). 09 §4 campaign steps 3–4 and cells N8–N11; the
// `--regenerate` cases of A.2, D-033, D-053 and D-074. The workspace is the template's fixed files
// (09 §1.1) with 06 §7's configuration (`lgpd: true`) and an empty `database/seed/modules.txt`.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sha256 } from '../src/candidate/digest.js';
import { cliVersion } from '../src/main.js';
import { Report } from '../src/report.js';
import { PAIR_HINT } from '../src/nodes/generated.js';
import { templateConfig } from './fixtures.js';
import { rows } from './generator/s6.js';
import { commitAll, gitIn, templateWorkspace, write } from './repo.js';

const bin = resolve(import.meta.dirname, '../dist/main.js');
const devai = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', env: { ...process.env, DEVAI_RUNTIME: '' } });
const SPEC = 'specs/notes/SPEC-DEMO-001.md';
const DTO = 'domain/notes/api/src/dto/create-note.dto.ts';
const SQL = 'domain/notes/db/demo_notes_notes.sql';
const SERVICE = 'domain/notes/api/src/notes.service.ts';
const MANIFEST = 'domain/notes/generation-manifest.json';
const read = (dir: string, p: string) => readFileSync(resolve(dir, p), 'utf8');

/** 09 §1.1 fixed files, 06 §7's configuration, `modules.txt` empty at init. */
function workspace(): string {
  return templateWorkspace({
    'devai.json': JSON.stringify({ ...templateConfig(), lgpd: true }, null, 2) + '\n',
    'database/seed/modules.txt': '',
  });
}
const generate = (dir: string, ...args: string[]) => devai(dir, 'new', 'module', '--spec', SPEC, ...args);
const generatedNode = (dir: string) => {
  const r = devai(dir, 'check', '--only', 'generated', '--format', 'json');
  expect(r.stderr).toBe('');
  const report = Report.parse(JSON.parse(r.stdout));
  expect(report.exitCode).toBe(r.status);
  return { status: r.status, node: report.nodes.find((n) => n.id === 'generated')!, report };
};
/** The D-088 pairs: always `tooling-missing` until STYNX publishes the write forms. */
const pairsOnly = (findings: { hint: string }[]) => findings.every((f) => f.hint === PAIR_HINT) && findings.length === 3;

describe('09 §4 campaign steps 3–4 (PKT-DEMO-002)', () => {
  it('new module writes 09 §6’s tree, appends modules.txt, prints the mount lines; generated replays clean', () => {
    const dir = workspace();
    const r = generate(dir);
    expect([r.status, r.stderr]).toEqual([0, '']);
    const out = r.stdout.split('\n');
    // one line per file `<mode> <path>` (A.2), then the append and the mount lines (09 §2, D-087)
    const s6 = rows();
    for (const row of s6.filter((x) => x.path.startsWith('domain/notes/') && x.mode !== '—')) expect(out).toContain(`${row.mode} ${row.path}`);
    expect(out).toContain('appended database/seed/modules.txt');
    expect(out).toContain(s6.find((x) => x.path === 'stdout')!.synopsis[0]);
    expect(out).toContain('mount: add { "path": "../../domain/notes/api" } to apps/api/tsconfig.json references'); // D-093
    expect(out.some((l) => l.includes('apps/web/tsconfig.json'))).toBe(false);
    expect(out).toContain('mount: add "domain/notes/api/src" to .stynxrc.json apiCoverage.sourceRoots');
    expect(out).toContain('mount: add "domain/notes" to .stynxrc.json publicApi.packageRoots');
    // D-106: the build is the last mount line, after the install the first line names
    expect(out.filter((l) => l.startsWith('mount: ')).at(-1)).toBe('mount: then pnpm -r build');
    // 09 §6 row `database/seed/modules.txt  appended  <sha256>  domain/notes/db/demo_notes_notes.sql`
    const line = s6.find((x) => x.path === 'database/seed/modules.txt')!.synopsis[0]!.replace('<sha256>', sha256(readFileSync(resolve(dir, SQL))));
    expect(read(dir, 'database/seed/modules.txt')).toBe(`${line}\n`);
    // nothing else: no commit, no edit of seed files the generator does not own (A.2, 09 §2)
    expect(gitIn(dir, 'status', '--porcelain').split('\n').filter(Boolean).sort()).toEqual([' M database/seed/modules.txt', '?? domain/']);
    const m = JSON.parse(read(dir, MANIFEST)) as { generatorVersion: string; specSha256: string };
    expect(m.generatorVersion).toBe(cliVersion());
    expect(m.specSha256).toBe(sha256(readFileSync(resolve(dir, SPEC))));
    gitIn(dir, 'add', '-A');
    gitIn(dir, '-c', 'user.name=devai-test', '-c', 'user.email=test@devai.local', 'commit', '-q', '-m', 'feat(notes): generate the notes module\n\nPacket: PKT-DEMO-002');
    const g = generatedNode(dir);
    // the base-present SQL leaves `expected` (D-043); seven generated entries and three STYNX pairs
    expect(g.node).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing', expected: 10, observed: 7, evaluated: 7 });
    expect(pairsOnly(g.node.findings)).toBe(true);
    expect(g.status).toBe(2);
  });

  it('json output is A.2’s shape; a second run without --regenerate is exit 2 output-exists', () => {
    const dir = workspace();
    const r = generate(dir, '--format', 'json');
    expect(r.status).toBe(0);
    const doc = JSON.parse(r.stdout) as Record<string, unknown> & { files: { path: string; mode: string; sha256: string; action: string }[] };
    expect(Object.keys(doc)).toEqual(['specId', 'specSha256', 'machineBlockSha256', 'out', 'files', 'accepted', 'exitCode']);
    expect(doc).toMatchObject({ specId: 'SPEC-DEMO-001', out: 'domain/notes', accepted: false, exitCode: 0 });
    expect(doc.files.every((f) => f.action === 'written')).toBe(true);
    expect(doc.files.find((f) => f.path === 'api/src/notes.service.ts')).toMatchObject({ mode: 'seed', sha256: sha256(readFileSync(resolve(dir, SERVICE))) });
    const again = generate(dir, '--format', 'json');
    expect([again.status, (JSON.parse(again.stdout) as { reason: string }).reason]).toEqual([2, 'output-exists']);
  });
});

describe('09 §4 negative cells', () => {
  const committed = () => {
    const dir = workspace();
    expect(generate(dir).status).toBe(0);
    commitAll(dir, 'feat(notes): generate\n\nPacket: PKT-DEMO-002');
    return dir;
  };

  it('N8: create-note.dto.ts max(80) → max(81) by hand: generated FAIL "differs from regeneration [S-45]"', () => {
    const dir = committed();
    write(dir, DTO, read(dir, DTO).replace('title: z.string().min(1).max(80)', 'title: z.string().min(1).max(81)'));
    const g = generatedNode(dir);
    expect(g.status).toBe(1);
    expect(g.node.status).toBe('FAIL');
    expect(g.node.findings[0]).toEqual({ locator: `${DTO}:1`, message: 'differs from regeneration', standard: 'S-45', hint: 'regenerate (devai new module --regenerate) or move the logic to a seed file' });
    const text = devai(dir, 'check', '--only', 'generated').stdout;
    expect(text).toContain(`${DTO}:1  differs from regeneration   [S-45]  regenerate (devai new module --regenerate) or move the logic to a seed file`);
  });

  it('N9: notes.service.ts edited, then --regenerate (same id): exit 0, "seed edited, left alone", generated files byte-identical', () => {
    const dir = committed();
    const edited = read(dir, SERVICE).replace("throw new NotImplementedException('SPEC-DEMO-001 R-1: implement in a code packet');", 'return Promise.reject(new Error("x"));');
    write(dir, SERVICE, edited);
    const r = generate(dir, '--regenerate');
    expect([r.status, r.stderr]).toEqual([0, '']);
    expect(r.stdout).toContain(`seed ${SERVICE}: seed edited, left alone`);
    expect(r.stdout).toContain('seed domain/notes/api/src/notes.controller.ts: seed unchanged, safe to overwrite');
    expect(r.stdout).toContain(`generated ${SQL}: base-present, never rewritten (LINT013)`);
    expect(r.stdout).not.toContain('appended');
    expect(read(dir, SERVICE)).toBe(edited);
    // only the edited seed differs from HEAD: every generated file and the manifest rewrote byte-identical
    expect(gitIn(dir, 'status', '--porcelain')).toBe(` M ${SERVICE}\n`);
    const g = generatedNode(dir);
    expect(g.node.status).toBe('UNKNOWN');
    expect(pairsOnly(g.node.findings)).toBe(true);
  });

  it('N10: spec status: draft → new module exit 2 spec-not-approved', () => {
    const dir = workspace();
    write(dir, SPEC, read(dir, SPEC).replace('status: approved', 'status: draft'));
    const r = generate(dir, '--format', 'json');
    expect(r.status).toBe(2);
    expect(JSON.parse(r.stdout)).toEqual({ accepted: false, exitCode: 2, reason: 'spec-not-approved', message: 'spec SPEC-DEMO-001 status draft: the pilot approves it; note it under ## Notes and stop' });
    expect(gitIn(dir, 'status', '--porcelain')).toBe(` M ${SPEC}\n`);
  });

  it('N11: a successor spec adds a column, --regenerate: exit 0; TS regenerated; base-present SQL untouched; migration line printed', () => {
    const dir = committed();
    const old = read(dir, SPEC);
    const successor = old
      .replace('# SPEC-DEMO-001 — Tenant notes', '# SPEC-DEMO-002 — Tenant notes with a body')
      .replace('id: SPEC-DEMO-001\n', `id: SPEC-DEMO-002\n`)
      .replace('product: demo\n', `supersedes: {id: SPEC-DEMO-001, path: ${SPEC}, sha256: ${sha256(old)}}\nproduct: demo\n`)
      .replace('        - {name: title, type: varchar, limits: {minLength: 1, maxLength: 80}, nullable: false}\n',
        '        - {name: title, type: varchar, limits: {minLength: 1, maxLength: 80}, nullable: false}\n        - {name: body, type: varchar, limits: {minLength: 0, maxLength: 2000}, nullable: true}\n')
      .replaceAll('response: {status: 200, columns: [note.id, note.title, note.author_alias]}', 'response: {status: 200, columns: [note.id, note.title, note.author_alias, note.body]}');
    write(dir, 'specs/notes/SPEC-DEMO-002.md', successor);
    write(dir, SPEC, old.replace('status: approved', 'status: "superseded-by: SPEC-DEMO-002"'));
    commitAll(dir, 'docs(specs): SPEC-DEMO-002 supersedes SPEC-DEMO-001');
    const sqlBefore = read(dir, SQL);
    const r = devai(dir, 'new', 'module', '--spec', 'specs/notes/SPEC-DEMO-002.md', '--regenerate');
    expect([r.status, r.stderr]).toEqual([0, '']);
    expect(r.stdout).toContain('write domain/notes/db/demo_notes_notes_<nn>_<topic>.sql by hand and append it to database/seed/modules.txt');
    expect(read(dir, SQL)).toBe(sqlBefore);
    expect(read(dir, 'domain/notes/api/src/dto/get-note.dto.ts')).toContain('body: z.string().min(0).max(2000).nullable()');
    expect(read(dir, 'domain/notes/README.md')).toContain('# Notes — SPEC-DEMO-002');
    const m = JSON.parse(read(dir, MANIFEST)) as { specId: string; specSha256: string; files: { path: string; sha256: string }[] };
    expect(m.specId).toBe('SPEC-DEMO-002');
    expect(m.specSha256).toBe(sha256(successor));
    expect(m.files.find((f) => f.path === 'db/demo_notes_notes.sql')!.sha256).toBe(sha256(sqlBefore));
    // the replay renders the successor's recorded bytes; the base-present SQL stays LINT013's
    const g = generatedNode(dir);
    expect(g.node.status).toBe('UNKNOWN');
    expect(pairsOnly(g.node.findings)).toBe(true);
  });
});

describe('--regenerate refusals and D-074', () => {
  it('a spec that is neither the manifest’s nor its successor: exit 2 spec-mismatch', () => {
    const dir = workspace();
    expect(generate(dir).status).toBe(0);
    const other = read(dir, SPEC).replace('id: SPEC-DEMO-001\n', 'id: SPEC-DEMO-009\n');
    write(dir, 'specs/notes/SPEC-DEMO-009.md', other);
    const r = devai(dir, 'new', 'module', '--spec', 'specs/notes/SPEC-DEMO-009.md', '--regenerate', '--format', 'json');
    expect(r.status).toBe(2);
    expect(JSON.parse(r.stdout)).toMatchObject({ reason: 'spec-mismatch' });
  });

  it('invalid spec: exit 2 spec-invalid with the SL locator; open questions: spec-not-approved', () => {
    const dir = workspace();
    write(dir, SPEC, read(dir, SPEC).replace('namespace: demo_notes', 'namespace: demo'));
    expect(JSON.parse(generate(dir, '--format', 'json').stdout)).toMatchObject({ reason: 'spec-invalid', message: 'specs/notes/SPEC-DEMO-001.md:19 SL01 invalid contract at /module/namespace: reserved schema' });
    write(dir, SPEC, read(dir, SPEC).replace('namespace: demo', 'namespace: demo_notes').replace('## Open questions\n\nNone.', '## Open questions\n\n- Who reads the notes?'));
    expect(JSON.parse(generate(dir, '--format', 'json').stdout)).toMatchObject({ reason: 'spec-not-approved' });
  });

  it('an older generatorVersion: generated UNKNOWN generator-version-mismatch; same-id --regenerate rewrites it; a stale pin FAILs', () => {
    const dir = workspace();
    expect(generate(dir).status).toBe(0);
    write(dir, MANIFEST, read(dir, MANIFEST).replace(`"generatorVersion": "${cliVersion()}"`, '"generatorVersion": "2.9.0"'));
    write(dir, 'domain/notes/api/package.json', read(dir, 'domain/notes/api/package.json').replace(`"@devai-nyx/decorators": "${cliVersion()}"`, '"@devai-nyx/decorators": "2.9.0"'));
    commitAll(dir, 'feat(notes): generate');
    let g = generatedNode(dir);
    expect(g.node.findings.find((f) => f.message.startsWith('installed generator'))).toEqual({ locator: `${MANIFEST}:1`, message: `installed generator ${cliVersion()} ≠ generatorVersion 2.9.0`, standard: 'S-45', hint: 'pnpm add -D @devai-nyx/cli@2.9.0' });
    expect(g.node.status).toBe('UNKNOWN');
    expect(generate(dir, '--regenerate').status).toBe(0);
    expect((JSON.parse(read(dir, MANIFEST)) as { generatorVersion: string }).generatorVersion).toBe(cliVersion());
    // the seed pin is the agent's hand edit (D-074): until then generated FAILs
    g = generatedNode(dir);
    expect(g.node.status).toBe('FAIL');
    expect(g.node.findings[0]).toMatchObject({ locator: 'domain/notes/api/package.json:1', message: `pins @devai-nyx/decorators 2.9.0 ≠ generatorVersion ${cliVersion()}` });
  });

  it('module SQL not yet at HEAD is rewritten by --regenerate (not base-present); a headed file outside every manifest FAILs', () => {
    const dir = workspace();
    expect(generate(dir).status).toBe(0);
    write(dir, SQL, read(dir, SQL) + '-- hand edit\n');
    const r = generate(dir, '--regenerate');
    expect(r.stdout).toContain(`generated ${SQL}\n`);
    expect(read(dir, SQL)).not.toContain('-- hand edit');
    write(dir, 'apps/api/src/stray.ts', '// @generated from SPEC-DEMO-001 do not edit\nexport {};\n');
    commitAll(dir, 'feat(notes): generate');
    const g = generatedNode(dir);
    expect(g.node.status).toBe('FAIL');
    expect(g.node.findings[0]).toMatchObject({ locator: 'apps/api/src/stray.ts:1', message: '@generated file outside every generation-manifest.json' });
  });

  it('recorded spec bytes not found: generated UNKNOWN generator-unavailable', () => {
    const dir = workspace();
    expect(generate(dir).status).toBe(0);
    write(dir, MANIFEST, read(dir, MANIFEST).replace(/"specSha256": "[0-9a-f]{64}"/, `"specSha256": "${'0'.repeat(64)}"`));
    commitAll(dir, 'feat(notes): generate');
    const g = generatedNode(dir);
    expect(g.node).toMatchObject({ status: 'UNKNOWN', reason: 'generator-unavailable' });
    expect(g.node.findings[0]).toEqual({ locator: `${MANIFEST}:1`, message: 'recorded spec bytes not found', standard: 'S-45', hint: 'regenerate in a generate packet' });
  });
});
