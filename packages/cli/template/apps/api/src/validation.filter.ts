// Maps a route's rejections to its declared `@ErrorContract` entry (09 §1.1, D-129): `parseDto`'s
// FLOW_VALIDATION_ERROR to the 400 VALIDATION entry, and the guards' 401 and 403 to the route's 401 and 403
// entries. The body is exactly `{ code, messageKey, requestId }`, without issues, input values or the guard's
// message. Anything else answers as STYNX core's filter would.
//
// Three pieces, because Nest gives an exception filter no handler: the guard records the handler's entries on
// the request before authentication runs (it is the first `APP_GUARD`); the filter reads them; the module
// registers the filter, imported last so that it is consulted before STYNX core's catch-all filter.
import {
  BadRequestException,
  type ArgumentsHost,
  type CanActivate,
  Catch,
  type ExceptionFilter,
  type ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  Module,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_FILTER, Reflector } from '@nestjs/core';

/** `@devai-nyx/decorators`' `ERROR_CONTRACT` metadata key. */
const ERROR_CONTRACT = 'devai:errorContract';
/** Where the guard leaves the handler's entries for the filter. */
const ENTRIES = Symbol('errorContract');

interface ErrorContractEntry {
  status: number;
  code: string;
  messageKey: string;
}

interface HttpRequest {
  headers: Record<string, string | string[] | undefined>;
  [ENTRIES]?: ErrorContractEntry[];
}

interface HttpResponse {
  status(code: number): { json(body: unknown): void };
}

function isFlowValidation(error: HttpException): boolean {
  const body: unknown = error.getResponse();
  return (
    typeof body === 'object' &&
    body !== null &&
    'code' in body &&
    body.code === 'FLOW_VALIDATION_ERROR'
  );
}

/** Records the handler's `@ErrorContract` entries; never refuses. */
@Injectable()
export class __PREFIX__ErrorContractGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const entries = this.reflector.get<ErrorContractEntry[] | undefined>(
      ERROR_CONTRACT,
      context.getHandler(),
    );
    if (entries) context.switchToHttp().getRequest<HttpRequest>()[ENTRIES] = entries;
    return true;
  }
}

@Catch(BadRequestException, UnauthorizedException, ForbiddenException)
class __PREFIX__ValidationFilter implements ExceptionFilter {
  catch(error: HttpException, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<HttpRequest>();
    const response = http.getResponse<HttpResponse>();
    const status = error.getStatus();
    // 400 maps only parseDto's rejection, to the VALIDATION entry; 401 and 403 to the route's entry.
    const entry = (request[ENTRIES] ?? []).find(
      (e) => e.status === status && (status !== 400 || e.code === 'VALIDATION'),
    );
    if (entry === undefined || (status === 400 && !isFlowValidation(error))) {
      response.status(status).json(error.getResponse());
      return;
    }
    const header = request.headers['x-request-id'];
    const requestId = typeof header === 'string' ? header : null;
    response.status(status).json({ code: entry.code, messageKey: entry.messageKey, requestId });
  }
}

/** Registers the filter; `AppModule` imports it last (see above). */
@Module({ providers: [{ provide: APP_FILTER, useClass: __PREFIX__ValidationFilter }] })
export class __PREFIX__ErrorContractModule {}
