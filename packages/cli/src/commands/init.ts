// 08 A.1 `devai init`, 09 §1. Materialise (no `devai.json` in --dir): validate every input, write the
// 09 §1.1 tree from the installed package's `template/`, `git init` when the folder is not a work-tree
// root, `pnpm add -w -D --save-exact @devai-nyx/cli@<own version>` then `pnpm install` (installs the workspace
// and completes the lock, D-097; `-w`: the template root is a pnpm workspace root, D-139; `add -w` links only
// the root, so `pnpm install` links the apps, D-140), commit it as `chore(template): devai init <product>` (trailer `Packet: PKT-DEMO-001`),
// render the four CMP-DEMO-001 packets with `base` = that commit and commit them (trailer
// `Packet: CMP-DEMO-001`, D-120), both commits with the
// hooks live. Attach (`devai.json` present and `HEAD` has both of those commits, D-115): rewrite only
// the three hooks. Otherwise, with `devai.json` present, it is a re-run (a failed install or a hook-refused
// commit; D-112, D-113, D-115): the files on disk stay, the given inputs must equal devai.json's (D-116),
// the install runs again and whichever of the two commits is missing is made. Both modes set the worktree's
// hooks path and agent identity (D-057, D-058, 02 §5) and end with the preflight; exit 2
// `tooling-missing` when an item does not resolve or the install failed (then nothing is committed).
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DevaiConfig } from '../config.js';
import { git, GitFailed, log, revParse, topLevel } from '../git/git.js';
import { CommandRefusal, cliVersion, type Format, loadConfig } from '../main.js';
import { spawn } from '../proc/spawn.js';

/** The template as installed with the CLI (`<package>/template`), never a repository checkout. */
export const TEMPLATE_DIR = fileURLToPath(new URL('../../template/', import.meta.url));

/** npm and pnpm drop `.gitignore` and `.npmrc` from a packed package (D-074); the template stores its dotfiles without the dot. */
const RENAMED: Record<string, string> = { gitignore: '.gitignore', npmrc: '.npmrc', prettierignore: '.prettierignore' };
const HOOKS = ['scripts/hooks/pre-commit', 'scripts/hooks/pre-push', 'scripts/hooks/commit-msg'];
const PACKETS = 'packets/';
const BASE_LINE = /^base: [0-9a-f]{40}$/m;

/** 02 §5: the seven protected classes, the template default. */
const PROTECTED = {
  spec: ['specs/**', 'packets/**'],
  product: ['product/**'],
  decisions: ['decisions.md', 'law/**'],
  standards: ['tools/**', 'eslint.config.*', 'tsconfig*.json', 'devai.json', '.stynxrc.json', 'AGENTS.md', 'CLAUDE.md', '.agents/**', '.claude/skills/**'],
  infra: ['infra/**', 'database/ddl/**', 'database/migrations/**', 'compose.yaml'],
  ci: ['.github/**', 'scripts/**'],
  acceptance: ['domain/*/api/test/acceptance/**', 'test/**'],
};

export interface InitOptions {
  product?: string;
  locales?: string;
  lgpd?: boolean;
  runtime?: string;
  dir?: string;
}

export interface PreflightItem {
  node: string;
  binary: string;
  status: 'resolved' | 'missing';
  remedy?: string;
}

/** 08 A.8 values for a new repository (09 §1.1 `devai.json` row). */
export function renderConfig(product: string, locales: string[], lgpd: boolean, mode: 'bare' | 'docker'): DevaiConfig {
  return {
    $schema: 'https://devai.nyx/schema/devai.json/3',
    productPrefix: product,
    locales,
    lgpd,
    runtime: { mode, services: { postgres: { bare: 'env:DATABASE_URL', docker: 'compose:postgres' } } },
    protected: PROTECTED,
    review: { mustRun: false, reviewers: { claude: 'codex exec --model gpt-6-astra', gpt: 'claude -p --model claude-opus-5-5' } },
    agentic: { permissionsPattern: { minConfidence: 0.7, maxInputTokens: 60000 } },
    check: { editLoopCeilingMs: 90000 },
  };
}

