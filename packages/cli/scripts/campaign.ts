// 09 §4 generator release matrix (R8): runs one or more cells in temporary workspaces, as 09 §4 steps 1–8
// state, and asserts per step the exit code and the expected rows. Not a `devai` command (D-055): a
// repository script the `ci.yml` `matrix` job and the release author run.
//
//   node packages/cli/scripts/campaign.ts --runtime bare --cells O1,O2 [--work <dir>] [--out <file.json>]
//   node packages/cli/scripts/campaign.ts --report <results.json>…   (the PR-body table)
//
// Each step asserts its *current* form. Where the current form differs from the law's (09 §4, D-098, D-100),
// the law's form is printed as `pending` with what it waits on: a STYNX S10 item (D-100) or a DEVAI Open
// item of the R8 PR; never a workaround in the cell. Cells the host cannot run skip with a named reason.
//
// Until R10 publishes @devai-nyx/{cli,decorators}, the cell installs them from this repository's build:
// `init`'s `pnpm add` goes through a `pnpm` first on PATH (D-107 Open 4) and every install through a global
// pnpmfile that `link:`s both packages. @stynx-nyx/* come from the GitHub registry
// with NODE_AUTH_TOKEN (ci.yml; locally `export NODE_AUTH_TOKEN=$(gh auth token)`).
import { spawnSync } from 'node:child_process';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, resolve } from 'node:path';

const CLI = resolve(import.meta.dirname, '..');
const REPO = resolve(CLI, '../..');
const FIXTURES = resolve(CLI, 'fixtures/campaign');
const MAIN = resolve(CLI, 'dist/main.js');

export type Runtime = 'bare' | 'docker';

// ---- the report -----------------------------------------------------------------------------------

interface NodeRow { id: string; status: string; reason?: string; cached?: boolean; findings: { locator: string; message: string; standard: string }[]; details?: Record<string, unknown> }
interface Report { exitCode: number; accepted?: boolean; reason?: string; message?: string; nodes?: NodeRow[] }

/** `STATUS` or `UNKNOWN reason`, the form the expectations use. */
export const rowOf = (n: NodeRow): string => (n.status === 'UNKNOWN' && n.reason ? `UNKNOWN ${n.reason}` : n.status);

/** What a `devai check` run must show: exit code, statuses (unlisted nodes take `others`), finding fragments. */
export interface Rows {
  exit: number;
  nodes?: Record<string, string>;
  /** Status of every node not named in `nodes`; omitted: unlisted nodes are not compared. */
  others?: string;
  /** `node: fragment` pairs: some finding of `node` contains `fragment` (in `locator message`). */
  findings?: [string, string][];
  /** `node: fragment` pairs that no finding of `node` may contain. */
  absent?: [string, string][];
  /** For refusals (exit 2 before the DAG): a fragment of the report's `message`. */
  message?: string;
  /** Nodes whose `cached` flag must be this value. */
  cached?: Record<string, boolean>;
}

/** The mismatches between a report and its expectation (empty: met). */
export function compare(r: Report, e: Rows): string[] {
  const out: string[] = [];
  if (r.exitCode !== e.exit) out.push(`exit ${r.exitCode}, expected ${e.exit}`);
  if (e.message !== undefined && !(r.message ?? '').includes(e.message)) out.push(`message "${r.message ?? ''}" lacks "${e.message}"`);
  const nodes = r.nodes ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const [id, want] of Object.entries(e.nodes ?? {})) {
    const n = byId.get(id);
    if (!n) out.push(`${id}: absent, expected ${want}`);
    else if (rowOf(n) !== want) out.push(`${id}: ${rowOf(n)}, expected ${want}`);
  }
  if (e.others !== undefined) {
    for (const n of nodes) if (!(n.id in (e.nodes ?? {})) && rowOf(n) !== e.others) out.push(`${n.id}: ${rowOf(n)}, expected ${e.others}`);
  }
  const text = (n: NodeRow | undefined) => (n?.findings ?? []).map((f) => `${f.locator} ${f.message} [${f.standard}]`);
  for (const [id, frag] of e.findings ?? []) if (!text(byId.get(id)).some((t) => t.includes(frag))) out.push(`${id}: no finding contains "${frag}"`);
  for (const [id, frag] of e.absent ?? []) if (text(byId.get(id)).some((t) => t.includes(frag))) out.push(`${id}: a finding contains "${frag}"`);
  for (const [id, want] of Object.entries(e.cached ?? {})) {
    const n = byId.get(id);
    if (n?.cached !== want) out.push(`${id}: cached ${String(n?.cached)}, expected ${String(want)}`);
  }
  return out;
}

/** One line per status group, for the log. */
export function summary(r: Report): string {
  if (!r.nodes) return `exit ${r.exitCode} ${r.reason ?? ''}: ${r.message ?? ''}`;
  const groups = new Map<string, string[]>();
  for (const n of r.nodes) groups.set(rowOf(n), [...(groups.get(rowOf(n)) ?? []), n.id]);
  return [`exit ${r.exitCode}`, ...[...groups].map(([k, v]) => `${k}: ${v.join(', ')}`)].join(' · ');
}

// ---- expectations -----------------------------------------------------------------------------------

/** D-100's S10 list, as cited in `pending` lines. */
export const S10: Record<number, string> = {
  1: 'S10 #1 (stynx api-docs/public-api-baselines write pair, D-088)',
  2: 'S10 #2 (stynx migrate up reads <cwd>/packages/data/migrations/platform)',
  3: 'S10 #3 (id-less GET /healthz, /readyz answer 500)',
  4: 'S10 #4 (list-routes reports permissions "" for @RequireRoles, D-087)',
  5: 'S10 #5 (migration linter: unquoted identifiers only, no author_alias PII token)',
  6: 'S10 #6 (LINT010 reads one prefix group, D-085)',
  7: 'S10 #7 (the guard answers a token naming no platform tenant with 403, D-129, D-134)',
  8: 'S10 #8 (the id-less /healthz and /readyz probes pass the global guard, D-137)',
};

/** The R8 PR's `## Open` items a pending form waits on (DEVAI, not STYNX). */
export const OPEN: Record<string, string> = {
  evidence: 'Open: permissions-pattern evidence cannot be produced while route-contract is tooling-missing (S10 #4)',
};

/** W11's R8 seed (devai-v3#72): campaign step 4 today, the same in every option cell (D-100, D-118). */
export const STEP4: Rows = {
  exit: 1,
  nodes: {
    'db-apply': 'FAIL', accept: 'FAIL',
    'route-contract': 'UNKNOWN tooling-missing', generated: 'UNKNOWN tooling-missing', openapi: 'UNKNOWN tooling-missing',
    'sql-typed': 'UNKNOWN prerequisite-failed', integration: 'UNKNOWN prerequisite-failed',
    'permissions-pattern': 'UNKNOWN prerequisite-failed', review: 'UNKNOWN prerequisite-failed',
    'spec-lint': 'SKIPPED', actionlint: 'SKIPPED', 'spec-tests': 'SKIPPED',
  },
  others: 'PASS',
  findings: [['db-apply', 'packages/data/migrations/platform'], ['route-contract', 'reads RequireRoles']],
};

