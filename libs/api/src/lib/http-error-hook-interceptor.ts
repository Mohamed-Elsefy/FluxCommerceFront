/**
 * Transport error hook for Sub-Phase 1.4 — HTTP Interceptor Pipeline.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.4
 * ("Error interception") with the strict boundary that full error
 * normalization and `ProblemDetail`/`ValidationProblemDetail` parsing belong
 * to Sub-Phase 1.5.
 *
 * Single responsibility: reserve the innermost pipeline slot (closest to the
 * backend, FIRST to observe transport failures on the way back) where 1.5
 * will plug normalization in. Until then errors — network failures, HTTP
 * error statuses, cancellations — pass through byte-identical and
 * unmapped, so no feature can accidentally depend on pre-normalization
 * behavior.
 *
 * Runs LAST in `API_INTERCEPTORS`.
 */

import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

/** Passthrough hook for transport failures; Sub-Phase 1.5 owns mapping. */
export const httpErrorHookInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(catchError((error: unknown) => throwError(() => error)));
