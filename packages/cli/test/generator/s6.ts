// 09 §6, the worked example, as a test oracle. `fixtures/09-s6-worked-example.txt` holds the bytes of
// §6's code block (checked equal to docs/framework/09-rail.md); this file reads its notation:
// - columns: path · mode · synopsis; an indented line continues the synopsis of the row above;
// - `G` is the header line, `<decorators>` is `@devai-nyx/decorators`, `<release>` the CLI version,
//   `<sha256>` the digest of the file the line names, `(empty)` an empty file;
// - `…` elides text; a synopsis line shows consecutive code with line breaks (and the trailing commas
//   and bracket padding they bring) removed, so text is compared after `normalise`;
// - the prose abbreviations are expanded by NOTATION below, nothing else.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const FIXTURE = resolve(import.meta.dirname, 'fixtures/09-s6-worked-example.txt');
export const LAW = resolve(import.meta.dirname, '../../../../docs/framework/09-rail.md');

export interface Row { path: string; mode: string; synopsis: string[] }

/** The §6 block as it appears in the law. */
export function lawBlock(): string {
  const text = readFileSync(LAW, 'utf8');
  const start = text.indexOf('## 6. Worked example');
  const open = text.indexOf('```\n', start) + 4;
  return text.slice(open, text.indexOf('\n```\n', open) + 1);
}

export function rows(text = readFileSync(FIXTURE, 'utf8')): Row[] {
  const lines = text.split('\n').filter((l) => l.length > 0);
  const first = lines[0]!;
  const modeAt = first.indexOf('generated');
  const synAt = first.indexOf('<!--');
  const out: Row[] = [];
  for (const l of lines) {
    if (l.startsWith(' ')) { out[out.length - 1]!.synopsis.push(l.slice(synAt)); continue; }
    out.push({ path: l.slice(0, modeAt).trim(), mode: l.slice(modeAt, synAt).trim(), synopsis: [l.slice(synAt)] });
  }
  return out;
}

/** Whitespace collapsed; no padding inside `()`/`[]`; no trailing comma before a closer. */
export const normalise = (s: string): string =>
  s.replace(/\s+/g, ' ').replace(/,\s*([)\]}])/g, ' $1').replace(/([([]) /g, '$1').replace(/ ([)\]])/g, '$1').trim();

const NOTATION: Record<string, string[]> = {
  '401, 403, 503': ['status: 401', 'status: 403', 'status: 503'],
  "404 'demo.notes.missing'": ['status: 404', "messageKey: 'demo.notes.missing'"],
  '(empty)': [], // asserted as zero bytes by the whole-row test
};

/** The literal fragments of one synopsis line, in order, after substitutions. */
export function fragments(line: string, subst: { header: string; version: string }): string[] {
  if (line.trim() === 'G') return [subst.header];
  let l = line.replace(/<decorators>/g, '@devai-nyx/decorators').replace(/<release>/g, subst.version);
  // `WITH CHECK (same predicate)`: the USING predicate of the same line.
  const using = /USING (\(.*?\)) WITH CHECK \(same predicate\)/.exec(l);
  if (using) l = l.replace('(same predicate)', using[1]!);
  return l.split('…').map((f) => f.trim()).filter((f) => f.length > 0).flatMap((f) => NOTATION[f] ?? [f]);
}

/** Every fragment of every synopsis line occurs in `text`, in order; returns the first one that does not. */
export function firstMissing(text: string, synopsis: readonly string[], subst: { header: string; version: string }): string | null {
  const hay = normalise(text);
  let from = 0;
  for (const line of synopsis) {
    for (const f of fragments(line, subst)) {
      const at = hay.indexOf(normalise(f), from);
      if (at < 0) return f;
      from = at + normalise(f).length;
    }
  }
  return null;
}
