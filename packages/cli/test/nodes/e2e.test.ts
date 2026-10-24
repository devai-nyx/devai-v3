// 08 B.23 `e2e` through `devai check --only e2e --format json` with @playwright/test 1.60.0 from the registry
// (07 §2 pin). Browserless tests observe the node without provisioned browsers; a `page` test with an
// empty PLAYWRIGHT_BROWSERS_PATH is the browsers-missing case (07 §5).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { templateWorkspace } from '../repo.js';
import { linkTools, toolsFor } from './helpers.js';
import { check, fakeBin } from './w3.js';

let tools: string;
beforeAll(() => { tools = toolsFor({ '@playwright/test': '1.60.0' }); }, 300_000);

const CONFIG = "import { defineConfig } from '@playwright/test';\nexport default defineConfig({ testDir: 'test/e2e', testMatch: ['**/*.e2e.spec.ts', '**/*.playwright.ts'], timeout: 2000 });\n";
const SPEC = 'test/e2e/notes.e2e.spec.ts';
const head = "import { expect, test } from '@playwright/test';\n";

function workspace(spec: string, extra: Record<string, string> = {}, link = true): string {
  const dir = templateWorkspace({ 'playwright.config.ts': CONFIG, [SPEC]: head + spec, ...extra });
  if (link) linkTools(dir, tools);
  return dir;
}

describe('B.23 e2e', () => {
  it('PASS: every collected test passed (expected = observed = evaluated)', () => {
    const { row } = check(workspace("test('lists notes', () => { expect(1).toBe(1); });\ntest('opens a note', () => { expect(2).toBe(2); });\n"), 'e2e');
    expect(row).toMatchObject({ status: 'PASS', expected: 2, observed: 2, evaluated: 2 });
  });

  it('FAIL: a failed test, B.23 form; a timed-out test counts as failed', () => {
    const { row } = check(workspace("test('lists notes', () => {\n  expect(1).toBe(2);\n});\ntest('hangs', async () => { await new Promise((r) => setTimeout(r, 10000)); });\n"), 'e2e');
    expect(row).toMatchObject({ status: 'FAIL', expected: 2, observed: 2, evaluated: 2 });
    expect(row.findings[0]).toMatchObject({ locator: `${SPEC}:2`, standard: 'tiers', hint: 'fix the flow' });
    expect(row.findings[0]!.message).toMatch(/^lists notes: Error: expect\(received\)\.toBe\(expected\)/);
    expect(row.findings[1]!.message).toMatch(/^hangs: Test timeout of 2000ms exceeded/);
  });

  it('UNKNOWN browsers-missing: a page test without provisioned browsers (remedy pnpm exec playwright install)', () => {
    const empty = mkdtempSync(resolve(tmpdir(), 'devai-no-browsers-'));
    const { row } = check(workspace("test('renders', async ({ page }) => { await page.goto('about:blank'); });\n"), 'e2e', { PLAYWRIGHT_BROWSERS_PATH: empty });
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'browsers-missing' });
    expect(row.findings[0]).toMatchObject({ locator: `${SPEC}:2`, hint: 'pnpm exec playwright install' });
  });

  it('UNKNOWN tooling-missing: no node_modules/.bin/playwright', () => {
    const { row } = check(workspace("test('x', () => {});\n", {}, false), 'e2e');
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing' });
    expect(row.findings[0]!.hint).toBe('install with pnpm add -D @playwright/test@1.60.0');
  });

  it('UNKNOWN runner-crashed (D-086): a config that does not load exits 1 without the JSON report', () => {
    const { row } = check(workspace("test('x', () => {});\n", { 'playwright.config.ts': 'export default {\n' }), 'e2e');
    expect(row).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed', findings: [{ locator: 'playwright.config.ts:1' }] });
  });

  it('UNKNOWN runner-crashed: a playwright that exits without output', () => {
    const dir = workspace("test('x', () => {});\n", {}, false);
    fakeBin(dir, 'playwright', 1, 'playwright: killed');
    expect(check(dir, 'e2e').row).toMatchObject({ status: 'UNKNOWN', reason: 'runner-crashed', findings: [{ message: 'playwright: killed' }] });
  });

  it('SKIPPED with the 05 §3 string without test/e2e files', () => {
    expect(check(templateWorkspace(), 'e2e').row).toMatchObject({ status: 'SKIPPED', evidence: 'no test/e2e files' });
  });
});
