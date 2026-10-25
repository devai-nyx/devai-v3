// R6 W7: the template manifest against 09 §1.1, and the rows whose bytes the law gives against the law.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { prettyJson, renderConfig, TEMPLATE_DIR, templateEntries } from '../src/commands/init.js';
import { DevaiConfig } from '../src/config.js';
import { templateConfig } from './fixtures.js';

const here = resolve(import.meta.dirname);
const law = (name: string) => readFileSync(resolve(here, '../../../docs/framework', name), 'utf8');
const tpl = (path: string) => readFileSync(resolve(TEMPLATE_DIR, path), 'utf8');

/** 09 §1.1, row by row, as written by `init` (`devai.json` is rendered, not stored; D-074 renames). */
const ROWS: string[] = [
  'README.md', 'AGENTS.md', 'CLAUDE.md', 'decisions.md', 'devai.json', 'package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml',
  '.gitignore', '.npmrc', '.stynxrc.json', 'tsconfig.test.json', 'eslint.config.mjs', 'vitest.config.ts', 'playwright.config.ts',
  'tools/commitlint.config.mjs', '.changeset/config.json', 'compose.yaml',
  'scripts/hooks/pre-commit', 'scripts/hooks/pre-push', 'scripts/hooks/commit-msg', 'scripts/ci-local/run.sh',
  '.github/workflows/devai.yml',
  'database/README.md', 'database/apply.sh', 'database/checks.sql', 'database/ddl/00-core-bootstrap.sql', 'database/seed/modules.txt',
  'apps/api/package.json', 'apps/api/tsconfig.json', 'apps/api/src/main.ts', 'apps/api/src/app.module.ts', 'apps/api/src/validation.filter.ts',
  'apps/web/package.json', 'apps/web/tsconfig.json', 'apps/web/angular.json', 'apps/web/src/main.ts', 'apps/web/src/index.html',
  'apps/web/src/app/app.component.ts', 'apps/web/src/app/app.config.ts', 'apps/web/src/app/app.routes.ts',
  'test/support/utils/runtime.ts', 'test/integration/request-id.integration.spec.ts', 'test/db/rls-isolation.db.spec.ts', 'test/e2e/shell.playwright.ts',
  'docs/adopters/layout.md', 'docs/_ia/categories.json',
  'docs/framework/contracts/openapi.json', 'docs/framework/contracts/public-api-baselines.json',
  '.agents/skills/devai-task/SKILL.md', '.agents/skills/devai-spec/SKILL.md', '.agents/skills/devai-test/SKILL.md', '.agents/skills/devai-review/SKILL.md',
  'product/demo/README.md', 'product/demo/rules/RN-DEMO-001.md', 'product/demo/rules/RN-DEMO-002.md', 'product/use-cases/UC-DEMO-001.json',
  'specs/notes/SPEC-DEMO-001.md',
  'packets/CMP-DEMO-001/campaign.md', 'packets/CMP-DEMO-001/PKT-DEMO-001.md', 'packets/CMP-DEMO-001/PKT-DEMO-002.md',
  'packets/CMP-DEMO-001/PKT-DEMO-003.md', 'packets/CMP-DEMO-001/PKT-DEMO-004.md',
];
/** Read by a node although 09 §1.1 has no row for it (listed under the PR's Open). */
const EXTRA = ['tools/knip.config.ts'];
/** Paths whose bytes 05, 06, 08, 09 or 10 fix: the product tokens never appear in them. */
const FIXED = /^(README\.md|AGENTS\.md|CLAUDE\.md|\.npmrc|\.stynxrc\.json|scripts\/hooks\/|\.agents\/|product\/|specs\/|packets\/)/;
const TOKENS = { __PRODUCT__: 'demo', __PREFIX__: 'Demo', __LOCALES__: "['en-US']" };

