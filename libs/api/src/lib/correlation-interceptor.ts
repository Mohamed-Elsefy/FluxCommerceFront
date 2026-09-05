/**
 * Correlation interceptor for Sub-Phase 1.4 — HTTP Interceptor Pipeline.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.4
 * ("Correlation / Request Context Interceptor hook").
 *
 * Single responsibility: propagate a caller-supplied correlation id to the
 * outbound `X-Correlation-ID` header (`API_CONTRACT.md` §0.4). The id comes
 * from `CORRELATION_ID_CONTEXT` (Sub-Phase 1.2 vocabulary); when absent the
 * request passes through untouched.
 *
 * Deliberately NOT decided here (Sub-Phase 1.6 owns it): whether the client
 * generates ids, which format, and how response `X-Correlation-ID` /
 * `X-Request-ID` / `traceId` values are surfaced. Runs FIRST in
 * `API_INTERCEPTORS` so every downstream interceptor and log sees the
 * correlated request.
 */

import { HttpInterceptorFn } from '@angular/common/http';
import { CORRELATION_ID_CONTEXT } from './request-context';

/** Propagates `X-Correlation-ID` from request context when supplied. */
export const correlationInterceptor: HttpInterceptorFn = (req, next) => {
  const correlationId = req.context.get(CORRELATION_ID_CONTEXT);
  if (!correlationId) {
    return next(req);
  }
  return next(req.clone({ setHeaders: { 'X-Correlation-ID': correlationId } }));
};
