// 08 B.13 `i18n`: catalog parity over the generator's `<slug>.i18n.<locale>.ts` files (09 §2) and the
// overlay's `@angular-eslint/template/i18n` over Angular templates (ESLint 10.10.0, angular-eslint 22.0.0).
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { i18n } from '../../src/nodes/i18n.js';
import { Report } from '../../src/report.js';
import { templateConfig } from '../fixtures.js';
import { contextOf, devaiCheck, fakeTool, toolModules, workspace } from './helpers.js';

const ptBR = { ...templateConfig(), locales: ['en-US', 'pt-BR'] };
const DEVAI_PT = { 'devai.json': JSON.stringify(ptBR, null, 2) + '\n' };
const catalog = (name: string, entries: Record<string, string>) =>
  `// @generated from SPEC-DEMO-001 do not edit\nexport const ${name} = {\n${Object.entries(entries).map(([k, v]) => `  '${k}': '${v}',`).join('\n')}\n} as const;\n`;
const EN = 'domain/notes/api/src/notes.i18n.en-us.ts';
const PT = 'domain/notes/api/src/notes.i18n.pt-br.ts';
const CATALOGS = {
  [EN]: catalog('demoNotesEnUs', { 'demo.notes.invalid': 'Invalid note request.', 'demo.notes.missing': 'Note not found.' }),
  [PT]: catalog('demoNotesPtBr', { 'demo.notes.invalid': 'Pedido de nota inválido.', 'demo.notes.missing': 'Nota não encontrada.' }),
};
const overlay = pathToFileURL(resolve(import.meta.dirname, '../../dist/nodes/lint-overlay/index.js')).href;
const ANGULAR = `import { createAngularConfig } from '@stynx-nyx/eslint-config';
import { createDevaiOverlay } from '${overlay}';
export default [
  ...createAngularConfig({ rootDir: import.meta.dirname, files: ['domain/*/web/src/**/*.ts'] }),
  ...createDevaiOverlay({ productPrefix: 'demo', files: ['domain/*/web/src/**/*.ts'] }),
];
`;
const WEB = { 'eslint.config.mjs': ANGULAR, 'domain/notes/web/package.json': JSON.stringify({ name: '@demo/notes-web', private: true, type: 'module', dependencies: { '@angular/core': '22.2.1' } }) + '\n' };
const run = async (dir: string) => i18n.run(await contextOf(dir, 'i18n', null, ptBR));

