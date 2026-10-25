// 08 B.15 `commitlint` against @commitlint/cli 21.2.2 as installed: the range form over `base..HEAD`,
// the message-file form W4's commit-msg hook calls, and D-086's pre-flight of config, message file and
// git root (commitlint exits 1 for each of those as for a violation).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { commitlint, lintMessageFile } from '../../src/nodes/commitlint.js';
import { Report } from '../../src/report.js';
import type { RunContext } from '../../src/runner/run.js';
import { commitAll, gitIn } from '../repo.js';
import { contextOf, devaiCheck, fakeTool, toolModules, workspace, write } from './tools.js';

const CONFIG = { 'tools/commitlint.config.mjs': "export default { extends: ['@commitlint/config-conventional'] };\n" };

/** A workspace whose `base` is the first commit, followed by one commit per message. */
function history(messages: string[], base: Record<string, string> = CONFIG, modules: string | null = toolModules()): { dir: string; base: string; shas: string[] } {
  const dir = workspace(base, {}, modules);
  const first = gitIn(dir, 'rev-parse', 'HEAD').trim();
  const shas = messages.map((m, i) => {
    write(dir, `f${i}.txt`, `${i}\n`);
    return commitAll(dir, m);
  });
  return { dir, base: first, shas };
}
const runRange = async (h: { dir: string; base: string }) => commitlint.run(await contextOf(h.dir, 'commitlint', h.base));

describe('B.15 commitlint', () => {
  beforeAll(() => void toolModules(), 300_000);

  it('PASS: every commit in base..HEAD is a semantic commit', async () => {
    expect(await runRange(history(['feat(core): add thing', 'fix: repair it']))).toEqual({ status: 'PASS', expected: 2, observed: 2, evaluated: 2, findings: [] });
  });

  it('FAIL: "<sha>:1 <rule>: <message> [S-40] type(scope): subject", parsed from the text output', async () => {
    const h = history(['bad message', 'feat(core): add thing', 'Fix: Something.']);
    const o = await runRange(h);
    const f = (sha: string, rule: string, message: string) => ({ locator: `${sha}:1`, message: `${rule}: ${message}`, standard: 'S-40', hint: 'type(scope): subject' });
    expect(o).toEqual({
      status: 'FAIL', expected: 3, observed: 3, evaluated: 3,
      findings: [
        f(h.shas[2]!, 'subject-case', 'subject must not be sentence-case'),
        f(h.shas[2]!, 'subject-full-stop', 'subject may not end with full stop'),
        f(h.shas[2]!, 'type-case', 'type must be lower-case'),
        f(h.shas[2]!, 'type-enum', 'type must be one of [build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test]'),
        f(h.shas[0]!, 'subject-empty', 'subject may not be empty'),
        f(h.shas[0]!, 'type-empty', 'type may not be empty'),
      ],
    });
  });

  it('the message-file form: PASS, FAIL at the message file, UNKNOWN io when it is unreadable', async () => {
    const h = history([]);
    const ctx = await contextOf(h.dir, 'commitlint');
    write(h.dir, '.git/MSG_OK', 'feat(notes): add notes\n');
    write(h.dir, '.git/MSG_BAD', 'notes\n');
    expect(await lintMessageFile(ctx, '.git/MSG_OK')).toEqual({ status: 'PASS', expected: 1, observed: 1, evaluated: 1, findings: [] });
    expect((await lintMessageFile(ctx, '.git/MSG_BAD')).findings[0]).toEqual({ locator: '.git/MSG_BAD:1', message: 'subject-empty: subject may not be empty', standard: 'S-40', hint: 'type(scope): subject' });
    expect(await lintMessageFile(ctx, '.git/NOPE')).toEqual({
      status: 'UNKNOWN', reason: 'io', expected: 1, observed: 0, evaluated: 0,
      findings: [{ locator: '.git/NOPE:1', message: 'message file is not readable', standard: 'S-40', hint: 'make the path readable (permissions, broken or escaping symlink), then re-run' }],
    });
  });

  it('UNKNOWN pre-flight: lint-config-failed (missing, unparseable) and not-a-repository, without invoking', async () => {
    expect(await runRange(history(['feat: x'], {}))).toMatchObject({ status: 'UNKNOWN', reason: 'lint-config-failed', findings: [{ locator: 'tools/commitlint.config.mjs:1', message: 'config file is missing or unreadable', standard: 'S-40', hint: 'the config at the locator did not load; fix it in a standards packet' }] });
    expect(await runRange(history(['feat: x'], { 'tools/commitlint.config.mjs': 'export default {\n' }))).toMatchObject({ status: 'UNKNOWN', reason: 'lint-config-failed', findings: [{ locator: 'tools/commitlint.config.mjs:1', message: "config does not parse: '}' expected." }] });
    const outside = mkdtempSync(resolve(tmpdir(), 'devai-w2a-norepo-'));
    write(outside, 'MSG', 'feat: x\n');
    expect(await lintMessageFile({ root: outside } as RunContext, 'MSG')).toMatchObject({ status: 'UNKNOWN', reason: 'not-a-repository', findings: [{ message: 'not inside a git work tree', standard: 'S-40' }] });
  });

  it('UNKNOWN tooling-missing, and runner-crashed on exit 1 without a parseable violation', async () => {
    expect(await runRange(history(['feat: x'], CONFIG, null))).toMatchObject({
      status: 'UNKNOWN', reason: 'tooling-missing', expected: 1, findings: [{ locator: 'package.json:1', message: 'commitlint not resolvable from node_modules/.bin', standard: 'S-19', hint: 'install with pnpm add -w -D --save-exact @commitlint/cli@21.2.2 @commitlint/config-conventional@21.2.2 && pnpm install' }],
    });
    expect(await runRange(history(['feat: x'], CONFIG, fakeTool('commitlint', 1)))).toMatchObject({
      status: 'UNKNOWN', reason: 'runner-crashed', expected: 1, findings: [{ locator: 'tools/commitlint.config.mjs:1', message: 'boom: the tool fell over', standard: 'S-40' }],
    });
  });

  it('SKIPPED without --packet (population 0, B.1 table), in a C.2-valid report on the template workspace', () => {
    const r = devaiCheck(workspace(CONFIG, {}, toolModules(), true), 'commitlint');
    const report = Report.parse(JSON.parse(r.stdout));
    expect(report.nodes.find((n) => n.id === 'commitlint')).toMatchObject({ status: 'SKIPPED', evidence: 'no commits between base and HEAD' });
    expect(r.status).toBe(0);
  });
});
