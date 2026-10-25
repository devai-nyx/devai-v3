// 08 A.1 `devai init` on the built binary (D-057): refusals, materialise (two commits, hooks path,
// identity, packets based on the template commit, preflight), attach, then the scaffold installed from
// its own lock and checked by `inventory` and `layout` (C.2 reports).
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Report } from '../src/report.js';
import { pnpmShim } from './pnpm-shim.js';

const cli = resolve(import.meta.dirname, '..');
const bin = resolve(cli, 'dist/main.js');
const run = (env: NodeJS.ProcessEnv, cwd: string, ...args: string[]) =>
  spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', env: { ...env, DEVAI_RUNTIME: '' }, maxBuffer: 64 * 1024 * 1024 });
const devai = (cwd: string, ...args: string[]) => run(process.env, cwd, ...args);
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
  /** A repository whose devai.json is `text`, with init's two commits (attach mode, D-115). */
  const attached = (text: string) => {
    const dir = tmp();
    writeFileSync(resolve(dir, 'devai.json'), text);
    spawnSync('git', ['init', '-q'], { cwd: dir });
    for (const m of ['chore(template): devai init demo\n\nPacket: PKT-DEMO-001', 'chore(packets): seed CMP-DEMO-001\n\nPacket: CMP-DEMO-001']) {
      spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', m], { cwd: dir });
    }
    return dir;
  };
  it('attach mode rejects --product', () => {
    expect(refusal(attached('{}'), '--product', 'demo')).toMatchObject({ status: 2, reason: 'usage' });
  });
  it('attach mode with an invalid devai.json is config-invalid', () => {
    expect(refusal(attached('{}'))).toMatchObject({ status: 2, reason: 'config-invalid' });
  });
  it('devai.json without a Packet: commit is a first run, which reads it: an invalid one is config-invalid (D-112)', () => {
    const dir = tmp();
    writeFileSync(resolve(dir, 'devai.json'), '{}');
    expect(refusal(dir)).toMatchObject({ status: 2, reason: 'config-invalid' });
  });
});

