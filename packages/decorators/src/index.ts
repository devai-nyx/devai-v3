import { SetMetadata } from '@nestjs/common';

// Route contract decorators (S-28; 06 §2 routes[]). route-contract reads the literal
// arguments statically (08 B.9); the metadata keys are not part of that contract.

export interface ErrorContractEntry {
  status: number;      // Integer400To599
  code: string;        // UpperSnakeIdentifier
  messageKey: string;  // I18nKey
}

export interface SloDeclaration {
  metric: 'http.server.duration';
  percentile: number;  // Integer1To99
  maxMs: number;       // PositiveInteger
}

export const ERROR_CONTRACT = 'devai:errorContract';
export const USE_CASE = 'devai:useCase';
export const SLO = 'devai:slo';

export const ErrorContract = (entries: readonly ErrorContractEntry[]) => SetMetadata(ERROR_CONTRACT, entries);
export const UseCase = (id: string) => SetMetadata(USE_CASE, id);
export const Slo = (slo: SloDeclaration) => SetMetadata(SLO, slo);