/** Campaign step 6 today: `spec-tests` meets the scratch database without the platform schema (S10 #2). */
export const STEP6: Rows = {
  exit: 1,
  nodes: {
    'db-apply': 'FAIL', integration: 'FAIL', accept: 'FAIL',
    'spec-tests': 'UNKNOWN setup-failed', typecheck: 'PASS',
    'route-contract': 'UNKNOWN tooling-missing', 'permissions-pattern': 'UNKNOWN prerequisite-failed', review: 'UNKNOWN prerequisite-failed',
    generated: 'UNKNOWN tooling-missing',
    'sql-lint': 'SKIPPED', 'spec-lint': 'SKIPPED', actionlint: 'SKIPPED', openapi: 'SKIPPED', 'sql-typed': 'SKIPPED',
  },
  others: 'PASS',
  findings: [['spec-tests', 'tenancy.tenants'], ['db-apply', 'packages/data/migrations/platform'], ['integration', 'GET /healthz with 200']],
  // D-132: the test project is a typecheck project, so a test packet's required typecheck runs.
  absent: [['accept', 'required node skipped for kind: test']],
};

/** Campaign step 8 today: PKT-DEMO-004's bodies, every DB-backed node behind `db-apply`'s FAIL (S10 #2). */
export const STEP8: Rows = {
  exit: 1,
  nodes: {
    'db-apply': 'FAIL', accept: 'FAIL',
    'route-contract': 'UNKNOWN tooling-missing', generated: 'UNKNOWN tooling-missing',
    'sql-typed': 'UNKNOWN prerequisite-failed', 'spec-tests': 'UNKNOWN prerequisite-failed', integration: 'UNKNOWN prerequisite-failed',
    'permissions-pattern': 'UNKNOWN prerequisite-failed', review: 'UNKNOWN prerequisite-failed',
    'sql-lint': 'SKIPPED', 'spec-lint': 'SKIPPED', actionlint: 'SKIPPED', openapi: 'SKIPPED',
  },
  others: 'PASS',
  findings: [['db-apply', 'packages/data/migrations/platform'], ['route-contract', 'reads RequireRoles']],
};

// ---- process helpers ------------------------------------------------------------------------------

interface Ran { code: number; stdout: string; stderr: string }

function run(argv: string[], cwd: string, env: NodeJS.ProcessEnv, timeoutMs = 900_000): Ran {
  const r = spawnSync(argv[0]!, argv.slice(1), { cwd, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, timeout: timeoutMs });
  return { code: r.status ?? (r.signal ? 128 : 1), stdout: r.stdout ?? '', stderr: (r.stderr ?? '') + (r.error ? String(r.error) : '') };
}

function parseReport(r: Ran): Report {
  try {
    return JSON.parse(r.stdout) as Report;
  } catch {
    return { exitCode: r.code, reason: 'unparsed', message: (r.stdout + r.stderr).split('\n').find((l) => l.trim() !== '') ?? '' };
  }
}

// ---- cells ----------------------------------------------------------------------------------------

export interface OptionCell { kind: 'option'; id: string; runtime: Runtime; lgpd: boolean; ptBR: boolean; web: boolean }

/** O1–O8 bare, O9–O16 the same eight in docker (D-098 numbering). */
export function optionCell(id: string): OptionCell | null {
  const m = /^O([1-9]|1[0-6])$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  const k = (n - 1) % 8;
  return { kind: 'option', id, runtime: n > 8 ? 'docker' : 'bare', lgpd: k % 2 === 1, ptBR: k % 4 >= 2, web: k >= 4 };
}

export const label = (c: OptionCell): string => [c.web ? '--web' : '', c.lgpd ? '--lgpd' : '', c.ptBR ? 'pt-BR' : ''].filter(Boolean).join(' ') || '—';

interface StepResult { step: string; ok: boolean; observed: string; mismatches: string[]; pending: string[] }
export interface CellResult { cell: string; runtime: Runtime; options: string; verdict: 'met' | 'not met' | 'skipped'; reason?: string; steps: StepResult[]; pending: string[]; schemaDigest?: string | null; durationMs: number }

class Cell {
  readonly steps: StepResult[] = [];
  /** Whether step 8's `--packet PKT-DEMO-004` passed the pre-DAG rules (the negative rows' invocation, D-130). */
  packetUsable = false;
  readonly id: string;
  readonly runtime: Runtime;
  readonly env: NodeJS.ProcessEnv;
  readonly dir: string;
  private readonly log: string;

  /** A fresh workspace `<work>/<id>`, or, with `shared`, another cell's workspace (the negative cells on O2). */
  constructor(id: string, runtime: Runtime, work: string, base: NodeJS.ProcessEnv, shared?: Cell) {
    this.id = id;
    this.runtime = runtime;
    this.dir = shared?.dir ?? resolve(work, id.toLowerCase());
    this.log = resolve(work, `${id.toLowerCase()}.log`);
    if (!shared) rmSync(this.dir, { recursive: true, force: true });
    writeFileSync(this.log, '');
    this.env = { ...base, DEVAI_RUNTIME: runtime };
  }

  note(text: string): void {
    writeFileSync(this.log, `${text}\n`, { flag: 'a' });
  }

  exec(argv: string[], cwd = this.dir): Ran {
    const r = run(argv, cwd, this.env);
    this.note(`$ ${argv.join(' ')}\n[exit ${r.code}]\n${r.stdout}${r.stderr}`);
    return r;
  }

  devai(args: string[]): Ran {
    return this.exec([resolve(this.dir, 'node_modules/.bin/devai'), ...args]);
  }

  check(args: string[]): Report {
    return parseReport(this.devai(['check', ...args, '--format', 'json']));
  }

  /** Records a step from its mismatches; `pending` names the law's form when it is not the current one. */
  record(step: string, observed: string, mismatches: string[], pending: string[] = []): boolean {
    this.steps.push({ step, ok: mismatches.length === 0, observed, mismatches, pending });
    const mark = mismatches.length === 0 ? 'ok ' : 'NOT';
    console.log(`  ${mark} ${this.id} ${step}: ${observed}${mismatches.map((m) => `\n        ✗ ${m}`).join('')}${pending.map((p) => `\n        pending: ${p}`).join('')}`);
    return mismatches.length === 0;
  }

  expectExit(step: string, r: Ran, exit: number, pending: string[] = []): boolean {
    const first = (r.stdout + r.stderr).split('\n').find((l) => l.trim() !== '') ?? '';
    return this.record(step, `exit ${r.code} ${first.slice(0, 140)}`, r.code === exit ? [] : [`exit ${r.code}, expected ${exit}`], pending);
  }

  expectRows(step: string, r: Report, e: Rows, pending: string[] = []): boolean {
    return this.record(step, summary(r), compare(r, e), pending);
  }

  commit(message: string): Ran {
    this.exec(['git', 'add', '-A']);
    return this.exec(['git', 'commit', '-q', '-m', message]);
  }

