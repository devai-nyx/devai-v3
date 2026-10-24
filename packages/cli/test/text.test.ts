// 08 C.3: the text report's grammar and its ≤ 40-line budget with the overflow rule; the --summary
// grammar; 10 §4 hints.
import { describe, expect, it } from 'vitest';
import { ReasonCode, type Report } from '../src/report.js';
import { NODE_IDS } from '../src/runner/edges.js';
import { HINTS } from '../src/text/hints.js';
import { MAX_LINES, renderText, statusLine } from '../src/text/report.js';
import { renderSummary } from '../src/text/summary.js';
import { finding, node, SHA1, SHA256, templateConfig } from './fixtures.js';

const config = templateConfig();
const findings = (n: number) => Array.from({ length: n }, (_, i) => ({ ...finding, locator: `f${i}.ts:${i + 1}`, message: `m${i}` }));
const report = (nodes: unknown[], extra: Record<string, unknown> = {}) =>
  ({ schemaVersion: '3', command: 'devai check --only inventory', packetId: null, kind: null, specId: null, specSha256: null, base: null, head: SHA1,
    candidateDigest: SHA256, toolchainDigest: SHA256, runtime: 'bare', accepted: false, exitCode: 1, durationMs: 41_000, nodes, ...extra }) as unknown as Report;
const accept = (deferred: string[] = []) => node('accept', 'FAIL', { findings: [finding], details: { node: 'accept', requiredSet: [], deferred, editLoopMs: 5 } });

describe('C.3 text report', () => {
  it('prints line 1, failing nodes first, the PASS/SKIPPED/deferred/review lines and exit', () => {
    const lines = renderText(report([
      node('inventory', 'PASS'),
      node('format', 'FAIL', { findings: [finding] }),
      node('lint', 'UNKNOWN', { reason: 'tooling-missing', observed: 0, evaluated: 0 }),
      node('layout', 'SKIPPED', { evidence: 'no paths', expected: 0, observed: 0, evaluated: 0 }),
      node('typecheck', 'PASS', { cached: true, cacheKey: SHA256 }),
      accept(['review', 'e2e']),
    ]), { config, untracked: 'notes.md' });
    expect(lines).toEqual([
      `devai check --only inventory   runtime=bare   base=none  head=${SHA1.slice(0, 4)}…`,
      'untracked: notes.md (not in any commit)',
      'FAIL     format              1 finding   (expected 1 files, observed 1)',
      '      x.ts:1  m   [S-1]  h',
      'FAIL     accept              1 finding   (expected 1 nodes, observed 1)',
      '      x.ts:1  m   [S-1]  h',
      'UNKNOWN  lint                0 findings   (expected 1 files, observed 0)',
      `      UNKNOWN lint tooling-missing: ${HINTS['tooling-missing']}`,
      'PASS  2 nodes (1 cached, 41 s)',
      'SKIPPED 1 node: layout[no paths]',
      'deferred: review, e2e',
      'review  not run: deferred',
      'exit 1',
    ]);
  });

  it('caps findings per node and marks the cut with +<k> more', () => {
    const lines = renderText(report([node('format', 'FAIL', { findings: findings(20) }), accept()]), { config });
    expect(lines.length).toBeLessThanOrEqual(MAX_LINES);
    const formatLines = lines.filter((l) => l.startsWith('      f'));
    expect(formatLines).toHaveLength(8);
    expect(formatLines[7]).toMatch(/\+12 more$/);
  });

  it('stays within 40 lines when every node fails, collapsing the lowest-priority nodes', () => {
    const nodes = NODE_IDS.map((id, i) => (i % 2 === 0 ? node(id, 'FAIL', { findings: findings(5) }) : node(id, 'UNKNOWN', { reason: 'timeout', findings: findings(3) })));
    const lines = renderText(report(nodes), { config, untracked: 'x' });
    expect(lines.length).toBeLessThanOrEqual(MAX_LINES);
    expect(lines[lines.length - 1]).toBe('exit 1');
    expect(lines[lines.length - 2]).toMatch(/^\+\d+ more findings: \.devai\/cache\/reports\/a{64}\.json$/);
    for (const id of NODE_IDS) expect(lines.some((l) => l.includes(` ${id} `) || l.startsWith(`FAIL     ${id}`) || l.startsWith(`UNKNOWN  ${id}`))).toBe(true);
  });

  it('keeps every status line when many nodes fail with one finding each', () => {
    const nodes = NODE_IDS.slice(0, 15).map((id) => node(id, 'FAIL', { findings: findings(3) }));
    const lines = renderText(report(nodes), { config });
    expect(lines.length).toBeLessThanOrEqual(MAX_LINES);
    expect(lines.filter((l) => l.startsWith('FAIL '))).toHaveLength(15);
  });

  it('prints a command-level reason as devai: <reason> — <hint>', () => {
    const lines = renderText(report([node('inventory', 'PASS'), node('accept', 'PASS', { details: { node: 'accept', requiredSet: [], deferred: [], editLoopMs: 1 } })], { exitCode: 2, reason: 'candidate-changed' }), { config });
    expect(lines).toContain(`devai: candidate-changed — ${HINTS['candidate-changed']}`);
  });

  it('status line grammar: status padded 7, node padded 18', () => {
    expect(statusLine(node('spec-tests', 'FAIL', { expected: 4, observed: 2, evaluated: 2, findings: [finding] }) as never))
      .toBe('FAIL     spec-tests          1 finding   (expected 4 acceptance requirements, observed 2)');
  });
});

