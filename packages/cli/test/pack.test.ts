// devai-v3#40 / D-074: the packed tarball carries the binary, the template (with `gitignore`) and the schema.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
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
});