  result(options: string, started: number, extra: Partial<CellResult> = {}): CellResult {
    const pending = [...new Set(this.steps.flatMap((s) => s.pending))];
    return { cell: this.id, runtime: this.runtime, options, verdict: this.steps.every((s) => s.ok) ? 'met' : 'not met', steps: this.steps, pending, durationMs: Date.now() - started, ...extra };
  }
}

const P2 = 'packets/CMP-DEMO-001/PKT-DEMO-002.md';
const P3 = 'packets/CMP-DEMO-001/PKT-DEMO-003.md';
const P4 = 'packets/CMP-DEMO-001/PKT-DEMO-004.md';
const SPEC = 'specs/notes/SPEC-DEMO-001.md';
const ACCEPTANCE = 'domain/notes/api/test/acceptance/spec-demo-001.acceptance.spec.ts';

const readJson = (p: string): Record<string, unknown> => JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
const writeJson = (p: string, v: unknown, indent = 2): void => writeFileSync(p, `${JSON.stringify(v, null, indent)}\n`);
const sorted = (o: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));

/** Applies `new module`'s printed mount lines (09 §2, §6) as written; anything else is a failure. */
export function applyMount(dir: string, lines: string[]): string[] {
  const bad: string[] = [];
  const touched = new Set<string>();
  for (const line of lines) {
    let m: RegExpExecArray | null;
    if ((m = /^mount: add "([^"]+)": "workspace:\*" to (\S+) and (\w+) to (\S+?)(?: imports)?, then pnpm install$/.exec(line))) {
      const [, pkg, manifest, symbol, file] = m as unknown as [string, string, string, string, string];
      const j = readJson(resolve(dir, manifest));
      j['dependencies'] = sorted({ ...(j['dependencies'] as Record<string, string>), [pkg]: 'workspace:*' });
      writeJson(resolve(dir, manifest), j);
      let src = readFileSync(resolve(dir, file), 'utf8');
      const imports = [...src.matchAll(/^import .*;$/gm)];
      const last = imports[imports.length - 1]!;
      src = `${src.slice(0, last.index + last[0].length)}\nimport { ${symbol} } from '${pkg}';${src.slice(last.index + last[0].length)}`;
      if (file.endsWith('app.module.ts')) {
        const at = src.indexOf('\n  ],\n  providers:');
        if (at < 0) bad.push(`${file}: no imports array`);
        src = `${src.slice(0, at)}\n    ${symbol},${src.slice(at)}`;
      } else {
        src = src.replace(/Routes = \[(.*)\];/, (_all, inner: string) => `Routes = [${inner}${inner.trim() === '' ? '' : ', '}...${symbol}];`);
      }
      writeFileSync(resolve(dir, file), src);
      touched.add(manifest).add(file);
    } else if ((m = /^mount: add \{ "path": "([^"]+)" \} to (\S+) references$/.exec(line))) {
      const [, path, file] = m as unknown as [string, string, string];
      const j = readJson(resolve(dir, file));
      j['references'] = [...((j['references'] as object[] | undefined) ?? []), { path }];
      writeJson(resolve(dir, file), j);
      touched.add(file);
    } else if ((m = /^mount: add "([^"]+)" to \.stynxrc\.json (\w+)\.(\w+)$/.exec(line))) {
      const [, value, a, b] = m as unknown as [string, string, string, string];
      const j = readJson(resolve(dir, '.stynxrc.json')) as Record<string, Record<string, string[]>>;
      j[a]![b] = [...(j[a]![b] ?? []), value];
      writeFileSync(resolve(dir, '.stynxrc.json'), `${JSON.stringify(j)}\n`);
      touched.add('.stynxrc.json');
    } else if (line !== 'mount: then pnpm -r build') {
      bad.push(`unrecognised mount line: ${line}`);
    }
  }
  return bad.length > 0 ? bad : [...touched];
}