/** One template file: its repository path, bytes or link target, and whether it is executable. */
interface Entry {
  path: string;
  bytes?: Buffer;
  link?: string;
  executable: boolean;
}

/** Every file under the installed template, renamed (D-074) and with the product tokens substituted. */
export function templateEntries(tokens: Record<string, string>, root = TEMPLATE_DIR): Entry[] {
  const out: Entry[] = [];
  const walk = (rel: string): void => {
    for (const d of readdirSync(resolve(root, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const from = rel === '' ? d.name : `${rel}/${d.name}`;
      const abs = resolve(root, from);
      const name = RENAMED[d.name] !== undefined && rel === '' ? RENAMED[d.name]! : d.name;
      const path = rel === '' ? name : `${rel}/${name}`;
      if (d.isDirectory()) walk(from);
      else {
        let text = readFileSync(abs, 'utf8');
        for (const [token, value] of Object.entries(tokens)) text = text.split(token).join(value);
        // A packed tarball keeps no mode bits: a script is what starts with a shebang.
        out.push({ path, bytes: Buffer.from(text, 'utf8'), executable: text.startsWith('#!') });
      }
    }
  };
  walk('');
  // 04 §1: skills live once in .agents/skills/; .claude/skills/<name> is a pointer. A packed tarball keeps
  // no symlink, so the pointers are made here.
  for (const e of [...out]) {
    const skill = /^\.agents\/skills\/([^/]+)\/SKILL\.md$/.exec(e.path);
    if (skill) out.push({ path: `.claude/skills/${skill[1]}`, link: `../../.agents/skills/${skill[1]}`, executable: false });
  }
  return out;
}

function write(dir: string, e: Entry): void {
  const abs = resolve(dir, e.path);
  mkdirSync(dirname(abs), { recursive: true });
  if (e.link !== undefined) {
    symlinkSync(e.link, abs);
    return;
  }
  writeFileSync(abs, e.bytes!);
  if (e.executable) chmodSync(abs, 0o755);
}

/** `git config` in the repository's own config: hooks path and the agent identity (A.1, 02 §5). */
async function configure(dir: string, product: string): Promise<Record<string, string>> {
  const values = { 'core.hooksPath': 'scripts/hooks', 'user.name': `${product}-agent`, 'user.email': `agent@${product}.local` };
  for (const [key, value] of Object.entries(values)) await git(dir, ['config', key, value]);
  return values;
}

async function host(argv: [string, ...string[]], cwd: string): Promise<boolean> {
  const r = await spawn({ argv, cwd, env: process.env, timeoutMs: 30_000 });
  return r.kind === 'exited' && r.code === 0;
}

/**
 * A.1 Preflight: every binary and library Part B names for the nodes whose population can be non-empty
 * on the template, resolved as the nodes resolve them (host PATH, `node_modules/.bin`, `node_modules`).
 */
export async function preflight(dir: string, mode: 'bare' | 'docker'): Promise<PreflightItem[]> {
  const deps = (() => {
    try {
      const pkg = JSON.parse(readFileSync(resolve(dir, 'package.json'), 'utf8')) as { devDependencies?: Record<string, string> };
      return pkg.devDependencies ?? {};
    } catch {
      return {};
    }
  })();
  const fromManifest = (pkg: string, pinned: string) => (pkg in deps ? 'pnpm install' : `pnpm add -w -D --save-exact ${pkg}@${pinned} && pnpm install`);
  const bin = (name: string) => existsSync(resolve(dir, 'node_modules/.bin', name));
  const lib = (name: string) => existsSync(resolve(dir, 'node_modules', name, 'package.json'));
  const checks: { nodes: string[]; binary: string; resolved: () => Promise<boolean> | boolean; remedy: string }[] = [
    { nodes: ['inventory'], binary: 'git', resolved: () => host(['git', '--version'], dir), remedy: 'install git' },
    { nodes: ['inventory'], binary: 'node', resolved: () => host(['node', '--version'], dir), remedy: 'install Node >=24 <25' },
    { nodes: ['inventory'], binary: 'corepack', resolved: () => host(['corepack', '--version'], dir), remedy: 'install Node >=24 <25 (it ships corepack)' },
    { nodes: ['inventory'], binary: 'pnpm', resolved: () => host(['pnpm', '--version'], dir), remedy: 'corepack enable' },
    { nodes: ['inventory', 'typecheck'], binary: 'tsc', resolved: () => bin('tsc'), remedy: fromManifest('typescript', '6.0.3') },
    { nodes: ['format'], binary: 'prettier', resolved: () => bin('prettier'), remedy: fromManifest('prettier', '3.9.6') },
    { nodes: ['lint', 'lint-tests', 'i18n'], binary: 'eslint', resolved: () => bin('eslint'), remedy: fromManifest('eslint', '10.10.0') },
    { nodes: ['lint', 'lint-tests', 'i18n'], binary: '@stynx-nyx/eslint-config', resolved: () => lib('@stynx-nyx/eslint-config'), remedy: fromManifest('@stynx-nyx/eslint-config', '3.0.0') },
    { nodes: ['lint', 'i18n'], binary: '@devai-nyx/cli', resolved: () => lib('@devai-nyx/cli'), remedy: '@devai-nyx/cli' in deps ? 'pnpm install' : installRemedy() },
    { nodes: ['sql-lint'], binary: 'stynx-migration-lint', resolved: () => bin('stynx-migration-lint'), remedy: fromManifest('@stynx-nyx/migration-linter', '3.0.0') },
    { nodes: ['unit', 'integration'], binary: 'vitest', resolved: () => bin('vitest'), remedy: fromManifest('vitest', '4.1.11') },
    { nodes: ['e2e'], binary: 'playwright', resolved: () => bin('playwright'), remedy: fromManifest('@playwright/test', '1.60.0') },
    { nodes: ['actionlint'], binary: 'github-actionlint', resolved: () => bin('github-actionlint'), remedy: fromManifest('github-actionlint', '1.7.12') },
    { nodes: ['commitlint'], binary: 'commitlint', resolved: () => bin('commitlint'), remedy: fromManifest('@commitlint/cli', '21.2.2') },
    { nodes: ['deadcode'], binary: 'knip', resolved: () => bin('knip'), remedy: fromManifest('knip', '6.35.1') },
    { nodes: ['deadcode'], binary: 'depcheck', resolved: () => bin('depcheck'), remedy: fromManifest('depcheck', '1.4.7') },
    { nodes: ['deadcode'], binary: 'madge', resolved: () => bin('madge'), remedy: fromManifest('madge', '8.0.0') },
    { nodes: ['route-contract', 'boundary', 'openapi', 'db-apply'], binary: 'stynx', resolved: () => bin('stynx'), remedy: fromManifest('@stynx-nyx/cli', '3.0.0') },
    { nodes: ['db-apply'], binary: 'sh', resolved: () => host(['sh', '-c', ':'], dir), remedy: 'install a POSIX sh' },
    { nodes: ['db-apply'], binary: 'psql', resolved: () => host(['psql', '--version'], dir), remedy: 'install the PostgreSQL 16 client (psql)' },
    ...(mode === 'docker' ? [{ nodes: ['db-apply'], binary: 'docker', resolved: () => host(['docker', 'compose', 'version'], dir), remedy: 'install Docker with the Compose plugin' }] : []),
  ];
  const out: PreflightItem[] = [];
  for (const c of checks) {
    const ok = await c.resolved();
    for (const node of c.nodes) out.push(ok ? { node, binary: c.binary, status: 'resolved' } : { node, binary: c.binary, status: 'missing', remedy: c.remedy });
  }
  return out;
}

const SLUG = /^[a-z][a-z0-9]*$/;

/** A string array as the template's Prettier options print it in TypeScript (`singleQuote`). */
const tsArray = (values: readonly string[]): string => `[${values.map((v) => `'${v}'`).join(', ')}]`;

/** JSON in the layout Prettier gives it (printWidth 100): an array of scalars on one line when it fits. */
export function prettyJson(value: unknown): string {
  return (
    JSON.stringify(value, null, 2).replace(/^( *)("[^"]*": )?\[\n((?:\1  [^\n\[\]{}]*\n)*?)\1\]/gm, (whole, indent: string, key: string | undefined, body: string) => {
      const line = `${indent}${key ?? ''}[${body.trim().split(/,\n\s*/).join(', ')}]`;
      return line.length <= 100 ? line : whole;
    }) + '\n'
  );
}

/** A.1 inputs, all validated before anything is written. */
function materialiseInputs(opts: InitOptions): { product: string; config: DevaiConfig } {
  if (opts.product === undefined) throw new CommandRefusal('usage', '--product <slug> is required when no devai.json exists (materialise mode)');
  if (!SLUG.test(opts.product)) throw new CommandRefusal('usage', `--product ${opts.product}: expected ^[a-z][a-z0-9]*$ (D-032)`);
  const mode = opts.runtime ?? 'bare';
  if (mode !== 'bare' && mode !== 'docker') throw new CommandRefusal('usage', `--runtime ${mode}: expected bare or docker`);
  const locales = (opts.locales ?? 'en-US').split(',').map((l) => l.trim());
  const parsed = DevaiConfig.safeParse(renderConfig(opts.product, locales, opts.lgpd === true, mode));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    throw new CommandRefusal('usage', `--locales ${locales.join(',')}: ${issue.message}`);
  }
  return { product: opts.product, config: parsed.data };
}

