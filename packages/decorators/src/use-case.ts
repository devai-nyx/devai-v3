import { SetMetadata } from '@nestjs/common';

// S-28; 06 §2 routes[].useCase. route-contract reads the literal id statically and checks it
// exists in product/use-cases/ (08 B.9); the key is not part of that contract.

export const USE_CASE = 'devai:useCase';

/** `id` is a UseCaseId, `UC-<PRODUCT>-nnn` (06 §2). */
export const UseCase = (id: string) => SetMetadata(USE_CASE, id);
