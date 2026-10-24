// 08 B.24 `permissions-pattern` and B.27 `review` end to end over a temp workspace, with the fake CLIs
// of test/model/fake.ts on PATH: PASS, FAIL, UNKNOWN (tooling-missing, capability-missing, stale and the
// rest of each Status row) and SKIPPED; 09 §4 cells N17, N19, N20. Until W4 lands `--packet`, the packet
// facts are set on the RunContext directly, as W4 will set them.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { digestOf, sha256, workingTree } from '../../src/candidate/digest.js';
import { CacheStore } from '../../src/cache/store.js';
import { CODEX_CONFINE } from '../../src/model/cli.js';
import { reviewPath, sensorPath } from '../../src/model/evidence.js';
import type { PacketFacts } from '../../src/model/packet.js';
import { runInventory } from '../../src/nodes/inventory.js';
import { permissionsPattern } from '../../src/nodes/permissions-pattern.js';
import { fingerprint, review } from '../../src/nodes/review.js';
import { NodeResult, Review, SensorEvidence } from '../../src/report.js';
import { exitCodeOf } from '../../src/runner/gating.js';
import { plan } from '../../src/runner/plan.js';
import { keyOf, type NodeAdapter, type NodeOutcome, rewriteNoObservations, runPlan, type RunContext } from '../../src/runner/run.js';
import { templateConfig } from '../fixtures.js';
import { commitAll, gitIn, templateWorkspace, write } from '../repo.js';
import { claudeStream, codexStream, type Fake, installFake } from '../model/fake.js';
import { contextOf } from './helpers.js';

const CLAUDE = 'Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>';
const GPT = 'Co-Authored-By: GPT-6 Codex <codex@openai.com>';
const PACKET = 'packets/CMP-DEMO-001/PKT-DEMO-004.md';
const SPEC = 'specs/notes/SPEC-DEMO-001.md';

const APP = `import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { NotesController } from './notes.controller.js';
import { TokenGuard } from './token.guard.js';

@Module({ imports: [], controllers: [NotesController], providers: [{ provide: APP_GUARD, useClass: TokenGuard }] })
export class AppModule {}
`;
const CONTROLLER = `import { Controller, Get } from '@nestjs/common';
import { Public } from './public.js';

@Controller('notes')
export class NotesController {
  @Get(':id')
  get(): string {
    return 'note';
  }

  @Public()
  @Get('health')
  health(): string {
    return 'ok';
  }
}
`;
const GUARD = `import { principalOf } from './principal.js';

export class TokenGuard {
  canActivate(ctx: unknown): boolean {
    return principalOf(ctx).roles.includes('member');
  }
}
`;
const PRINCIPAL = `export const principalOf = (ctx: unknown): { roles: string[] } => ({ roles: (ctx as { roles?: string[] }).roles ?? [] });
`;
const PUBLIC = `export const Public = (): MethodDecorator => () => undefined;
`;
const SPEC_TEXT = `# SPEC-DEMO-001 Notes

## Contract

\`\`\`yaml
id: SPEC-DEMO-001
status: approved
module: { slug: notes }
requirements:
  - { id: R-1, acceptance: "yes" }
  - { id: R-2, acceptance: "yes" }
  - { id: R-3, acceptance: "no" }
\`\`\`
`;
const PACKET_TEXT = (dispositions = '') => `---
id: PKT-DEMO-004
kind: code
---

## Intent
Notes by id.

## Deliverables
- R-1, R-2 of SPEC-DEMO-001.
${dispositions ? `\n## Review dispositions\n${dispositions}\n` : ''}`;

interface Ws { dir: string; base: string }

/** Template workspace + one app with a guarded controller (base), then a worker commit with `trailers`. */
function workspace(trailers: string[] = [CLAUDE], opts: { mount?: boolean } = {}): Ws {
  const files: Record<string, string> = { [SPEC]: SPEC_TEXT, [PACKET]: PACKET_TEXT() };
  if (opts.mount !== false) Object.assign(files, { 'apps/api/src/app.module.ts': APP, 'apps/api/src/notes.controller.ts': CONTROLLER, 'apps/api/src/token.guard.ts': GUARD, 'apps/api/src/principal.ts': PRINCIPAL, 'apps/api/src/public.ts': PUBLIC });
  const dir = templateWorkspace(files);
  const base = gitIn(dir, 'rev-parse', 'HEAD').trim();
  trailers.forEach((t, i) => {
    write(dir, `apps/api/src/change-${i}.ts`, `export const change${i} = ${i};\n`);
    gitIn(dir, 'add', '-A');
    gitIn(dir, 'commit', '-q', '-m', `feat(api): change ${i}\n\n${t}`);
  });
  return { dir, base };
}