describe('10 §4 hints', () => {
  it('cover every reason code in one line of at most 160 characters', () => {
    for (const r of ReasonCode.options) {
      expect(HINTS[r], r).toBeTruthy();
      expect(HINTS[r].length).toBeLessThanOrEqual(160);
      expect(HINTS[r]).not.toMatch(/\n/);
    }
  });
});

describe('C.3 --summary', () => {
  it('renders the 02 §8 instance shape for a pinning kind', () => {
    const r = report([
      node('inventory', 'PASS'),
      node('e2e', 'SKIPPED', { evidence: 'no test/e2e files', expected: 0, observed: 0, evaluated: 0 }),
      node('protected-paths', 'PASS', { details: { node: 'protected-paths', touched: [] } }),
      node('packet-scope', 'PASS'),
      node('spec-tests', 'PASS', { expected: 7, observed: 7, evaluated: 7 }),
      node('review', 'PASS', { details: { node: 'review', model: 'm', verdict: 'no-blockers', inputTokens: 1, outputTokens: 1, seconds: 1, toolCalls: 1, unexamined: [] } }),
      node('accept', 'PASS', { details: { node: 'accept', requiredSet: [], deferred: [], editLoopMs: 1 } }),
    ], { packetId: 'PKT-BOAT-103', kind: 'code', specId: 'SPEC-BOAT-CRASH-0001', specSha256: '9ab2' + 'c'.repeat(60), exitCode: 0 });
    const lines = renderSummary({ report: r, config, title: 'Implement crash record start/classify routes', review: { minor: 2, disposed: [], workerFamily: 'claude', reviewerFamily: 'gpt', head: '9e41' + 'd'.repeat(36) } });
    expect(lines).toEqual([
      'PKT-BOAT-103  Implement crash record start/classify routes   spec SPEC-BOAT-CRASH-0001 @ 9ab2… (frozen)',
      'acceptance: PASS (7 nodes: 6 pass, 1 skipped: e2e[no test/e2e files])   runtime: bare',
      'protected paths: none touched   packet scope: ok   spec tests: 7/7 requirements covered',
      'review: no blockers (2 minor, 0 disposed; mustRun: false, tallied)   worker: claude   reviewer: gpt   bound to head 9e41…',
    ]);
    expect(lines.length).toBeLessThanOrEqual(10);
  });

  it('lists at most six failing nodes, the sixth replaced by +<k> more nodes', () => {
    const r = report([...NODE_IDS.slice(1, 10).map((id) => node(id, 'FAIL', { findings: [finding] })), accept()], { packetId: 'PKT-DEMO-004', kind: 'standards' });
    const lines = renderSummary({ report: r, config, title: 't' });
    expect(lines[0]).toBe('PKT-DEMO-004  t   standards');
    expect(lines.length).toBeLessThanOrEqual(10);
    expect(lines[lines.length - 1]).toBe('+4 more nodes');
  });
});
