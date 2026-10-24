// 08 C.4 `resultDigest`: sha256 of the NodeResult JSON with durationMs, cached and cacheKey removed,
// findings sorted by locator then message, keys in canonical (sorted) order.
import type { z } from 'zod';
import { sha256 } from '../candidate/digest.js';
import type { NodeResult } from '../report.js';

export type NodeRow = z.infer<typeof NodeResult>;

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** JSON with object keys sorted at every depth; array order kept. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => cmp(a, b));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function resultDigest(row: NodeRow): string {
  const { durationMs: _d, cached: _c, cacheKey: _k, ...rest } = row;
  const findings = [...rest.findings].sort((a, b) => cmp(a.locator, b.locator) || cmp(a.message, b.message));
  return sha256(canonicalJson({ ...rest, findings }));
}
