// 10 §3 prompts byte for byte; the D-079 family rule; A.8 / D-074 reviewer selection; dispositions;
// the evidence files' trust boundary (devai-v3#35: stale candidate, changed prompt or config, missing
// or malformed evidence) and D-083's threshold re-application.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { reviewPath, sensorPath, verifyReview, verifySensor, writeReview, writeSensor } from '../../src/model/evidence.js';
import { dispositions, rangeFamily, reviewerFor, sensorReviewerFor, trailerFamily } from '../../src/model/packet.js';
import { PHASE1, PHASE2, SENSOR } from '../../src/model/prompts.js';
import { templateConfig } from '../fixtures.js';

const law10 = readFileSync(resolve(import.meta.dirname, '../../../../docs/framework/10-agent-surface.md'), 'utf8');
const lawBlock = (name: string): string => {
  const at = law10.indexOf(`<!-- text: ${name} -->`);
  const open = law10.indexOf('````text\n', at) + '````text\n'.length;
  return law10.slice(open, law10.indexOf('\n````', open)) + '\n';
};
const law02 = readFileSync(resolve(import.meta.dirname, '../../../../docs/framework/02-architecture.md'), 'utf8');

describe('10 §3 prompts', () => {
  it.each([['reviewer-phase-1', PHASE1], ['reviewer-phase-2', PHASE2], ['sensor', SENSOR]])('%s is the law block byte for byte', (name, text) => expect(text).toBe(lawBlock(name)));
  it("the sensor's question is 02 §4's (D-025)", () => {
    const question = SENSOR.split('\n').at(-2)!;
    const q02 = law02.slice(law02.indexOf('> Every protected route'), law02.indexOf('\n\n', law02.indexOf('> Every protected route'))).split('\n').map((l) => l.replace(/^> ?/, '')).join(' ');
    expect(question).toBe(q02);
  });
});

describe('worker family (B.27 Inputs, D-079)', () => {
  it('each trailer by the two regexes', () => {
    expect(trailerFamily('Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>')).toBe('claude');
    expect(trailerFamily('Co-Authored-By: GPT-6 Codex <codex@openai.com>')).toBe('gpt');
    expect(trailerFamily('Co-Authored-By: Antonio <a@b.c>')).toBe('unknown');
  });
  it('N17: two families in base..HEAD is mixed; none is unknown; one value is that value', () => {
    expect(rangeFamily(['Co-Authored-By: Claude x', 'Co-Authored-By: GPT y'])).toBe('mixed');
    expect(rangeFamily(['Co-Authored-By: Claude x', 'Co-Authored-By: Bob'])).toBe('mixed');
    expect(rangeFamily([])).toBe('unknown');
    expect(rangeFamily(['Co-Authored-By: Claude x', 'Co-Authored-By: claude y'])).toBe('claude');
  });
  it('review takes the family\'s reviewer, never a fallback; the sensor falls back in Family order (D-074)', () => {
    const c = templateConfig();
    expect(reviewerFor(c, 'claude')).toBe('codex exec --model gpt-6-astra');
    expect(reviewerFor(c, 'unknown')).toBeNull();
    expect(reviewerFor(c, 'mixed')).toBeNull();
    expect(sensorReviewerFor(c, 'unknown')).toBe('codex exec --model gpt-6-astra');
    expect(sensorReviewerFor({ ...c, review: { mustRun: false, reviewers: { gpt: 'claude -p' } } }, 'unknown')).toBe('claude -p');
    expect(sensorReviewerFor(c, 'mixed')).toBeNull();
  });
});

describe('review dispositions (02 §9)', () => {
  it('reads the RV lines of the section only', () => {
    const text = '## Notes\nRV aaaaaaaaaaaa · R-1 · a.ts:1 · not-a-defect · no\n## Review dispositions\nRV ac9f878d7da8 · R-4 · domain/notes/api/src/notes.service.ts:41 · not-a-defect · R-4 requires 404\nRV 0123 · R-1 · x:1 · not-a-defect · too short\n';
    expect(dispositions(text)).toEqual([{ prefix: 'ac9f878d7da8', requirement: 'R-4', locator: 'domain/notes/api/src/notes.service.ts:41', disposition: 'not-a-defect', reason: 'R-4 requires 404' }]);
  });
});

