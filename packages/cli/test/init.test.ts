// 08 A.1 `devai init` on the built binary (D-057): refusals, materialise (two commits, hooks path,
// identity, packets based on the template commit, preflight), attach, then the scaffold installed from
// its own lock and checked by `inventory` and `layout` (C.2 reports).
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Report } from '../src/report.js';

const cli = resolve(import.meta.dirname, '..');
const bin = resolve(cli, 'dist/main.js');
const devai = (cwd: string, ...args: string[]) =>
  spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', env: { ...process.env, DEVAI_RUNTIME: '' }, maxBuffer: 64 * 1024 * 1024 });
const git = (cwd: string, ...args: string[]) => spawnSync('git', args, { cwd, encoding: 'utf8' }).stdout.trim();
const tmp = () => mkdtempSync(resolve(tmpdir(), 'devai-init-'));

describe('devai init refusals (A.1 Failure → reason)', () => {
  const refusal = (cwd: string, ...args: string[]) => {
    const r = devai(cwd, 'init', '--format', 'json', ...args);
    return { status: r.status, ...(JSON.parse(r.stdout) as { reason: string; message: string }) };
  };

  it('--product is required in materialise mode: usage', () => {
    expect(refusal(tmp(), '--dir', 'x')).toMatchObject({ status: 2, reason: 'usage', message: expect.stringMatching(/--product <slug> is required/) });
  });
  it('a product slug outside ^[a-z][a-z0-9]*$ is usage', () => {
    expect(refusal(tmp(), '--product', 'Demo-1')).toMatchObject({ status: 2, reason: 'usage' });
  });
  it('--locales must start with en-US (D-014): usage, nothing written', () => {
    const dir = tmp();
    expect(refusal(dir, '--product', 'demo', '--locales', 'pt-BR', '--dir', 'w')).toMatchObject({ status: 2, reason: 'usage', message: expect.stringMatching(/en-US is the default locale/) });
    expect(spawnSync('ls', [resolve(dir, 'w')]).status).not.toBe(0);
  });
  it('--runtime outside bare|docker is usage', () => {
    expect(refusal(tmp(), '--product', 'demo', '--runtime', 'podman')).toMatchObject({ status: 2, reason: 'usage' });
  });
  it('a non-empty --dir is dir-not-empty', () => {
    const dir = tmp();
    writeFileSync(resolve(dir, 'notes.txt'), 'x\n');
    expect(refusal(dir, '--product', 'demo')).toMatchObject({ status: 2, reason: 'dir-not-empty' });
  });
  it('attach mode rejects --product', () => {
    const dir = tmp();
    writeFileSync(resolve(dir, 'devai.json'), '{}');
    expect(refusal(dir, '--product', 'demo')).toMatchObject({ status: 2, reason: 'usage' });
  });
  it('attach mode with an invalid devai.json is config-invalid', () => {
    const dir = tmp();
    writeFileSync(resolve(dir, 'devai.json'), '{}');
    expect(refusal(dir)).toMatchObject({ status: 2, reason: 'config-invalid' });
  });
});

describe('devai init --product demo --dir <tmp> (materialise)', () => {
  const parent = tmp();
  const dir = resolve(parent, 'demo');
  let out: { mode: string; product: string; written: string[]; gitConfig: Record<string, string>; preflight: { node: string; binary: string; status: string; remedy?: string }[]; exitCode: number; reason?: string };
  let status: number | null;

  beforeAll(() => {
    const r = devai(parent, 'init', '--product', 'demo', '--dir', 'demo', '--format', 'json');
    status = r.status;
    out = JSON.parse(r.stdout) as typeof out;
  });

  it('writes the template and reports it in the A.1 JSON shape', () => {
    expect(out).toMatchObject({ mode: 'materialise', product: 'demo', accepted: false });
    expect(out.written).toEqual(expect.arrayContaining(['devai.json', '.gitignore', '.npmrc', 'scripts/hooks/pre-commit', 'packets/CMP-DEMO-001/PKT-DEMO-004.md']));
  });

  it('makes the two commits, the first with the PKT-DEMO-001 trailer, as the agent identity', () => {
    expect(git(dir, 'log', '--format=%s|%an <%ae>|%(trailers:key=Packet,valueonly)')).toBe(
      ['chore(packets): seed CMP-DEMO-001|demo-agent <agent@demo.local>|', 'chore(template): devai init demo|demo-agent <agent@demo.local>|PKT-DEMO-001'].join('\n'),
    );
    expect(git(dir, 'status', '--porcelain')).toBe('');
  });

  it('renders the packets with base = the template commit, leaving the rest of their bytes', () => {
    const template = git(dir, 'rev-parse', 'HEAD~1');
    for (const id of ['001', '002', '003', '004']) {
      const text = readFileSync(resolve(dir, `packets/CMP-DEMO-001/PKT-DEMO-${id}.md`), 'utf8');
      expect(text).toContain(`\nbase: ${template}\n`);
      expect(text).toBe(readFileSync(resolve(cli, `template/packets/CMP-DEMO-001/PKT-DEMO-${id}.md`), 'utf8').replace(/^base: [0-9a-f]{40}$/m, `base: ${template}`));
    }
    expect(git(dir, 'ls-tree', '-r', '--name-only', 'HEAD~1', '--', 'packets')).toBe('');
  });

  it('sets the hooks path and identity in the repository config', () => {
    expect(out.gitConfig).toEqual({ 'core.hooksPath': 'scripts/hooks', 'user.name': 'demo-agent', 'user.email': 'agent@demo.local' });
    expect(git(dir, 'config', '--get', 'core.hooksPath')).toBe('scripts/hooks');
    expect(git(dir, 'config', '--get', 'user.email')).toBe('agent@demo.local');
  });

  it('substitutes the product into the roles and shells, and writes a valid devai.json', () => {
    expect(readFileSync(resolve(dir, 'database/ddl/00-core-bootstrap.sql'), 'utf8')).toContain('CREATE ROLE demo_app LOGIN NOINHERIT NOBYPASSRLS');
    expect(readFileSync(resolve(dir, 'database/apply.sh'), 'utf8')).toContain('stynx migrate up --role-prefix demo\n');
    expect(JSON.parse(readFileSync(resolve(dir, 'apps/api/package.json'), 'utf8')).name).toBe('@demo/api');
    expect(readFileSync(resolve(dir, 'apps/web/src/app/app.component.ts'), 'utf8')).toContain("selector: 'demo-root'");
    expect(devai(dir, 'packets', 'status').status).toBe(0);
  });

  it('ends with the preflight: before an install every package binary is missing, remedy pnpm install (exit 2 tooling-missing)', () => {
    expect(status).toBe(2);
    expect(out).toMatchObject({ exitCode: 2, reason: 'tooling-missing' });
    const missing = out.preflight.filter((p) => p.status === 'missing');
    expect(missing.map((p) => p.binary)).toEqual(expect.arrayContaining(['tsc', 'eslint', 'vitest', 'stynx', 'knip']));
    for (const p of missing.filter((p) => p.binary !== '@devai-nyx/cli' && p.binary !== 'psql')) expect(p.remedy, p.binary).toBe('pnpm install');
  });

  it('prints the file classes, the git config lines, the preflight lines and the protection host line (D-091)', () => {
    const text = devai(dir, 'init').stdout.split('\n');
    expect(text).toEqual(expect.arrayContaining(['init-owned: 3 files written', 'git config core.hooksPath scripts/hooks', 'protection: require the devai job']));
    expect(text.some((l) => l.startsWith('ruleset:'))).toBe(false); // D-091 retired D-080's ruleset
    expect(text).toContain('UNKNOWN: tooling-missing — lint: install with pnpm install');
  });
});

