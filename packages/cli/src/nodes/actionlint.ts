// 08 B.14 `actionlint`: `github-actionlint -format '{{json .}}' -- <files…>` over the changed, present
// `.github/**/*.{yml,yaml}` (B.1 population table). stdout is a JSON array of error entries, `[]` on a
// clean set [fact: 1.7.12, D-089 a7]; ≥ 1 entry is `FAIL`; unparseable output or an exit outside
// {0, 1} is `runner-crashed`.
import type { NodeAdapter, NodeOutcome, RunContext } from '../runner/run.js';
import { changedPresent, type Finding, runTool, unknownOutcome } from '../proc/tool.js';

export const ACTIONLINT_INSTALL = 'pnpm add -w -D --save-exact github-actionlint@1.7.12 && pnpm install';
const STANDARD = 'S-43';
const workflow = (p: string) => p.startsWith('.github/') && /\.ya?ml$/.test(p);

interface Entry {
  message: string;
  filepath: string;
  line: number;
  column: number;
  kind: string;
}

export function parseActionlint(stdout: string, code: number): Entry[] | null {
  if (code !== 0 && code !== 1) return null;
  try {
    const doc = JSON.parse(stdout) as unknown;
    if (!Array.isArray(doc)) return null;
    const ok = doc.every((e) => typeof e === 'object' && e !== null && typeof (e as Entry).message === 'string' && typeof (e as Entry).filepath === 'string');
    if (!ok || (code === 1) !== (doc.length > 0)) return null;
    return doc as Entry[];
  } catch {
    return null;
  }
}

export const actionlint: NodeAdapter = {
  id: 'actionlint',
  contract: 1,
  configFiles: () => [],
  inputs: (ctx) => changedPresent(ctx, workflow),
  async run(ctx: RunContext): Promise<NodeOutcome> {
    const files = changedPresent(ctx, workflow);
    const expected = files.length;
    if (expected === 0) return { status: 'PASS', expected: 0, observed: 0, evaluated: 0, findings: [] };
    const r = await runTool({
      root: ctx.root, bin: 'github-actionlint', install: ACTIONLINT_INSTALL, args: ['-format', '{{json .}}', '--', ...files],
      locator: `${files[0]}:1`, standard: STANDARD, parse: parseActionlint,
    });
    if (r.kind === 'unknown') return unknownOutcome(r.unknown, { expected });
    const findings: Finding[] = r.value.map((e) => ({
      locator: `${e.filepath}:${e.line}:${e.column}`, message: `${e.kind}: ${e.message}`, standard: STANDARD, hint: 'fix the expression or input',
    }));
    // Observation (B.14): every argv file on an exit of 0 or 1 with parseable JSON.
    return { status: findings.length > 0 ? 'FAIL' : 'PASS', expected, observed: expected, evaluated: expected, findings };
  },
};
