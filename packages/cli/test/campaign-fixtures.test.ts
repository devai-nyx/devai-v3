// 09 §4 campaign fixtures (D-098, R8): the reference acceptance file (with its bearer-token helper, D-107),
// the reference service and repository bodies and their unit spec (D-131), placed where campaign steps 5
// and 7 put them in a workspace holding the template (09 §1.1) and the 09 §6 module. They are Prettier-clean
// under the template's options, type-check against the rendered module and the API shell, lint clean under
// the template's ESLint config, and the unit spec passes. The tools come from the registry, as the node
// tests' do (helpers.ts).
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { check } from 'prettier';
import { beforeAll, describe, expect, it } from 'vitest';
import { prettyJson, renderConfig, templateEntries } from '../src/commands/init.js';
import { PRETTIER_OPTIONS, render } from '../src/generator/render.js';
import { cliVersion } from '../src/main.js';
import { toolsFor } from './nodes/helpers.js';

const CLI = resolve(import.meta.dirname, '..');
const FIXTURES = resolve(CLI, 'fixtures/campaign');
const DECORATORS = resolve(CLI, '../decorators');

/** Where 09 §4 steps 5 and 7 put each fixture. */
const PLACED: Record<string, string> = {
  'SPEC-DEMO-001.acceptance.spec.ts': 'domain/notes/api/test/acceptance/spec-demo-001.acceptance.spec.ts',
  'notes.service.ts': 'domain/notes/api/src/notes.service.ts',
  'notes.repository.ts': 'domain/notes/api/src/notes.repository.ts',
  // D-131: PKT-DEMO-004's unit test of the zero-row → 404 mapping, beside the seed controller spec.
  'notes.service.spec.ts': 'domain/notes/api/test/notes.service.spec.ts',
};

/** The template's pins (package.json, apps/api, the module manifest) for the packages the checks load. */
const PINS: Record<string, string> = {
  typescript: '6.0.3', eslint: '10.10.0', '@stynx-nyx/eslint-config': '3.0.0',
  '@angular-eslint/eslint-plugin': '22.0.0', '@angular-eslint/eslint-plugin-template': '22.0.0', '@angular-eslint/template-parser': '22.0.0',
  '@types/node': '24.13.4', '@types/pg': '8.20.0', pg: '8.23.1', vitest: '4.1.11', 'reflect-metadata': '0.2.2', rxjs: '7.8.2', zod: '4.4.3',
  '@nestjs/common': '11.2.3', '@nestjs/core': '11.2.3', '@stynx-nyx/tsconfig': '3.0.0',
  '@stynx-nyx/auth': '3.0.0', '@stynx-nyx/core': '3.0.0', '@stynx-nyx/data': '3.0.0', '@stynx-nyx/health': '3.0.0', '@stynx-nyx/i18n': '3.0.0',
  '@stynx-nyx/logging': '3.0.0', '@stynx-nyx/backend': '3.0.0', '@stynx-nyx/flow': '3.0.0', '@stynx-nyx/idempotency': '3.0.0',
  '@devai-nyx/cli': `link:${CLI}`, '@devai-nyx/decorators': `link:${DECORATORS}`,
};

const put = (dir: string, path: string, bytes: Buffer | string) => {
  mkdirSync(dirname(resolve(dir, path)), { recursive: true });
  writeFileSync(resolve(dir, path), bytes);
};