/** 09 §4 steps 1–8 of one option cell (or of O2 as the negative cells' default). Returns false once a step blocks the next. */
function campaign(c: Cell, o: OptionCell, work: string): boolean {
  const initArgs = ['--product', 'demo', ...(o.lgpd ? ['--lgpd'] : []), ...(o.ptBR ? ['--locales', 'en-US,pt-BR'] : []), ...(o.runtime === 'docker' ? ['--runtime', 'docker'] : [])];
  // 1. init
  const init = c.exec([process.execPath, MAIN, 'init', '--dir', c.dir, ...initArgs], work);
  if (!c.expectExit('1 init', init, 0)) return false;
  const trailers = c.exec(['git', 'log', '--format=%(trailers:key=Packet,valueonly)']).stdout.split('\n').map((s) => s.trim()).filter(Boolean);
  c.record('1 init commits', trailers.join(', '), trailers.join(',') === 'CMP-DEMO-001,PKT-DEMO-001' ? [] : ['expected trailers CMP-DEMO-001, PKT-DEMO-001 (D-120)']);
  const config = readJson(resolve(c.dir, 'devai.json'));
  const want = { lgpd: o.lgpd, locales: o.ptBR ? ['en-US', 'pt-BR'] : ['en-US'] };
  c.record('1 devai.json', JSON.stringify({ lgpd: config['lgpd'], locales: config['locales'] }), JSON.stringify({ lgpd: config['lgpd'], locales: config['locales'] }) === JSON.stringify(want) ? [] : [`expected ${JSON.stringify(want)}`]);

  // 2. --packet PKT-DEMO-002 --full: PL-15 line, exit 1
  c.expectRows('2 check PKT-DEMO-002', c.check(['--packet', P2, '--full']), { exit: 1, findings: [['accept', 'required node skipped for kind: generate']] });

  // 3. rebase, new module, mount, pnpm install, pnpm -r build, commit
  if (!c.expectExit('3 packet rebase PKT-DEMO-002', c.devai(['packet', 'rebase', P2, '--to', 'HEAD']), 0)) return false;
  const gen = c.devai(['new', 'module', '--spec', SPEC, ...(o.web ? ['--web'] : [])]);
  if (!c.expectExit('3 new module', gen, 0)) return false;
  const mount = gen.stdout.split('\n').filter((l) => l.startsWith('mount: '));
  c.record('3 mount lines', `${mount.length} lines, last "${mount[mount.length - 1] ?? ''}"`, mount[mount.length - 1] === 'mount: then pnpm -r build' ? [] : ['last mount line is not "mount: then pnpm -r build" (D-109)']);
  const files = applyMount(c.dir, mount);
  if (!c.record('3 mount applied', files.join(' '), files.some((f) => f.startsWith('unrecognised') || f.includes(': no ')) ? files : [])) return false;
  c.exec([resolve(c.dir, 'node_modules/.bin/prettier'), '--write', ...files]);
  if (o.web) c.record('3 --web module', 'domain/notes/web', existsSync(resolve(c.dir, 'domain/notes/web/src')) ? [] : ['domain/notes/web/src absent']);
  if (o.ptBR) c.record('3 pt-BR catalogue', 'notes.i18n.pt-br.ts', existsSync(resolve(c.dir, 'domain/notes/api/src/notes.i18n.pt-br.ts')) ? [] : ['domain/notes/api/src/notes.i18n.pt-br.ts absent']);
  // Step 3's `pnpm install` writes the new workspace package into the lock the step-3 commit carries, as it does
  // on the agent's machine; under CI=true pnpm would refuse that unless told (R8 PR ## Open).
  if (!c.expectExit('3 pnpm install', c.exec(['pnpm', 'install', '--no-frozen-lockfile']), 0)) return false;
  if (!c.expectExit('3 pnpm -r build', c.exec(['pnpm', '-r', 'build']), 0)) return false;
  if (!c.expectExit('3 commit (hooks)', c.commit('feat(notes): generate the notes module\n\nPacket: PKT-DEMO-002'), 0)) return false;

  // 4. --packet PKT-DEMO-002 --full
  const s4 = c.check(['--packet', P2, '--full']);
  c.expectRows('4 check PKT-DEMO-002', s4, STEP4, [`exit 0 (09 §4 step 4) after ${S10[1]}, ${S10[2]}, ${S10[4]}`]);
  if (o.lgpd) c.record('4 --lgpd sql-lint', rowOf(s4.nodes?.find((n) => n.id === 'sql-lint') ?? { id: 'sql-lint', status: 'absent', findings: [] }), s4.nodes?.find((n) => n.id === 'sql-lint')?.status === 'PASS' ? [] : ['sql-lint not PASS'], [`LINT012 reads author_alias as PII after ${S10[5]}`]);
  if (o.ptBR) {
    const i18n = s4.nodes?.find((n) => n.id === 'i18n');
    c.record('4 pt-BR i18n', i18n ? `${rowOf(i18n)} ${String((i18n as unknown as { observed?: number }).observed ?? '')}` : 'absent', i18n?.status === 'PASS' ? [] : ['i18n not PASS']);
  }
  if (o.web) {
    const e2e = s4.nodes?.find((n) => n.id === 'e2e');
    c.record('4 --web e2e', e2e ? rowOf(e2e) : 'absent', e2e?.status === 'PASS' ? [] : ['e2e not PASS']);
  }

  // 5. rebase PKT-DEMO-003, add the reference acceptance file (D-098), commit
  if (!c.expectExit('5 packet rebase PKT-DEMO-003', c.devai(['packet', 'rebase', P3, '--to', 'HEAD']), 0)) return false;
  mkdirSync(resolve(c.dir, dirname(ACCEPTANCE)), { recursive: true });
  cpSync(resolve(FIXTURES, 'SPEC-DEMO-001.acceptance.spec.ts'), resolve(c.dir, ACCEPTANCE));
  if (!c.expectExit('5 commit (hooks)', c.commit('test(notes): derive the SPEC-DEMO-001 acceptance tests\n\nPacket: PKT-DEMO-003'), 0)) return false;

  // 6. --packet PKT-DEMO-003 --full --expect-red: exit 0, expect-red 3 (R-1, R-2, R-4)
  c.expectRows('6 check PKT-DEMO-003 --expect-red', c.check(['--packet', P3, '--full', '--expect-red']), STEP6, [
    `exit 0, spec-tests PASS with expect-red 3 (R-1, R-2, R-4) after ${S10[2]}, ${S10[3]}, ${S10[8]}, ${S10[1]}, ${S10[4]}, ${S10[7]}`,
  ]);

  // 7. rebase PKT-DEMO-004, add the reference service and repository bodies (D-098) and their unit spec (D-131), commit
  // D-124 judges PL-14 at --to; D-135's whole-file context entry fits the 09 §6 seed there.
  const rebased = c.expectExit('7 packet rebase PKT-DEMO-004', c.devai(['packet', 'rebase', P4, '--to', 'HEAD']), 0);
  for (const f of ['notes.service.ts', 'notes.repository.ts']) cpSync(resolve(FIXTURES, f), resolve(c.dir, 'domain/notes/api/src', f));
  cpSync(resolve(FIXTURES, 'notes.service.spec.ts'), resolve(c.dir, 'domain/notes/api/test/notes.service.spec.ts'));
  if (!c.expectExit('7 commit (hooks)', c.commit('feat(notes): implement note creation and retrieval\n\nPacket: PKT-DEMO-004'), 0)) return false;

  // 8. --packet PKT-DEMO-004 --full: exit 0
  const s8 = c.check(['--packet', P4, '--full']);
  c.packetUsable = s8.reason !== 'packet-invalid';
  c.expectRows('8 check PKT-DEMO-004', s8, rebased ? STEP8 : { exit: 2, message: 'does not exist at base' }, [
    `exit 0 after ${S10[1]}, ${S10[2]}, ${S10[3]}, ${S10[4]}, ${S10[7]}, ${S10[8]}`,
  ]);
  return true;
}

/** C.4 `schemaDigest` of the cell's last `db-apply` PASS, or null (none today: S10 #2). */
function schemaDigestOf(c: Cell): string | null {
  const r = c.check(['--only', 'db-apply']);
  const d = r.nodes?.find((n) => n.id === 'db-apply');
  return d?.status === 'PASS' ? String((d.details as { schemaDigest?: string } | undefined)?.schemaDigest ?? '') : null;
}

// ---- negative cells (D-098: mutate O2 after PKT-DEMO-004) -----------------------------------------

interface Negative {
  id: string;
  title: string;
  /** Skips with this named reason when it returns a string. */
  skip?: () => string | null;
  run: (c: Cell, head: string) => void;
}

const edit = (c: Cell, path: string, from: string | RegExp, to: string): void => {
  const p = resolve(c.dir, path);
  const before = readFileSync(p, 'utf8');
  const after = before.replace(from, to);
  if (after === before) throw new Error(`${path}: ${String(from)} not found`);
  writeFileSync(p, after);
};

const removeLine = (c: Cell, path: string, pattern: RegExp): void => edit(c, path, new RegExp(`^.*${pattern.source}.*\\n`, 'm'), '');

/** N1: the POST handler's decorator lines, one per run. */
const N1_RUNS: { decorator: string; pattern: RegExp; expect: Rows }[] = [
  { decorator: '@NoIdempotent', pattern: /^ {2}@NoIdempotent\(\)\n/m, expect: { exit: 1, nodes: { 'route-contract': 'FAIL', lint: 'FAIL' }, findings: [['route-contract', 'POST /notes lacks @NoIdempotent [S-28]'], ['lint', 'require-idempotent-route-decorator']] } },
  { decorator: '@RequireRoles', pattern: /^ {2}@RequireRoles\(\['demo-member'\], 'all'\)\n/m, expect: { exit: 1, nodes: { 'route-contract': 'FAIL' }, findings: [['route-contract', 'POST /notes lacks @RequireRoles [S-28]'], ['route-contract', 'POST /notes neither role-bound nor @Public() [S-11]']] } },
  { decorator: '@ErrorContract', pattern: /^ {2}@ErrorContract\(\[\n(?: {4}.*\n)+? {2}\]\)\n/m, expect: { exit: 1, nodes: { 'route-contract': 'FAIL' }, findings: [['route-contract', 'POST /notes lacks @ErrorContract [S-28]']] } },
  { decorator: '@UseCase', pattern: /^ {2}@UseCase\('UC-DEMO-001'\)\n/m, expect: { exit: 1, nodes: { 'route-contract': 'FAIL' }, findings: [['route-contract', 'POST /notes lacks @UseCase [S-28]']] } },
  { decorator: '@Slo', pattern: /^ {2}@Slo\(\{ metric: 'http.server.duration', percentile: 95, maxMs: 500 \}\)\n/m, expect: { exit: 1, nodes: { 'route-contract': 'FAIL' }, findings: [['route-contract', 'POST /notes @Slo missing (spec: p95 500 ms) [S-25]']] } },
];