const SHA = (c: string) => c.repeat(64);
const sensor = (over: Record<string, unknown> = {}) => ({
  packetId: 'PKT-DEMO-004', sliceDigest: SHA('a'), promptDigest: SHA('b'), model: 'gpt-6-astra',
  output: { verdict: 'compliant' as const, inspectedEntrypoints: ['NotesController.get'], findings: [], unresolved: [], confidence: 0.8 },
  inputTokens: 1, outputTokens: 1, seconds: 1, minConfidence: 0.7, ...over,
});
const reviewFile = (over: Record<string, unknown> = {}) => ({
  packetId: 'PKT-DEMO-004', head: 'b'.repeat(40), candidateDigest: SHA('c'), specSha256: SHA('d'),
  requirements: [{ id: 'R-1', implemented: 'yes' as const, tested: 'yes' as const, locators: ['a.ts:1'] }], findings: [], verdict: 'no-blockers' as const,
  inputTokens: 1, outputTokens: 1, seconds: 1, model: 'm', workerFamily: 'claude' as const, workerTrailers: ['Co-Authored-By: Claude'], ...over,
});
const bind = { packetId: 'PKT-DEMO-004', sliceDigest: SHA('a'), promptDigest: SHA('b'), minConfidence: 0.7 };

describe('sensor evidence trust boundary (B.24 CI, D-083, devai-v3#35)', () => {
  const dir = () => mkdtempSync(resolve(tmpdir(), 'devai-w5-ev-'));
  it('matching digests and threshold → the file', () => {
    const d = dir();
    writeSensor(d, sensor());
    expect(verifySensor(d, bind)).toMatchObject({ kind: 'ok' });
    expect(JSON.parse(readFileSync(resolve(d, sensorPath('PKT-DEMO-004')), 'utf8')).minConfidence).toBe(0.7);
  });
  it.each([
    ['missing evidence', (d: string) => d, bind, /is missing/],
    ['malformed evidence (not JSON)', (d: string) => { mkdirSync(resolve(d, '.devai/review'), { recursive: true }); writeFileSync(resolve(d, sensorPath('PKT-DEMO-004')), '{'); return d; }, bind, /not JSON/],
    ['malformed evidence (schema)', (d: string) => { writeSensor(d, sensor()); const p = resolve(d, sensorPath('PKT-DEMO-004')); const j = JSON.parse(readFileSync(p, 'utf8')); delete j.minConfidence; writeFileSync(p, JSON.stringify(j)); return d; }, bind, /malformed/],
    ['stale slice (candidate changed the slice)', (d: string) => { writeSensor(d, sensor()); return d; }, { ...bind, sliceDigest: SHA('e') }, /slice digest/],
    ['changed prompt', (d: string) => { writeSensor(d, sensor()); return d; }, { ...bind, promptDigest: SHA('f') }, /prompt digest/],
    ['N20: changed config, minConfidence 0.7 → 0.9 with confidence 0.8', (d: string) => { writeSensor(d, sensor()); return d; }, { ...bind, minConfidence: 0.9 }, /minConfidence 0.7; devai.json at the head has 0.9/],
    ['fabricated low confidence', (d: string) => { writeSensor(d, sensor({ output: { ...sensor().output, confidence: 0 } })); return d; }, bind, /confidence 0 < minConfidence 0.7/],
  ])('%s → stale', (_, setup, b, message) => {
    const r = verifySensor(setup(dir()), b);
    expect(r.kind).toBe('stale');
    expect((r as { message: string }).message).toMatch(message);
  });
});

describe('review evidence trust boundary (B.27 CI, devai-v3#35)', () => {
  const dir = () => mkdtempSync(resolve(tmpdir(), 'devai-w5-ev-'));
  const b = { packetId: 'PKT-DEMO-004', candidateDigest: SHA('c'), specSha256: SHA('d') };
  it('matching candidate digest → the file', () => {
    const d = dir();
    writeReview(d, reviewFile());
    expect(verifyReview(d, b)).toMatchObject({ kind: 'ok', value: { workerFamily: 'claude' } });
  });
  it.each([
    ['missing', (d: string) => d, b, /missing/],
    ['malformed (verdict blockers without a blocker finding)', (d: string) => { mkdirSync(resolve(d, '.devai/review'), { recursive: true }); writeFileSync(resolve(d, reviewPath('PKT-DEMO-004')), JSON.stringify(reviewFile({ verdict: 'blockers' }))); return d; }, b, /malformed/],
    ['stale candidate', (d: string) => { writeReview(d, reviewFile()); return d; }, { ...b, candidateDigest: SHA('9') }, /candidateDigest/],
    ['another packet', (d: string) => { writeReview(d, reviewFile()); return d; }, { ...b, packetId: 'PKT-DEMO-005' }, /missing/],
  ])('%s → stale', (_, setup, bb, message) => {
    const r = verifyReview(setup(dir()), bb);
    expect(r.kind).toBe('stale');
    expect((r as { message: string }).message).toMatch(message);
  });
});
