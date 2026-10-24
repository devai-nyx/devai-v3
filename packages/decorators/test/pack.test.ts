// 02 §1 row "Rail: helpers": the packed tarball carries dist only, and the package depends on neither STYNX nor the CLI.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

describe('pnpm pack', () => {
  it('includes dist/index.js and dist/index.d.ts and nothing from src/', () => {
    const dest = mkdtempSync(resolve(tmpdir(), 'devai-decorators-pack-'));
    const pack = spawnSync('pnpm', ['pack', '--pack-destination', dest], { cwd: root, encoding: 'utf8' });
    expect(pack.status, pack.stderr).toBe(0);
    const tarball = readdirSync(dest).find((f) => f.endsWith('.tgz'));
    expect(tarball).toBeDefined();
    const list = spawnSync('tar', ['-tzf', resolve(dest, tarball!)], { encoding: 'utf8' });
    const files = list.stdout.split('\n');
    expect(files).toContain('package/dist/index.js');
    expect(files).toContain('package/dist/index.d.ts');
    expect(files.some((f) => f.startsWith('package/src/') || f.startsWith('package/test/'))).toBe(false);
  });

  it('declares no dependency on STYNX or the CLI', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as Record<string, Record<string, string> | undefined>;
    const names = ['dependencies', 'peerDependencies', 'optionalDependencies'].flatMap((k) => Object.keys(manifest[k] ?? {}));
    expect(names.filter((n) => n.startsWith('@stynx-nyx/') || n === '@devai-nyx/cli')).toEqual([]);
  });
});
