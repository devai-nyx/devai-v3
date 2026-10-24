// 08 B.11 / B.22 counting over a C.5 census (D-081): one observation = one case that ran to `passed` or
// `failed`; `expected` = cases collected across the expected files; a skipped or pending case is collected
// but not observed, a shortfall `FAIL` naming the case; a collected case with no result at run end is
// `runner-crashed`; a module that fails to import is a candidate defect (`FAIL`); a hook or worker failure
// is `setup-failed` (C.5).
import { realpathSync } from 'node:fs';
import { isAbsolute, relative } from 'node:path';
import type { Finding, Unknown } from '../ts/outcome.js';
import { HINTS } from '../text/hints.js';
import { type Census, type Case, type EventError, firstMessageLine } from './census.js';

export interface Tally {
  expected: number;
  observed: number;
  evaluated: number;
  findings: Finding[];
  unknowns: Unknown[];
}

export const emptyTally = (): Tally => ({ expected: 0, observed: 0, evaluated: 0, findings: [], unknowns: [] });
export const countsOf = (t: Tally) => ({ expected: t.expected, observed: t.observed, evaluated: t.evaluated });

/** The error's first frame as `<repo path>:<line>` when it lies in the repository outside node_modules. */
const locatorOfError = (root: string, e: EventError | undefined, fallback: string): string => {
  const top = e?.stacks[0];
  if (!top) return fallback;
  const rel = relative(realpathSync(root), top.file);
  return rel.startsWith('..') || isAbsolute(rel) || rel.includes('node_modules/') ? fallback : `${rel}:${top.line}`;
};

/** Adds one tier run's census over `files` (repo-relative) to `t`; `failure` renders a failed case's finding. */
export function tally(t: Tally, root: string, census: Census, files: readonly string[], failure: (file: string, c: Case) => Finding): void {
  for (const file of files) {
    const m = census.modules.get(file);
    if (!m) {
      t.findings.push({ locator: `${file}:1`, message: 'not collected: vitest.config.ts did not select the file for its tier', standard: 'tests', hint: 'put the file where the tier glob expects it (04 §4)' });
      continue;
    }
    if (m.importError) {
      t.findings.push({ locator: `${file}:1`, message: `collection failed: ${firstMessageLine(m.importError)}`, standard: 'tests', hint: 'fix the import' });
      continue;
    }
    if (m.hookError) t.unknowns.push({ reason: 'setup-failed', finding: { locator: locatorOfError(root, m.hookError, `${file}:1`), message: `setup failed: ${firstMessageLine(m.hookError)}`, standard: 'tests', hint: HINTS['setup-failed'] } });
    for (const c of m.cases) {
      t.expected++;
      if (c.state === undefined) {
        t.unknowns.push({ reason: 'runner-crashed', finding: { locator: `${file}:${c.line}`, message: `${c.fullName}: no result at run end`, standard: 'tests', hint: HINTS['runner-crashed'] } });
      } else if (c.state === 'passed' || c.state === 'failed') {
        t.observed++;
        t.evaluated++;
        if (c.state === 'failed') t.findings.push(failure(file, c));
      } else if (!m.hookError) {
        // D-081: S-64's issue reference satisfies test-integrity, not this node. (A case skipped because its
        // module's hook failed is reported by that hook's setup-failed instead.)
        t.findings.push({ locator: `${file}:${c.line}`, message: `${c.fullName}: skipped`, standard: 'S-64', hint: 'make it run or delete the case' });
      }
    }
  }
  for (const e of census.unhandled) {
    t.unknowns.push({ reason: 'setup-failed', finding: { locator: locatorOfError(root, e, 'vitest.config.ts:1'), message: `unhandled error: ${firstMessageLine(e)}`, standard: 'tests', hint: HINTS['setup-failed'] } });
  }
}