describe('devai init --product demo --dir <tmp> (materialise; the install stubbed by a PATH pnpm, D-097)', () => {
  const parent = tmp();
  const dir = resolve(parent, 'demo');
  const shim = pnpmShim('stub');
  let out: { mode: string; product: string; written: string[]; gitConfig: Record<string, string>; preflight: { node: string; binary: string; status: string; remedy?: string }[]; exitCode: number; reason?: string };
  let status: number | null;

  beforeAll(() => {
    const r = run(shim.env, parent, 'init', '--product', 'demo', '--dir', 'demo', '--format', 'json');
    status = r.status;
    out = JSON.parse(r.stdout) as typeof out;
  });

  it('writes the template and reports it in the A.1 JSON shape', () => {
    expect(out).toMatchObject({ mode: 'materialise', product: 'demo', accepted: false });
    expect(out.written).toEqual(expect.arrayContaining(['devai.json', '.gitignore', '.npmrc', 'scripts/hooks/pre-commit', 'packets/CMP-DEMO-001/PKT-DEMO-004.md']));
  });

  it('installs @devai-nyx/cli at its own version before committing, then commits with the hooks live (D-097)', () => {
    const calls = readFileSync(shim.log, 'utf8').trim().split('\n');
    // D-139, D-140: the root add, then a plain install that links the apps
    expect(calls.slice(0, 2)).toEqual(['add -w -D --save-exact @devai-nyx/cli@3.0.0', 'install']);
    // both commits ran pre-commit and commit-msg (no --no-verify)
    expect(calls.filter((c) => c === 'exec devai check --hook pre-commit')).toHaveLength(2);
    expect(calls.filter((c) => c.startsWith('exec devai check --hook commit-msg'))).toHaveLength(2);
    const committed = JSON.parse(git(dir, 'show', 'HEAD~1:package.json')) as { devDependencies: Record<string, string> };
    expect(committed.devDependencies['@devai-nyx/cli']).toBe('3.0.0');
  });

  it('makes the two commits, the first with the PKT-DEMO-001 trailer, as the agent identity', () => {
    expect(git(dir, 'log', '--format=%s|%an <%ae>|%(trailers:key=Packet,valueonly,separator=%x2C)')).toBe(
      ['chore(packets): seed CMP-DEMO-001|demo-agent <agent@demo.local>|CMP-DEMO-001', 'chore(template): devai init demo|demo-agent <agent@demo.local>|PKT-DEMO-001'].join('\n'),
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

  it('ends with the preflight: the stub installed only the CLI, so every other package binary is missing, remedy pnpm install (exit 2 tooling-missing)', () => {
    expect(status).toBe(2);
    expect(out).toMatchObject({ exitCode: 2, reason: 'tooling-missing' });
    const missing = out.preflight.filter((p) => p.status === 'missing');
    expect(missing.map((p) => p.binary)).toEqual(expect.arrayContaining(['tsc', 'eslint', 'vitest', 'stynx', 'knip']));
    expect(out.preflight.filter((p) => p.binary === '@devai-nyx/cli').map((p) => p.status)).toEqual(['resolved', 'resolved']);
    for (const p of missing.filter((p) => p.binary !== 'psql')) expect(p.remedy, p.binary).toBe('pnpm install');
  });

  it('prints the file classes, the git config lines, the preflight lines and the protection host line (D-091)', () => {
    const text = devai(dir, 'init').stdout.split('\n');
    expect(text).toEqual(expect.arrayContaining(['init-owned: 3 files written', 'git config core.hooksPath scripts/hooks', 'protection: require the devai job']));
    expect(text.some((l) => l.startsWith('ruleset:'))).toBe(false); // D-091 retired D-080's ruleset
    expect(text).toContain('UNKNOWN: tooling-missing — lint: install with pnpm install');
  });
});

describe('devai init when the install fails (D-097)', () => {
  it('a failed `pnpm install` after the add is the same exit 2 tooling-missing, both commands as the remedy (D-140)', () => {
    const parent = tmp();
    const shim = pnpmShim('install-fails');
    const text = run(shim.env, parent, 'init', '--product', 'demo', '--dir', 'demo');
    expect(text.status).toBe(2);
    expect(text.stdout.split('\n')).toContain('devai: tooling-missing — install with pnpm add -w -D --save-exact @devai-nyx/cli@3.0.0 && pnpm install (ERR_PNPM_OUTDATED_LOCKFILE  Cannot install with "frozen-lockfile"); nothing was committed');
    expect(readFileSync(shim.log, 'utf8').trim().split('\n').slice(0, 2)).toEqual(['add -w -D --save-exact @devai-nyx/cli@3.0.0', 'install']);
    expect(spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: resolve(parent, 'demo') }).status).not.toBe(0);
  });

  it('exit 2 tooling-missing, the pnpm add command as the remedy, the files written and nothing committed', () => {
    const parent = tmp();
    const dir = resolve(parent, 'demo');
    const shim = pnpmShim('fail');
    const text = run(shim.env, parent, 'init', '--product', 'demo', '--dir', 'demo');
    expect(text.status).toBe(2);
    expect(text.stdout.split('\n')).toContain('devai: tooling-missing — install with pnpm add -w -D --save-exact @devai-nyx/cli@3.0.0 && pnpm install (ERR_PNPM_FETCH_404  GET https://npm.pkg.github.com/@devai-nyx%2Fcli: Not Found - 404); nothing was committed');
    expect(spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: dir }).status).not.toBe(0);
    expect(readFileSync(resolve(dir, 'devai.json'), 'utf8')).toContain('"productPrefix": "demo"');
    const json = run(pnpmShim('fail').env, tmp(), 'init', '--product', 'demo', '--dir', 'demo', '--format', 'json');
    const out = JSON.parse(json.stdout) as { exitCode: number; reason: string; preflight: { binary: string; status: string; remedy?: string }[] };
    expect(out).toMatchObject({ exitCode: 2, reason: 'tooling-missing' });
    expect(out.preflight.find((p) => p.binary === '@devai-nyx/cli')).toMatchObject({ status: 'missing', remedy: 'pnpm add -w -D --save-exact @devai-nyx/cli@3.0.0 && pnpm install' });
    // D-112, D-113: unborn HEAD, so the re-run is a first run; another --product is exit 2 config-mismatch.
    const stub = pnpmShim('stub');
    const other = run(stub.env, dir, 'init', '--product', 'other', '--format', 'json');
    expect([other.status, JSON.parse(other.stdout)]).toMatchObject([2, { reason: 'config-mismatch' }]);
    expect(spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: dir }).status).not.toBe(0);
    const again = JSON.parse(run(stub.env, dir, 'init', '--format', 'json').stdout) as { mode: string; written: string[] };
    expect(again.mode).toBe('materialise');
    expect(again.written.filter((p) => !p.startsWith('packets/'))).toEqual([]);
    expect(readFileSync(stub.log, 'utf8')).toContain('add -w -D --save-exact @devai-nyx/cli@3.0.0');
    expect(git(dir, 'log', '--format=%s|%(trailers:key=Packet,valueonly,separator=%x2C)')).toBe('chore(packets): seed CMP-DEMO-001|CMP-DEMO-001\nchore(template): devai init demo|PKT-DEMO-001');
    expect(git(dir, 'status', '--porcelain')).toBe('');
    expect(JSON.parse(run(stub.env, dir, 'init', '--format', 'json').stdout)).toMatchObject({ mode: 'attach' });
  });
});

