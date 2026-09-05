/**
 * Correlation interceptor for Sub-Phases 1.4 + 1.6 — HTTP Interceptor Pipeline
 * and Correlation & Request Context.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §§1.4
 * ("Correlation / Request Context Interceptor hook"), 1.6 (ownership,
 * generation, header behavior). Ownership/generation rules live in
 * `./correlation-ids`.
 *
 * Single responsibility: guarantee every outbound request carries
 * `X-Correlation-ID` — the caller-supplied flow id from
 * `CORRELATION_ID_CONTEXT` when present, else a fresh per-request UUID from
 * `newCorrelationId()`. An explicitly set header is never overwritten. The
 * backend reuses the inbound id (else generates its own) and always echoes
 * it with `X-Request-ID`, so the sent value is the end-to-end trace key the
 * error interceptor attaches to `ApiError`.
 *
 * Runs FIRST in `API_INTERCEPTORS` so every downstream interceptor and log
 * sees the correlated request.
 */

import { HttpInterceptorFn } from '@angular/common/http';
import { CORRELATION_ID_CONTEXT } from '../runtime/request-context';
import { CORRELATION_ID_HEADER, newCorrelationId } from '../runtime/correlation-ids';

/** Ensures `X-Correlation-ID` on every request (flow id wins, else generated). */
export const correlationInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has(CORRELATION_ID_HEADER)) {
    return next(req);
  }
  const correlationId = req.context.get(CORRELATION_ID_CONTEXT) ?? newCorrelationId();
  return next(req.clone({ setHeaders: { [CORRELATION_ID_HEADER]: correlationId } }));
};