/** Empty or absent; a `.git` alone is admitted, since `init` runs `git init` only "if needed" (09 §1). */
function assertEmpty(dir: string): void {
  if (!existsSync(dir)) return;
  if (!lstatSync(dir).isDirectory()) throw new CommandRefusal('dir-not-empty', `${dir}: not a directory`);
  const rest = readdirSync(dir).filter((n) => n !== '.git');
  if (rest.length > 0) throw new CommandRefusal('dir-not-empty', `${dir}: not empty (${rest.sort()[0]}); materialise needs an empty or absent --dir`);
}

async function commit(dir: string, message: string, paths: string[]): Promise<string> {
  await git(dir, ['add', '-A', '--', ...paths]);
  // D-097: the install came first, so the hooks resolve and run; never `--no-verify`.
  try {
    await git(dir, ['commit', '--quiet', '-F', '-'], { stdin: message });
  } catch (e) {
    if (!(e instanceof GitFailed)) throw e;
    // The hook's report (git sends hook output to stderr): its node lines and its closing stage line.
    const lines = e.stderr.split('\n').map((l) => l.trim()).filter((l) => /^(FAIL|UNKNOWN)\b|^devai (pre-commit|commit-msg) /.test(l));
    const tail = (lines.length > 0 ? lines : [e.message]).join(' · ');
    throw new CommandRefusal('setup-failed', `git commit "${message.split('\n')[0]}" refused by the hooks: ${tail}; fix the findings, then run devai init again`);
  }
  return (await git(dir, ['rev-parse', 'HEAD'])).toString('utf8').trim();
}

