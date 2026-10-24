// 08 Part A preamble, exercised on the built binary (D-057: emitted JS). `build` runs before `test` (ci.yml).
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CommandRefusal, loadConfig, resolveRuntime } from '../src/main.js';
import { templateConfig } from './fixtures.js';

const bin = resolve(import.meta.dirname, '../dist/main.js');
const run = (...args: string[]) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });

describe('devai (preamble)', () => {
  it('--version prints the package version and exits 0', () => {
    const r = run('--version');
    expect(r.status).toBe(0);
    expect(r.stdout.trim()).toBe('3.0.0');
  });
  it('an unknown option is exit 2 usage, as JSON when asked', () => {
    const r = run('--format', 'json', '--bogus');
    expect(r.status).toBe(2);
    expect(JSON.parse(r.stdout)).toMatchObject({ accepted: false, exitCode: 2, reason: 'usage' });
  });
});

describe('loadConfig / resolveRuntime (A.8, 02 §6)', () => {
  it('missing devai.json is config-invalid', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'devai-w0-'));
    expect(() => loadConfig(dir)).toThrowError(CommandRefusal);
    try { loadConfig(dir); } catch (e) { expect((e as CommandRefusal).reason).toBe('config-invalid'); }
  });
  it('an invalid field is reported with its path', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'devai-w0-'));
    const c = templateConfig(); (c as { lgpd: unknown }).lgpd = 'yes';
    writeFileSync(resolve(dir, 'devai.json'), JSON.stringify(c));
    try { loadConfig(dir); throw new Error('unreachable'); } catch (e) { expect((e as CommandRefusal).message).toMatch(/devai\.json: lgpd /); }
  });
  it('a valid file loads and DEVAI_RUNTIME overrides the mode', () => {
    const dir = mkdtempSync(resolve(tmpdir(), 'devai-w0-'));
    writeFileSync(resolve(dir, 'devai.json'), JSON.stringify(templateConfig()));
    const config = loadConfig(dir);
    expect(resolveRuntime(config, {}).mode).toBe('bare');
    expect(resolveRuntime(config, { DEVAI_RUNTIME: 'docker' }).mode).toBe('docker');
    expect(() => resolveRuntime(config, { DEVAI_RUNTIME: 'podman' })).toThrowError(CommandRefusal);
  });
});
