// 08 C.4: key framing vectors, resultDigest canonicalisation, the store (PASS only, corrupt = miss), --prune.
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cacheKey, configDigest, frame, frameList, inputDigest, nodeVersion } from '../src/cache/key.js';
import { canonicalJson, type NodeRow, resultDigest } from '../src/cache/result-digest.js';
import { CacheStore, prune } from '../src/cache/store.js';
import { node } from './fixtures.js';

const h = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const row = (extra: Record<string, unknown> = {}) => node('format', 'PASS', extra) as NodeRow;

describe('C.4 key', () => {
  it('frames each component as <len>:<bytes> (byte length, not characters)', () => {
    expect(frame('abc').toString()).toBe('3:abc');
    expect(frame('').toString()).toBe('0:');
    expect(frame('≠').toString()).toBe('3:≠');
    expect(frameList(['a', 'bc']).toString()).toBe('1:a2:bc');
  });

  it('is sha256 over the seven framed components, inputs sorted, list components framed twice', () => {
    const key = cacheKey({ nodeId: 'lint', nodeVersion: '3.0.0+1', toolchainDigest: 't', configDigest: 'c', runtimeOrSchema: 'bare', inputDigests: ['zz', 'aa'], dependencyResultDigests: ['d1'] });
    expect(key).toBe(h('4:lint7:3.0.0+11:t1:c4:bare8:2:aa2:zz4:2:d1'));
  });

  it('changes with any component and with the order of dependency digests, not of inputs', () => {
    const base = { nodeId: 'lint', nodeVersion: '3.0.0+1', toolchainDigest: 't', configDigest: 'c', runtimeOrSchema: 'bare', inputDigests: ['a', 'b'], dependencyResultDigests: ['x', 'y'] };
    const k = cacheKey(base);
    expect(cacheKey({ ...base, inputDigests: ['b', 'a'] })).toBe(k);
    expect(cacheKey({ ...base, dependencyResultDigests: ['y', 'x'] })).not.toBe(k);
    expect(cacheKey({ ...base, runtimeOrSchema: 'docker' })).not.toBe(k);
    expect(cacheKey({ ...base, nodeVersion: '3.0.0+2' })).not.toBe(k);
    expect(cacheKey({ ...base, extra: ['static'] })).not.toBe(cacheKey({ ...base, extra: ['db'] }));
  });

  it('input and config digests and nodeVersion', () => {
    expect(inputDigest('a.ts', 'f'.repeat(64))).toBe(h(`a.ts:${'f'.repeat(64)}`));
    expect(inputDigest('a.ts', null)).toBe(h('a.ts:absent'));
    expect(configDigest([{ path: 'z.json', sha256: 'z' }, { path: 'a.json', sha256: null }])).toBe(h('13:a.json:absent8:z.json:z'));
    expect(nodeVersion('3.0.0', 1)).toBe('3.0.0+1');
  });
});

describe('C.4 resultDigest', () => {
  const f1 = { locator: 'b.ts:1', message: 'm', standard: 'S-1', hint: 'h' };
  const f2 = { locator: 'a.ts:2', message: 'z', standard: 'S-1', hint: 'h' };
  const f3 = { locator: 'a.ts:2', message: 'a', standard: 'S-1', hint: 'h' };
  it('ignores durationMs, cached and cacheKey', () => {
    expect(resultDigest(row({ durationMs: 5 }))).toBe(resultDigest(row({ durationMs: 900, cached: true, cacheKey: 'c'.repeat(64) })));
  });
  it('sorts findings by locator then message and keys canonically', () => {
    const a = node('format', 'FAIL', { findings: [f1, f2, f3] }) as NodeRow;
    const b = node('format', 'FAIL', { findings: [f3, f1, f2] }) as NodeRow;
    expect(resultDigest(a)).toBe(resultDigest(b));
    const { durationMs: _d, cached: _c, ...rest } = a;
    const sorted = canonicalJson({ ...rest, findings: [f3, f2, f1] });
    expect(sorted.startsWith('{"evaluated":1,"expected":1,"findings":[{"hint":"h","locator":"a.ts:2","message":"a"')).toBe(true);
    expect(resultDigest(a)).toBe(h(sorted));
  });
  it('differs when the result differs', () => {
    expect(resultDigest(row())).not.toBe(resultDigest(row({ observed: 2, expected: 2, evaluated: 2 })));
  });
});

describe('C.4 store', () => {
  const tmp = () => mkdtempSync(resolve(tmpdir(), 'devai-w1-cache-'));
  const key = 'e'.repeat(64);

  it('stores and returns a PASS; never stores anything else', () => {
    const root = tmp();
    const s = new CacheStore(root);
    s.store('format', key, row());
    expect(s.lookup('format', key)).toMatchObject({ id: 'format', status: 'PASS' });
    s.store('lint', key, node('lint', 'FAIL', { findings: [{ locator: 'x:1', message: 'm', standard: 'S-1', hint: 'h' }] }) as NodeRow);
    expect(s.lookup('lint', key)).toBeNull();
  });

  it('a corrupt or tampered entry is a miss', () => {
    const root = tmp();
    const s = new CacheStore(root);
    s.store('format', key, row());
    const rd = resultDigest(row());
    writeFileSync(resolve(s.dir, 'results', `${rd}.json`), '{not json');
    expect(s.lookup('format', key)).toBeNull();
    writeFileSync(resolve(s.dir, 'results', `${rd}.json`), JSON.stringify(row({ observed: 2, expected: 2, evaluated: 2 })));
    expect(s.lookup('format', key)).toBeNull();
    writeFileSync(resolve(s.dir, 'nodes', 'format', `${key}.json`), 'garbage');
    expect(s.lookup('format', key)).toBeNull();
  });

  it('discard removes what this run wrote (candidate-changed)', () => {
    const root = tmp();
    const s = new CacheStore(root);
    s.store('format', key, row());
    s.discard();
    expect(s.lookup('format', key)).toBeNull();
  });

  it('--prune keeps the newest 200 entries per node by mtime and drops unreferenced results', () => {
    const root = tmp();
    const s = new CacheStore(root);
    for (let i = 0; i < 203; i++) {
      const k = i.toString(16).padStart(64, '0');
      s.store('format', k, row({ observed: i + 1, expected: i + 1, evaluated: i + 1 }));
      const t = new Date(Date.UTC(2026, 0, 1, 0, 0, i));
      utimesSync(resolve(s.dir, 'nodes', 'format', `${k}.json`), t, t);
    }
    mkdirSync(resolve(s.dir, 'nodes', 'lint'), { recursive: true });
    expect(prune(root)).toBe(3);
    const left = readdirSync(resolve(s.dir, 'nodes', 'format'));
    expect(left).toHaveLength(200);
    expect(left).not.toContain(`${'0'.repeat(64)}.json`);
    expect(readdirSync(resolve(s.dir, 'results'))).toHaveLength(200);
  });
});
