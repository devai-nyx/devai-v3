import { SetMetadata } from '@nestjs/common';

// S-28; 06 §2 routes[].errorContract. route-contract reads the literal array statically and
// compares it as a set of {status, code, messageKey} (08 B.9); the key is not part of that contract.

export interface ErrorContractEntry {
  /** Integer400To599 (06 §2). */
  status: number;
  /** UpperSnakeIdentifier, `[A-Z][A-Z0-9_]*` (06 §2). */
  code: string;
  /** I18nKey, dot-separated lowercase identifiers (06 §2). */
  messageKey: string;
}

export const ERROR_CONTRACT = 'devai:errorContract';

export const ErrorContract = (entries: readonly ErrorContractEntry[]) => SetMetadata(ERROR_CONTRACT, entries);
