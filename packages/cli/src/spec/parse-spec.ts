// `parse-spec`: the one reading of an approved spec file (06 §1–§2) that `spec-lint` (08 B.8), the
// generator (09 §2, A.2), the `generated` replay (B.16) and `i18n` (B.13) share. It composes the 07 §3
// YAML reader and the 06 §2 zod definition of `machine-block.ts` with the parts of the prose the
// consumers need: the `## Open questions` body (A.2 admission), the acceptance criteria (requirements
// with `acceptance: "yes"`) and the `i18n` map.
import type { z } from 'zod';
import { sha256 } from '../candidate/digest.js';
import { MachineBlock, readSpec, type BlockProblem } from './machine-block.js';

export type Requirement = MachineBlock['requirements'][number];

export type ParsedSpec =
  /** Readable bytes that are not one valid machine block (06 §4 SL01). */
  | { kind: 'malformed'; problems: BlockProblem[] }
  /** One YAML document that the 06 §2 definition rejects; `issues` carry the zod paths. */
  | { kind: 'invalid'; value: unknown; lineOf: (path: readonly PropertyKey[]) => number; problems: BlockProblem[]; issues: z.core.$ZodIssue[] }
  | {
      kind: 'valid';
      value: unknown;
      lineOf: (path: readonly PropertyKey[]) => number;
      /** Structural problems outside the block (missing sections); spec-lint reports them as SL01. */
      problems: BlockProblem[];
      block: MachineBlock;
      /** The fenced YAML's bytes (09 §2: `machineBlockSha256` is taken over them). */
      blockText: string;
      machineBlockSha256: string;
      /** Requirements with `acceptance: "yes"`, in spec order (06 §5 spec tests). */
      acceptance: Requirement[];
      /** `i18n` key → locale → text (06 §2). */
      i18n: Record<string, Record<string, string>>;
      /** The `## Open questions` body, trimmed. */
      openQuestions: string;
    };

/** The trimmed body of `## <title>`, up to the next `## ` heading outside a fence; null when absent. */
export function sectionBody(text: string, title: string): string | null {
  const lines = text.split('\n');
  let fence: string | null = null;
  let start = -1;
  const body: string[] = [];
  for (const line of lines) {
    const f = /^(`{3,}|~{3,})/.exec(line);
    if (f) fence = fence === null ? f[1]! : line.startsWith(fence) ? null : fence;
    const heading = fence === null && !f ? /^## (.+?)\s*$/.exec(line) : null;
    if (heading) {
      if (start >= 0) break;
      if (heading[1] === title) { start = 0; continue; }
    }
    if (start >= 0) body.push(line);
  }
  return start < 0 ? null : body.join('\n').trim();
}

/** `## Open questions` counts as empty when its body is empty or the single word `None.` (06 §7's form). */
export const noOpenQuestions = (body: string): boolean => body === '' || body === 'None.';

export function parseSpec(text: string): ParsedSpec {
  const read = readSpec(text);
  if (read.kind === 'malformed') return read;
  const parsed = MachineBlock.safeParse(read.value);
  if (!parsed.success) return { kind: 'invalid', value: read.value, lineOf: read.lineOf, problems: read.problems, issues: parsed.error.issues };
  const block = parsed.data;
  return {
    kind: 'valid',
    value: read.value,
    lineOf: read.lineOf,
    problems: read.problems,
    block,
    blockText: read.block,
    machineBlockSha256: sha256(read.block),
    acceptance: block.requirements.filter((r) => r.acceptance === 'yes'),
    i18n: block.i18n,
    openQuestions: sectionBody(text, 'Open questions') ?? '',
  };
}
