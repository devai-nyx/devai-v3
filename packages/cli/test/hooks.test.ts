// 08 A.7 hooks: the three scripts are 08's bytes, and installed with `core.hooksPath scripts/hooks`
// they run `pnpm exec devai check --hook …` end to end through `git commit` and `git push` to a local
// bare remote (the staged snapshot, commitlint over the message file, the pre-push range). The
// pre-push internals (fetched base, protected-paths notices, stage line) are also run in-process with
// stub adapters, because `generated` (B.16) has no adapter yet and the built binary refuses that plan.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { sha256 } from '../src/candidate/digest.js';
import { ADAPTERS, check } from '../src/commands/check.js';
import { dataLayerChanged, fetchedBase, stageLine } from '../src/commands/hook.js';
import { Report } from '../src/report.js';
import type { NodeId } from '../src/runner/edges.js';
import type { NodeAdapter } from '../src/runner/run.js';
import { fullReport, node } from './fixtures.js';
import { toolModules } from './nodes/tools.js';
import { PACKET, packetText, SPEC_PATH } from './packets.js';
import { commitAll, gitIn, templateDir, templateWorkspace, write } from './repo.js';

const bin = resolve(import.meta.dirname, '../dist/main.js');
const law = readFileSync(resolve(import.meta.dirname, '../../../docs/framework/08-cli-and-nodes.md'), 'utf8');

