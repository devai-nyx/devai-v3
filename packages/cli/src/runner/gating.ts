// A.3 / C.2 prose (D-028, D-058, D-078): gating is derived, never stored. A row gates unless it is
// `review` while `review.mustRun` is false and `protected-paths` reports no `declared: false` class.
import type { DevaiConfig } from '../config.js';
import type { NodeRow } from '../cache/result-digest.js';

export function undeclaredProtectedTouch(rows: readonly NodeRow[]): boolean {
  const pp = rows.find((r) => r.id === 'protected-paths');
  return pp?.details?.node === 'protected-paths' && pp.details.touched.some((t) => t.declared === false);
}

export function gates(row: NodeRow, config: DevaiConfig, rows: readonly NodeRow[]): boolean {
  if (row.id !== 'review') return true;
  return config.review.mustRun || undeclaredProtectedTouch(rows);
}

/** 02 §8 / A.3: 1 on a gating FAIL; 2 on a gating UNKNOWN (or a command-level reason); else 0. */
export function exitCodeOf(rows: readonly NodeRow[], config: DevaiConfig, commandReason: boolean): 0 | 1 | 2 {
  if (commandReason) return 2;
  const gating = rows.filter((r) => gates(r, config, rows));
  if (gating.some((r) => r.status === 'FAIL')) return 1;
  if (gating.some((r) => r.status === 'UNKNOWN')) return 2;
  return 0;
}