describe('B.13 i18n', () => {
  beforeAll(() => void toolModules(), 300_000);

  it('PASS: every (key, locale) pair present; catalogs alone need no tool', async () => {
    expect(await run(workspace(CATALOGS, {}, null))).toEqual({ status: 'PASS', expected: 4, observed: 4, evaluated: 4, findings: [] });
  });

  it('FAIL: "<catalog pt-BR>:1 missing key <k> [S-16] add the pt-BR text", and a spec key absent from the en-US catalog', async () => {
    const pt = catalog('demoNotesPtBr', { 'demo.notes.invalid': 'Pedido de nota inválido.' });
    expect(await run(workspace({ ...CATALOGS, [PT]: pt }, {}, null))).toEqual({
      status: 'FAIL', expected: 4, observed: 4, evaluated: 4,
      findings: [{ locator: `${PT}:1`, message: 'missing key demo.notes.missing', standard: 'S-16', hint: 'add the pt-BR text' }],
    });
    const spec = '# SPEC-DEMO-001\n\n```yaml\nid: SPEC-DEMO-001\ni18n:\n  demo.notes.invalid: {en-US: a, pt-BR: b}\n  demo.notes.missing: {en-US: a, pt-BR: b}\n  demo.notes.forbidden: {en-US: a, pt-BR: b}\n```\n';
    const withSpec = { ...CATALOGS, 'domain/notes/generation-manifest.json': JSON.stringify({ specId: 'SPEC-DEMO-001' }), 'specs/notes/SPEC-DEMO-001.md': spec };
    expect((await run(workspace(withSpec, {}, null))).findings).toEqual([
      { locator: `${EN}:1`, message: 'missing key demo.notes.forbidden', standard: 'S-16', hint: 'add the en-US text' },
      { locator: `${PT}:1`, message: 'missing key demo.notes.forbidden', standard: 'S-16', hint: 'add the pt-BR text' },
    ]);
  });

  it('FAIL: "<template>:<line>:<col> template/i18n: <message> [S-16] mark the text i18n"; a marked template passes', async () => {
    const dir = workspace({ ...CATALOGS, ...WEB }, { 'domain/notes/web/src/notes.component.html': '<p>Hello</p>\n', 'domain/notes/web/src/ok.component.html': '<p i18n="@@demo.notes.hello">Hello</p>\n' });
    const o = await run(dir);
    expect(o).toMatchObject({ status: 'FAIL', expected: 6, observed: 6, evaluated: 6 });
    expect(o.findings).toEqual([{ locator: 'domain/notes/web/src/notes.component.html:1:4', message: expect.stringMatching(/^template\/i18n: /), standard: 'S-16', hint: 'mark the text i18n' }]);
  });

  it('UNKNOWN catalog-unresolved (not statically readable; en-US absent) and io (catalog unreadable)', async () => {
    const spread = `export const base = {};\nexport const demoNotesPtBr = { ...base } as const;\n`;
    expect(await run(workspace({ ...CATALOGS, [PT]: spread }, {}, null))).toMatchObject({
      status: 'UNKNOWN', reason: 'catalog-unresolved', findings: [{ locator: `${PT}:2`, message: 'catalog not statically readable: a property without a literal key', standard: 'S-16', hint: 'regenerate the module in a generate packet' }],
    });
    expect(await run(workspace({ [PT]: CATALOGS[PT] }, {}, null))).toMatchObject({ status: 'UNKNOWN', reason: 'catalog-unresolved', findings: [{ locator: `${EN}:1`, message: 'en-US catalog is absent' }] });
    const dir = workspace(CATALOGS, {}, null);
    const ctx = await contextOf(dir, 'i18n', null, ptBR);
    rmSync(resolve(dir, PT));
    expect(await i18n.run(ctx)).toMatchObject({ status: 'UNKNOWN', reason: 'io', findings: [{ locator: `${PT}:1`, message: 'catalog is not readable', standard: 'S-16' }] });
  });

  it('UNKNOWN for the template half: tooling-missing, lint-config-failed, runner-crashed', async () => {
    const tpl = { 'domain/notes/web/src/a.component.html': '<p i18n="@@demo.a">A</p>\n' };
    expect(await run(workspace({ ...CATALOGS, ...WEB }, tpl, null))).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing', findings: [{ message: 'eslint not resolvable from node_modules/.bin' }] });
    const noConfig = { ...WEB } as Record<string, string>;
    delete noConfig['eslint.config.mjs'];
    expect(await run(workspace({ ...CATALOGS, ...noConfig }, tpl))).toMatchObject({ status: 'UNKNOWN', reason: 'lint-config-failed', findings: [{ locator: 'eslint.config.mjs:1' }] });
    expect(await run(workspace({ ...CATALOGS, ...WEB }, tpl, fakeTool('eslint')))).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed', findings: [{ locator: 'eslint.config.mjs:1', message: 'boom: the tool fell over', standard: 'S-16' }] });
  });

  it('SKIPPED with the 05 §3 evidence string, and a C.2-valid report on the template workspace', () => {
    const skipped = Report.parse(JSON.parse(devaiCheck(workspace({}, {}, toolModules(), true), 'i18n').stdout));
    expect(skipped.nodes.find((n) => n.id === 'i18n')).toMatchObject({ status: 'SKIPPED', evidence: 'no opted-in locale beyond en-US and no Angular app' });
    const r = devaiCheck(workspace({ ...DEVAI_PT, ...CATALOGS }, {}, toolModules(), true), 'i18n');
    const report = Report.parse(JSON.parse(r.stdout));
    expect(report.nodes.map((n) => [n.id, n.status])).toEqual([['inventory', 'PASS'], ['i18n', 'PASS'], ['accept', 'PASS']]);
    expect(r.status).toBe(0);
  });
});
