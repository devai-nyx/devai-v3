import { SetMetadata } from '@nestjs/common';

// S-28; 06 §2 routes[].slo. route-contract reads the literal object statically (08 B.9);
// the key is not part of that contract.

export interface SloDeclaration {
  /** The one metric 06 §2 declares. */
  metric: 'http.server.duration';
  /** Integer1To99 (06 §2). */
  percentile: number;
  /** PositiveInteger (06 §2). */
  maxMs: number;
}

export const SLO = 'devai:slo';

export const Slo = (slo: SloDeclaration) => SetMetadata(SLO, slo);
