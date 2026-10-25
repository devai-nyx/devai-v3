// D-097 in tests: materialise `init` runs `pnpm add -D --save-exact @devai-nyx/cli@<own version>` with the
// host `pnpm` from PATH. The registry has no @devai-nyx/cli 3.0.0 until R10, so tests put a `pnpm` first on
// PATH (the one lookup init already makes; no flag, no variable of the CLI's own) that stands in for it:
// - `stub`: the add links this repository's package into node_modules and records the exact pin, without
//   installing anything else; `exec devai …` (the hooks) exits 0. Every call is logged.
// - `fail`: the add fails as the registry does today (ERR_PNPM_FETCH_404), after the DEP0169 warning pnpm 9.15
//   prints on Node 24, whose text also says "errors".
// - `real`: the add runs the real `pnpm install --frozen-lockfile` from the shipped lock, then links this
//   repository's package and its `devai` bin; everything else, `exec` included, is the real pnpm.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, resolve } from 'node:path';

export const CLI = resolve(import.meta.dirname, '..');
export type ShimMode = 'stub' | 'fail' | 'real';

/** A directory holding the `pnpm` shim, and the env that puts it first on PATH. */
export function pnpmShim(mode: ShimMode): { dir: string; log: string; env: NodeJS.ProcessEnv } {
  const dir = mkdtempSync(resolve(tmpdir(), 'devai-pnpm-shim-'));
  const log = resolve(dir, 'calls.log');
  const real = spawnSync('sh', ['-c', 'command -v pnpm'], { encoding: 'utf8' }).stdout.trim();
  const link = [
    'mkdir -p node_modules/@devai-nyx node_modules/.bin',
    `ln -sfn '${CLI}' node_modules/@devai-nyx/cli`,
    `printf '#!/bin/sh\\nexec "%s" "%s/dist/main.js" "$@"\\n' '${process.execPath}' '${CLI}' > node_modules/.bin/devai`,
    'chmod +x node_modules/.bin/devai',
    // the exact pin `pnpm add --save-exact` writes into the root manifest
    `"${process.execPath}" -e 'const f=require("fs");const p=JSON.parse(f.readFileSync("package.json","utf8"));const v=process.argv[1].split("@").pop();p.devDependencies={...p.devDependencies,"@devai-nyx/cli":v};p.devDependencies=Object.fromEntries(Object.entries(p.devDependencies).sort(([a],[b])=>a.localeCompare(b)));f.writeFileSync("package.json",JSON.stringify(p,null,2)+"\\n")' "$4"`,
  ].join('\n');
  const body: Record<ShimMode, string> = {
    stub: ['case "$1" in', `  add) ${link.split('\n').join('\n  ')}`, '    exit 0 ;;', '  *) exit 0 ;;', 'esac'].join('\n'),
    fail: ['if [ "$1" = add ]; then', "  echo '(node:1) [DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized and prone to errors that have security implications.' >&2", "  echo ' ERR_PNPM_FETCH_404  GET https://npm.pkg.github.com/@devai-nyx%2Fcli: Not Found - 404' >&2", '  exit 1', 'fi', `exec '${real}' "$@"`].join('\n'),
    real: ['if [ "$1" = add ]; then', `  '${real}' install --frozen-lockfile --reporter=silent || exit $?`, `  ${link.split('\n').join('\n  ')}`, '  exit 0', 'fi', `exec '${real}' "$@"`].join('\n'),
  };
  writeFileSync(resolve(dir, 'pnpm'), `#!/bin/sh\necho "$*" >> '${log}'\n${body[mode]}\n`);
  chmodSync(resolve(dir, 'pnpm'), 0o755);
  mkdirSync(resolve(dir, 'empty'), { recursive: true });
  return { dir, log, env: { ...process.env, PATH: `${dir}${delimiter}${process.env['PATH'] ?? ''}`, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' } };
}
