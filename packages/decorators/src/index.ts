// Route contract decorators (S-28; 06 §2 routes[]). Validation of the arguments belongs to
// route-contract (08 B.9) and the generator, not to the decorators (D-055).
export { ERROR_CONTRACT, ErrorContract, type ErrorContractEntry } from './error-contract.js';
export { SLO, Slo, type SloDeclaration } from './slo.js';
export { USE_CASE, UseCase } from './use-case.js';
