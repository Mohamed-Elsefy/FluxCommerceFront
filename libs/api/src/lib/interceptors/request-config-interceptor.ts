/**
 * Request configuration interceptor for Sub-Phase 1.4 — HTTP Interceptor Pipeline,
 * extended in Sub-Phase 4.5 — Backend Culture Synchronization.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.4
 * ("Request Configuration / Context Interceptor ... attach required system headers").
 *
 * Single responsibility: map per-request configuration from `HttpContext`
 * (Sub-Phase 1.2 vocabulary) onto outbound headers, setting only what the
 * caller supplied, plus the ambient frontend culture:
 *
 * - `Accept-Language`: explicit `CULTURE_CONTEXT` wins when present; otherwise
 *   the ambient culture from `ACTIVE_CULTURE_PROVIDER` (./culture-token,
 *   overridden by Phase 4 with the `CultureService`-backed reader, inert
 *   `null` until then). An explicitly set `Accept-Language` header is never
 *   clobbered. Absent everywhere means backend default `en`
 *   (`LOCALIZATION_CONTRACT.md` §2).
 * - `IDEMPOTENCY_KEY_CONTEXT` → `Idempotency-Key` (required ONLY on
 *   `POST /orders/checkout`; `DTO_REFERENCE.md` §7).
 *
 * The interceptor reads the ambient culture per request, so a runtime
 * language switch affects subsequent requests (including 401-recovery
 * retries, which re-enter the pipeline) without restarts. There is exactly
 * one `Accept-Language` writer — no per-feature header logic.
 *
 * Correlation is owned by `correlationInterceptor`; authentication by
 * `authInterceptor`. Runs SECOND in `API_INTERCEPTORS`.
 */

import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { CULTURE_CONTEXT, IDEMPOTENCY_KEY_CONTEXT } from '../runtime/request-context';
import { ACTIVE_CULTURE_PROVIDER } from './culture-token';

/** Attaches configuration headers (`Accept-Language`, `Idempotency-Key`). */
export const requestConfigInterceptor: HttpInterceptorFn = (req, next) => {
  const headers: Record<string, string> = {};
  if (!req.headers.has('Accept-Language')) {
    const culture = req.context.get(CULTURE_CONTEXT) ?? inject(ACTIVE_CULTURE_PROVIDER)();
    if (culture) {
      headers['Accept-Language'] = culture;
    }
  }
  const idempotencyKey = req.context.get(IDEMPOTENCY_KEY_CONTEXT);
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }
  if (Object.keys(headers).length === 0) {
    return next(req);
  }
  return next(req.clone({ setHeaders: headers }));
};
