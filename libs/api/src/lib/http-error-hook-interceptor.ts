/**
 * Error normalization interceptor for Sub-Phases 1.4 + 1.5 — HTTP Interceptor
 * Pipeline and API Error Normalization.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §§1.4 ("Error
 * interception"), 1.5 (normalization). Export name kept from 1.4 so the
 * pipeline order in `API_INTERCEPTORS` is unchanged.
 *
 * Single responsibility: convert every rejection reaching this innermost
 * slot into the stable `ApiError` (`./error-normalizer`) so feature
 * data-access layers observe exactly one error shape. `HttpErrorResponse`s
 * are parsed (ProblemDetails, validation maps, business/conflict errors,
 * network failures, cancellations); anything else is classified as
 * unexpected. Nothing is translated here — `message` carries backend
 * `detail` verbatim or a technical diagnostic; stable `code`s are preserved
 * for the localization layer (`libs/i18n`, Phase 4).
 *
 * Correlation attached is strictly pre-existing, in priority order: the
 * sent context id, else the sent header (incl. 1.6-generated ids), else the
 * backend `X-Correlation-ID`/`X-Request-ID` echo, else `null`. No generation,
 * no new header handling — Sub-Phase 1.6 owns that.
 *
 * Runs LAST in `API_INTERCEPTORS` (closest to the backend, first to observe
 * failures on the way back).
 */

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { CORRELATION_ID_CONTEXT } from './request-context';
import { CORRELATION_ID_HEADER, extractCorrelationId } from './correlation-ids';
import { normalizeHttpError, normalizeUnknownError } from './error-normalizer';

/** Normalizes pipeline rejections into `ApiError`; features never see raw HTTP errors. */
export const httpErrorHookInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) =>
      throwError(() => {
        if (error instanceof HttpErrorResponse) {
          const correlationId =
            req.context.get(CORRELATION_ID_CONTEXT) ??
            req.headers.get(CORRELATION_ID_HEADER) ??
            extractCorrelationId(error.headers);
          return normalizeHttpError(error, correlationId);
        }
        return normalizeUnknownError(error);
      }),
    ),
  );
