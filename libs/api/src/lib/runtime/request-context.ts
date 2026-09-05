/**
 * Shared request configuration/context conventions for Sub-Phase 1.2.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.2
 * ("Define shared request configuration/context conventions").
 *
 * This file defines the VOCABULARY for per-request context — not behavior.
 * It introduces no interceptors (Sub-Phase 1.4) and no API client (1.3); it
 * only fixes how a caller attaches request-scoped metadata so the later
 * interceptor pipeline and typed client share one convention:
 *
 * ```text
 * Feature data access builds ApiRequestContext
 *     ↓ toHttpContext (this file)
 * HttpContext on the HttpClient request
 *     ↓ read by interceptors (Sub-Phase 1.4+)
 * Outbound headers (X-Correlation-ID, Accept-Language, Idempotency-Key)
 * ```
 *
 * Header grounding (`docs/frontend-contract/`):
 * - `correlationId` → `X-Correlation-ID` (optional inbound, echoed with
 *   `X-Request-ID` in responses; `API_CONTRACT.md` §0.4).
 * - `culture` → `Accept-Language` / `?culture=` (`LOCALIZATION_CONTRACT.md` §2).
 * - `idempotencyKey` → `Idempotency-Key`, required on `POST /orders/checkout`
 *   only (`DTO_REFERENCE.md` §7). Never reused across different payloads.
 */

import { HttpContext, HttpContextToken } from '@angular/common/http';
import type { SupportedCulture } from '../contracts/api-headers';

/**
 * Per-request context a feature data-access service may attach to an
 * outbound API call. Every field is optional; unset fields leave the
 * request untouched (backend defaults apply).
 */
export interface ApiRequestContext {
  /**
   * Traced flow identifier (`X-Correlation-ID`). Wins when supplied so one id
   * traces a whole flow; when absent the correlation interceptor generates a
   * per-request UUID (ownership rules in `./correlation-ids`, Sub-Phase 1.6).
   */
  readonly correlationId?: string;
  /** Desired response culture (`Accept-Language`). Defaults to backend `en`. */
  readonly culture?: SupportedCulture;
  /**
   * Checkout idempotency key (`Idempotency-Key`, 1..128 chars).
   * Set ONLY on `POST /orders/checkout`; reuse the same key + body on
   * retry, mint a new key for a new payload.
   */
  readonly idempotencyKey?: string;
}

/** `HttpContext` slot for `ApiRequestContext.correlationId`. */
export const CORRELATION_ID_CONTEXT = new HttpContextToken<string | undefined>(() => undefined);

/** `HttpContext` slot for `ApiRequestContext.culture`. */
export const CULTURE_CONTEXT = new HttpContextToken<SupportedCulture | undefined>(() => undefined);

/** `HttpContext` slot for `ApiRequestContext.idempotencyKey`. */
export const IDEMPOTENCY_KEY_CONTEXT = new HttpContextToken<string | undefined>(() => undefined);

/**
 * Converts an `ApiRequestContext` into Angular `HttpContext`, setting only
 * the slots whose values are defined. Pass the result as the `context`
 * option of an `HttpClient` request.
 */
export function toHttpContext(context: ApiRequestContext): HttpContext {
  let httpContext = new HttpContext();
  if (context.correlationId !== undefined) {
    httpContext = httpContext.set(CORRELATION_ID_CONTEXT, context.correlationId);
  }
  if (context.culture !== undefined) {
    httpContext = httpContext.set(CULTURE_CONTEXT, context.culture);
  }
  if (context.idempotencyKey !== undefined) {
    httpContext = httpContext.set(IDEMPOTENCY_KEY_CONTEXT, context.idempotencyKey);
  }
  return httpContext;
}
