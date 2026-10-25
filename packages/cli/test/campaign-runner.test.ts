// The 09 §4 cell runner's pure parts (scripts/campaign.ts): D-098's O-cell numbering, the row comparison
// every step asserts with, and the application of `new module`'s printed mount lines (09 §2, §6).
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyMount, compare, label, NEGATIVES, optionCell, STEP4 } from '../scripts/campaign.ts';

describe('09 §4 cell runner', () => {
  it('numbers the option cells as D-098 does: O1 none · O2 --lgpd · O3 pt-BR · O4 both, O5–O8 with --web, O9–O16 docker', () => {
    expect(['O1', 'O2', 'O3', 'O4', 'O5', 'O8'].map((id) => label(optionCell(id)!))).toEqual(['—', '--lgpd', 'pt-BR', '--lgpd pt-BR', '--web', '--web --lgpd pt-BR']);
    expect(optionCell('O2')!.runtime).toBe('bare');
    expect(optionCell('O10')).toMatchObject({ runtime: 'docker', lgpd: true, ptBR: false, web: false });
    expect(optionCell('O16')).toMatchObject({ runtime: 'docker', lgpd: true, ptBR: true, web: true });
    expect(optionCell('O17')).toBeNull();
  });

  it('expresses every negative cell of 09 §4, N1–N20 with N4a–c and N7a–b', () => {
    expect(NEGATIVES.map((n) => n.id)).toEqual(['N1', 'N2', 'N3', 'N4a', 'N4b', 'N4c', 'N5', 'N6', 'N7a', 'N7b', 'N8', 'N9', 'N10', 'N11', 'N12', 'N13', 'N14', 'N15', 'N16', 'N17', 'N18', 'N19', 'N20']);
    expect(NEGATIVES.find((n) => n.id === 'N19')!.skip!()).toMatch(/D-082/);
  });

  it('compares exit, named rows, the others row and finding fragments', () => {
    const node = (id: string, status: string, reason?: string, message = '') => ({ id, status, ...(reason ? { reason } : {}), findings: message ? [{ locator: 'a.ts:1', message, standard: 'S-1' }] : [] });
    const report = { exitCode: 1, nodes: [node('db-apply', 'FAIL', undefined, 'scandir packages/data/migrations/platform'), node('unit', 'PASS'), node('generated', 'UNKNOWN', 'tooling-missing')] };
    expect(compare(report, { exit: 1, nodes: { 'db-apply': 'FAIL', generated: 'UNKNOWN tooling-missing' }, others: 'PASS', findings: [['db-apply', 'migrations/platform']] })).toEqual([]);
    expect(compare(report, { exit: 0, nodes: { unit: 'FAIL' }, findings: [['unit', 'x']] })).toEqual(['exit 1, expected 0', 'unit: PASS, expected FAIL', 'unit: no finding contains "x"']);
    expect(compare(report, STEP4)).toContain('accept: absent, expected FAIL');
  });

  it("applies the printed mount lines to the API shell, the tsconfig references and .stynxrc.json", () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'devai-r8-mount-'));
    mkdirSync(resolve(dir, 'apps/api/src'), { recursive: true });
    writeFileSync(resolve(dir, 'apps/api/package.json'), JSON.stringify({ name: '@demo/api', dependencies: { zod: '4.4.3' } }));
    writeFileSync(resolve(dir, 'apps/api/tsconfig.json'), JSON.stringify({ compilerOptions: {} }));
    writeFileSync(resolve(dir, 'apps/api/src/app.module.ts'), "import { Module } from '@nestjs/common';\nimport { z } from 'zod';\n\n@Module({\n  imports: [\n    A.forRoot(),\n  ],\n  providers: [],\n})\nexport class AppModule {}\n");
    writeFileSync(resolve(dir, '.stynxrc.json'), JSON.stringify({ apiCoverage: { sourceRoots: ['apps/api/src'] }, publicApi: { packageRoots: [] } }));
    const touched = applyMount(dir, [
      'mount: add "@demo/notes-api": "workspace:*" to apps/api/package.json and DemoNotesModule to apps/api/src/app.module.ts imports, then pnpm install',
      'mount: add { "path": "../../domain/notes/api" } to apps/api/tsconfig.json references',
      'mount: add "domain/notes/api/src" to .stynxrc.json apiCoverage.sourceRoots',
      'mount: add "domain/notes" to .stynxrc.json publicApi.packageRoots',
      'mount: then pnpm -r build',
    ]);
    expect(touched.sort()).toEqual(['.stynxrc.json', 'apps/api/package.json', 'apps/api/src/app.module.ts', 'apps/api/tsconfig.json']);
    expect(readFileSync(resolve(dir, 'apps/api/src/app.module.ts'), 'utf8')).toContain("import { z } from 'zod';\nimport { DemoNotesModule } from '@demo/notes-api';");
    expect(readFileSync(resolve(dir, 'apps/api/src/app.module.ts'), 'utf8')).toContain('    A.forRoot(),\n    DemoNotesModule,\n  ],');
    expect(JSON.parse(readFileSync(resolve(dir, 'apps/api/package.json'), 'utf8')).dependencies).toEqual({ '@demo/notes-api': 'workspace:*', zod: '4.4.3' });
    expect(JSON.parse(readFileSync(resolve(dir, '.stynxrc.json'), 'utf8'))).toEqual({ apiCoverage: { sourceRoots: ['apps/api/src', 'domain/notes/api/src'] }, publicApi: { packageRoots: ['domain/notes'] } });
    expect(applyMount(dir, ['mount: something else'])).toEqual(['unrecognised mount line: mount: something else']);
  });
});