const CONTROLLER = 'domain/notes/api/src/notes.controller.ts';
/**
 * D-130: a negative row runs the default cell's own acceptance, PKT-DEMO-004's `--packet --full`. While that
 * packet fails the pre-DAG rules (step 8, Open `range`), every such run would be the same exit 2, so the row
 * runs `--full` and names the packet form as pending.
 */
const nRun = (c: Cell): string[] => (c.packetUsable ? ['--packet', P4, '--full'] : ['--full']);
const nPending = (c: Cell): string[] => (c.packetUsable ? [] : [`the row under --packet PKT-DEMO-004 --full (D-130) after PKT-DEMO-004 passes the pre-DAG rules`]);
const SQL = 'domain/notes/db/demo_notes_notes.sql';

/** The negative cells; each starts from O2's state after step 7's commit (`head`) with a clean tree. */
export const NEGATIVES: Negative[] = [
  {
    id: 'N1', title: 'one contract decorator removed (five runs)',
    run: (c) => {
      for (const r of N1_RUNS) {
        reset(c);
        edit(c, CONTROLLER, r.pattern, '');
        // D-098: each run also carries D-087's tooling-missing lines (S10 #4) for the role-bound routes.
        c.expectRows(`N1 ${r.decorator}`, c.check(nRun(c)), { ...r.expect, findings: [...r.expect.findings!, ['route-contract', 'reads RequireRoles']] }, [...nPending(c)]);
      }
    },
  },
  {
    id: 'N2', title: 'parseDto( removed from the POST body parameter',
    run: (c) => {
      edit(c, CONTROLLER, 'const parsedBody = parseDto(createNoteBody, body);', 'const parsedBody = body as CreateNoteBody;');
      edit(c, CONTROLLER, "import { createNoteBody, type CreateNoteResponse } from './dto/create-note.dto.js';", "import type { CreateNoteBody, CreateNoteResponse } from './dto/create-note.dto.js';");
      c.expectRows('N2', c.check(nRun(c)), { exit: 1, nodes: { 'route-contract': 'FAIL' }, findings: [['route-contract', '@Body() without parseDto [S-26]']] }, [...nPending(c)]);
    },
  },
  {
    id: 'N3', title: 'repository z.string().max(80) → max(1024)',
    run: (c) => {
      edit(c, 'domain/notes/api/src/notes.repository.ts', 'params: z.tuple([z.string().min(1).max(80),', 'params: z.tuple([z.string().min(1).max(1024),');
      // Under --full the DB phase is planned, so db-apply's FAIL (S10 #2) masks the static finding too.
      c.expectRows('N3', c.check(nRun(c)), { exit: 1, nodes: { 'sql-typed': 'UNKNOWN prerequisite-failed', 'db-apply': 'FAIL' } }, [`sql-typed FAIL static (≠ spec limit) and DB (exceeds varchar(80)) after ${S10[2]}`, ...nPending(c)]);
    },
  },
  ...(['ENABLE', 'FORCE', 'POLICY'] as const).map((what, i): Negative => ({
    id: `N4${'abc'[i]}`, title: `${what} line removed from db/demo_notes_notes.sql`,
    run: (c) => {
      removeLine(c, SQL, what === 'POLICY' ? /CREATE POLICY/ : new RegExp(`${what} ROW LEVEL SECURITY`));
      c.expectRows(`N4${'abc'[i]}`, c.check(nRun(c)), { exit: 1, nodes: { 'sql-lint': 'FAIL' }, findings: [['sql-lint', 'LINT013'], ['sql-lint', 'present at base differs at head']] }, [`sql-lint LINT001 after ${S10[5]}`, `db-apply FAIL checks.sql forced-RLS assertion after ${S10[2]}`, ...nPending(c)]);
    },
  })),
  {
    id: 'N5', title: '-- @pii line removed',
    run: (c) => {
      removeLine(c, SQL, /-- @pii:/);
      c.expectRows('N5', c.check(nRun(c)), { exit: 1, nodes: { 'sql-lint': 'FAIL' }, findings: [['sql-lint', 'LINT013']] }, [`sql-lint LINT012 after ${S10[5]}`, ...nPending(c)]);
    },
  },
  {
    id: 'N6', title: 'demo.notes.missing removed from notes.i18n.en-us.ts',
    run: (c) => {
      removeLine(c, 'domain/notes/api/src/notes.i18n.en-us.ts', /'demo\.notes\.missing'/);
      c.expectRows('N6', c.check(nRun(c)), { exit: 1, nodes: { i18n: 'FAIL', generated: 'FAIL' }, findings: [['i18n', 'missing key demo.notes.missing [S-16]'], ['generated', 'notes.i18n.en-us.ts:1 differs from regeneration [S-45]']] }, [...nPending(c)]);
    },
  },
  {
    id: 'N7a', title: "one it('R-3: …') removed",
    run: (c) => {
      edit(c, ACCEPTANCE, /\n\n {2}it\('R-3: role-boundary'[\s\S]*?\n {2}\}\);\n/, '\n');
      c.expectRows('N7a', c.check(nRun(c)), { exit: 1, nodes: { 'test-integrity': 'FAIL', format: 'PASS' }, findings: [['test-integrity', "it('R-3: …') removed for an acceptance: yes requirement [S-63]"]] }, [`spec-tests FAIL uncovered R-3 [S-65] (spec-tests is prerequisite-failed today) after ${S10[2]}`, ...nPending(c)]);
    },
  },
  {
    id: 'N7b', title: 'acceptance file deleted',
    run: (c) => {
      rmSync(resolve(c.dir, ACCEPTANCE));
      c.expectRows('N7b', c.check(nRun(c)), { exit: 1, nodes: { 'test-integrity': 'FAIL', 'spec-tests': 'SKIPPED', accept: 'FAIL' }, findings: [['test-integrity', 'acceptance file changed without @acceptance-change [S-63]'], ['accept', 'required node skipped for kind: code: spec-tests (inventory: no acceptance file for SPEC-DEMO-001)']] }, [...nPending(c)]);
    },
  },
  {
    id: 'N8', title: 'create-note.dto.ts max(80) → max(81) by hand',
    run: (c) => {
      edit(c, 'domain/notes/api/src/dto/create-note.dto.ts', 'title: z.string().min(1).max(80),', 'title: z.string().min(1).max(81),');
      c.expectRows('N8', c.check(nRun(c)), { exit: 1, nodes: { generated: 'FAIL' }, findings: [['generated', 'create-note.dto.ts:1 differs from regeneration [S-45]']] }, [...nPending(c)]);
    },
  },
  {
    id: 'N9', title: 'notes.service.ts edited, then --regenerate (same id)',
    run: (c) => {
      edit(c, 'domain/notes/api/src/notes.service.ts', '@Injectable()', '// edited by hand\n@Injectable()');
      const r = c.devai(['new', 'module', '--spec', SPEC, '--regenerate']);
      const status = c.exec(['git', 'status', '--porcelain']).stdout.trim().split('\n').filter(Boolean);
      const mism = [
        ...(r.code === 0 ? [] : [`exit ${r.code}, expected 0`]),
        ...(r.stdout.includes('domain/notes/api/src/notes.service.ts: seed edited, left alone') ? [] : ['no "seed edited, left alone" line for notes.service.ts']),
        ...(status.length === 1 && status[0]!.endsWith('domain/notes/api/src/notes.service.ts') ? [] : [`working tree: ${status.join(', ')} (expected only notes.service.ts: generated files byte-identical)`]),
      ];
      c.record('N9', `exit ${r.code}; ${status.length} changed path(s)`, mism);
    },
  },
  {
    id: 'N10', title: 'spec status: draft',
    run: (c) => {
      edit(c, SPEC, 'status: approved', 'status: draft');
      const r = c.devai(['new', 'module', '--spec', SPEC, '--format', 'json']);
      c.record('N10', `exit ${r.code} ${r.stdout.trim().slice(0, 120)}`, r.code === 2 && r.stdout.includes('spec-not-approved') ? [] : [`exit ${r.code}, expected 2 spec-not-approved`]);
    },
  },
  {
    id: 'N11', title: 'successor spec adds a column, --regenerate',
    run: (c) => {
      const old = readFileSync(resolve(c.dir, SPEC), 'utf8');
      const digest = spawnSync(process.execPath, ['-e', `process.stdout.write(require('crypto').createHash('sha256').update(require('fs').readFileSync(${JSON.stringify(resolve(c.dir, SPEC))})).digest('hex'))`], { encoding: 'utf8' }).stdout;
      const successor = old
        .replace('# SPEC-DEMO-001', '# SPEC-DEMO-002')
        .replace('id: SPEC-DEMO-001\n', `id: SPEC-DEMO-002\nsupersedes: {id: SPEC-DEMO-001, path: ${SPEC}, sha256: "${digest}"}\n`)
        .replace('          retention: RN-DEMO-002/until-workspace-destruction\n', '          retention: RN-DEMO-002/until-workspace-destruction\n        - {name: color, type: varchar, limits: {minLength: 1, maxLength: 20}, nullable: true}\n');
      const path = 'specs/notes/SPEC-DEMO-002.md';
      writeFileSync(resolve(c.dir, path), successor);
      const sqlBefore = readFileSync(resolve(c.dir, SQL), 'utf8');
      const r = c.devai(['new', 'module', '--spec', path, '--regenerate']);
      const mism = [
        ...(r.code === 0 ? [] : [`exit ${r.code}, expected 0: ${(r.stdout + r.stderr).trim().slice(0, 200)}`]),
        ...(readFileSync(resolve(c.dir, SQL), 'utf8') === sqlBefore ? [] : ['base-present db/*.sql rewritten']),
        ...(r.stdout.includes('by hand and append it to database/seed/modules.txt') ? [] : ['no migration line printed']),
      ];
      c.record('N11 --regenerate', `exit ${r.code}`, mism);
      edit(c, SQL, 'CREATE INDEX', '-- edited\nCREATE INDEX');
      c.expectRows('N11 old SQL edited', c.check(nRun(c)), { exit: 1, nodes: { 'sql-lint': 'FAIL' }, findings: [['sql-lint', 'LINT013']] }, [`sql-typed DB FAIL until the hand migration exists, after ${S10[2]}`, ...nPending(c)]);
    },
  },
  {
    id: 'N12', title: '@stynx-nyx/cli uninstalled',
    run: (c) => {
      // A real uninstall changes the root manifest and the lock, so no verdict cached for the installed
      // candidate stands; the reset after the row restores both, and the install restores node_modules.
      c.exec(['pnpm', 'remove', '-w', '@stynx-nyx/cli']);
      try {
        // The shell's own wording follows (bash: `No such file or directory`, dash: `not found`).
        c.expectRows('N12', c.check(nRun(c)), { exit: 1, nodes: { 'route-contract': 'UNKNOWN tooling-missing', boundary: 'UNKNOWN tooling-missing', 'db-apply': 'FAIL', openapi: 'SKIPPED' }, findings: [['route-contract', 'stynx not resolvable from node_modules/.bin'], ['boundary', 'stynx not resolvable from node_modules/.bin'], ['db-apply', 'database/apply.sh exited 1'], ['db-apply', 'tooling-missing — db-apply: stynx not resolvable from node_modules/.bin (rls-negative)']] }, [...nPending(c)]);
      } finally {
        reset(c);
        c.exec(['pnpm', 'install', '--no-frozen-lockfile']);
      }
    },
  },
  {
    id: 'N13', title: 'code packet protected: [] touches .github/**, then widens protected: [ci]',
    run: (c) => {
      edit(c, P4, 'protected: [spec]', 'protected: []');
      mkdirSync(resolve(c.dir, '.github/workflows'), { recursive: true });
      writeFileSync(resolve(c.dir, '.github/workflows/notes.yml'), 'name: notes\non: push\njobs:\n  noop:\n    runs-on: ubuntu-24.04\n    steps:\n      - run: echo notes\n');
      c.commit('ci(notes): add a workflow\n\nPacket: PKT-DEMO-004');
      edit(c, P4, 'protected: []', 'protected: [ci]');
      c.commit('chore(packets): widen PKT-DEMO-004 protected\n\nPacket: PKT-DEMO-004');
      const r = c.check(nRun(c));
      const pp = r.nodes?.find((n) => n.id === 'protected-paths');
      const touched = (pp?.details as { touched?: { class: string; declared: boolean }[] } | undefined)?.touched ?? [];
      const ci = touched.find((t) => t.class === 'ci');
      c.record('N13', `${summary(r)} · ci touched, declared: ${String(ci?.declared)}`, [
        ...compare(r, { exit: 1, nodes: { 'protected-paths': 'PASS', review: 'UNKNOWN prerequisite-failed' } }),
        ...(ci?.declared === false ? [] : ['protected-paths: ci not touched with declared: false (D-078)']),
      ], [`protected:unplanned makes review gating (D-078) once review runs, after ${S10[1]}, ${S10[2]}, ${S10[4]}`, ...nPending(c)]);
    },
  },
  {
    id: 'N14', title: 'apps/api/src/validation.filter.ts edited after a green --full',
    run: (c) => {
      c.check(nRun(c));
      edit(c, 'apps/api/src/validation.filter.ts', '@Injectable()', '// edited\n@Injectable()');
      c.expectRows('N14', c.check(nRun(c)), { exit: 1, cached: { integration: false } }, [`spec-tests cache miss and re-run, unit a hit for unaffected projects (D-076), after a green --full, which needs ${S10[2]}`, ...nPending(c)]);
    },
  },
  {
    id: 'N15', title: 'pnpm-lock.yaml bumped (toolchain) after a green --full',
    run: (c) => {
      c.check(nRun(c));
      writeFileSync(resolve(c.dir, 'pnpm-lock.yaml'), `${readFileSync(resolve(c.dir, 'pnpm-lock.yaml'), 'utf8')}\n`);
      const r = c.check(nRun(c));
      const hits = (r.nodes ?? []).filter((n) => n.cached === true).map((n) => n.id);
      c.record('N15', summary(r), hits.length === 0 ? [] : [`cache hits after a toolchain bump: ${hits.join(', ')}`], [`review re-runs (D-076) once it runs at all, after ${S10[1]}, ${S10[2]}, ${S10[4]}`, ...nPending(c)]);
    },
  },
  {
    id: 'N16', title: '.DS_Store written in the working tree',
    run: (c) => {
      writeFileSync(resolve(c.dir, '.DS_Store'), 'x');
      const ignored = c.devai(['check', '--full']);
      const m1 = ignored.stdout.includes('untracked:') ? ['an untracked: line printed while .DS_Store is ignored'] : [];
      edit(c, '.gitignore', /^\.DS_Store\n/m, '');
      const unignored = c.devai(['check', '--full']);
      const m2 = unignored.stdout.includes('untracked: .DS_Store (not in any commit)') ? [] : ['no "untracked: .DS_Store (not in any commit)" line once the .gitignore line is removed'];
      c.record('N16', `ignored: exit ${ignored.code}; unignored: exit ${unignored.code}`, [...m1, ...m2]);
    },
  },
  {
    id: 'N17', title: 'Co-Authored-By Claude and GPT in base..HEAD',
    skip: () => (hasReviewers() ? null : 'needs the reviewer CLIs (claude, codex) on the host (D-079); not provisioned in CI'),
    run: (c) => {
      c.exec(['git', 'commit', '--allow-empty', '-q', '-m', 'chore(notes): one\n\nPacket: PKT-DEMO-004\nCo-Authored-By: Claude <noreply@anthropic.com>']);
      c.exec(['git', 'commit', '--allow-empty', '-q', '-m', 'chore(notes): two\n\nPacket: PKT-DEMO-004\nCo-Authored-By: GPT <noreply@openai.com>']);
      c.expectRows('N17', c.check(nRun(c)), { exit: 1, nodes: { review: 'UNKNOWN prerequisite-failed' } }, [`review UNKNOWN: family; review.json absent; exit 2 (D-079), once review runs, after ${S10[1]}, ${S10[2]}, ${S10[4]}`, ...nPending(c)]);
    },
  },
  {
    id: 'N18', title: "one unit case changed to it.skip('… // #123')",
    run: (c) => {
      edit(c, 'domain/notes/api/test/notes.controller.spec.ts', "it('rejects an undeclared body field with 400 VALIDATION'", "it.skip('rejects an undeclared body field with 400 VALIDATION // #123'");
      c.expectRows('N18', c.check(nRun(c)), { exit: 1, nodes: { 'test-integrity': 'PASS', unit: 'FAIL' }, findings: [['unit', '// #123: skipped [S-64]']] }, [...nPending(c)]);
    },
  },
  {
    id: 'N19', title: 'phase-2 reviewer prompt seeded with a write and a curl',
    skip: () => 'needs both reviewer CLIs with their sandboxes on the host (D-082, C.1 step 10); not provisioned in CI',
    run: () => undefined,
  },
  {
    id: 'N20', title: 'agentic.permissionsPattern.minConfidence 0.7 → 0.9 after a green --full',
    run: (c) => {
      const cfg = readJson(resolve(c.dir, 'devai.json')) as { agentic?: { permissionsPattern?: { minConfidence?: number } } };
      const pp = cfg.agentic?.permissionsPattern;
      if (pp?.minConfidence === undefined) throw new Error('devai.json has no agentic.permissionsPattern.minConfidence');
      pp.minConfidence = 0.9;
      writeJson(resolve(c.dir, 'devai.json'), cfg);
      c.exec([resolve(c.dir, 'node_modules/.bin/prettier'), '--write', 'devai.json']);
      c.expectRows('N20', c.check(nRun(c)), { exit: 1, nodes: { 'permissions-pattern': 'UNKNOWN prerequisite-failed', format: 'PASS' } }, [`CI permissions-pattern: UNKNOWN (stale) against committed evidence (D-083), after ${OPEN['evidence']}`, ...nPending(c)]);
    },
  },
];

