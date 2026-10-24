// 02 §11, 08 A.3 Writes, B.24/B.27 Status and C.4 rows "Layout" and ".devai/review/": the two tracked
// evidence files and the gitignored verdict cache. CI never calls a model (C.1, D-037): it recomputes
// the digests from the PR head and reports the file's verdict, or `UNKNOWN: stale` when the file is
// missing or malformed, belongs to another packet, or is bound to other digests; the sensor file is also
// stale when its `minConfidence` differs from the head's `devai.json` or `output.confidence` is below it
// (D-083). This is freshness, not provenance: matching digests do not prove a reviewer ran (D-037).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { z } from 'zod';
import { Review, SensorEvidence } from '../report.js';

export const REVIEW_DIR = '.devai/review';
export const reviewPath = (packetId: string): string => `${REVIEW_DIR}/${packetId}.json`;
export const sensorPath = (packetId: string): string => `${REVIEW_DIR}/${packetId}.permissions.json`;

export type ReviewFile = z.infer<typeof Review>;
export type SensorFile = z.infer<typeof SensorEvidence>;

/** C.1 "CI": the Action runs with `CI=true` (GitHub Actions sets it); there the model nodes verify, never call. */
export const ciMode = (env: NodeJS.ProcessEnv = process.env): boolean => env['CI'] === 'true';

const writeJson = (root: string, path: string, value: unknown): void => {
  const abs = resolve(root, path);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(value, null, 2) + '\n');
};

export const writeReview = (root: string, v: ReviewFile): void => writeJson(root, reviewPath(v.packetId), Review.parse(v));
export const writeSensor = (root: string, v: SensorFile): void => writeJson(root, sensorPath(v.packetId), SensorEvidence.parse(v));

/** `.devai/cache/agentic/<node>/<digest>.json`: the validated model output (02 §11 verdict cache). */
export const writeVerdict = (root: string, node: 'permissions-pattern' | 'review', digest: string, value: unknown): void =>
  writeJson(root, `.devai/cache/agentic/${node}/${digest}.json`, value);

export type Read<T> = { kind: 'ok'; value: T } | { kind: 'stale'; message: string };

function readEvidence<T>(root: string, path: string, schema: z.ZodType<T>): Read<T> {
  let text: string;
  try {
    text = readFileSync(resolve(root, path), 'utf8');
  } catch {
    return { kind: 'stale', message: `${path} is missing` };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { kind: 'stale', message: `${path} is not JSON` };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) return { kind: 'stale', message: `${path} is malformed: ${parsed.error.issues[0]?.message ?? 'invalid'} at ${parsed.error.issues[0]?.path.join('.') ?? ''}` };
  return { kind: 'ok', value: parsed.data };
}

export interface SensorBinding { packetId: string; sliceDigest: string; promptDigest: string; minConfidence: number }

/** B.24 Status (CI), D-083. */
export function verifySensor(root: string, b: SensorBinding): Read<SensorFile> {
  const r = readEvidence(root, sensorPath(b.packetId), SensorEvidence);
  if (r.kind === 'stale') return r;
  const v = r.value;
  if (v.packetId !== b.packetId) return { kind: 'stale', message: `evidence is for ${v.packetId}, not ${b.packetId}` };
  if (v.sliceDigest !== b.sliceDigest) return { kind: 'stale', message: `slice digest ${v.sliceDigest.slice(0, 12)}… ≠ the head's ${b.sliceDigest.slice(0, 12)}…` };
  if (v.promptDigest !== b.promptDigest) return { kind: 'stale', message: `prompt digest ${v.promptDigest.slice(0, 12)}… ≠ the CLI's ${b.promptDigest.slice(0, 12)}…` };
  if (v.minConfidence !== b.minConfidence) return { kind: 'stale', message: `judged with minConfidence ${v.minConfidence}; devai.json at the head has ${b.minConfidence}` };
  if (v.output.confidence < b.minConfidence) return { kind: 'stale', message: `confidence ${v.output.confidence} < minConfidence ${b.minConfidence}` };
  return r;
}

export interface ReviewBinding { packetId: string; candidateDigest: string; specSha256: string | null }

/** B.27 Status (CI): `stale` when `candidateDigest` ≠ the PR head's digest (and when the file is absent or malformed). */
export function verifyReview(root: string, b: ReviewBinding): Read<ReviewFile> {
  const r = readEvidence(root, reviewPath(b.packetId), Review);
  if (r.kind === 'stale') return r;
  const v = r.value;
  if (v.packetId !== b.packetId) return { kind: 'stale', message: `evidence is for ${v.packetId}, not ${b.packetId}` };
  if (v.candidateDigest !== b.candidateDigest) return { kind: 'stale', message: `review.json candidateDigest ${v.candidateDigest.slice(0, 12)}… ≠ the head's ${b.candidateDigest.slice(0, 12)}…` };
  if (v.specSha256 !== b.specSha256) return { kind: 'stale', message: `review.json specSha256 ≠ the packet's` };
  return r;
}