describe('A.7 hook scripts', () => {
  it('are byte-identical to 08 A.7 and executable (09 §1.1 row scripts/hooks)', () => {
    const blocks = [...law.matchAll(/```sh\n(#!\/bin\/sh\n[^`]*?)```/g)].map((m) => m[1]!);
    expect(blocks).toHaveLength(3);
    for (const stage of ['pre-commit', 'pre-push', 'commit-msg']) {
      const path = resolve(templateDir, 'scripts/hooks', stage);
      const want = blocks.find((b) => b.includes(`--hook ${stage}`));
      expect(readFileSync(path, 'utf8')).toBe(want);
      expect(statSync(path).mode & 0o111).toBe(0o111);
    }
  });
});

/**
 * A template workspace whose `node_modules` holds the W2a tool install plus `devai` (the built
 * binary) on `.bin`, the 09 commitlint config, and `core.hooksPath scripts/hooks`.
 */
function hookWorkspace(): string {
  const dir = templateWorkspace({ 'tools/commitlint.config.mjs': "export default { extends: ['@commitlint/config-conventional'] };\n" });
  const tools = toolModules();
  mkdirSync(resolve(dir, 'node_modules/.bin'), { recursive: true });
  for (const e of readdirSync(tools)) if (e !== '.bin') symlinkSync(resolve(tools, e), resolve(dir, 'node_modules', e));
  // pnpm's .bin shims resolve their package from $0, so each is a wrapper that execs the installed one.
  const shims: Record<string, string> = { devai: `exec "${process.execPath}" "${bin}" "$@"` };
  for (const b of readdirSync(resolve(tools, '.bin'))) shims[b] = `exec "${resolve(tools, '.bin', b)}" "$@"`;
  for (const [b, body] of Object.entries(shims)) {
    writeFileSync(resolve(dir, 'node_modules/.bin', b), `#!/bin/sh\n${body}\n`);
    chmodSync(resolve(dir, 'node_modules/.bin', b), 0o755);
  }
  writeFileSync(resolve(dir, '.git/info/exclude'), '/node_modules\n');
  gitIn(dir, 'config', 'core.hooksPath', 'scripts/hooks');
  return dir;
}

/** `git <args>` with the test identity, hooks enabled; never throws. */
const git = (dir: string, ...args: string[]) => {
  const r = spawnSync('git', ['-c', 'user.name=devai-test', '-c', 'user.email=test@devai.local', '-c', 'commit.gpgsign=false', ...args], { cwd: dir, encoding: 'utf8', env: { ...process.env, DEVAI_RUNTIME: '', COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' } });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
};
const headOf = (dir: string) => gitIn(dir, 'rev-parse', 'HEAD').trim();

describe('A.7 end to end through git commit and git push', () => {
  let dir: string;
  beforeAll(() => {
    dir = hookWorkspace();
  }, 300_000);

  it('pre-commit checks the staged snapshot; commit-msg runs commitlint over the message file', () => {
    // PASS: a formatted file, a semantic message.
    write(dir, 'docs/note.md', '# Note\n');
    git(dir, 'add', 'docs/note.md');
    let r = git(dir, 'commit', '-m', 'docs: add a note');
    expect(r.status).toBe(0);
    expect(r.out).toContain('devai pre-commit PASS — format lint lint-tests sql-lint on the staged snapshot\nexit 0\n');
    expect(r.out).toContain('devai commit-msg PASS\nexit 0\n');
    expect(gitIn(dir, 'log', '-1', '--format=%s')).toBe('docs: add a note\n');

    // A partially staged file is checked as staged: the index holds formatted bytes, the disk does not.
    write(dir, 'docs/data.json', '{ "a": 1 }\n');
    git(dir, 'add', 'docs/data.json');
    write(dir, 'docs/data.json', '{"a":1}\n');
    r = git(dir, 'commit', '-m', 'docs: add data');
    expect(r.status).toBe(0);
    expect(r.out).toContain('devai pre-commit PASS');

    // FAIL: the staged bytes are not formatted; the commit is refused and HEAD stays.
    const head = headOf(dir);
    git(dir, 'add', 'docs/data.json');
    r = git(dir, 'commit', '-m', 'docs: reformat data');
    expect(r.status).not.toBe(0);
    expect(r.out).toContain('      docs/data.json:1  not formatted   [S-41]');
    expect(r.out).toContain('devai pre-commit FAIL — fix the lines above, git add, commit again; CI runs the same nodes\nexit 1\n');
    expect(headOf(dir)).toBe(head);
    write(dir, 'docs/data.json', '{ "a": 1 }\n');
    git(dir, 'add', 'docs/data.json');

    // FAIL: a message commitlint rejects; the commit is refused.
    write(dir, 'docs/two.md', '# Two\n');
    git(dir, 'add', 'docs/two.md');
    r = git(dir, 'commit', '-m', 'Add Two.');
    expect(r.status).not.toBe(0);
    expect(r.out).toContain('      .git/COMMIT_EDITMSG:1  type-empty: type may not be empty   [S-40]  type(scope): subject');
    expect(r.out).toContain('devai commit-msg FAIL — write type(scope): subject, scope = package or module slug; keep the trailers\nexit 1\n');
    expect(headOf(dir)).toBe(head);
    expect(git(dir, 'commit', '-m', 'docs: add two').status).toBe(0);
  });

  it('N13 through the hooks: a code packet with protected: [] whose branch touches .github/** and widens protected', () => {
    const base = headOf(dir);
    const sha = sha256(readFileSync(resolve(dir, SPEC_PATH)));
    write(dir, PACKET, packetText({ base, sha, protected: [] }));
    git(dir, 'add', PACKET);
    let r = git(dir, 'commit', '-m', 'chore(packets): add PKT-DEMO-005');
    expect(r.out).toContain('devai commit-msg PASS');
    expect(r.status).toBe(0);
    git(dir, 'checkout', '-q', '-b', 'n13');
    write(dir, '.github/workflows/ci.yml', 'on: push\n');
    write(dir, PACKET, packetText({ base, sha, protected: ['ci', 'spec'] }));
    git(dir, 'add', '-A');
    r = git(dir, 'commit', '-m', 'ci: add the workflow', '-m', 'Packet: PKT-DEMO-005');
    expect(r.status).toBe(0);

    const report = Report.parse(JSON.parse(spawnSync(process.execPath, [bin, 'check', '--packet', PACKET, '--only', 'protected-paths', '--format', 'json'], { cwd: dir, encoding: 'utf8' }).stdout));
    expect(report.nodes.find((n) => n.id === 'protected-paths')!.details).toEqual({ node: 'protected-paths', touched: [
      { class: 'spec', paths: [PACKET], declared: false },
      { class: 'ci', paths: ['.github/workflows/ci.yml'], declared: false },
    ] });

    // git push runs the pre-push hook. Until B.16 `generated` has an adapter the hook's plan is refused
    // (exit 2, `node generated arrives in a later wave`), so the push is rejected and the remote unchanged.
    const remote = resolve(dir, '../', `${dir.split('/').pop()}-remote.git`);
    gitIn(dir, 'init', '-q', '--bare', remote);
    gitIn(dir, 'remote', 'add', 'origin', remote);
    expect(git(dir, 'push', '-q', '--no-verify', 'origin', 'main').status).toBe(0);
    r = git(dir, 'push', 'origin', 'n13');
    expect(r.out).toContain('devai: usage — node generated arrives in a later wave\nexit 2\n');
    expect(r.status).not.toBe(0);
    expect(gitIn(remote, 'branch', '--list', 'n13')).toBe('');
  });
});

describe('A.7 pre-push in process (stub adapters for the nodes other waves own)', () => {
  const stubbed: NodeId[] = ['format', 'lint', 'lint-tests', 'sql-lint', 'generated', 'boundary', 'deadcode', 'openapi', 'actionlint', 'typecheck'];
  const saved = new Map<NodeId, NodeAdapter | undefined>();
  const stub = (id: NodeId): NodeAdapter => ({ id, contract: 1, configFiles: () => [], inputs: () => [], run: async () => ({ status: 'PASS', expected: 1, observed: 1, evaluated: 1, findings: [] }) });
  afterEach(() => {
    for (const [id, a] of saved) {
      if (a) ADAPTERS[id] = a;
      else delete ADAPTERS[id];
    }
  });
  const withStubs = () => {
    for (const id of stubbed) {
      saved.set(id, ADAPTERS[id]);
      ADAPTERS[id] = stub(id);
    }
  };

  it('the fetched base from the ref lines; protected-paths notices over base..HEAD; the stage line', async () => {
    withStubs();
    const ws = templateWorkspace();
    const remote = `${ws}-remote.git`;
    gitIn(ws, 'init', '-q', '--bare', remote);
    gitIn(ws, 'remote', 'add', 'origin', remote);
    gitIn(ws, 'push', '-q', 'origin', 'main');
    gitIn(ws, 'remote', 'set-head', 'origin', 'main');
    const base = headOf(ws);
    gitIn(ws, 'checkout', '-q', '-b', 'feat');
    write(ws, '.github/workflows/ci.yml', 'on: push\n');
    const head = commitAll(ws, 'ci: add the workflow');
    const zero = '0'.repeat(40);
    const stdin = `refs/heads/feat ${head} refs/heads/feat ${zero}\n`;
    expect(await fetchedBase(ws, stdin)).toBe(base); // remote sha zero: merge-base with origin/HEAD
    expect(await fetchedBase(ws, `refs/heads/feat ${head} refs/heads/feat ${base}\n`)).toBe(base); // remote sha, an ancestor
    expect(await fetchedBase(ws, `(delete) ${zero} refs/heads/x ${base}\n`)).toBeNull();

    const r = await check(['--hook', 'pre-push', 'origin', remote], { hook: 'pre-push', args: ['origin', remote], stdin }, 'text', ws);
    const lines = r.stdout.trimEnd().split('\n');
    expect(r.exitCode).toBe(0);
    expect(lines[0]).toBe(`devai check --hook pre-push origin ${remote}   runtime=bare   base=${base.slice(0, 4)}…  head=${head.slice(0, 4)}…`);
    expect(lines).toContain('protected:ci — .github/workflows/ci.yml (no packet)');
    expect(lines.at(-2)).toBe(`devai pre-push PASS — 13 nodes over ${base.slice(0, 7)}..${head.slice(0, 7)}`);

    // unresolvable base: protected-paths UNKNOWN base-unreadable (exit 2: C.2 has no non-gating UNKNOWN row)
    const u = await check(['--hook', 'pre-push'], { hook: 'pre-push', stdin: '' }, 'json', ws);
    const report = Report.parse(JSON.parse(u.stdout));
    expect(report.nodes.find((n) => n.id === 'protected-paths')).toMatchObject({ status: 'UNKNOWN', reason: 'base-unreadable' });
    expect(u.exitCode).toBe(2);
    expect(stageLine('pre-push', report)).toBe('devai pre-push UNKNOWN — protected-paths: base-unreadable; do the remedy above, then push again');
  });

  it('dataLayerChanged and the 10 §4 stage lines', () => {
    expect(dataLayerChanged(['database/ddl/00-core-bootstrap.sql'])).toBe(true);
    expect(dataLayerChanged(['domain/notes/db/x.sql', 'README.md'])).toBe(true);
    expect(dataLayerChanged(['domain/notes/api/src/notes.repository.ts'])).toBe(true);
    expect(dataLayerChanged(['domain/notes/api/src/notes.service.ts'])).toBe(false);
    const rep = (exitCode: number, nodes: unknown[]) => Report.parse(fullReport(nodes, { accepted: false, exitCode, command: 'devai check --hook pre-commit' }));
    const pass = rep(0, [node('format', 'PASS'), node('accept', 'PASS', { details: { node: 'accept', requiredSet: [], deferred: [], editLoopMs: null } })]);
    expect(stageLine('commit-msg', pass)).toBe('devai commit-msg PASS');
    const unknown = rep(2, [node('lint', 'UNKNOWN', { reason: 'tooling-missing' }), node('accept', 'UNKNOWN', { reason: 'tooling-missing' })]);
    expect(stageLine('pre-commit', unknown)).toBe('devai pre-commit UNKNOWN — lint: tooling-missing; do the remedy above, then commit again');
    const both = rep(1, [node('format', 'FAIL', { findings: [{ locator: 'a.md:1', message: 'm', standard: 'S-41', hint: 'h' }] }), node('lint', 'UNKNOWN', { reason: 'timeout' }), node('accept', 'FAIL', { findings: [{ locator: 'format', message: 'm', standard: 'S-65', hint: 'h' }] })]);
    expect(stageLine('pre-push', both)).toBe('devai pre-push FAIL — fix the lines above, commit, push again; CI runs the same nodes');
  });
});
