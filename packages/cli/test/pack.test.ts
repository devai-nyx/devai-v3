// devai-v3#40 / D-074: the packed tarball carries the binary, the template (with `gitignore`) and the schema.
import { spawnSync } from 'node:child_process';
import { lstatSync, mkdtempSync, readdirSync, readlinkSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

describe('pnpm pack', () => {
  it('includes dist/main.js, template/gitignore and schema/devai.schema.json', () => {
    const dest = mkdtempSync(resolve(tmpdir(), 'devai-pack-'));
    const pack = spawnSync('pnpm', ['pack', '--pack-destination', dest], { cwd: root, encoding: 'utf8' });
    expect(pack.status, pack.stderr).toBe(0);
    const tarball = readdirSync(dest).find((f) => f.endsWith('.tgz'));
    expect(tarball).toBeDefined();
    const list = spawnSync('tar', ['-tzf', resolve(dest, tarball!)], { encoding: 'utf8' });
    const files = list.stdout.split('\n');
    expect(files).toContain('package/dist/main.js');
    expect(files).toContain('package/template/gitignore');
    expect(files).toContain('package/schema/devai.schema.json');
    expect(files).toContain('package/template/scripts/hooks/pre-commit');
    expect(files.some((f) => f.startsWith('package/src/'))).toBe(false);
  });

  // R6 W7: every template file is packed, and `init` copies the template from the installed package.
  it('packs the whole template, and init from the unpacked package writes executable hooks and the skill pointers', () => {
    const dest = mkdtempSync(resolve(tmpdir(), 'devai-pack-'));
    expect(spawnSync('pnpm', ['pack', '--pack-destination', dest], { cwd: root, encoding: 'utf8' }).status).toBe(0);
    const tarball = resolve(dest, readdirSync(dest).find((f) => f.endsWith('.tgz'))!);
    const packed = spawnSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).stdout.split('\n').filter((f) => f.startsWith('package/template/') && !f.endsWith('/'));
    const tracked = spawnSync('git', ['ls-files', 'template'], { cwd: root, encoding: 'utf8' }).stdout.split('\n').filter((f) => f !== '');
    expect(packed.map((f) => f.slice('package/'.length)).sort()).toEqual(tracked.sort());

    expect(spawnSync('tar', ['-xzf', tarball, '-C', dest]).status).toBe(0);
    symlinkSync(resolve(root, 'node_modules'), resolve(dest, 'package/node_modules'));
    const r = spawnSync(process.execPath, [resolve(dest, 'package/dist/main.js'), 'init', '--product', 'demo', '--dir', resolve(dest, 'w')], { encoding: 'utf8' });
    expect(r.status, r.stdout + r.stderr).toBe(2); // tooling-missing: nothing is installed in w
    expect(lstatSync(resolve(dest, 'w/scripts/hooks/pre-commit')).mode & 0o111).not.toBe(0);
    expect(readlinkSync(resolve(dest, 'w/.claude/skills/devai-task'))).toBe('../../.agents/skills/devai-task');
    expect(lstatSync(resolve(dest, 'w/.npmrc')).isFile()).toBe(true);
  });
});