const facts = (ws: Ws, over: Partial<PacketFacts> = {}): PacketFacts => ({
  id: 'PKT-DEMO-004', kind: 'code', path: PACKET, base: ws.base, text: readFileSync(resolve(ws.dir, PACKET), 'utf8'),
  specPath: SPEC, specSha256: sha256(SPEC_TEXT), sources: [], deliverables: ['- R-1, R-2 of SPEC-DEMO-001.'], full: true, ...over,
});

async function ctxOf(ws: Ws, adapter: NodeAdapter, over: Partial<PacketFacts> = {}, config: Partial<RunContext['config']> = {}): Promise<RunContext> {
  const ctx = await contextOf(ws.dir, { base: ws.base, only: adapter.id === 'review' ? 'permissions-pattern' : adapter.id, config });
  ctx.packet = facts(ws, over);
  return ctx;
}

async function run(adapter: NodeAdapter, ctx: RunContext): Promise<NodeOutcome> {
  const o = rewriteNoObservations(await adapter.run(ctx));
  const { fromEvidence: _, ...row } = o;
  NodeResult.parse({ id: adapter.id, ...row, durationMs: 0, cached: false, needs: ['model'] });
  return o;
}

const COMPLIANT = { verdict: 'compliant', inspectedEntrypoints: ['NotesController.get'], findings: [], unresolved: [], confidence: 0.9 };
const PHASE1_OUT = { requirements: [{ id: 'R-1', observable: 'GET /notes/:id returns the note', falsifier: 'an unknown id' }, { id: 'R-2', observable: 'members only', falsifier: 'no role' }] };
const PHASE2_OUT = (over: Record<string, unknown> = {}) => ({
  requirements: [
    { id: 'R-1', implemented: 'yes', tested: 'yes', locators: ['apps/api/src/notes.controller.ts:6'] },
    { id: 'R-2', implemented: 'yes', tested: 'weak', locators: ['apps/api/src/token.guard.ts:4'] },
  ],
  verdict: 'no-blockers', findings: [], ...over,
});
const BLOCKER = { severity: 'blocker', requirement: 'R-2', locator: 'apps/api/src/token.guard.ts:5', statement: 'roles are not checked against the token', evidence: 'read the guard', basis: 'derived', confidence: 0.8 };

let fake: Fake;
beforeEach(() => {
  vi.stubEnv('CI', '');
  fake = installFake();
});
afterEach(() => vi.unstubAllEnvs());