describe('devai init re-run (D-113, D-115, D-116, D-117)', () => {
  /** A first run whose install failed: the files are on disk, nothing is committed. */
  const failed = (...args: string[]) => {
    const parent = tmp();
    run(pnpmShim('fail').env, parent, 'init', '--product', 'demo', '--dir', 'demo', ...args);
    return resolve(parent, 'demo');
  };
  const mismatch = (dir: string, ...args: string[]) => {
    const r = run(pnpmShim('stub').env, dir, 'init', '--format', 'json', ...args);
    return { status: r.status, ...(JSON.parse(r.stdout) as { reason: string; message: string }) };
  };

  it.each([
    [['--product', 'other'], '--product differs from devai.json productPrefix; omit it or pass the recorded value'],
    [['--locales', 'en-US,pt-BR'], '--locales differs from devai.json locales; omit it or pass the recorded value'],
    [['--lgpd'], '--lgpd differs from devai.json lgpd; omit it or pass the recorded value'],
    [['--runtime', 'docker'], '--runtime differs from devai.json runtime.mode; omit it or pass the recorded value'],
  ])('%j that differs from devai.json is exit 2 config-mismatch, nothing committed', (args, message) => {
    const dir = failed();
    expect(mismatch(dir, ...args)).toMatchObject({ status: 2, reason: 'config-mismatch', message });
    expect(spawnSync('git', ['rev-parse', '--verify', 'HEAD'], { cwd: dir }).status).not.toBe(0);
  });

  it('the recorded values are accepted: the re-run makes both commits', () => {
    const dir = failed('--lgpd', '--locales', 'en-US,pt-BR');
    const r = run(pnpmShim('stub').env, dir, 'init', '--format', 'json', '--product', 'demo', '--lgpd', '--locales', 'en-US,pt-BR', '--runtime', 'bare');
    expect(JSON.parse(r.stdout)).toMatchObject({ mode: 'materialise' });
    expect(git(dir, 'log', '--format=%s')).toBe('chore(packets): seed CMP-DEMO-001\nchore(template): devai init demo');
  });

  it('template commit present, packets commit missing: the re-run makes only the packets commit, keeping the packets on disk', () => {
    const parent = tmp();
    const dir = resolve(parent, 'demo');
    const stub = pnpmShim('stub');
    run(stub.env, parent, 'init', '--product', 'demo', '--dir', 'demo');
    const template = git(dir, 'rev-parse', 'HEAD~1');
    // the packets commit undone, its files left on disk (a hook-refused packets commit leaves this state)
    spawnSync('git', ['reset', '-q', 'HEAD~1'], { cwd: dir });
    const packet = resolve(dir, 'packets/CMP-DEMO-001/PKT-DEMO-001.md');
    const kept = readFileSync(packet, 'utf8');
    expect(JSON.parse(run(stub.env, dir, 'init', '--format', 'json').stdout)).toMatchObject({ mode: 'materialise', written: [] });
    expect(git(dir, 'log', '--format=%s')).toBe('chore(packets): seed CMP-DEMO-001\nchore(template): devai init demo');
    expect(git(dir, 'rev-parse', 'HEAD~1')).toBe(template);
    expect(readFileSync(packet, 'utf8')).toBe(kept);
    expect(kept).toContain(`\nbase: ${template}\n`);
    expect(git(dir, 'status', '--porcelain')).toBe('');
    expect(JSON.parse(run(stub.env, dir, 'init', '--format', 'json').stdout)).toMatchObject({ mode: 'attach' });
  });

  it('both init commits are read by their Packet: trailers, never by subject (D-120)', () => {
    const repo = (packets: string) => {
      const dir = tmp();
      writeFileSync(resolve(dir, 'devai.json'), '{}');
      spawnSync('git', ['init', '-q'], { cwd: dir });
      for (const m of ['chore(template): devai init demo\n\nPacket: PKT-DEMO-001', packets]) spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', m], { cwd: dir });
      return dir;
    };
    // init's subject without the trailer is not the packets commit: a re-run, which reads devai.json (`{}` is config-invalid)
    expect(mismatch(repo('chore(packets): seed CMP-DEMO-001'))).toMatchObject({ status: 2, reason: 'config-invalid' });
    // any subject with the trailer is: attach mode, which rejects --product
    expect(mismatch(repo('chore(packets): reworded\n\nPacket: CMP-DEMO-001'), '--product', 'demo')).toMatchObject({ status: 2, reason: 'usage' });
  });

  it('packets missing from disk too: the re-run renders them with base = the existing template commit', () => {
    const parent = tmp();
    const dir = resolve(parent, 'demo');
    const stub = pnpmShim('stub');
    run(stub.env, parent, 'init', '--product', 'demo', '--dir', 'demo');
    const template = git(dir, 'rev-parse', 'HEAD~1');
    spawnSync('git', ['reset', '-q', '--hard', 'HEAD~1'], { cwd: dir });
    const out = JSON.parse(run(stub.env, dir, 'init', '--format', 'json').stdout) as { written: string[] };
    expect(out.written.every((p) => p.startsWith('packets/'))).toBe(true);
    expect(readFileSync(resolve(dir, 'packets/CMP-DEMO-001/PKT-DEMO-002.md'), 'utf8')).toContain(`\nbase: ${template}\n`);
    expect(git(dir, 'log', '--format=%s')).toBe('chore(packets): seed CMP-DEMO-001\nchore(template): devai init demo');
  });
});

