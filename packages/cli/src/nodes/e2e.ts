// 08 B.23 `e2e` (R6 W3): `playwright test --config playwright.config.ts --reporter json` (1.60.0). One
// observation = one test with a terminal status (`passed`, `failed`, `timedOut`, `skipped`); `evaluated` =
// passed or failed, `timedOut` counting as failed; `interrupted` is not terminal (`runner-crashed`).
// Browsers are provisioned beforehand (07 §5): a launch that finds no browser executable is
// `UNKNOWN: browsers-missing`. JSON shape [fact: probe of @playwright/test 1.60.0, 2026-10-24: top-level
// `config.rootDir`, `suites[].specs[].tests[].results[].status`, `errors[]`; spec `file` relative to `rootDir`].
import { relative, resolve } from 'node:path';
import { E2E_FILE } from './inventory.js';
import { runTool, type Unknown } from '../proc/tool.js';
import type { NodeAdapter, NodeOutcome } from '../runner/run.js';
import { type Finding, outcome } from '../ts/outcome.js';
import { HINTS } from '../text/hints.js';

const CONFIG = 'playwright.config.ts';
const ANSI = /\u001b\[[0-9;]*m/g;

interface PwResult { status: string; error?: { message?: string }; errors?: { message?: string }[] }
interface PwSpec { title: string; file: string; line: number; tests: { results: PwResult[] }[] }
interface PwSuite { specs?: PwSpec[]; suites?: PwSuite[] }
interface PwReport { config: { rootDir: string }; suites: PwSuite[]; errors: { message?: string }[] }

const specsOf = (s: PwSuite): PwSpec[] => [...(s.specs ?? []), ...(s.suites ?? []).flatMap(specsOf)];
const firstLine = (m: string | undefined): string => (m ?? '').replace(ANSI, '').split('\n').map((l) => l.trim()).find((l) => l !== '') ?? 'no message';

export const e2e: NodeAdapter = {
  id: 'e2e',
  contract: 1,
  configFiles: () => [CONFIG],
  inputs: (ctx) => ctx.listing.entries.map((e) => e.path).filter((p) => E2E_FILE.test(p) || /^apps\//.test(p)).sort(),
  async run(ctx): Promise<NodeOutcome> {
    const r = await runTool<PwReport>({
      root: ctx.root, bin: 'playwright', install: 'pnpm add -w -D @playwright/test@1.60.0 && pnpm install', args: ['test', '--config', CONFIG, '--reporter', 'json'],
      locator: `${CONFIG}:1`, standard: 'tiers', timeoutMs: 1_800_000,
      parse: (stdout) => {
        try {
          const j = JSON.parse(stdout) as PwReport;
          return j && typeof j.config?.rootDir === 'string' && Array.isArray(j.suites) ? j : null;
        } catch {
          return null;
        }
      },
    });
    if (r.kind === 'unknown') return outcome({ expected: 0, observed: 0, evaluated: 0 }, [], [r.unknown]);
    const base = relative(resolve(ctx.root), r.value.config.rootDir);
    const at = (s: PwSpec) => `${base ? `${base}/` : ''}${s.file}:${s.line}`;
    const findings: Finding[] = [];
    const unknowns: Unknown[] = [];
    let expected = 0;
    let observed = 0;
    let evaluated = 0;
    for (const spec of r.value.suites.flatMap(specsOf)) {
      for (const t of spec.tests) {
        expected++;
        const last = t.results[t.results.length - 1];
        const status = last?.status;
        const message = firstLine(last?.error?.message ?? last?.errors?.[0]?.message);
        if (status === 'interrupted' || status === undefined) {
          unknowns.push({ reason: 'runner-crashed', finding: { locator: at(spec), message: `${spec.title}: ${status ?? 'no result'}`, standard: 'tiers', hint: HINTS['runner-crashed'] } });
          continue;
        }
        observed++;
        if (status === 'skipped') {
          findings.push({ locator: at(spec), message: `${spec.title}: skipped`, standard: 'tiers', hint: 'make it run or delete the case' });
          continue;
        }
        evaluated++;
        if (status === 'passed') continue;
        if (/Executable doesn't exist|browserType\.launch/.test(message)) {
          unknowns.push({ reason: 'browsers-missing', finding: { locator: at(spec), message: `${spec.title}: ${message}`, standard: '07 §5', hint: HINTS['browsers-missing'] } });
          continue;
        }
        findings.push({ locator: at(spec), message: `${spec.title}: ${message}`, standard: 'tiers', hint: 'fix the flow' });
      }
    }
    // Errors outside any test (a webServer that did not start, a global setup) leave the app unstarted.
    for (const e of r.value.errors ?? []) unknowns.push({ reason: 'setup-failed', finding: { locator: `${CONFIG}:1`, message: firstLine(e.message), standard: 'tiers', hint: HINTS['setup-failed'] } });
    return outcome({ expected, observed, evaluated }, findings, unknowns);
  },
};