describe('B.24 permissions-pattern', () => {
  it('PASS: compliant over every mounted protected route; the worker family\'s reviewer (claude → codex) with the sensor flags; evidence with minConfidence (D-083)', async () => {
    const ws = workspace([CLAUDE]);
    fake.plan({ sensor: { stdout: codexStream(COMPLIANT, { usage: { input: 900, output: 60 } }) } });
    const ctx = await ctxOf(ws, permissionsPattern);
    const o = await run(permissionsPattern, ctx);
    expect(o).toMatchObject({ status: 'PASS', expected: 1, observed: 1, evaluated: 1, details: { node: 'permissions-pattern', model: 'gpt-6-astra', inputTokens: 900, outputTokens: 60 } });
    const [c] = fake.calls();
    expect(c!.bin).toBe('codex');
    expect(c!.argv).toEqual(expect.arrayContaining(['exec', '--model', 'gpt-6-astra', '--json', '--ephemeral', '--sandbox', 'read-only', '-']));
    expect(c!.entries).toEqual([]); // the empty --cd
    expect(c!.stdin).toContain('=== apps/api/src/token.guard.ts');
    expect(c!.stdin).toContain('=== apps/api/src/principal.ts'); // the guard's import closure
    expect(c!.stdin).toContain('- NotesController.get (GET /notes/:id)');
    expect(c!.stdin).not.toContain('NotesController.health ('); // @Public() is not a protected route
    const ev = SensorEvidence.parse(JSON.parse(readFileSync(resolve(ws.dir, sensorPath('PKT-DEMO-004')), 'utf8')));
    expect(ev).toMatchObject({ packetId: 'PKT-DEMO-004', minConfidence: 0.7, output: { verdict: 'compliant' }, model: 'gpt-6-astra' });
  });

  it('FAIL: a violation with a valid locator, finding in the B.24 form', async () => {
    const ws = workspace([CLAUDE]);
    const violation = { ...COMPLIANT, verdict: 'violation', findings: [{ path: 'apps/api/src/token.guard.ts', line: 5, statement: 'roles read from the request', evidence: 'ctx.roles' }] };
    fake.plan({ sensor: { stdout: codexStream(violation) } });
    const o = await run(permissionsPattern, await ctxOf(ws, permissionsPattern));
    expect(o.status).toBe('FAIL');
    expect(o.findings).toEqual([{ locator: 'apps/api/src/token.guard.ts:5', message: 'roles read from the request — ctx.roles', standard: 'S-12', hint: 'decide from the token principal' }]);
  });

  it('UNKNOWN tooling-missing when the reviewer CLI is absent', async () => {
    const ws = workspace([CLAUDE]);
    installFake(['claude']); // no codex on PATH
    const o = await run(permissionsPattern, await ctxOf(ws, permissionsPattern));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing' });
    expect(o.findings[0]).toMatchObject({ message: 'permissions-pattern UNKNOWN (tooling-missing): install with npm install -g @openai/codex@0.163.0', hint: 'install with npm install -g @openai/codex@0.163.0' });
  });

  it('UNKNOWN capability-missing: the CLI rejects an enforcement flag (codex 0.163.0 stderr form)', async () => {
    const ws = workspace([CLAUDE]);
    fake.plan({ sensor: { stderr: "error: unexpected argument '--sandbox' found\n", code: 2 } });
    const o = await run(permissionsPattern, await ctxOf(ws, permissionsPattern));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'capability-missing' });
    expect(o.findings[0]!.message).toBe('permissions-pattern UNKNOWN (capability-missing): the reviewer CLI cannot enforce read-only, no-network isolation (sandbox or flag missing); install the version 12 pins');
  });

  it('UNKNOWN capability-missing: claude init shows tools the flags remove (gpt worker → claude sensor with --bare)', async () => {
    const ws = workspace([GPT]);
    fake.plan({ sensor: { stdout: claudeStream(COMPLIANT, { tools: ['Bash', 'StructuredOutput'] }) } });
    const o = await run(permissionsPattern, await ctxOf(ws, permissionsPattern));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'capability-missing' });
    expect(fake.calls()[0]!.argv).toEqual(expect.arrayContaining(['--tools', '', '--restricted', '--bare']));
  });

  it('UNKNOWN tool-use-observed: a command item in the sensor stream', async () => {
    const ws = workspace([CLAUDE]);
    fake.plan({ sensor: { stdout: codexStream(COMPLIANT, { commands: [{ command: '/bin/zsh -lc ls', output: 'a\n' }] }) } });
    expect(await run(permissionsPattern, await ctxOf(ws, permissionsPattern))).toMatchObject({ status: 'UNKNOWN', reason: 'tool-use-observed' });
  });

  it.each([
    ['model-error', { stdout: codexStream(COMPLIANT).replace(/\{"type":"turn.completed".*\n/, '{"type":"turn.failed","error":{"message":"401 Unauthorized"}}\n') }, 'check that codex is logged in, then re-run'],
    ['input-bound-exceeded', { stdout: codexStream(COMPLIANT, { usage: null }) }, undefined],
    ['output-bound-exceeded', { stdout: codexStream(COMPLIANT, { usage: { input: 100, output: 2001 } }) }, undefined],
    ['schema-invalid', { stdout: codexStream({ verdict: 'compliant' }) }, undefined],
    ['verdict-unknown', { stdout: codexStream({ ...COMPLIANT, verdict: 'unknown' }) }, undefined],
    ['runner-crashed', { stderr: 'panic: boom\n', code: 101 }, undefined],
  ])('UNKNOWN %s', async (reason, reply, hint) => {
    const ws = workspace([CLAUDE]);
    fake.plan({ sensor: reply });
    const o = await run(permissionsPattern, await ctxOf(ws, permissionsPattern));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason });
    if (hint) expect(o.findings[0]!.hint).toBe(hint);
  });

  it('UNKNOWN verdict-unknown when compliant misses an entrypoint or the confidence is below the threshold', async () => {
    const ws = workspace([CLAUDE]);
    fake.plan({ sensor: { stdout: codexStream({ ...COMPLIANT, inspectedEntrypoints: [], confidence: 0.5 }) } });
    const o = await run(permissionsPattern, await ctxOf(ws, permissionsPattern));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'verdict-unknown', expected: 1, observed: 0 });
    expect(o.findings.map((f) => f.message)).toEqual(expect.arrayContaining(['entrypoint NotesController.get not inspected', 'confidence 0.5 < minConfidence 0.7']));
  });

  it('UNKNOWN slice-too-large before any call, listing the slice files', async () => {
    const ws = workspace([CLAUDE]);
    const o = await run(permissionsPattern, await ctxOf(ws, permissionsPattern, {}, { agentic: { permissionsPattern: { minConfidence: 0.7, maxInputTokens: 50 } } }));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'slice-too-large' });
    expect(o.findings.map((f) => f.locator)).toEqual(expect.arrayContaining(['apps/api/src/token.guard.ts:1', 'apps/api/src/principal.ts:1']));
    expect(fake.calls()).toEqual([]);
  });

  it('UNKNOWN missing-source: a guard import with no source', async () => {
    const ws = workspace([CLAUDE]);
    write(ws.dir, 'apps/api/src/token.guard.ts', GUARD.replace('./principal.js', './gone.js'));
    const o = await run(permissionsPattern, await ctxOf(ws, permissionsPattern));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'missing-source' });
    expect(o.findings.some((f) => f.locator === 'apps/api/src/token.guard.ts:1' && f.message === 'import ./gone.js has no source')).toBe(true);
  });

  it('UNKNOWN family: a mixed range has no sensor reviewer; no family falls back to the first configured (D-074)', async () => {
    const mixed = workspace([CLAUDE, GPT]);
    expect(await run(permissionsPattern, await ctxOf(mixed, permissionsPattern))).toMatchObject({ status: 'UNKNOWN', reason: 'family' });
    const none = workspace(['Signed-off-by: someone']);
    fake.plan({ sensor: { stdout: codexStream(COMPLIANT) } });
    expect(await run(permissionsPattern, await ctxOf(none, permissionsPattern))).toMatchObject({ status: 'PASS' });
    expect(fake.calls()[0]!.bin).toBe('codex'); // reviewers.claude, first in Family order
  });

  it('SKIPPED: no mounted routes (inventory population)', async () => {
    const ws = workspace([CLAUDE], { mount: false });
    const ctx = await contextOf(ws.dir, { base: ws.base, only: 'permissions-pattern' });
    expect(ctx.inventory!.populations['permissions-pattern']).toMatchObject({ predicate: 'no mounted routes', count: 0 });
    const pass: NodeOutcome = { status: 'PASS', expected: 1, observed: 1, evaluated: 1, findings: [] };
    const stub = (id: 'typecheck' | 'route-contract'): NodeAdapter => ({ id, contract: 1, configFiles: () => [], inputs: () => [], run: async () => pass });
    const out = await runPlan({ ...ctx, plan: plan({ packet: false, full: false, only: ['permissions-pattern'] }) }, {
      inventory: runInventory, adapters: { typecheck: stub('typecheck'), 'route-contract': stub('route-contract'), 'permissions-pattern': permissionsPattern },
      accept: () => pass, redigest: async () => '', store: new CacheStore(ws.dir),
    }, '');
    expect(out.rows.find((r) => r.id === 'permissions-pattern')).toMatchObject({ status: 'SKIPPED', evidence: 'no mounted routes' });
    expect(fake.calls()).toEqual([]);
  });

  it('CI verifies the evidence (cached: true on a match) and never calls a model', async () => {
    const ws = workspace([CLAUDE]);
    fake.plan({ sensor: { stdout: codexStream(COMPLIANT) } });
    await run(permissionsPattern, await ctxOf(ws, permissionsPattern));
    commitAll(ws.dir, 'chore(review): sensor evidence');
    vi.stubEnv('CI', 'true');
    const o = await run(permissionsPattern, await ctxOf(ws, permissionsPattern));
    expect(o).toMatchObject({ status: 'PASS', fromEvidence: true });
    expect(fake.calls()).toHaveLength(1);
  });

  it('N20: minConfidence 0.7 → 0.9 after a green --full with confidence 0.8: CI stale; locally the key misses (configDigest)', async () => {
    const ws = workspace([CLAUDE]);
    fake.plan({ sensor: { stdout: codexStream({ ...COMPLIANT, confidence: 0.8 }) } });
    const before = await ctxOf(ws, permissionsPattern);
    expect(await run(permissionsPattern, before)).toMatchObject({ status: 'PASS' });
    const alone = (c: RunContext): RunContext => ({ ...c, plan: { ...c.plan, prerequisites: new Map() } });
    const key0 = keyOf(alone(before), permissionsPattern, new Map(), (await permissionsPattern.keyExtra!(before)));
    const raised = { ...templateConfig(), agentic: { permissionsPattern: { minConfidence: 0.9, maxInputTokens: 60000 } } };
    write(ws.dir, 'devai.json', JSON.stringify(raised, null, 2) + '\n');
    commitAll(ws.dir, 'chore(config): raise minConfidence');
    vi.stubEnv('CI', 'true');
    const ci = await ctxOf(ws, permissionsPattern, {}, raised);
    const o = await run(permissionsPattern, ci);
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'stale' });
    expect(o.findings[1]!.message).toBe('judged with minConfidence 0.7; devai.json at the head has 0.9');
    const key1 = keyOf(alone(ci), permissionsPattern, new Map(), (await permissionsPattern.keyExtra!(ci)));
    expect(key1).not.toBe(key0);
  });

  it('CI stale: evidence missing, or the slice changed after it was written', async () => {
    const ws = workspace([CLAUDE]);
    vi.stubEnv('CI', 'true');
    expect(await run(permissionsPattern, await ctxOf(ws, permissionsPattern))).toMatchObject({ status: 'UNKNOWN', reason: 'stale' });
    vi.stubEnv('CI', '');
    fake.plan({ sensor: { stdout: codexStream(COMPLIANT) } });
    await run(permissionsPattern, await ctxOf(ws, permissionsPattern));
    write(ws.dir, 'apps/api/src/principal.ts', PRINCIPAL + '// changed\n');
    vi.stubEnv('CI', 'true');
    const o = await run(permissionsPattern, await ctxOf(ws, permissionsPattern));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'stale' });
    expect(o.findings[1]!.message).toMatch(/^slice digest/);
  });
});