/** D-097, D-139, D-140: materialise's install, `pnpm add -w` (the template root is a workspace root) then
 * `pnpm install` (`add -w` links only the root importer, not `apps/*`); the remedy prints both. */
export const installCommand = (): [string, ...string[]] => ['pnpm', 'add', '-w', '-D', '--save-exact', `@devai-nyx/cli@${cliVersion()}`];
export const installRemedy = (): string => `${installCommand().join(' ')} && pnpm install`;
const INSTALL_TIMEOUT_MS = 600_000;

/** Runs the two installs in `dir` (host `pnpm` from PATH, the registry `.npmrc` names); on failure the first `ERR_` line, else the first error line. */
async function install(dir: string): Promise<string | null> {
  for (const argv of [installCommand(), ['pnpm', 'install'] as [string, ...string[]]]) {
    const r = await spawn({ argv, cwd: dir, env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' }, timeoutMs: INSTALL_TIMEOUT_MS });
    if (r.kind === 'missing') return 'pnpm not found on PATH';
    if (r.code === 0 && !r.timedOut && !r.overflow) continue;
    const lines = `${r.stderr.toString('utf8')}\n${r.stdout.toString('utf8')}`.split('\n').map((l) => l.trim());
    return lines.find((l) => /\bERR_/.test(l)) ?? lines.find((l) => /error/i.test(l)) ?? (r.timedOut ? 'timed out' : `exited ${String(r.code)}`);
  }
  return null;
}

/** D-120: init's packets commit; its trailer names the campaign it seeds. */
const PACKETS_COMMIT = 'chore(packets): seed CMP-DEMO-001\n\nPacket: CMP-DEMO-001\n';

/** D-115, D-120: init's two commits in `HEAD`'s history, by their `Packet:` trailers (`PKT-DEMO-001`, `CMP-DEMO-001`). */
async function initCommits(dir: string): Promise<{ template: string | null; packets: boolean }> {
  if ((await topLevel(dir)) === null || (await revParse(dir, 'HEAD')) === null) return { template: null, packets: false };
  const records = (await log(dir, ['--format=%H%x1f%(trailers:key=Packet,valueonly,separator=%x2C)%x1e', 'HEAD'])).split('\x1e').map((r) => r.trim().split('\x1f'));
  const carrying = (id: string) => records.find((r) => (r[1] ?? '').split(',').map((t) => t.trim()).includes(id))?.[0] ?? null;
  return { template: carrying('PKT-DEMO-001'), packets: carrying('CMP-DEMO-001') !== null };
}

/** D-116, D-117: on a re-run each given input equals devai.json's, else exit 2 `config-mismatch`. */
function assertRecorded(opts: InitOptions, config: DevaiConfig): void {
  const given: [string, string, unknown, unknown][] = [
    ['--product', 'productPrefix', opts.product, config.productPrefix],
    ['--locales', 'locales', opts.locales?.split(',').map((l) => l.trim()).join(','), config.locales.join(',')],
    ['--lgpd', 'lgpd', opts.lgpd, config.lgpd],
    ['--runtime', 'runtime.mode', opts.runtime, config.runtime.mode],
  ];
  for (const [flag, field, value, recorded] of given) {
    if (value !== undefined && value !== recorded) throw new CommandRefusal('config-mismatch', `${flag} differs from devai.json ${field}; omit it or pass the recorded value`);
  }
}

const tokensOf = (product: string, locales: readonly string[]) => ({ __PRODUCT__: product, __PREFIX__: product[0]!.toUpperCase() + product.slice(1), __LOCALES__: tsArray(locales) });

export async function init(opts: InitOptions, format: Format, cwd: string): Promise<{ stdout: string; exitCode: 0 | 2 }> {
  const dir = resolve(cwd, opts.dir ?? '.');
  const configured = existsSync(resolve(dir, 'devai.json'));
  const made = configured ? await initCommits(dir) : { template: null, packets: false };
  const attach = made.template !== null && made.packets;
  let product: string;
  let mode: 'bare' | 'docker';
  let gitConfig: Record<string, string>;
  const written: string[] = [];
  let installFailure: string | null = null;
  const classes: Record<string, number> = {};
  const count = (cls: string, path: string) => {
    written.push(path);
    classes[cls] = (classes[cls] ?? 0) + 1;
  };

  if (attach) {
    if (opts.product !== undefined) throw new CommandRefusal('usage', `--product is rejected: ${resolve(dir, 'devai.json')} exists (attach mode)`);
    const config = loadConfig(dir);
    if ((await topLevel(dir)) === null) throw new CommandRefusal('not-a-repository', `${dir}: not inside a git work tree; attach mode needs the repository`);
    product = config.productPrefix;
    mode = config.runtime.mode;
    gitConfig = await configure(dir, product);
    for (const e of templateEntries(tokensOf(product, config.locales)).filter((e) => HOOKS.includes(e.path))) {
      const abs = resolve(dir, e.path);
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, e.bytes!);
      chmodSync(abs, 0o755);
      count('init-owned', e.path);
    }
  } else {
    let entries: Entry[];
    if (configured) {
      // D-112, D-113, D-115: a re-run keeps the files on disk and takes the inputs devai.json records.
      const config = loadConfig(dir);
      assertRecorded(opts, config);
      product = config.productPrefix;
      mode = config.runtime.mode;
      entries = templateEntries(tokensOf(product, config.locales));
    } else {
      const inputs = materialiseInputs(opts);
      product = inputs.product;
      mode = inputs.config.runtime.mode;
      assertEmpty(dir);
      entries = templateEntries(tokensOf(product, inputs.config.locales));
      mkdirSync(dir, { recursive: true });
      for (const e of entries.filter((e) => !e.path.startsWith(PACKETS))) {
        write(dir, e);
        count(HOOKS.includes(e.path) ? 'init-owned' : 'seed', e.path);
      }
      writeFileSync(resolve(dir, 'devai.json'), prettyJson(inputs.config));
      count('seed', 'devai.json');
    }
    const top = await topLevel(dir);
    if (top === null || realpathSync(top) !== realpathSync(dir)) await git(dir, ['init', '--quiet', '--initial-branch=main']);
    gitConfig = await configure(dir, product);
    installFailure = await install(dir);
    if (installFailure === null) {
      // D-115: only the missing commits are made.
      const template = made.template ?? (await commit(dir, `chore(template): devai init ${product}\n\nPacket: PKT-DEMO-001\n`, ['.']));
      // D-095 as amended: `base` is the template commit for all four packets; campaign step 3 rebases
      // PKT-DEMO-002 to HEAD before its commit. A packet already on disk is kept (D-113).
      if (!made.packets) {
        for (const e of entries.filter((e) => e.path.startsWith(PACKETS))) {
          if (existsSync(resolve(dir, e.path))) continue;
          write(dir, { ...e, bytes: Buffer.from(e.bytes!.toString('utf8').replace(BASE_LINE, `base: ${template}`), 'utf8') });
          count('seed', e.path);
        }
        await commit(dir, PACKETS_COMMIT, ['packets']);
      }
    }
  }
  const items = await preflight(dir, mode);
  const missing = items.filter((i) => i.status === 'missing');
  const exitCode = missing.length > 0 || installFailure !== null ? 2 : 0;
  const installLine = installFailure === null ? [] : [`devai: tooling-missing — install with ${installRemedy()} (${installFailure}); nothing was committed`];

  if (format === 'json') {
    return {
      stdout: JSON.stringify({ mode: attach ? 'attach' : 'materialise', product, written, gitConfig, preflight: items, accepted: false, exitCode, ...(exitCode === 2 ? { reason: 'tooling-missing' } : {}) }) + '\n',
      exitCode,
    };
  }
  const lines = [
    ...Object.entries(classes).map(([cls, n]) => `${cls}: ${n} file${n === 1 ? '' : 's'} written`),
    ...Object.entries(gitConfig).map(([k, v]) => `git config ${k} ${v}`),
    ...installLine,
    ...new Set(missing.map((i) => `UNKNOWN: tooling-missing — ${i.node}: install with ${i.remedy}`)),
    'protection: require the devai job',
  ];
  return { stdout: lines.join('\n') + '\n', exitCode };
}
