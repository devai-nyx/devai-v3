// 08 B.3 `lint` against ESLint 10.10.0 + `@stynx-nyx/eslint-config` 3.0.0 + the v3 overlay (built
// dist, loaded by the fixture's eslint.config.mjs as a product would): Status sentences and finding forms.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { lint } from '../../src/nodes/lint.js';
import { Report } from '../../src/report.js';
import { contextOf, devaiCheck, fakeTool, toolModules, workspace } from './tools.js';

const overlay = pathToFileURL(resolve(import.meta.dirname, '../../dist/nodes/lint-overlay/index.js')).href;
export const ESLINT_CONFIG = `import { createNestConfig } from '@stynx-nyx/eslint-config';
import { createDevaiOverlay } from '${overlay}';
export default [
  ...createNestConfig({ rootDir: import.meta.dirname, files: ['src/**/*.ts'] }),
  ...createDevaiOverlay({ productPrefix: 'demo', files: ['src/**/*.ts'] }),
];
`;
export const TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: 'es2022', module: 'nodenext', moduleResolution: 'nodenext', strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true,
    isolatedModules: true, forceConsistentCasingInFileNames: true, noEmit: true, skipLibCheck: true, types: [],
  },
  include: ['src'],
}, null, 2) + '\n';
const BASE = { 'eslint.config.mjs': ESLINT_CONFIG, 'tsconfig.json': TSCONFIG, 'src/seed.ts': 'export const seed = 1;\n' };
const run = async (dir: string) => lint.run(await contextOf(dir, 'lint'));

const BAD = `declare function Injectable(): ClassDecorator;
declare class InjectionToken<T> { constructor(name: string); private t?: T }
declare function defineQuery(q: object): object;
class Transaction { query(text: string): number { return text.length; } }
type Tx = Transaction;
export enum Colour { Red = 'red' }
@Injectable()
export class NotesService {}
export const NOTES_TOKEN = new InjectionToken<string>('notes');
export const q = defineQuery({});
export function raw(tx: Tx): number { return tx.query('select 1'); }
const hidden = 1;
export { hidden as default };
declare function Component(o: { selector: string }): ClassDecorator;
@Component({ selector: 'notes-list' })
export class DemoNotesListComponent {}
`;