const token = process.env['NODE_AUTH_TOKEN'];
describe.skipIf(!token)('the scaffold installs from its own lock and is checked (needs NODE_AUTH_TOKEN for @stynx-nyx/*)', () => {
  const parent = tmp();
  const dir = resolve(parent, 'demo');
  const pnpm = (...args: string[]) => spawnSync('pnpm', args, { cwd: dir, encoding: 'utf8', env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' } });

  beforeAll(() => {
    devai(parent, 'init', '--product', 'demo', '--dir', 'demo');
  });

  it('pnpm install --frozen-lockfile succeeds and leaves the tree clean', () => {
    const r = pnpm('install', '--frozen-lockfile', '--reporter=silent');
    expect(r.status, r.stderr).toBe(0);
    expect(git(dir, 'status', '--porcelain')).toBe('');
  }, 600_000);

  it('attach mode then resolves every package tool; the overlay comes from @devai-nyx/cli, linked here until it is published', () => {
    mkdirSync(resolve(dir, 'node_modules/@devai-nyx'), { recursive: true });
    symlinkSync(cli, resolve(dir, 'node_modules/@devai-nyx/cli'));
    const r = devai(dir, 'init', '--format', 'json');
    const out = JSON.parse(r.stdout) as { mode: string; preflight: { binary: string; status: string }[] };
    expect(out.mode).toBe('attach');
    const missing = out.preflight.filter((p) => p.status === 'missing').map((p) => p.binary);
    // psql is a host tool (07 §4); CI installs it before the tests.
    expect(missing.filter((b) => b !== 'psql')).toEqual([]);
    if (missing.length === 0) expect(r.status).toBe(0);
  });

  it('every file init generated is Prettier-clean with the template\'s own options', () => {
    const r = spawnSync(resolve(dir, 'node_modules/.bin/prettier'), ['--check', 'devai.json', 'package.json', 'eslint.config.mjs', 'vitest.config.ts', 'apps/api/src/app.module.ts', 'apps/web/src/app/app.component.ts', 'test/support/utils/runtime.ts'], { cwd: dir, encoding: 'utf8' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });

  it('check --only inventory: a C.2 report; before the first module the two domain globs match no package (D-084 item 7)', () => {
    const r = devai(dir, 'check', '--only', 'inventory', '--format', 'json');
    const report = Report.parse(JSON.parse(r.stdout));
    const inventory = report.nodes.find((n) => n.id === 'inventory')!;
    expect(r.status).toBe(1);
    expect(inventory).toMatchObject({ status: 'FAIL', expected: 2, observed: 2 });
    expect(inventory.findings.map((f) => `${f.locator} ${f.message}`)).toEqual([
      'pnpm-workspace.yaml:3 glob domain/*/api matches no package',
      'pnpm-workspace.yaml:4 glob domain/*/web matches no package',
    ]);
  }, 120_000);

  it('check --only layout: a C.2 report; layout waits on inventory', () => {
    const r = devai(dir, 'check', '--only', 'layout', '--format', 'json');
    const report = Report.parse(JSON.parse(r.stdout));
    expect(report.nodes.find((n) => n.id === 'layout')).toMatchObject({ status: 'UNKNOWN', reason: 'prerequisite-failed' });
  }, 120_000);

  it('the compiled shells typecheck with tsc -b', () => {
    const r = spawnSync(resolve(dir, 'node_modules/.bin/tsc'), ['-b', '--pretty', 'false', 'apps/api/tsconfig.json', 'apps/web/tsconfig.json', 'tsconfig.test.json'], { cwd: dir, encoding: 'utf8' });
    expect(r.status, r.stdout).toBe(0);
    expect(git(dir, 'status', '--porcelain')).toBe('');
  }, 300_000);
});
