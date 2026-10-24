// 08 B.6 `layout`: 04 §1–§6 as path predicates over the full candidate path set, in process (no
// TypeScript library; `ignore` 7.0.5 for tier globs, D-057). One observation = one predicate × path in
// that predicate's scope; every pair is evaluated. Finding form `<path>:1 <predicate>: <what> [04 §n] <hint>`.
import { readFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import ignore from 'ignore';
import { parse as parseYaml } from 'yaml';
import { globMatches } from './inventory.js';
import type { NodeAdapter, RunContext } from '../runner/run.js';
import { type Finding, outcome, type Unknown } from '../ts/outcome.js';
import { parse, walk, ts } from '../ts/program.js';

/** One predicate: its scope over the path set and its check of one path (null = holds). */
interface Predicate {
  name: string;
  scope: (p: string) => boolean;
  check: (p: string) => Omit<Finding, 'locator'> & { line?: number } | null;
}

const ROOT_GUIDES = ['README.md', 'AGENTS.md', 'CLAUDE.md', 'decisions.md'];
const LAYER_FOLDERS = ['controllers', 'services', 'entities', 'guards', 'repositories'];
const DOCS_SECTIONS = ['framework', 'meta', 'adopters', 'reference', 'start', 'site', '_ia', 'archive'];
const BINARY = /\.(png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|woff2?|ttf|otf|mp4|mov|docx?|xlsx?|pptx?)$/i;
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** D-017, D-040: 00–08 tables, 11–14 functions, 21–24 RLS, 80–89 views, 90 assertions, 91–94 comments, 98 seed. */
export const ddlBand = (nn: number): boolean => (nn >= 0 && nn <= 8) || (nn >= 11 && nn <= 14) || (nn >= 21 && nn <= 24) || (nn >= 80 && nn <= 94) || nn === 98;
const TIER_SUFFIX: [RegExp, RegExp, string][] = [
  [/^test\/integration\//, /\.integration\.spec\.ts$/, '*.integration.spec.ts'],
  [/^test\/db\//, /\.db\.spec\.ts$/, '*.db.spec.ts'],
  [/^test\/e2e\//, /(\.e2e\.spec\.ts|\.playwright\.ts)$/, '*.e2e.spec.ts or *.playwright.ts'],
  [/^domain\/[^/]+\/api\/test\/acceptance\//, /\.acceptance\.spec\.ts$/, '<lowercase-spec-id>.acceptance.spec.ts'],
];

const read = (root: string, p: string): string | null => {
  try {
    return readFileSync(resolve(root, p), 'utf8');
  } catch {
    return null;
  }
};

/** The predicates of B.6's Observation row that range over single paths. */
function pathPredicates(root: string, unreadable: string[]): Predicate[] {
  const text = (p: string): string => {
    const t = read(root, p);
    if (t === null) unreadable.push(p);
    return t ?? '';
  };
  return [
    {
      name: 'module shape',
      scope: (p) => /^domain\/[^/]+\/(api|web)\/src\//.test(p) || /^domain\/[^/]+\/db\//.test(p),
      check: (p) => {
        const api = /^domain\/([^/]+)\/api\/src\/(.+)$/.exec(p);
        if (api) {
          const parts = api[2]!.split('/');
          if (parts.length === 1 || (parts.length === 2 && (parts[0] === 'dto' || parts[0] === 'adapter'))) return null;
          const folder = parts[0]!;
          const file = parts[parts.length - 1]!;
          if (LAYER_FOLDERS.includes(folder)) {
            return { message: 'module shape: layer folder under api/src', standard: '04 §2', hint: `flatten to api/src/${file.replace(/\.ts$/, '')}.${folder.replace(/(ie)?s$/, (m) => (m === 'ies' ? 'y' : ''))}.ts` };
          }
          return { message: `module shape: folder ${folder}/ under api/src`, standard: '04 §2', hint: `flatten to api/src/${file}; only dto/ and adapter/ are folders` };
        }
        const web = /^domain\/[^/]+\/web\/src\/(.+)$/.exec(p);
        if (web) return web[1]!.includes('/') ? { message: 'module shape: folder under web/src', standard: '04 §2', hint: `flatten to web/src/${basename(p)}` } : null;
        const db = /^domain\/([^/]+)\/db\/(.+)$/.exec(p)!;
        const slug = db[1]!.replace(/-/g, '_');
        const ok = new RegExp(`^[a-z][a-z0-9_]*_${slug}(_\\d{2}_[a-z0-9]+(_[a-z0-9]+)*)?\\.sql$`).test(db[2]!);
        return ok ? null : { message: 'module shape: db file is not <ns>_<slug>.sql or <ns>_<slug>_<nn>_<topic>.sql', standard: '04 §3', hint: `rename to <ns>_${slug}.sql (D-023)` };
      },
    },
    {
      name: 'test singular',
      scope: () => true,
      check: (p) => (/(^|\/)tests\//.test(p) ? { message: 'test singular: tests/ folder', standard: '04 §4', hint: 'rename the folder to test/ (D-024)' } : null),
    },
    {
      name: 'tier suffix',
      scope: (p) => p.endsWith('.ts') && (TIER_SUFFIX.some(([dir]) => dir.test(p)) || p.endsWith('.acceptance.spec.ts')),
      check: (p) => {
        for (const [dir, suffix, form] of TIER_SUFFIX) {
          if (dir.test(p) && !suffix.test(p)) return { message: `tier suffix: file is not ${form}`, standard: '04 §4', hint: `rename to ${form}` };
        }
        if (p.endsWith('.acceptance.spec.ts') && !TIER_SUFFIX[3]![0].test(p)) return { message: 'tier suffix: acceptance file outside domain/<m>/api/test/acceptance/', standard: '04 §4', hint: 'move it to domain/<m>/api/test/acceptance/' };
        return null;
      },
    },
    {
      name: 'docs layout',
      scope: (p) => p.startsWith('docs/'),
      check: (p) => {
        const segs = p.split('/');
        if (segs.length > 2 && !DOCS_SECTIONS.includes(segs[1]!)) return { message: `docs layout: ${segs[1]}/ is not a docs section`, standard: '04 §5', hint: `move it under one of docs/{${DOCS_SECTIONS.join(',')}}/` };
        if (BINARY.test(p) && segs[1] !== 'archive') return { message: 'docs layout: binary outside docs/archive/', standard: '04 §5', hint: 'move it to docs/archive/' };
        const bad = segs.slice(1, -1).find((s) => s !== '_ia' && !KEBAB.test(s));
        if (bad) return { message: `docs layout: segment ${bad} is not kebab-case`, standard: '04 §5', hint: 'rename it in kebab-case' };
        return null;
      },
    },
    {
      name: 'spec layout',
      scope: (p) => /^specs\/.+\.md$/.test(p),
      check: (p) => {
        const segs = p.split('/');
        if (segs.length !== 3 || !KEBAB.test(segs[1]!)) return { message: 'spec layout: not specs/<area>-<capability>/<file>.md', standard: '04 §1', hint: 'move it to a kebab-case folder directly under specs/' };
        const lines = text(p).split('\n').length - (text(p).endsWith('\n') ? 1 : 0);
        if (lines > 350) return { message: `spec layout: ${lines} lines > 350`, standard: '04 §4', hint: 'split the spec (successor spec or a second capability)' };
        return null;
      },
    },
    {
      name: 'root guide',
      scope: (p) => !p.includes('/') && /\.md$/i.test(p),
      check: (p) => (ROOT_GUIDES.includes(p) ? null : { message: `root guide: ${p} is not on the allowlist`, standard: '04 §1', hint: 'fold it into docs/meta/eng/ or an ADR (D-031)' }),
    },
    {
      name: 'facade',
      scope: (p) => /^(law|product)\/(.+\/)?README\.md$/.test(p),
      check: (p) => {
        const body = text(p).split('\n').map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('#'));
        const linkOnly = body.length > 0 && body.every((l) => /^([-*]\s*)?(\[[^\]]*\]\(([^)]*)\)[\s,.;]*)+$/.test(l) && [...l.matchAll(/\]\(([^)]*)\)/g)].every((m) => /(^|\/)docs\//.test(m[1]!)));
        return linkOnly ? { message: 'facade: README only links into docs/', standard: '04 §1', hint: 'put the real content here or delete the README' } : null;
      },
    },
    {
      name: 'ddl band',
      scope: (p) => /^database\/ddl\/[^/]+\.sql$/.test(p),
      check: (p) => {
        const m = /^(\d{2})-[a-z0-9_]+(-[a-z0-9_]+)+\.sql$/.exec(basename(p));
        if (!m) return { message: 'ddl band: name is not NN-<schema>-<topic>.sql', standard: '04 §3', hint: 'rename to NN-<schema>-<topic>.sql (D-017)' };
        return ddlBand(Number(m[1])) ? null : { message: `ddl band: ${m[1]} is not a band`, standard: '04 §3', hint: 'use 00–08, 11–14, 21–24, 80–89, 90, 91–94 or 98 (D-017, D-040)' };
      },
    },
    {
      name: 'migration name',
      scope: (p) => /^database\/migrations\/[^/]+\.sql$/.test(p),
      check: (p) => (/^\d{8}_\d{2}_[a-z0-9]+(_[a-z0-9]+)*\.sql$/.test(basename(p)) ? null : { message: 'migration name: not YYYYMMDD_NN_snake_case.sql', standard: '04 §3', hint: 'rename to YYYYMMDD_NN_snake_case.sql' }),
    },
  ];
}

/** Tier globs of `vitest.config.ts`: string literals that are path globs (contain `*`, end in `.ts`). */
export function tierGlobs(text: string): { glob: string; line: number }[] {
  const sf = parse('vitest.config.ts', text);
  const out: { glob: string; line: number }[] = [];
  walk(sf, (n) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && n.text.includes('*') && /\.(ts|mts)$/.test(n.text) && !n.text.startsWith('!')) {
      out.push({ glob: n.text, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
    }
  });
  return out;
}

export const layout: NodeAdapter = {
  id: 'layout',
  contract: 1,
  configFiles: () => ['pnpm-workspace.yaml', 'vitest.config.ts', 'docs/_ia/categories.json'],
  inputs: (ctx) => {
    const paths = ctx.listing.entries.map((e) => e.path);
    // The full path set is an input: each path's digest (content-sensitive files are among them).
    return paths;
  },
  async run(ctx: RunContext) {
    const paths = ctx.listing.entries.map((e) => e.path);
    const present = new Set(paths);
    const unreadable: string[] = [];
    const findings: Finding[] = [];
    let n = 0;
    for (const pred of pathPredicates(ctx.root, unreadable)) {
      for (const p of paths.filter(pred.scope)) {
        n++;
        const f = pred.check(p);
        if (f) findings.push({ locator: `${p}:${f.line ?? 1}`, message: f.message, standard: f.standard, hint: f.hint });
      }
    }
    // docs: `_ia/categories.json` exists when docs/ does (04 §5).
    if (paths.some((p) => p.startsWith('docs/'))) {
      n++;
      if (!present.has('docs/_ia/categories.json')) findings.push({ locator: 'docs/_ia/categories.json:1', message: 'docs layout: docs/_ia/categories.json is missing', standard: '04 §5', hint: 'add docs/_ia/categories.json' });
    }
    // Workspace globs name real packages (04 §1).
    const ws = present.has('pnpm-workspace.yaml') ? read(ctx.root, 'pnpm-workspace.yaml') : null;
    if (present.has('pnpm-workspace.yaml') && ws === null) unreadable.push('pnpm-workspace.yaml');
    let globs: string[] = [];
    try {
      const doc = ws === null ? null : (parseYaml(ws) as { packages?: unknown } | null);
      globs = Array.isArray(doc?.packages) ? doc.packages.filter((g): g is string => typeof g === 'string' && !g.startsWith('!')) : [];
    } catch {
      globs = []; // inventory reports the unparseable file
    }
    const pkgDirs = paths.filter((p) => p.endsWith('/package.json')).map((p) => p.slice(0, -'/package.json'.length));
    const wsLines = (ws ?? '').split('\n');
    for (const g of globs) {
      n++;
      if (!pkgDirs.some((d) => globMatches(g, d))) {
        findings.push({ locator: `pnpm-workspace.yaml:${wsLines.findIndex((l) => l.includes(g)) + 1 || 1}`, message: `workspace globs: ${g} names no real package`, standard: '04 §1', hint: 'remove the glob' });
      }
    }
    // Every enabled tier glob matches ≥ 1 file (S-62).
    if (present.has('vitest.config.ts')) {
      const t = read(ctx.root, 'vitest.config.ts');
      if (t === null) unreadable.push('vitest.config.ts');
      for (const { glob, line } of t === null ? [] : tierGlobs(t)) {
        n++;
        const ig = ignore().add(glob);
        if (!paths.some((p) => ig.ignores(p))) findings.push({ locator: `vitest.config.ts:${line}`, message: `tier glob: ${glob} matches no file`, standard: '04 §4', hint: "add the tier's first file or remove the glob (S-62)" });
      }
    }
    const unknown: Unknown[] = unreadable.map((p) => ({ reason: 'io', finding: { locator: `${p}:1`, message: 'not readable', standard: '04 §1', hint: 'make the path readable (permissions, broken or escaping symlink), then re-run' } }));
    if (unknown.length > 0) return outcome({ expected: n, observed: n, evaluated: n - unknown.length }, [], unknown);
    return outcome({ expected: n, observed: n, evaluated: n }, findings, []);
  },
};
