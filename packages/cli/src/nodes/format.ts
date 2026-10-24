// 08 B.2 `format`: `prettier --list-different -- <files…>` over the changed, present
// `*.{ts,mjs,json,md}` (B.1 population table). A listed path is `not formatted`; a syntax error
// Prettier reports for a candidate file is a defect; anything else on an exit of 2, or an exit
// outside {0, 1, 2}, is `runner-crashed` (B.2 Status, 08 §0 fifth convention).
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { changedPresent, type Finding, runTool, firstLine, unknown, unknownOutcome } from '../proc/tool.js';

export const FORMAT_INSTALL = 'pnpm add -D --save-exact prettier@3.9.6';
const STANDARD = 'S-41';
const formattable = (p: string) => /\.(ts|mjs|json|md)$/.test(p);

interface Listed {
  paths: string[];
  syntax: Finding[];
}

/** B.2 stdout (one path per line) plus the `[error] <path>: SyntaxError: <message> (<line>:<col>)` stderr headers. */
export function parsePrettier(stdout: string, stderr: string, code: number, files: readonly string[]): Listed | { crash: string } {
  if (code !== 0 && code !== 1 && code !== 2) return { crash: firstLine(stderr) || `prettier exited ${code}` };
  const argv = new Set(files);
  const paths = stdout.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (paths.some((p) => !argv.has(p))) return { crash: `prettier listed a path it was not given: ${paths.find((p) => !argv.has(p))}` };
  const syntax: Finding[] = [];
  for (const line of stderr.split('\n')) {
    const m = /^\[error\] (\S.*)$/.exec(line);
    if (!m) continue;
    const header = /^(.+?): \w*Error: (.*) \((\d+):(\d+)\)$/.exec(m[1]!);
    if (header && argv.has(header[1]!)) {
      syntax.push({ locator: `${header[1]}:${header[3]}:${header[4]}`, message: `syntax error: ${header[2]}`, standard: STANDARD, hint: 'fix the file' });
    } else if (!m[1]!.startsWith('>')) return { crash: line }; // code-frame lines are `[error] >` or indented
  }
  if (code === 2 && syntax.length === 0) return { crash: firstLine(stderr) || 'prettier exited 2' };
  return { paths, syntax };
}

export const format: NodeAdapter = {
  id: 'format',
  contract: 1,
  configFiles: () => ['package.json', '.prettierignore'],
  inputs: (ctx) => changedPresent(ctx, formattable),
  async run(ctx: RunContext): Promise<NodeOutcome> {
    const files = changedPresent(ctx, formattable);
    const expected = files.length;
    if (expected === 0) return { status: 'PASS', expected: 0, observed: 0, evaluated: 0, findings: [] };
    const r = await runTool({
      root: ctx.root, bin: 'prettier', install: FORMAT_INSTALL, args: ['--list-different', '--', ...files], locator: `${files[0]}:1`, standard: STANDARD,
      parse: (stdout) => stdout, // the verdict needs stderr too; parsed below
    });
    if (r.kind === 'unknown') return unknownOutcome(r.unknown, { expected });
    const listed = parsePrettier(r.value, r.stderr, r.code, files);
    if ('crash' in listed) return unknownOutcome(unknown('runner-crashed', `${files[0]}:1`, listed.crash, STANDARD), { expected });
    // Observation (B.2): every argv file Prettier accepted as input, i.e. without a parse error.
    const rejected = new Set(listed.syntax.map((f) => f.locator.split(':')[0]));
    const observed = files.filter((f) => !rejected.has(f)).length;
    const findings: Finding[] = [
      ...listed.paths.map((p) => ({ locator: `${p}:1`, message: 'not formatted', standard: STANDARD, hint: `run prettier --write ${p}` })),
      ...listed.syntax,
    ];
    return { status: findings.length > 0 ? 'FAIL' : 'PASS', expected, observed, evaluated: observed, findings };
  },
};