describe('B.27 review', () => {
  const plan2 = (p2: string, p1 = codexStream(PHASE1_OUT)) => fake.plan({ phase1: { stdout: p1 }, phase2: { stdout: p2 } });

  it('PASS: phase 1 blind with no tools, phase 2 in the scratch copy under workspace-write; review.json with workerFamily and trailers', async () => {
    const ws = workspace([CLAUDE]);
    plan2(codexStream(PHASE2_OUT(), { commands: [{ command: "/bin/zsh -lc 'git log --oneline'", output: 'x\n' }] }));
    const ctx = await ctxOf(ws, review);
    const digest0 = digestOf(ctx.listing);
    const o = await run(review, ctx);
    expect(o).toMatchObject({ status: 'PASS', expected: 2, observed: 2, evaluated: 2, details: { node: 'review', verdict: 'no-blockers', toolCalls: 1, model: 'gpt-6-astra', unexamined: [] } });
    const [p1, p2] = fake.calls();
    expect(p1!.argv).toEqual(expect.arrayContaining(['--sandbox', 'read-only']));
    expect(p1!.entries).toEqual([]);
    expect(p1!.stdin).toContain(SPEC_TEXT.trim());
    expect(p1!.stdin).not.toContain('change0'); // no candidate bytes in phase 1
    expect(p2!.argv).toEqual(expect.arrayContaining(['--sandbox', 'workspace-write', ...CODEX_CONFINE]));
    expect(p2!.cwd).toMatch(/\.devai\/cache\/scratch\/[0-9a-f]{64}\/worktree$/);
    expect(p2!.entries).toEqual(expect.arrayContaining(['apps', 'devai.json']));
    expect(p2!.stdin).toContain('<<<DIFF\ndiff --git');
    expect(p2!.stdin).toContain('change0');
    expect(existsSync(p2!.cwd)).toBe(false); // scratch removed
    const file = Review.parse(JSON.parse(readFileSync(resolve(ws.dir, reviewPath('PKT-DEMO-004')), 'utf8')));
    expect(file).toMatchObject({ workerFamily: 'claude', workerTrailers: [CLAUDE], candidateDigest: digest0, verdict: 'no-blockers', specSha256: sha256(SPEC_TEXT) });
    expect(digestOf(await workingTree(ws.dir, ws.base))).toBe(digest0); // C.1 step 10: the real candidate is unchanged
  });

  it('FAIL: a blocker finding, in the B.27 form, with its fingerprint in review.json', async () => {
    const ws = workspace([CLAUDE]);
    plan2(codexStream(PHASE2_OUT({ verdict: 'blockers', findings: [BLOCKER] })));
    const o = await run(review, await ctxOf(ws, review));
    expect(o.status).toBe('FAIL');
    expect(o.findings).toEqual([{ locator: 'apps/api/src/token.guard.ts:5', message: 'roles are not checked against the token (R-2, blocker, basis: derived)', standard: 'S-66', hint: 'fix or dispose with a contract-bound reason' }]);
    const file = Review.parse(JSON.parse(readFileSync(resolve(ws.dir, reviewPath('PKT-DEMO-004')), 'utf8')));
    expect(file.findings[0]!.fingerprint).toBe(fingerprint('R-2', 'apps/api/src/token.guard.ts:5', 'roles are not checked against the token'));
  });

  it('PL-10: accepted-risk disposes of the blocker; not-a-defect falls when the finding recurs observed', async () => {
    const fp = fingerprint('R-2', 'apps/api/src/token.guard.ts:5', 'roles are not checked against the token');
    const ws = workspace([CLAUDE]);
    plan2(codexStream(PHASE2_OUT({ verdict: 'blockers', findings: [BLOCKER] })));
    const accepted = await run(review, await ctxOf(ws, review, { text: PACKET_TEXT(`RV ${fp.slice(0, 12)} · R-2 · apps/api/src/token.guard.ts:5 · accepted-risk · pilot`) }));
    expect(accepted).toMatchObject({ status: 'PASS', details: { verdict: 'no-blockers' } });
    const out = '1 passed\n';
    plan2(codexStream(PHASE2_OUT({ verdict: 'blockers', findings: [{ ...BLOCKER, basis: 'observed', evidence: `ran node -e 1; sha256 ${sha256(out)}` }] }), { commands: [{ command: "/bin/zsh -lc 'node -e 1'", output: out }] }));
    const recurs = await run(review, await ctxOf(ws, review, { text: PACKET_TEXT(`RV ${fp.slice(0, 12)} · R-2 · apps/api/src/token.guard.ts:5 · not-a-defect · we think not`) }));
    expect(recurs.status).toBe('FAIL');
    expect(recurs.findings[0]!.message).toContain('basis: observed');
  });

  it('basis observed without a matching command and output digest in the stream is downgraded to derived (02 §9)', async () => {
    const ws = workspace([CLAUDE]);
    plan2(codexStream(PHASE2_OUT({ verdict: 'blockers', findings: [{ ...BLOCKER, basis: 'observed', evidence: 'ran it, trust me' }] })));
    const o = await run(review, await ctxOf(ws, review));
    expect(o.findings[0]!.message).toContain('basis: derived');
  });

  it('N17: Claude and GPT trailers in base..HEAD → UNKNOWN family, review.json absent; with the sensor also family, exit 2', async () => {
    const ws = workspace([CLAUDE, GPT]);
    const ctx = await ctxOf(ws, review);
    const o = await run(review, ctx);
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'family' });
    expect(o.findings[0]!.message).toBe(`review UNKNOWN (family): worker family mixed from 2 Co-Authored-By trailer(s) in ${ws.base.slice(0, 7)}..HEAD`);
    expect(o.findings.slice(1).map((f) => f.message)).toEqual([`trailer: ${CLAUDE} → claude`, `trailer: ${GPT} → gpt`]);
    expect(existsSync(resolve(ws.dir, reviewPath('PKT-DEMO-004')))).toBe(false);
    expect(fake.calls()).toEqual([]);
    const sensor = await run(permissionsPattern, await ctxOf(ws, permissionsPattern));
    const row = (id: 'review' | 'permissions-pattern', x: NodeOutcome) => ({ id, ...x, durationMs: 0, cached: false, needs: ['model' as const] });
    expect(exitCodeOf([row('permissions-pattern', sensor), row('review', o)], templateConfig(), false)).toBe(2);
  });

  it('UNKNOWN family for an unknown worker (no fallback for review); no-reviewer-configured', async () => {
    expect(await run(review, await ctxOf(workspace(['Signed-off-by: someone']), review))).toMatchObject({ status: 'UNKNOWN', reason: 'family' });
    const ws = workspace([CLAUDE]);
    const o = await run(review, await ctxOf(ws, review, {}, { review: { mustRun: false, reviewers: { gpt: 'claude -p' } } }));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'no-reviewer-configured' });
  });

  it('UNKNOWN tooling-missing when the reviewer CLI is absent', async () => {
    const ws = workspace([CLAUDE]);
    installFake(['claude']);
    expect(await run(review, await ctxOf(ws, review))).toMatchObject({ status: 'UNKNOWN', reason: 'tooling-missing' });
  });

  describe('N19: isolation enforced by the CLI, then checked in the stream (D-082)', () => {
    it('codex: the phase-2 argv carries the sandbox; a stream with commands but no escaping write or network item completes', async () => {
      const ws = workspace([CLAUDE]);
      plan2(codexStream(PHASE2_OUT(), { commands: [{ command: "/bin/zsh -lc 'printf x > /repo/apps/api/src/x.ts'", output: 'zsh: operation not permitted\n' }, { command: "/bin/zsh -lc 'curl -sS https://example.com'", output: 'curl: (6) Could not resolve host\n' }] }));
      const ctx = await ctxOf(ws, review);
      const digest0 = digestOf(ctx.listing);
      expect(await run(review, ctx)).toMatchObject({ status: 'PASS' });
      expect(existsSync(resolve(ws.dir, 'apps/api/src/x.ts'))).toBe(false);
      expect(digestOf(await workingTree(ws.dir, ws.base))).toBe(digest0);
    });

    it.each([
      ['a codex file_change outside the scratch copy', () => codexStream(PHASE2_OUT(), { items: [{ id: 'f1', type: 'file_change', changes: [{ path: '/repo/apps/api/src/x.ts', kind: 'add' }] }] })],
      ['a codex web_search item', () => codexStream(PHASE2_OUT(), { items: [{ id: 'w1', type: 'web_search', query: 'x' }] })],
    ])('%s → capability-missing', async (_, stream) => {
      const ws = workspace([CLAUDE]);
      plan2(stream());
      expect(await run(review, await ctxOf(ws, review))).toMatchObject({ status: 'UNKNOWN', reason: 'capability-missing' });
    });

    it('codex rejecting a confinement override → capability-missing', async () => {
      const ws = workspace([CLAUDE]);
      fake.plan({ phase1: { stdout: codexStream(PHASE1_OUT) }, phase2: { stderr: "error: unexpected argument '-c' found\n", code: 2 } });
      expect(await run(review, await ctxOf(ws, review))).toMatchObject({ status: 'UNKNOWN', reason: 'capability-missing' });
    });

    it('claude: the phase-2 flags verbatim; a claude without the sandbox (< 2.1.219) → capability-missing; a Write item → capability-missing', async () => {
      const ws = workspace([GPT]);
      const p2tools = ['Bash', 'Glob', 'Grep', 'Read', 'StructuredOutput'];
      fake.plan({ phase1: { stdout: claudeStream(PHASE1_OUT) }, phase2: { stdout: claudeStream(PHASE2_OUT(), { tools: p2tools, version: '2.1.100' }) } });
      expect(await run(review, await ctxOf(ws, review))).toMatchObject({ status: 'UNKNOWN', reason: 'capability-missing' });
      const p2 = fake.calls()[1]!;
      expect(p2.argv).toEqual(expect.arrayContaining(['--restricted', '--tools', 'Read,Grep,Glob,Bash', '--disallowedTools', 'Edit,Write,NotebookEdit,WebFetch,WebSearch', '--settings', '{"sandbox":{"enabled":true,"allowUnsandboxedCommands":false,"network":{"allowedDomains":[],"strictAllowlist":true}}}']));
      fake.plan({ phase1: { stdout: claudeStream(PHASE1_OUT) }, phase2: { stdout: claudeStream(PHASE2_OUT(), { tools: p2tools, items: [{ type: 'tool_use', id: 'w', name: 'Write', input: { file_path: '/repo/apps/api/src/x.ts', content: 'x' } }] }) } });
      expect(await run(review, await ctxOf(ws, review))).toMatchObject({ status: 'UNKNOWN', reason: 'capability-missing' });
      fake.plan({ phase1: { stdout: claudeStream(PHASE1_OUT) }, phase2: { stdout: claudeStream(PHASE2_OUT(), { tools: p2tools }) } });
      expect(await run(review, await ctxOf(ws, review))).toMatchObject({ status: 'PASS', details: { model: 'claude-fake-1' } });
    });
  });

  it('budget-exhausted: terminated at the 21st tool call', async () => {
    const ws = workspace([CLAUDE]);
    const commands = Array.from({ length: 25 }, (_, i) => ({ command: `/bin/zsh -lc 'ls ${i}'`, output: '' }));
    plan2(codexStream(PHASE2_OUT(), { commands }));
    const o = await run(review, await ctxOf(ws, review));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason: 'budget-exhausted', details: { unexamined: ['R-1', 'R-2'] } });
    expect(o.findings[0]!.message).toBe('review UNKNOWN (budget-exhausted): phase 2: terminated at tool call 21 (bound 20)');
  });

  it.each([
    ['review-incomplete', () => PHASE2_OUT({ requirements: [PHASE2_OUT().requirements[0]] }), 'review UNKNOWN (review-incomplete): unexamined R-2'],
    ['verdict-unknown', () => PHASE2_OUT({ verdict: 'unknown' }), 'review UNKNOWN (verdict-unknown): the reviewer answered unknown'],
    ['schema-invalid', () => PHASE2_OUT({ verdict: 'blockers' }), 'review UNKNOWN (schema-invalid): verdict blockers is inconsistent with the findings'],
    ['schema-invalid', () => PHASE2_OUT({ requirements: [{ id: 'R-1', implemented: 'yes', tested: 'yes', locators: ['apps/api/src/notes.controller.ts:999'] }, PHASE2_OUT().requirements[1]] }), 'review UNKNOWN (schema-invalid): invalid locator apps/api/src/notes.controller.ts:999'],
  ])('UNKNOWN %s', async (reason, answer, message) => {
    const ws = workspace([CLAUDE]);
    plan2(codexStream(answer()));
    const o = await run(review, await ctxOf(ws, review));
    expect(o).toMatchObject({ status: 'UNKNOWN', reason });
    expect(o.findings[0]!.message).toBe(message);
  });

  it('UNKNOWN input-bound-exceeded (usage absent) and output-bound-exceeded (over 4k across phases)', async () => {
    const ws = workspace([CLAUDE]);
    plan2(codexStream(PHASE2_OUT(), { usage: null }));
    expect(await run(review, await ctxOf(ws, review))).toMatchObject({ status: 'UNKNOWN', reason: 'input-bound-exceeded' });
    plan2(codexStream(PHASE2_OUT(), { usage: { input: 1000, output: 3900 } }), codexStream(PHASE1_OUT, { usage: { input: 1000, output: 200 } }));
    expect(await run(review, await ctxOf(ws, review))).toMatchObject({ status: 'UNKNOWN', reason: 'output-bound-exceeded' });
  });

  it('CI: a matching review.json is reported (cached: true); a stale candidate, missing or malformed file is stale', async () => {
    const ws = workspace([CLAUDE]);
    plan2(codexStream(PHASE2_OUT()));
    await run(review, await ctxOf(ws, review));
    commitAll(ws.dir, 'chore(review): review evidence'); // C.6 excludes .devai/review/**: the digest survives
    vi.stubEnv('CI', 'true');
    expect(await run(review, await ctxOf(ws, review))).toMatchObject({ status: 'PASS', fromEvidence: true });
    write(ws.dir, 'apps/api/src/change-0.ts', 'export const change0 = 42;\n');
    const stale = await run(review, await ctxOf(ws, review));
    expect(stale).toMatchObject({ status: 'UNKNOWN', reason: 'stale' });
    expect(stale.findings[0]!.message).toMatch(/^review UNKNOWN \(stale\): review.json candidateDigest/);
    expect(stale.findings[0]!.hint).toBe(`re-run devai check --packet ${PACKET} --full and commit .devai/review/`);
    write(ws.dir, reviewPath('PKT-DEMO-004'), '{"packetId":');
    expect((await run(review, await ctxOf(ws, review))).findings[0]!.message).toMatch(/is not JSON$/);
    expect(fake.calls()).toHaveLength(2);
  });

  it('C.4 (D-076): the key carries candidate digest, specSha256, packet digest (dispositions), prompt digest and model id', async () => {
    const ws = workspace([CLAUDE]);
    const ctx = await ctxOf(ws, review);
    const extra = await review.keyExtra!(ctx);
    expect(extra).toEqual([digestOf(ctx.listing), sha256(SPEC_TEXT), sha256(PACKET_TEXT()), expect.stringMatching(/^[0-9a-f]{64}$/), 'gpt-6-astra']);
    const disposed = await review.keyExtra!({ ...ctx, packet: { ...ctx.packet!, text: PACKET_TEXT('RV 0123456789ab · R-1 · a.ts:1 · not-a-defect · no') } });
    expect(disposed[2]).not.toBe(extra[2]);
  });
});
