// 06 §2 value types TypeScript can express; `tsc -p test` compiles the @ts-expect-error lines.
import { describe, expectTypeOf, it } from 'vitest';
import { ErrorContract, Slo, UseCase, type ErrorContractEntry, type SloDeclaration } from '../src/index.js';

describe('argument types', () => {
  it('admits the 09 §6 call shapes', () => {
    expectTypeOf(ErrorContract).parameter(0).toEqualTypeOf<readonly ErrorContractEntry[]>();
    expectTypeOf(UseCase).parameter(0).toEqualTypeOf<string>();
    expectTypeOf<SloDeclaration['metric']>().toEqualTypeOf<'http.server.duration'>();
  });

  it('rejects a metric other than http.server.duration', () => {
    // @ts-expect-error 06 §2 declares one metric
    Slo({ metric: 'http.server.requests', percentile: 95, maxMs: 500 });
  });

  it('rejects an error entry without messageKey', () => {
    // @ts-expect-error messageKey is required (06 §2)
    ErrorContract([{ status: 400, code: 'VALIDATION' }]);
  });
});