const token = process.env['NODE_AUTH_TOKEN'];
describe.skipIf(!token)('init installs from the shipped lock, commits with the hooks live and is checked (needs NODE_AUTH_TOKEN for @stynx-nyx/*)', () => {
  const parent = tmp();
  const dir = resolve(parent, 'demo');
  // `real`: the shipped lock installed by the real pnpm, this repository's CLI linked in place of the
  // unpublished @devai-nyx/cli 3.0.0, and the hooks run the real nodes (D-097).
  const shim = pnpmShim('real');
  let init: ReturnType<typeof run>;

  beforeAll(() => {
    init = run(shim.env, parent, 'init', '--product', 'demo', '--dir', 'demo', '--format', 'json');
  }, 900_000);

  it('materialise exits 0: the install resolved every tool, both commits passed their hooks, the tree is clean', () => {
    const out = JSON.parse(init.stdout) as { exitCode: number; preflight: { binary: string; status: string }[] };
    // psql is a host tool (07 §4); CI installs it before the tests.
    expect(out.preflight.filter((p) => p.status === 'missing').map((p) => p.binary).filter((b) => b !== 'psql')).toEqual([]);
    if (!out.preflight.some((p) => p.status === 'missing')) expect([init.status, init.stderr]).toEqual([0, '']);
    expect(git(dir, 'log', '--format=%s')).toBe('chore(packets): seed CMP-DEMO-001\nchore(template): devai init demo');
    expect(git(dir, 'status', '--porcelain')).toBe('');
  });

  it('attach mode then resolves every package tool', () => {
    const r = run(shim.env, dir, 'init', '--format', 'json');
    const out = JSON.parse(r.stdout) as { mode: string; preflight: { binary: string; status: string }[] };
    expect(out.mode).toBe('attach');
    expect(out.preflight.filter((p) => p.status === 'missing').map((p) => p.binary).filter((b) => b !== 'psql')).toEqual([]);
  });

  it('every file init generated is Prettier-clean with the template\'s own options', () => {
    const r = spawnSync(resolve(dir, 'node_modules/.bin/prettier'), ['--check', 'devai.json', 'package.json', 'eslint.config.mjs', 'vitest.config.ts', 'apps/api/src/app.module.ts', 'apps/web/src/app/app.component.ts', 'test/support/utils/runtime.ts'], { cwd: dir, encoding: 'utf8' });
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });

  it('check --only inventory: PASS before the first module; the two seed globs are no finding (D-092)', () => {
    const r = devai(dir, 'check', '--only', 'inventory', '--format', 'json');
    const report = Report.parse(JSON.parse(r.stdout));
    expect(report.nodes.find((n) => n.id === 'inventory')).toMatchObject({ status: 'PASS', expected: 2, observed: 2, findings: [] });
  }, 120_000);

  it('check --only layout: PASS; the 09 §1.1 tier literals matching nothing are no finding (D-092)', () => {
    const r = devai(dir, 'check', '--only', 'layout', '--format', 'json');
    const report = Report.parse(JSON.parse(r.stdout));
    expect(report.nodes.find((n) => n.id === 'layout')).toMatchObject({ status: 'PASS', findings: [] });
  }, 120_000);

  it('the compiled shells typecheck with tsc -b', () => {
    const r = spawnSync(resolve(dir, 'node_modules/.bin/tsc'), ['-b', '--pretty', 'false', 'apps/api/tsconfig.json', 'apps/web/tsconfig.json', 'tsconfig.test.json'], { cwd: dir, encoding: 'utf8' });
    expect(r.status, r.stdout).toBe(0);
    expect(git(dir, 'status', '--porcelain')).toBe('');
  }, 300_000);
});