/** 06 §7's body for `### \`<path>\``: the fenced block after the heading, with its final newline. */
function fixtureBody(path: string): string {
  const text = law('06-spec-format.md');
  const at = text.indexOf(`### \`${path}\``);
  if (at < 0) throw new Error(`06 §7 has no body for ${path}`);
  const fence = /^(`{3,})[a-z]*\n/m.exec(text.slice(at))!;
  const open = at + fence.index + fence[0].length;
  return text.slice(open, text.indexOf(`\n${fence[1]}\n`, open)) + '\n';
}

describe('template manifest (09 §1.1)', () => {
  const entries = templateEntries(TOKENS);
  const paths = new Set([...entries.map((e) => e.path), 'devai.json']);

  it.each(ROWS)('%s is written by init', (path) => expect(paths.has(path)).toBe(true));

  it('writes nothing beyond the rows, the knip config and the .claude/skills pointers (04 §1)', () => {
    const extra = [...paths].filter((p) => !ROWS.includes(p) && !EXTRA.includes(p) && !p.startsWith('.claude/skills/'));
    expect(extra).toEqual([]);
  });

  it('stores .gitignore and .npmrc without the dot, because pnpm pack drops both names (D-074)', () => {
    expect(existsSync(resolve(TEMPLATE_DIR, 'gitignore'))).toBe(true);
    expect(existsSync(resolve(TEMPLATE_DIR, 'npmrc'))).toBe(true);
    expect(existsSync(resolve(TEMPLATE_DIR, '.npmrc'))).toBe(false);
  });

  it('every token is one of the three init substitutes, and none is left in a written file', () => {
    const raw = templateEntries({}).filter((e) => e.bytes).flatMap((e) => [...e.bytes!.toString('utf8').matchAll(/__[A-Z]+__/g)].map((m) => m[0]));
    expect([...new Set(raw)].sort()).toEqual(Object.keys(TOKENS).sort());
    for (const e of entries.filter((e) => e.bytes)) expect(e.bytes!.toString('utf8'), e.path).not.toMatch(/__[A-Z]+__/);
  });

  it('fixed-byte files carry no token, so init writes them unchanged', () => {
    const raw = templateEntries({});
    for (const e of raw.filter((e) => e.bytes && FIXED.test(e.path))) expect(e.bytes!.toString('utf8'), e.path).not.toMatch(/__[A-Z]+__/);
  });

  it('shell scripts are written executable, from their shebang (a packed tarball keeps no mode bits)', () => {
    const scripts = entries.filter((e) => e.executable).map((e) => e.path).sort();
    expect(scripts).toEqual(['database/apply.sh', 'scripts/ci-local/run.sh', 'scripts/hooks/commit-msg', 'scripts/hooks/pre-commit', 'scripts/hooks/pre-push']);
  });

  it('.claude/skills/<name> points at each .agents/skills/<name> (04 §1; a packed tarball keeps no symlink)', () => {
    expect(entries.filter((e) => e.link !== undefined).map((e) => `${e.path} -> ${e.link}`)).toEqual(
      ['devai-review', 'devai-spec', 'devai-task', 'devai-test'].map((n) => `.claude/skills/${n} -> ../../.agents/skills/${n}`),
    );
  });

  it('the database seed manifest is empty at init (09 §1.1)', () => expect(tpl('database/seed/modules.txt')).toBe(''));
});

describe('fixed-byte rows equal their law source', () => {
  it('.npmrc equals the 09 §1.1 row', () => {
    expect(tpl('npmrc')).toBe('@devai-nyx:registry=https://npm.pkg.github.com\n@stynx-nyx:registry=https://npm.pkg.github.com\n//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}\n');
  });

  it('.stynxrc.json equals the 09 §1.1 row (D-087)', () => {
    const row = law('09-rail.md').split('\n').find((l) => l.startsWith('| `.stynxrc.json` |'))!;
    const bytes = /`(\{ "boundary".*?\} \})`/.exec(row)![1]!;
    expect(tpl('.stynxrc.json')).toBe(bytes + '\n');
  });

  it('.gitignore carries the 09 §1.1 names in order, then what `tsc -b` writes beside a tsconfig', () => {
    const row = law('09-rail.md').split('\n').find((l) => l.startsWith('| `.gitignore` |'))!;
    const names = /\| `([^`]+)` \(never/.exec(row)![1]!.split(' ');
    expect(tpl('gitignore')).toBe([...names, '*.tsbuildinfo'].join('\n') + '\n');
  });

  it('CLAUDE.md is the one line @AGENTS.md (09 §1.1)', () => expect(tpl('CLAUDE.md')).toBe('@AGENTS.md\n'));

  it('AGENTS.md is at most 60 lines (09 §1.1)', () => expect(tpl('AGENTS.md').split('\n').length - 1).toBeLessThanOrEqual(60));

  it.each(['product/demo/README.md', 'product/demo/rules/RN-DEMO-001.md', 'product/demo/rules/RN-DEMO-002.md', 'product/use-cases/UC-DEMO-001.json', 'specs/notes/SPEC-DEMO-001.md'])(
    '%s equals its 06 §7 body', (path) => expect(tpl(path)).toBe(fixtureBody(path)),
  );

  it('the spec is 10,035 bytes, sha256 12e9041f…f30a (09 §1, D-064)', () => {
    const bytes = readFileSync(resolve(TEMPLATE_DIR, 'specs/notes/SPEC-DEMO-001.md'));
    const sha = createHash('sha256').update(bytes).digest('hex');
    expect(bytes.length).toBe(10035);
    expect([sha.slice(0, 8), sha.slice(-4)]).toEqual(['12e9041f', 'f30a']);
  });

  it('the packets pin the spec digest', () => {
    const sha = createHash('sha256').update(readFileSync(resolve(TEMPLATE_DIR, 'specs/notes/SPEC-DEMO-001.md'))).digest('hex');
    for (const id of ['PKT-DEMO-002', 'PKT-DEMO-003', 'PKT-DEMO-004']) expect(tpl(`packets/CMP-DEMO-001/${id}.md`)).toContain(`sha256: "${sha}"`);
  });

  it('pnpm-workspace.yaml names the 09 §1.1 globs', () => expect(tpl('pnpm-workspace.yaml')).toBe('packages:\n  - apps/*\n  - domain/*/api\n  - domain/*/web\n'));

  it('the workflow runs on ubuntu-24.04 only, pins every action by sha and has no workflow-level paths filter', () => {
    const yml = tpl('.github/workflows/devai.yml');
    expect([...yml.matchAll(/runs-on: (.+)/g)].map((m) => m[1])).toSatisfy((r: string[]) => r.every((v) => v === 'ubuntu-24.04'));
    for (const m of yml.matchAll(/uses: (\S+)/g)) expect(m[1]).toMatch(/@[0-9a-f]{40}$/);
    expect(yml).not.toMatch(/^\s{2,4}paths:/m);
    expect(yml).toMatch(/^ {2}devai:$/m);
  });
});

