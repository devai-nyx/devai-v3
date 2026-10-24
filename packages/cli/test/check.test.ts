// `devai check` end to end on the built binary (D-057) in a temp workspace carrying the template's
// fixed files: a C.2-valid report with inventory and accept rows, the report file, the W1 refusals.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Report } from '../src/report.js';
import { NODE_IDS } from '../src/runner/edges.js';
import { templateWorkspace, write } from './repo.js';

const bin = resolve(import.meta.dirname, '../dist/main.js');
const devai = (cwd: string, ...args: string[]) => spawnSync(process.execPath, [bin, ...args], { cwd, encoding: 'utf8', env: { ...process.env, DEVAI_RUNTIME: '' } });

describe('devai check --only inventory (W1 entry point)', () => {
  it('prints a C.2-valid report with inventory and accept, accepted: false, and writes it under reports/', () => {
    const dir = templateWorkspace();
    const r = devai(dir, 'check', '--only', 'inventory', '--format', 'json');
    expect(r.stderr).toBe('');
    expect(r.status).toBe(0);
    const report = Report.parse(JSON.parse(r.stdout));
    expect(report.nodes.map((n) => n.id)).toEqual(['inventory', 'accept']);
    expect(report).toMatchObject({ accepted: false, exitCode: 0, command: 'devai check --only inventory --format json', base: null, runtime: 'bare' });
    expect(report.nodes.map((n) => n.status)).toEqual(['PASS', 'PASS']);
    const accept = report.nodes[1]!;
    expect(accept.details).toMatchObject({ node: 'accept', requiredSet: [], deferred: NODE_IDS.filter((n) => n !== 'inventory' && n !== 'accept') });
    const path = resolve(dir, '.devai/cache/reports', `${report.candidateDigest}.json`);
    expect(existsSync(path)).toBe(true);
    expect(Report.parse(JSON.parse(readFileSync(path, 'utf8')))).toEqual(report);
  });

  it('the program-level --format before the command works too, and the cache does not change the digest', () => {
    const dir = templateWorkspace();
    const a = Report.parse(JSON.parse(devai(dir, '--format', 'json', 'check', '--only', 'inventory').stdout));
    const b = Report.parse(JSON.parse(devai(dir, 'check', '--only', 'inventory', '--format', 'json').stdout));
    expect(b.candidateDigest).toBe(a.candidateDigest);
  });

  it('text output: ≤ 40 lines, the untracked diagnostic, exit last', () => {
    const dir = templateWorkspace();
    write(dir, 'notes.md', 'stray\n');
    const r = devai(dir, 'check', '--only', 'inventory');
    const lines = r.stdout.trimEnd().split('\n');
    expect(r.status).toBe(0);
    expect(lines.length).toBeLessThanOrEqual(40);
    expect(lines[0]).toMatch(/^devai check --only inventory   runtime=bare   base=none  head=[0-9a-f]{4}…$/);
    expect(lines[1]).toBe('untracked: notes.md (not in any commit)');
    expect(lines).toContain('PASS  2 nodes (0 cached, 0 s)');
    expect(lines[lines.length - 1]).toBe('exit 0');
  });

  it('a FAIL inventory is exit 1 with accept FAIL', () => {
    const dir = templateWorkspace({ 'package.json': JSON.stringify({ name: 'demo', engines: { node: '>=24 <25' }, packageManager: 'pnpm@9.15.0' }) });
    const r = devai(dir, 'check', '--only', 'inventory', '--format', 'json');
    const report = Report.parse(JSON.parse(r.stdout));
    expect(r.status).toBe(1);
    expect(report.nodes.map((n) => n.status)).toEqual(['FAIL', 'FAIL']);
    expect(report.nodes[0]!.findings[0]).toEqual({ locator: 'package.json:1', message: '"type" is not "module"', standard: 'S-31', hint: 'set "type": "module"' });
  });
});

describe('devai check refusals (W1)', () => {
  const usage = (dir: string, ...args: string[]) => {
    const r = devai(dir, 'check', ...args, '--format', 'json');
    expect(r.status).toBe(2);
    return JSON.parse(r.stdout) as { reason: string; message: string };
  };
  it('a node without an adapter: exit 2 usage "node <id> arrives in a later wave"', () => {
    const dir = templateWorkspace();
    expect(usage(dir, '--only', 'format')).toMatchObject({ reason: 'usage', message: 'node format arrives in a later wave' });
    expect(usage(dir)).toMatchObject({ reason: 'usage', message: 'node format arrives in a later wave' });
    expect(usage(dir, '--only', 'route-contract')).toMatchObject({ reason: 'usage', message: 'node typecheck arrives in a later wave' });
  });
  it('flags of later waves refuse naming the wave', () => {
    const dir = templateWorkspace();
    expect(usage(dir, '--packet', 'packets/CMP-DEMO-001/PKT-DEMO-004.md')).toMatchObject({ reason: 'usage', message: '--packet arrives in a later wave (R6 W4)' });
    expect(usage(dir, '--hook', 'pre-commit')).toMatchObject({ reason: 'usage', message: '--hook arrives in a later wave (R6 W4)' });
    expect(usage(dir, '--summary')).toMatchObject({ reason: 'usage' });
    expect(usage(dir, '--full')).toMatchObject({ reason: 'usage' });
    expect(usage(dir, '--only', 'bogus')).toMatchObject({ reason: 'usage' });
    expect(usage(dir, '--prune', '--only', 'inventory')).toMatchObject({ reason: 'usage', message: '--prune combines with nothing else (A.3)' });
  });
  it('--prune exits 0; outside a repository is not-a-repository; no devai.json is config-invalid', () => {
    const dir = templateWorkspace();
    expect(devai(dir, 'check', '--prune').status).toBe(0);
    const sub = resolve(dir, 'specs');
    write(dir, 'specs/devai.json', readFileSync(resolve(dir, 'devai.json'), 'utf8'));
    expect(JSON.parse(devai(sub, 'check', '--only', 'inventory', '--format', 'json').stdout)).toMatchObject({ reason: 'not-a-repository' });
    expect(JSON.parse(devai(resolve(dir, 'packets'), 'check', '--format', 'json').stdout)).toMatchObject({ reason: 'config-invalid' });
  });
  it('a symlink escaping the repository is exit 2 io', () => {
    const dir = templateWorkspace();
    spawnSync('ln', ['-s', '../../../etc/hosts', resolve(dir, 'specs/escape')]);
    expect(usage(dir, '--only', 'inventory')).toMatchObject({ reason: 'io' });
  });
});