describe('B.3 lint', () => {
  beforeAll(() => void toolModules(), 300_000);

  it('PASS: a clean changed file', async () => {
    const dir = workspace(BASE, { 'src/ok.ts': 'export const value = 1;\n' });
    expect(await run(dir)).toEqual({ status: 'PASS', expected: 1, observed: 1, evaluated: 1, findings: [] });
  });

  it('FAIL: "<path>:<line>:<col> <ruleId>: <message> [S-nn] <hint>" for the five devai/* rules and STYNX\'s strict levels', async () => {
    const dir = workspace(BASE, { 'src/bad.ts': BAD, 'src/any.ts': 'export function f(x: any): unknown { return x; }\n' });
    const o = await run(dir);
    expect(o).toMatchObject({ status: 'FAIL', expected: 2, observed: 2, evaluated: 2 });
    expect(o.findings).toEqual(expect.arrayContaining([
      { locator: 'src/any.ts:1:22', message: '@typescript-eslint/no-explicit-any: Unexpected any. Specify a different type.', standard: 'S-33', hint: 'type the value or parse it with zod' },
      { locator: 'src/bad.ts:6:8', message: 'devai/no-enum: enum Colour is not allowed (S-36)', standard: 'S-36', hint: 'use a string-literal union or an as const object' },
      { locator: 'src/bad.ts:8:8', message: 'devai/product-prefix: class NotesService lacks the Demo prefix (D-032)', standard: 'S-36', hint: 'prefix it with devai.json productPrefix (D-032)' },
      { locator: 'src/bad.ts:9:14', message: 'devai/product-prefix: DI token NOTES_TOKEN lacks the DEMO_ prefix (D-032)', standard: 'S-36', hint: 'prefix it with devai.json productPrefix (D-032)' },
      { locator: 'src/bad.ts:10:18', message: 'devai/define-query-location: defineQuery( outside a *.repository.ts file (02 §3)', standard: '02 §3', hint: 'move the defineQuery to a *.repository.ts file' },
      { locator: 'src/bad.ts:11:46', message: 'devai/no-raw-query: .query( on Transaction bypasses defineQuery (02 §3)', standard: '02 §3', hint: 'define the query with defineQuery and run it with tx.run' },
      { locator: 'src/bad.ts:15:24', message: 'devai/product-prefix: selector notes-list lacks the demo- prefix (D-032)', standard: 'S-36', hint: 'prefix it with devai.json productPrefix (D-032)' },
      { locator: 'src/bad.ts:13:10', message: 'devai/named-exports-only: default export is not allowed; export by name (S-38)', standard: 'S-38', hint: 'export by name' },
    ]));
  });

  it('devai/product-prefix leaves the mount census root alone: AppModule in apps/<app>/src/app.module.ts only (D-102 #66 Open 3, D-097)', async () => {
    const files = "['src/**/*.ts', 'apps/*/src/**/*.ts']";
    const config = ESLINT_CONFIG.split("files: ['src/**/*.ts']").join(`files: ${files}`);
    const tsconfig = TSCONFIG.replace('"include": [\n    "src"\n  ]', '"include": [\n    "src",\n    "apps"\n  ]');
    const mod = "declare function Module(o: object): ClassDecorator;\n@Module({})\nexport class AppModule {}\n";
    const dir = workspace({ 'eslint.config.mjs': config, 'tsconfig.json': tsconfig, 'src/seed.ts': 'export const seed = 1;\n' }, { 'apps/api/src/app.module.ts': mod, 'src/app.module.ts': mod });
    const o = await run(dir);
    expect(o.findings.map((f) => `${f.locator} ${f.message}`)).toEqual(['src/app.module.ts:3:8 devai/product-prefix: class AppModule lacks the Demo prefix (D-032)']);
  });

  it('FAIL: an expected file absent from the JSON (ignored by config) is a shortfall', async () => {
    const dir = workspace(BASE, { 'other.ts': 'export const o = 1;\n' });
    expect(await run(dir)).toEqual({
      status: 'FAIL', expected: 1, observed: 0, evaluated: 0,
      findings: [{ locator: 'other.ts:1', message: 'not linted: ignored by the ESLint config', standard: 'S-41', hint: 'remove it from the config ignores or add it to a profile\'s files' }],
    });
  });

  it('UNKNOWN lint-config-failed: config missing or not parseable (pre-flight), parser fatal at the file', async () => {
    const missing = workspace({ 'tsconfig.json': TSCONFIG }, { 'src/a.ts': 'export const a = 1;\n' });
    expect(await run(missing)).toMatchObject({ status: 'UNKNOWN', reason: 'lint-config-failed', findings: [{ locator: 'eslint.config.mjs:1', message: 'config file is missing or unreadable' }] });
    const broken = workspace({ ...BASE, 'eslint.config.mjs': 'export default [\n' }, { 'src/a.ts': 'export const a = 1;\n' });
    expect(await run(broken)).toMatchObject({ status: 'UNKNOWN', reason: 'lint-config-failed', findings: [{ locator: 'eslint.config.mjs:1', message: "config does not parse: ']' expected." }] });
    const fatal = workspace(BASE, { 'src/broken.ts': 'const = ;\n' });
    expect(await run(fatal)).toEqual({
      status: 'UNKNOWN', reason: 'lint-config-failed', expected: 1, observed: 1, evaluated: 0,
      findings: [{ locator: 'src/broken.ts:1:6', message: 'Parsing error: Variable declaration expected.', standard: 'S-41', hint: 'the config at the locator did not load; fix it in a standards packet' }],
    });
  });

  it('UNKNOWN tooling-missing and runner-crashed (a config that throws at load: ESLint exits 2 with no JSON)', async () => {
    expect(await run(workspace(BASE, { 'src/a.ts': 'export const a = 1;\n' }, null))).toMatchObject({
      status: 'UNKNOWN', reason: 'tooling-missing', findings: [{ locator: 'package.json:1', message: 'eslint not resolvable from node_modules/.bin', standard: 'S-19', hint: 'install with pnpm add -w -D --save-exact eslint@10.10.0 @stynx-nyx/eslint-config@3.0.0 && pnpm install' }],
    });
    expect(await run(workspace(BASE, { 'src/a.ts': 'export const a = 1;\n' }, fakeTool('eslint')))).toMatchObject({
      status: 'UNKNOWN', reason: 'runner-crashed', findings: [{ locator: 'eslint.config.mjs:1', message: 'boom: the tool fell over', standard: 'S-41' }],
    });
    const throws = workspace({ ...BASE, 'eslint.config.mjs': "throw new Error('config boom');\n" }, { 'src/a.ts': 'export const a = 1;\n' });
    expect(await run(throws)).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed', findings: [{ locator: 'eslint.config.mjs:1', message: 'Oops! Something went wrong! :(' }] });
  });

  it('SKIPPED with the B.3 evidence string, and a C.2-valid report on the template workspace', () => {
    const skipped = Report.parse(JSON.parse(devaiCheck(workspace(BASE, {}, toolModules(), true), 'lint').stdout));
    expect(skipped.nodes.find((n) => n.id === 'lint')).toMatchObject({ status: 'SKIPPED', evidence: 'no changed *.ts, *.mts or *.html' });
    const dir = workspace(BASE, { 'src/ok.ts': 'export const value = 1;\n' }, toolModules(), true);
    const r = devaiCheck(dir, 'lint');
    const report = Report.parse(JSON.parse(r.stdout));
    expect(report.nodes.map((n) => [n.id, n.status])).toEqual([['inventory', 'PASS'], ['lint', 'PASS'], ['accept', 'PASS']]);
    expect(r.status).toBe(0);
  });
});
