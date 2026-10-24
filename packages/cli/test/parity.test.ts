// The shipped zod definitions are byte-identical to their law blocks (12 §2, devai-v3#49).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = resolve(import.meta.dirname);
const law = readFileSync(resolve(here, '../../../docs/framework/08-cli-and-nodes.md'), 'utf8');
const block = (heading: string): string => {
  const start = law.indexOf(heading);
  if (start < 0) throw new Error(`heading not found: ${heading}`);
  const open = law.indexOf('```ts\n', start) + '```ts\n'.length;
  const close = law.indexOf('```', open);
  return law.slice(open, close);
};
const src = (name: string) => readFileSync(resolve(here, '../src', name), 'utf8');

describe('byte parity with 08', () => {
  it('src/report.ts equals 08 C.2', () => expect(src('report.ts')).toBe(block('### C.2 ')));
  it('src/config.ts equals 08 A.8', () => expect(src('config.ts')).toBe(block('### A.8 ')));
});

describe('template hook scripts equal 08 A.7', () => {
  const hooks = resolve(here, '../template/scripts/hooks');
  it.each([
    ['pre-commit', '#!/bin/sh\nexec pnpm exec devai check --hook pre-commit\n'],
    ['pre-push', '#!/bin/sh\nexec pnpm exec devai check --hook pre-push "$@"\n'],
    ['commit-msg', '#!/bin/sh\nexec pnpm exec devai check --hook commit-msg "$1"\n'],
  ])('%s', (name, bytes) => expect(readFileSync(resolve(hooks, name), 'utf8')).toBe(bytes));
});
