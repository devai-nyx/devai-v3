// S-28; 09 §6: the decorators store the literal argument under their key, unchanged.
import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ERROR_CONTRACT, ErrorContract, SLO, Slo, USE_CASE, UseCase } from '../src/index.js';

const errors = [
  { status: 400, code: 'VALIDATION', messageKey: 'demo.notes.invalid' },
  { status: 403, code: 'FORBIDDEN', messageKey: 'demo.notes.forbidden' },
] as const;
const slo = { metric: 'http.server.duration', percentile: 95, maxMs: 500 } as const;

class NotesController {
  @ErrorContract(errors)
  @UseCase('UC-DEMO-001')
  @Slo(slo)
  create(): void {}
}

const handler = NotesController.prototype.create;

describe('@devai-nyx/decorators', () => {
  it('@ErrorContract stores the literal array', () => {
    expect(Reflect.getMetadata(ERROR_CONTRACT, handler)).toBe(errors);
  });

  it('@UseCase stores the literal id', () => {
    expect(Reflect.getMetadata(USE_CASE, handler)).toBe('UC-DEMO-001');
  });

  it('@Slo stores the literal object', () => {
    expect(Reflect.getMetadata(SLO, handler)).toBe(slo);
  });

  it('keeps the keys distinct and as published', () => {
    expect([ERROR_CONTRACT, USE_CASE, SLO]).toEqual(['devai:errorContract', 'devai:useCase', 'devai:slo']);
    expect(new Set([ERROR_CONTRACT, USE_CASE, SLO]).size).toBe(3);
  });
});
