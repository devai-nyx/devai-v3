// 08 C.2 invariants (D-077): the seven inconsistent reports of devai-v3#34 are rejected; valid shapes pass.
import { describe, expect, it } from 'vitest';
import { NodeResult, Report, Review, SensorEvidence } from '../src/report.js';
import { SHA1, SHA256, acceptRow, finding, fullReport, node } from './fixtures.js';

const rejects = (report: unknown, message: string) => {
  const r = Report.safeParse(report);
  expect(r.success, 'report should be rejected').toBe(false);
  if (!r.success) expect(r.error.issues.map((i) => i.message)).toContain(message);
};

describe('Report (D-077 refinements)', () => {
  it('rejects PASS with evaluated ≠ observed ≠ expected', () =>
    rejects(fullReport([node('unit', 'PASS', { expected: 10, observed: 1, evaluated: 0 }), acceptRow()]), 'unit: PASS needs evaluated = observed = expected'));
  it('rejects accepted with no nodes', () => rejects(fullReport([]), 'accepted needs nodes'));
  it('rejects accepted beside a FAIL row', () =>
    rejects(fullReport([node('spec-tests', 'FAIL', { findings: [finding] }), node('accept', 'FAIL', { findings: [finding] })]), 'accepted needs accept PASS'));
  it('rejects accepted with a gating UNKNOWN', () =>
    rejects(fullReport([node('unit', 'UNKNOWN', { reason: 'timeout' }), acceptRow()]), 'accepted needs every node other than review PASS or SKIPPED'));
  it('rejects exit 0 with an accept FAIL', () =>
    rejects(fullReport([node('unit', 'PASS'), node('accept', 'FAIL', { findings: [finding] })], { accepted: false }), 'exit 0 needs no FAIL or UNKNOWN row other than review'));
  it('rejects cached without cacheKey', () => rejects(fullReport([node('unit', 'PASS', { cached: true }), acceptRow()]), 'unit: cached needs cacheKey'));
  it('rejects a required node that is SKIPPED (PL-15)', () =>
    rejects(fullReport([node('unit', 'SKIPPED', { evidence: 'no unit test files in affected projects', expected: 0, observed: 0, evaluated: 0 }), acceptRow(['unit'])]), 'accepted needs required node unit present and not SKIPPED'));

  it('accepts a valid accepted report with a cached PASS and a tallied review UNKNOWN', () => {
    const r = Report.safeParse(fullReport([node('unit', 'PASS', { cached: true, cacheKey: SHA256 }), node('review', 'UNKNOWN', { reason: 'family' }), acceptRow(['unit'])]));
    expect(r.success).toBe(true);
  });
  it('accepts exit 1 on a gating review FAIL with accepted false', () => {
    const r = Report.safeParse(fullReport([node('unit', 'PASS'), node('review', 'FAIL', { findings: [finding] }), acceptRow(['unit'])], { accepted: false, exitCode: 1 }));
    expect(r.success).toBe(true);
  });
  it('keeps the pre-D-077 invariants', () => {
    rejects(fullReport([acceptRow(), acceptRow()]), 'duplicate node id');
    rejects(fullReport([node('unit', 'PASS')]), 'accept row missing');
    rejects(fullReport([node('unit', 'PASS'), acceptRow()], { command: 'devai check' }), 'accepted needs a full packet run with exit 0');
  });
});

describe('NodeResult', () => {
  it('rejects FAIL without a finding and UNKNOWN without a reason', () => {
    expect(NodeResult.safeParse(node('lint', 'FAIL')).success).toBe(false);
    expect(NodeResult.safeParse(node('lint', 'UNKNOWN')).success).toBe(false);
  });
  it('rejects details that belong to another node', () => {
    expect(NodeResult.safeParse(node('lint', 'PASS', { details: { node: 'accept', requiredSet: [], deferred: [], editLoopMs: null } })).success).toBe(false);
  });
});

describe('Review (D-077, D-079)', () => {
  const review = {
    packetId: 'PKT-DEMO-004', head: SHA1, candidateDigest: SHA256, specSha256: SHA256, requirements: [], findings: [],
    verdict: 'no-blockers', inputTokens: 1, outputTokens: 1, seconds: 1, model: 'm', workerFamily: 'claude', workerTrailers: ['Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>'],
  };
  it('rejects blockers without a blocker finding', () => expect(Review.safeParse({ ...review, verdict: 'blockers' }).success).toBe(false));
  it('requires workerFamily and workerTrailers', () => {
    const { workerFamily: _f, workerTrailers: _t, ...without } = review;
    expect(Review.safeParse(without).success).toBe(false);
    expect(Review.safeParse(review).success).toBe(true);
  });
});

describe('SensorEvidence (D-083)', () => {
  const evidence = {
    packetId: 'PKT-DEMO-004', sliceDigest: SHA256, promptDigest: SHA256, model: 'm',
    output: { verdict: 'compliant', inspectedEntrypoints: [], findings: [], unresolved: [], confidence: 0.8 },
    inputTokens: 1, outputTokens: 1, seconds: 1,
  };
  it('requires minConfidence', () => {
    expect(SensorEvidence.safeParse(evidence).success).toBe(false);
    expect(SensorEvidence.safeParse({ ...evidence, minConfidence: 0.7 }).success).toBe(true);
  });
});
