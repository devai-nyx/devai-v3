// 08 C.5: the Vitest 4.1.11 `Reporter` module `unit`, `spec-tests` and `integration` pass with `--reporter`.
// It writes one JSON line per event to the file the runner names in `DEVAI_VITEST_EVENTS`; the runner
// never parses Vitest's console output. Hooks used [fact: `vitest@4.1.11 dist/chunks/reporters.d.DtoKVV2s.d.ts`
// `onInit` :1042, `onTestRunEnd` :1061, `onTestModuleCollected` :1069, `onTestModuleEnd` :1077,
// `onTestCaseResult` :1087]. `includeTaskLocation` is switched on in `onInit` so each case carries its
// line (Vitest leaves `location` undefined otherwise; probe 2026-10-24).
import { appendFileSync } from 'node:fs';
import type { Reporter, TestCase, TestModule, Vitest } from 'vitest/node';

/** One line of the events file; `census.ts` validates the same shape. */
export type VitestEvent =
  | { e: 'collected'; file: string; cases: { id: string; name: string; fullName: string; line: number | null; top: boolean }[]; errors: EventError[] }
  | { e: 'result'; file: string; id: string; state: 'passed' | 'failed' | 'skipped' | 'pending'; errors: EventError[] }
  | { e: 'module-end'; file: string; errors: EventError[] }
  | { e: 'end'; reason: string; unhandled: EventError[] };

export interface EventError { name: string | null; message: string; stacks: { file: string; line: number; column: number }[] }

const errorOf = (e: { name?: unknown; message?: unknown; stacks?: { file: string; line: number; column: number }[] }): EventError => ({
  name: typeof e.name === 'string' ? e.name : null,
  message: typeof e.message === 'string' ? e.message : String(e.message),
  stacks: (e.stacks ?? []).map((s) => ({ file: s.file, line: s.line, column: s.column })),
});

export default class DevaiReporter implements Reporter {
  private readonly out = process.env['DEVAI_VITEST_EVENTS'];

  private write(ev: VitestEvent): void {
    if (this.out) appendFileSync(this.out, JSON.stringify(ev) + '\n');
  }

  onInit(vitest: Vitest): void {
    vitest.config.includeTaskLocation = true;
  }

  onTestModuleCollected(m: TestModule): void {
    const cases = [...m.children.allTests()].map((t: TestCase) => ({
      id: t.id, name: t.name, fullName: t.fullName, line: t.location?.line ?? null, top: t.parent.type === 'module',
    }));
    this.write({ e: 'collected', file: m.moduleId, cases, errors: m.errors().map(errorOf) });
  }

  onTestCaseResult(t: TestCase): void {
    const r = t.result();
    this.write({ e: 'result', file: t.module.moduleId, id: t.id, state: r.state, errors: (r.errors ?? []).map(errorOf) });
  }

  onTestModuleEnd(m: TestModule): void {
    this.write({ e: 'module-end', file: m.moduleId, errors: m.errors().map(errorOf) });
  }

  onTestRunEnd(_modules: ReadonlyArray<TestModule>, unhandled: ReadonlyArray<{ name?: unknown; message?: unknown }>, reason: string): void {
    this.write({ e: 'end', reason, unhandled: unhandled.map(errorOf) });
  }
}
