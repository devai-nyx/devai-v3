// Maps `parseDto`'s FLOW_VALIDATION_ERROR to the route's declared 400 VALIDATION entry and message key,
// without the issues or the input values (09 §1.1). It reads the handler's `@ErrorContract` metadata, so
// it runs where the handler is known: around the handler, as an interceptor.
import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { catchError, type Observable, throwError } from 'rxjs';

/** `@devai-nyx/decorators`' `ERROR_CONTRACT` metadata key. */
const ERROR_CONTRACT = 'devai:errorContract';

interface ErrorContractEntry {
  status: number;
  code: string;
  messageKey: string;
}

function isFlowValidation(error: unknown): boolean {
  if (!(error instanceof BadRequestException)) return false;
  const body: unknown = error.getResponse();
  return (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    body.code === 'FLOW_VALIDATION_ERROR'
  );
}

@Injectable()
export class __PREFIX__ValidationFilter implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const entries =
      this.reflector.get<ErrorContractEntry[] | undefined>(ERROR_CONTRACT, context.getHandler()) ??
      [];
    const declared = entries.find((e) => e.status === 400 && e.code === 'VALIDATION');
    return next
      .handle()
      .pipe(
        catchError((error: unknown) =>
          throwError(() =>
            declared && isFlowValidation(error)
              ? new BadRequestException({ code: declared.code, messageKey: declared.messageKey })
              : error,
          ),
        ),
      );
  }
}