describe('09 §4 campaign fixtures (D-098)', () => {
  let dir = '';
  const tool = (bin: string, args: string[]) => spawnSync(resolve(dir, 'node_modules/.bin', bin), args, { cwd: dir, encoding: 'utf8' });

  beforeAll(async () => {
    dir = mkdtempSync(resolve(tmpdir(), 'devai-r8-fixtures-'));
    for (const e of templateEntries({ __PRODUCT__: 'demo', __PREFIX__: 'Demo', __LOCALES__: "['en-US']" })) if (e.bytes) put(dir, e.path, e.bytes);
    put(dir, 'devai.json', prettyJson(renderConfig('demo', ['en-US'], true, 'bare')));
    // 09 §6's configuration: 06 §7's (`demo`, `lgpd: true`, en-US), no `--web`.
    const spec = readFileSync(resolve(CLI, 'template/specs/notes/SPEC-DEMO-001.md'));
    for (const [path, f] of await render(spec, { web: false, locales: ['en-US'], lgpd: true, productPrefix: 'demo' }, cliVersion())) put(dir, `domain/notes/${path}`, f.bytes);
    for (const [from, to] of Object.entries(PLACED)) {
      mkdirSync(dirname(resolve(dir, to)), { recursive: true });
      cpSync(resolve(FIXTURES, from), resolve(dir, to));
    }
    symlinkSync(resolve(toolsFor(PINS), 'node_modules'), resolve(dir, 'node_modules'), 'dir');
    execFileSync('git', ['init', '-q'], { cwd: dir });
  }, 900_000);

  it('the fixture set is the three files D-098 names and D-131\'s service spec', () => {
    expect(Object.keys(PLACED).sort()).toEqual(['SPEC-DEMO-001.acceptance.spec.ts', 'notes.repository.ts', 'notes.service.spec.ts', 'notes.service.ts']);
  });

  it("the acceptance file has one top-level it('R-n: …') per acceptance requirement, named as the spec's notes", () => {
    const text = readFileSync(resolve(FIXTURES, 'SPEC-DEMO-001.acceptance.spec.ts'), 'utf8');
    const cases = [...text.matchAll(/^ {2}it\('(R-\d): ([a-z-]+)'/gm)].map((m) => `${m[1]}: ${m[2]}`);
    expect(cases).toEqual(['R-1: create-and-read', 'R-2: strict-inputs', 'R-3: role-boundary', 'R-4: tenant-isolation', 'R-5: input-rejection', 'R-6: rls-visibility']);
  });

  it('is Prettier-clean under the template options', async () => {
    for (const [from, to] of Object.entries(PLACED)) {
      expect([from, await check(readFileSync(resolve(FIXTURES, from), 'utf8'), { ...PRETTIER_OPTIONS, filepath: resolve(dir, to) })]).toEqual([from, true]);
    }
  });

  it('the service and repository bodies type-check in the rendered module', () => {
    const r = tool('tsc', ['-p', 'domain/notes/api/tsconfig.json', '--outDir', resolve(dir, '.out/module'), '--tsBuildInfoFile', resolve(dir, '.out/module.tsbuildinfo')]);
    expect(r.stdout + r.stderr).toBe('');
    expect(r.status).toBe(0);
  });

  it('the service spec passes against the bodies', () => {
    put(dir, 'vitest.fixtures.config.mjs', "export default { test: { include: ['domain/notes/api/test/notes.service.spec.ts'] } };\n");
    const r = tool('vitest', ['run', '--config', 'vitest.fixtures.config.mjs']);
    expect(r.stdout + r.stderr).toMatch(/Tests {2}2 passed \(2\)/);
    expect(r.status).toBe(0);
  });

  it('the acceptance file and the service spec type-check against the API shell and the test support', () => {
    put(dir, 'tsconfig.fixtures.json', JSON.stringify({
      extends: '@stynx-nyx/tsconfig/node24.json',
      compilerOptions: { noEmit: true, experimentalDecorators: true, emitDecoratorMetadata: true, types: ['node'] },
      include: [PLACED['SPEC-DEMO-001.acceptance.spec.ts'], PLACED['notes.service.spec.ts'], 'apps/api/src/**/*.ts', 'test/support/utils/*.ts'],
    }));
    const r = tool('tsc', ['-p', 'tsconfig.fixtures.json']);
    expect(r.stdout + r.stderr).toBe('');
    expect(r.status).toBe(0);
  });

  it("lints clean under the template's ESLint config", () => {
    const r = tool('eslint', ['--max-warnings', '0', ...Object.values(PLACED)]);
    expect(r.stdout).toBe('');
    expect(r.status).toBe(0);
  });
});