describe('template pins (07 §2, 09 §5)', () => {
  const manifests = ['package.json', 'apps/api/package.json', 'apps/web/package.json'].map((p) => JSON.parse(tpl(p)) as Record<string, Record<string, string>>);
  const deps = Object.assign({}, ...manifests.flatMap((m) => [m['dependencies'] ?? {}, m['devDependencies'] ?? {}])) as Record<string, string>;

  it('every @stynx-nyx/* dependency is exactly 3.0.0', () => {
    const stynx = Object.entries(deps).filter(([n]) => n.startsWith('@stynx-nyx/'));
    expect(stynx.length).toBeGreaterThan(0);
    for (const [n, v] of stynx) expect(v, n).toBe('3.0.0');
  });

  it('07 §2 pins are exact, TypeScript keeps D-057\'s ~6.0.3', () => {
    expect(deps).toMatchObject({
      typescript: '~6.0.3', '@types/node': '24.13.4', vitest: '4.1.11', '@swc/core': '1.16.2', 'unplugin-swc': '1.5.9', '@playwright/test': '1.60.0',
      eslint: '10.10.0', prettier: '3.9.6', knip: '6.35.1', depcheck: '1.4.7', madge: '8.0.0', 'github-actionlint': '1.7.12',
      '@commitlint/cli': '21.2.2', '@commitlint/config-conventional': '21.2.2', '@changesets/cli': '2.31.0',
      '@angular-eslint/eslint-plugin': '22.0.0', '@angular/core': '22.2.1', '@nestjs/core': '11.2.3', 'reflect-metadata': '0.2.2', rxjs: '7.8.2', zod: '4.4.3',
    });
    for (const [n, v] of Object.entries(deps)) if (n !== 'typescript') expect(v, n).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('the root manifest: module, engines, packageManager, scripts.test, STYNX\'s prettier block (09 §1.1)', () => {
    expect(JSON.parse(tpl('package.json'))).toMatchObject({
      type: 'module', engines: { node: '>=24 <25' }, packageManager: 'pnpm@9.15.0', scripts: { test: 'devai check --only unit' },
      prettier: { printWidth: 100, tabWidth: 2, singleQuote: true, trailingComma: 'all', semi: true },
    });
  });

  it('the lock resolves every importer the manifests declare', () => {
    const lock = tpl('pnpm-lock.yaml');
    expect(lock).toMatch(/^lockfileVersion: '9.0'$/m);
    for (const importer of ['.', 'apps/api', 'apps/web']) expect(lock).toContain(`\n  ${importer}:\n`);
    expect(lock).toContain("'@stynx-nyx/eslint-config@3.0.0'");
  });

  it('tsconfigs extend the published presets (09 §1.1)', () => {
    expect(JSON.parse(tpl('apps/api/tsconfig.json')).extends).toBe('@stynx-nyx/tsconfig/node24.json');
    expect(JSON.parse(tpl('apps/web/tsconfig.json')).extends).toBe('@stynx-nyx/tsconfig/angular18.json');
    expect(JSON.parse(tpl('tsconfig.test.json')).extends).toBe('@stynx-nyx/tsconfig/node24.json');
  });
});

describe('devai.json (08 A.8, 09 §1.1)', () => {
  it('renders the A.8 template values and validates', () => {
    const c = renderConfig('demo', ['en-US'], false, 'bare');
    expect(c).toEqual(templateConfig());
    expect(DevaiConfig.safeParse(c).success).toBe(true);
  });

  it('prints arrays of scalars on one line, as Prettier does at printWidth 100', () => {
    const text = prettyJson(renderConfig('demo', ['en-US', 'pt-BR'], true, 'docker'));
    expect(text).toContain('"locales": ["en-US", "pt-BR"],');
    expect(text).toContain('"ci": [".github/**", "scripts/**"],');
    expect(JSON.parse(text)).toEqual(renderConfig('demo', ['en-US', 'pt-BR'], true, 'docker'));
  });
});

describe('the template ships from the installed package', () => {
  it('TEMPLATE_DIR is <package>/template, which package.json "files" packs', () => {
    expect(TEMPLATE_DIR).toBe(resolve(here, '../template') + '/');
    expect(JSON.parse(readFileSync(resolve(here, '../package.json'), 'utf8')).files).toContain('template');
    expect(readdirSync(TEMPLATE_DIR)).toContain('gitignore');
  });
});
