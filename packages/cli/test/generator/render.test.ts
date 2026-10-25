// 09 §2 render(): the 09 §6 worked example (fixture bytes from 09 §6, not from the renderer), the
// 09 §2.1 mapping across options, determinism and the shapes of the emitted TypeScript.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { entriesOf, manifestOf, manifestText } from '../../src/generator/manifest.js';
import { render, renderBlock, type RenderOptions } from '../../src/generator/render.js';
import { cliVersion } from '../../src/main.js';
import { MachineBlock } from '../../src/spec/machine-block.js';
import { parseSpec } from '../../src/spec/parse-spec.js';
import { FIXTURE, firstMissing, lawBlock, normalise, rows } from './s6.js';

const template = resolve(import.meta.dirname, '../../template');
const specBytes = readFileSync(resolve(template, 'specs/notes/SPEC-DEMO-001.md'));
/** 09 §6 configuration: 06 §7's (`productPrefix: demo`, `lgpd: true`, `locales: [en-US]`), no `--web`. */
const S6: RenderOptions = { web: false, locales: ['en-US'], lgpd: true, productPrefix: 'demo' };
const version = cliVersion();
const text = (r: ReturnType<typeof render>, p: string) => r.get(p)!.bytes.toString('utf8');
const valid = () => { const p = parseSpec(specBytes.toString('utf8')); if (p.kind !== 'valid') throw new Error(p.kind); return p; };

describe('09 §6 worked example', () => {
  const rendered = render(specBytes, S6, version);
  const subst = { header: '// @generated from SPEC-DEMO-001 do not edit', version };
  const module = rows().filter((r) => r.path.startsWith('domain/notes/'));

  it('the fixture is the bytes of the 09 §6 block', () => {
    expect(readFileSync(FIXTURE, 'utf8')).toBe(lawBlock());
  });

  it('the file set and every mode are §6’s', () => {
    const files = module.filter((r) => r.path !== 'domain/notes/generation-manifest.json');
    expect([...rendered.keys()]).toEqual(files.map((r) => r.path.slice('domain/notes/'.length)).sort());
    for (const r of files) expect([r.path, rendered.get(r.path.slice('domain/notes/'.length))!.mode]).toEqual([r.path, r.mode]);
    expect(module.find((r) => r.path === 'domain/notes/generation-manifest.json')!.mode).toBe('—');
  });

  it('every file carries §6’s text, in §6’s order', () => {
    const p = valid();
    const manifest = manifestText(manifestOf({ id: 'SPEC-DEMO-001', sha256: '0'.repeat(64), machineBlockSha256: p.machineBlockSha256 }, S6, version, entriesOf(rendered)));
    for (const r of module) {
      const path = r.path.slice('domain/notes/'.length);
      const body = path === 'generation-manifest.json' ? manifest : text(rendered, path);
      expect([r.path, firstMissing(body, r.synopsis, subst)]).toEqual([r.path, null]);
    }
  });

  it('rows §6 gives whole are byte-identical: api/tsconfig.json, api/src/index.ts, acceptance/.gitkeep', () => {
    const whole = (path: string) => rows().find((r) => r.path === `domain/notes/${path}`)!.synopsis.map((l) => (l.trim() === 'G' ? subst.header : l)).join('\n');
    expect(normalise(text(rendered, 'api/tsconfig.json'))).toBe(normalise(whole('api/tsconfig.json')));
    expect(text(rendered, 'api/src/index.ts')).toBe(whole('api/src/index.ts').split('  ').join('\n') + '\n');
    expect(rows().find((r) => r.path.endsWith('.gitkeep'))!.synopsis).toEqual(['(empty)']);
    expect(rendered.get('api/test/acceptance/.gitkeep')!.bytes.length).toBe(0);
  });

  it('headers: `//` in TS and JSONC, `--` in SQL, `<!-- -->` in Markdown; seeds carry none (02 §7, P-5-03)', () => {
    for (const [path, f] of rendered) {
      const first = f.bytes.toString('utf8').split('\n')[0]!;
      const want = path.endsWith('.sql') ? '-- @generated from SPEC-DEMO-001 do not edit' : path.endsWith('.md') ? '<!-- @generated from SPEC-DEMO-001 do not edit -->' : subst.header;
      if (f.mode === 'generated') expect([path, first]).toEqual([path, want]);
      else expect([path, first.includes('@generated')]).toEqual([path, false]);
    }
  });
});