function hasReviewers(): boolean {
  return ['claude', 'codex'].every((b) => spawnSync('sh', ['-c', `command -v ${b}`]).status === 0);
}

/** Back to O2 after step 7: tracked files restored, untracked files removed (ignored ones kept). */
function reset(c: Cell, head?: string): void {
  run(['git', 'reset', '-q', '--hard', head ?? 'HEAD'], c.dir, c.env);
  run(['git', 'clean', '-fdq'], c.dir, c.env);
}

// ---- driver -----------------------------------------------------------------------------------------

function baseEnv(work: string, runtime: Runtime): NodeJS.ProcessEnv {
  if (!process.env['NODE_AUTH_TOKEN']) throw new Error('NODE_AUTH_TOKEN is not set: @stynx-nyx/* install from the GitHub registry');
  const pnpmfile = resolve(work, 'pnpmfile.cjs');
  writeFileSync(pnpmfile, [
    '// 09 §4 cells until R10: @devai-nyx/{cli,decorators} 3.0.0 are unpublished, so installs link this repository.',
    `const LINK = ${JSON.stringify({ '@devai-nyx/cli': `link:${CLI}`, '@devai-nyx/decorators': `link:${resolve(REPO, 'packages/decorators')}` })};`,
    'module.exports = { hooks: { readPackage(pkg) {',
    "  for (const k of ['dependencies', 'devDependencies']) for (const [n, v] of Object.entries(LINK)) if (pkg[k] && pkg[k][n]) pkg[k][n] = v;",
    '  return pkg;',
    '} } };',
  ].join('\n'));
  // The `pnpm` first on PATH stands in for init's `pnpm add -w -D --save-exact @devai-nyx/cli@<v>` (D-139; 404 until R10):
  // it writes the exact pin, then runs a real install, which the pnpmfile resolves to this repository, so the
  // lock init commits matches its manifest as a real add leaves it. `--no-frozen-lockfile` is explicit because
  // pnpm forces a frozen install under CI=true, which stays set (the model nodes verify evidence there, C.1).
  // init's bare `pnpm install` after the add (D-140) runs unfrozen for the same reason. Every other call is the
  // real pnpm. Goes at R10.
  const real = spawnSync('sh', ['-c', 'command -v pnpm'], { encoding: 'utf8' }).stdout.trim();
  if (real === '') throw new Error('pnpm is not on PATH');
  const shimDir = resolve(work, 'shim');
  mkdirSync(shimDir, { recursive: true });
  const pin = `const f=require('fs');const p=JSON.parse(f.readFileSync('package.json','utf8'));const v=process.argv[1].split('@').pop();p.devDependencies=Object.fromEntries(Object.entries({...p.devDependencies,'@devai-nyx/cli':v}).sort(([a],[b])=>a.localeCompare(b)));f.writeFileSync('package.json',JSON.stringify(p,null,2)+'\\n')`;
  writeFileSync(resolve(shimDir, 'pnpm'), [
    '#!/bin/sh',
    'if [ "$1" = add ]; then',
    // pnpm's own refusal of `add` at a workspace root without -w (D-139), so the shim cannot mask it.
    `  case " $* " in *' -w '*|*' --workspace-root '*) ;; *) if [ -f pnpm-workspace.yaml ]; then echo ' ERR_PNPM_ADDING_TO_ROOT  Running this command will add the dependency to the workspace root' >&2; exit 1; fi ;; esac`,
    `  for a in "$@"; do case "$a" in @devai-nyx/cli@*) "${process.execPath}" -e "${pin}" "$a" || exit $?;; esac; done`,
    `  exec '${real}' install --no-frozen-lockfile --reporter=silent`,
    'fi',
    `if [ "$*" = install ]; then exec '${real}' install --no-frozen-lockfile --reporter=silent; fi`,
    `exec '${real}' "$@"`,
    '',
  ].join('\n'));
  chmodSync(resolve(shimDir, 'pnpm'), 0o755);
  const env: NodeJS.ProcessEnv = { ...process.env, npm_config_global_pnpmfile: pnpmfile, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' };
  env['PATH'] = `${shimDir}${delimiter}${dirname(process.execPath)}${delimiter}${process.env['PATH'] ?? ''}`;
  if (runtime === 'bare' && !env['DATABASE_URL']) env['DATABASE_URL'] = 'postgresql://postgres:postgres@localhost:5432/postgres';
  if (runtime === 'docker') {
    delete env['DATABASE_URL'];
    env['POSTGRES_USER'] ??= 'postgres';
    env['POSTGRES_PASSWORD'] ??= 'postgres';
    env['POSTGRES_DB'] ??= 'postgres';
  }
  return env;
}

function dockerDown(c: Cell): void {
  if (c.runtime === 'docker' && existsSync(resolve(c.dir, 'compose.yaml'))) c.exec(['docker', 'compose', 'down', '-v', '--remove-orphans']);
}

export function runCells(ids: string[], runtime: Runtime, work: string): CellResult[] {
  const env = baseEnv(work, runtime);
  const results: CellResult[] = [];
  const negatives = ids.filter((id) => /^N/.test(id));
  for (const id of ids.filter((x) => /^O/.test(x))) {
    const o = optionCell(id);
    if (!o) throw new Error(`unknown cell ${id}`);
    if (o.runtime !== runtime) throw new Error(`${id} is a ${o.runtime} cell; pass --runtime ${o.runtime}`);
    const started = Date.now();
    console.log(`${id} · ${label(o)} · ${runtime}`);
    const c = new Cell(id, runtime, work, env);
    try {
      campaign(c, o, work);
      const digest = c.steps.some((s) => s.step.startsWith('8')) ? schemaDigestOf(c) : null;
      results.push(c.result(label(o), started, { schemaDigest: digest, pending: [...new Set([...c.steps.flatMap((s) => s.pending), ...(digest === null ? [`schemaDigest equal across bare and docker (D-039, C.4) after ${S10[2]}`] : [])])] }));
    } catch (e) {
      c.record('error', String((e as Error).stack ?? e).split('\n')[0]!, ['runner error']);
      results.push(c.result(label(o), started));
    } finally {
      dockerDown(c);
    }
  }
  if (negatives.length > 0) {
    if (runtime !== 'bare') throw new Error('negative cells run on the default cell, O2, bare (D-098)');
    console.log(`N-base · O2 (--lgpd) · bare, steps 1–8`);
    const base = new Cell('N-base', 'bare', work, env);
    const baseStarted = Date.now();
    const ok = campaign(base, optionCell('O2')!, work);
    // The default cell's own steps are a result too: a broken base must not read as N cells skipped.
    results.push(base.result('O2 (--lgpd), the default cell, steps 1–8', baseStarted));
    const head = run(['git', 'rev-parse', 'HEAD'], base.dir, base.env).stdout.trim();
    for (const id of negatives) {
      const n = NEGATIVES.find((x) => x.id === id);
      if (!n) throw new Error(`unknown cell ${id}`);
      const t = Date.now();
      console.log(`${n.id} · ${n.title}`);
      const reason = n.skip?.() ?? (ok ? null : 'the default cell O2 did not reach step 8');
      const c = new Cell(n.id, 'bare', work, env, base);
      c.packetUsable = base.packetUsable;
      if (reason) {
        console.log(`  skipped ${n.id}: ${reason}`);
        results.push({ cell: n.id, runtime: 'bare', options: n.title, verdict: 'skipped', reason, steps: [], pending: [], durationMs: 0 });
        continue;
      }
      reset(c, head);
      try {
        n.run(c, head);
      } catch (e) {
        c.record('error', String((e as Error).message), ['runner error']);
      }
      results.push(c.result(n.title, t));
      reset(c, head);
    }
  }
  return results;
}

// ---- the PR-body table ------------------------------------------------------------------------------

export function table(results: CellResult[]): string {
  const mark = (r: CellResult) => (r.verdict === 'met' ? '✅' : r.verdict === 'skipped' ? `skipped: ${r.reason ?? ''}` : '❌');
  const lines = ['| Cell | Options | Runtime | Result | Steps not met | Pending (law form waits on) |', '|---|---|---|---|---|---|'];
  for (const r of results) {
    const bad = r.steps.filter((s) => !s.ok).map((s) => `${s.step}: ${s.mismatches.join('; ')}`).join('<br>');
    lines.push(`| ${r.cell} | ${r.options} | ${r.runtime} | ${mark(r)} | ${bad || '—'} | ${r.pending.length} |`);
  }
  return lines.join('\n');
}

function main(argv: string[]): number {
  const arg = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const report = argv.indexOf('--report');
  if (report >= 0) {
    const results = argv.slice(report + 1).flatMap((f) => JSON.parse(readFileSync(f, 'utf8')) as CellResult[]);
    console.log(table(results));
    return 0;
  }
  const runtime = arg('--runtime');
  const cells = arg('--cells');
  if ((runtime !== 'bare' && runtime !== 'docker') || !cells) {
    console.error('usage: campaign.ts --runtime bare|docker --cells O1,…,N20 [--work <dir>] [--out <file.json>] · campaign.ts --report <file.json>…');
    return 2;
  }
  const work = arg('--work') ?? mkdtempSync(resolve(tmpdir(), 'devai-campaign-'));
  mkdirSync(work, { recursive: true });
  const ids = cells === 'all' ? [...Array.from({ length: 8 }, (_, i) => `O${runtime === 'bare' ? i + 1 : i + 9}`), ...(runtime === 'bare' ? NEGATIVES.map((n) => n.id) : [])] : cells.split(',');
  if (!existsSync(MAIN)) throw new Error(`${MAIN} is missing: run pnpm -r build first`);
  const results = runCells(ids, runtime, work);
  const out = arg('--out');
  if (out) writeJson(out, results);
  console.log(`\n${table(results)}\n\nwork: ${work}`);
  return results.every((r) => r.verdict !== 'not met') ? 0 : 1;
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));
