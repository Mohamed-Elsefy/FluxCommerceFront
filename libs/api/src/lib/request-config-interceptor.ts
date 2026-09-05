/**
 * Request configuration interceptor for Sub-Phase 1.4 — HTTP Interceptor Pipeline.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.4
 * ("Request Configuration / Context Interceptor ... attach required system headers").
 *
 * Single responsibility: map per-request configuration from `HttpContext`
 * (Sub-Phase 1.2 vocabulary) onto outbound headers, setting only what the
 * caller supplied:
 *
 * - `CULTURE_CONTEXT` → `Accept-Language` (`LOCALIZATION_CONTRACT.md` §2;
 *   unset means backend default `en`).
 * - `IDEMPOTENCY_KEY_CONTEXT` → `Idempotency-Key` (required ONLY on
 *   `POST /orders/checkout`; `DTO_REFERENCE.md` §7).
 *
 * Correlation is owned by `correlationInterceptor`; authentication by
 * `authInterceptor`. Runs SECOND in `API_INTERCEPTORS`.
 */

import { HttpInterceptorFn } from '@angular/common/http';
import { CULTURE_CONTEXT, IDEMPOTENCY_KEY_CONTEXT } from './request-context';

/** Attaches caller-supplied configuration headers (`Accept-Language`, `Idempotency-Key`). */
export const requestConfigInterceptor: HttpInterceptorFn = (req, next) => {
  const headers: Record<string, string> = {};
  const culture = req.context.get(CULTURE_CONTEXT);
  if (culture) {
    headers['Accept-Language'] = culture;
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