describe('09 §2 render', () => {
  it('is deterministic: identical inputs give identical bytes (INV-CLI-002)', () => {
    const a = render(specBytes, S6, version);
    const b = render(Buffer.from(specBytes), { ...S6 }, version);
    expect([...a].map(([p, f]) => [p, f.mode, f.bytes.toString('hex')])).toEqual([...b].map(([p, f]) => [p, f.mode, f.bytes.toString('hex')]));
  });

  it('every emitted TypeScript file is syntactically valid', () => {
    const all = render(specBytes, { ...S6, web: true, locales: ['en-US', 'pt-BR'] }, version);
    for (const [path, f] of all) {
      if (!path.endsWith('.ts')) continue;
      const out = ts.transpileModule(f.bytes.toString('utf8'), { reportDiagnostics: true, fileName: path, compilerOptions: { experimentalDecorators: true, target: ts.ScriptTarget.ES2022 } });
      expect([path, (out.diagnostics ?? []).map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))]).toEqual([path, []]);
    }
  });

  it('pt-BR: one catalog per configured locale, keys sorted, exported from the barrel', () => {
    const r = render(specBytes, { ...S6, locales: ['en-US', 'pt-BR'] }, version);
    expect(text(r, 'api/src/notes.i18n.pt-br.ts')).toBe([
      '// @generated from SPEC-DEMO-001 do not edit',
      'export const demoNotesPtBr = {',
      "  'demo.notes.forbidden': 'Você não pode acessar estas notas.',",
      "  'demo.notes.invalid': 'Pedido de nota inválido.',",
      "  'demo.notes.missing': 'Nota não encontrada.',",
      "  'demo.notes.unauthenticated': 'Entre para usar as notas.',",
      "  'demo.notes.unavailable': 'As notas estão temporariamente indisponíveis.',",
      '} as const;',
      '',
    ].join('\n'));
    expect(text(r, 'api/src/index.ts')).toContain("export { demoNotesPtBr } from './notes.i18n.pt-br.js';");
  });

  it('lgpd off: no `-- @pii` line (LINT012 applies only under lgpd)', () => {
    expect(text(render(specBytes, { ...S6, lgpd: false }, version), 'db/demo_notes_notes.sql')).not.toContain('@pii');
    expect(text(render(specBytes, S6, version), 'db/demo_notes_notes.sql')).toMatch(/-- @pii: basis=RN-DEMO-002\/demo-consent, retention=RN-DEMO-002\/until-workspace-destruction\n {2}"author_alias"/);
  });

  it('--web: the 09 §2.1 web row (detail component for the parameterised GET; no list without a collection GET)', () => {
    const r = render(specBytes, { ...S6, web: true }, version);
    const web = [...r].filter(([p]) => p.startsWith('web/')).map(([p, f]) => `${f.mode} ${p}`);
    expect(web).toEqual([
      'seed web/package.json', 'generated web/src/index.ts', 'seed web/src/note-detail.component.ts', 'seed web/src/note.service.ts',
      'generated web/src/notes.routes.ts', 'seed web/test/note.service.spec.ts', 'generated web/tsconfig.json',
    ]);
    const detail = text(r, 'web/src/note-detail.component.ts');
    expect(detail).toContain("selector: 'demo-note-detail'");
    expect(detail).toContain('changeDetection: ChangeDetectionStrategy.OnPush');
    expect(detail).toContain('readonly id = input.required<string>();');
    expect(text(r, 'web/src/notes.routes.ts')).toContain("export const demoNotesRoutes: Routes = [{ path: 'notes/:id', component: DemoNoteDetailComponent }];");
  });

  it('api/package.json pins @devai-nyx/decorators at the generator version (09 §2, D-074)', () => {
    const pkg = JSON.parse(text(render(specBytes, S6, '9.8.7'), 'api/package.json')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@devai-nyx/decorators']).toBe('9.8.7');
  });

  it('lowering: key idempotency, integer/boolean/timestamptz leaves, nullable and optional inputs, CHECKs', () => {
    const b = structuredClone(valid().block) as MachineBlock;
    b.data.tables[0]!.columns.push(
      { name: 'rank', type: 'integer', limits: { minimum: 0, maximum: 9 }, nullable: true },
      { name: 'pinned', type: 'boolean', limits: { values: [false, true] }, nullable: false },
      { name: 'due_at', type: 'timestamptz', limits: { minimum: '2026-01-01T00:00:00Z', maximum: '2027-01-01T00:00:00Z' }, nullable: false, default: 'transaction-time' },
    );
    const post = b.routes[0]!;
    post.idempotency = { mode: 'key', header: 'Idempotency-Key', ttlMs: 86400000 };
    post.request.body['rank'] = { column: 'note.rank', required: false };
    post.request.body['pinned'] = { column: 'note.pinned', required: true };
    post.request.body['due_at'] = { column: 'note.due_at', required: true };
    const r = renderBlock(MachineBlock.parse(b), S6, version);
    const dto = text(r, 'api/src/dto/create-note.dto.ts');
    expect(dto).toContain('  rank: z.number().int().min(0).max(9).nullable().optional(),');
    expect(dto).toContain('  pinned: z.boolean(),');
    expect(dto).toContain(`  due_at: z.string().datetime().refine((v) => Date.parse(v) >= ${Date.parse('2026-01-01T00:00:00Z')} && Date.parse(v) <= ${Date.parse('2027-01-01T00:00:00Z')}),`);
    const controller = text(r, 'api/src/notes.controller.ts');
    expect(controller).toContain("  @Idempotent({ headerName: 'Idempotency-Key', ttlMs: 86400000 })");
    expect(controller).toContain("import { Idempotent, NoIdempotent } from '@stynx-nyx/idempotency';");
    const sql = text(r, 'db/demo_notes_notes.sql');
    expect(sql).toContain('  "rank" INTEGER CHECK ("rank" BETWEEN 0 AND 9),');
    expect(sql).toContain('  "pinned" BOOLEAN NOT NULL,');
    expect(sql).toContain(`  "due_at" TIMESTAMPTZ NOT NULL DEFAULT now() CHECK ("due_at" BETWEEN '2026-01-01T00:00:00Z' AND '2027-01-01T00:00:00Z'),`);
  });
});
