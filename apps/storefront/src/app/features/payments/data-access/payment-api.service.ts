/**
 * Payments data-access service for Sub-Phases 9.3 (data access) and
 * 9.10 (order-summary display read).
 *
 * Scope: `docs/phases/PHASE_9_PAYMENTS.md` §§9.3/9.10 (data access only
 * — no state implementation, no provider integration, no UI).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §6
 * (`GET /api/payments/{id}` → `ApiResponse<PaymentResponse>`; the
 * webhook is Stripe→API only and never called here),
 * `docs/frontend-contract/DTO_REFERENCE.md` §6, and the Sub-Phase 9.1
 * audit module (`@flux/models` `payment-contract`: `Payment`,
 * `PaymentInitializationRequest`, `PaymentInitializationResult`).
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * PaymentState (9.4 — not this sub-phase; feature-owned local Signals)
 *         ↓ PaymentApiService (this file — thin typed façade)
 *     ApiClient (Phase 1, the ONLY HttpClient user)
 *         ↓ HttpClient → interceptors → ASP.NET Core API
 * ```
 *
 * Contract fidelity rules enforced here (same convention as
 * `CheckoutApiService`, Phase 8.2, and `ProductDetailsApiService`,
 * Phase 6):
 * - Request/response types come from `@flux/models` plus the §9.2
 *   `ConfirmPaymentRequest` (`../models`) — no local re-declarations,
 *   so no contract drift is possible.
 * - The route template comes from `PAYMENTS_ENDPOINTS` with the id as
 *   `pathParams` (interpolated by `ApiClient`) — no scattered string
 *   literals.
 * - The service never unwraps `ApiResponse.data`, never catches or
 *   remaps errors, and never attaches tokens: the envelope stays intact
 *   for feature state (9.4) to map, failures (`401` anonymous, `404`
 *   unknown-or-foreign payment id, `400` validation) flow untouched
 *   through the Observable error channel to the Phase 1 error
 *   normalizer, and `Authorization` stays owned by the interceptor
 *   pipeline.
 * - The service performs no business logic: no status derivation, no
 *   verification, no retry policy, no duplicate-submission guard.
 * - Cancellation travels through `ApiRequestOptions.signal` (Phase 1
 *   `cancelOnAbort` completes pre-aborted/in-flight aborts silently —
 *   never as errors). The service forwards the signal; lifecycle
 *   ownership belongs to the 9.4 caller.
 * - Contract-honest blocking: `initializePayment` and `confirmPayment`
 *   have NO backend HTTP path today (the §9.1 blocker,
 *   `PAYMENT_INIT_HTTP_AVAILABLE = false`; confirmation executes
 *   provider-side via Stripe.js in 9.5/9.7 with backend verification
 *   through the webhook). Both short-circuit with a normalized
 *   `ApiError` (`paymentContractBlockedError`) WITHOUT issuing any HTTP
 *   — inventing an endpoint would violate Rule 5 (backend contracts are
 *   the source of truth). The 9.4 state layer branches on the blocked
 *   code; the real calls land here once the backend exposes them.
 *
 * Security guardrails (this sub-phase's core constraint):
 * - No Stripe-specific details cross this service: it never imports the
 *   §9.1 provider types (`PaymentConfirmationInput`,
 *   `ProviderConfirmationOutcome`), never accepts a client secret, and
 *   never shapes card data.
 * - No sensitive values are logged: this file contains no `console`
 *   calls, and the blocked error carries no identifiers (no order/payment
 *   id echo — see the spec's leakage pins).
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.4 — no feature state, no signals, no lifecycle store.
 * - 9.5 — no Stripe SDK, no Elements, no provider abstraction.
 * - 9.6+ — no initialization execution, confirmation execution,
 *   polling, or retry.
 */

import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import {
  ApiClient,
  ApiError,
  ORDERS_ENDPOINTS,
  PAYMENTS_ENDPOINTS,
  type ApiRequestOptions,
  type ApiResponseWithData,
} from '@flux/api';
import type {
  OrderDetailsResponse,
  Payment,
  PaymentInitializationRequest,
  PaymentInitializationResult,
} from '@flux/models';
import type { ConfirmPaymentRequest } from '../models/payment.models';

/**
 * Client-synthesized code for operations with no backend HTTP contract
 * yet. A stable PascalCase single (like `NetworkError`) that can never
 * collide with dotted backend codes; the 9.4 state layer branches on it
 * to select the order-poll proxy instead of the missing calls.
 */
export const PAYMENT_CONTRACT_BLOCKED_CODE = 'PaymentContractBlocked';

/** Operations currently blocked on the missing backend HTTP contract. */
export type BlockedPaymentOperation = 'initializePayment' | 'confirmPayment';

/**
 * Builds the normalized failure for a contract-blocked operation:
 * `status 0` (no response — nothing was sent), the blocked code, and a
 * technical English diagnostic naming the operation (never user-facing
 * copy, never identifiers). Pure — performs no HTTP and throws nothing
 * (the error travels through the Observable error channel).
 */
export function paymentContractBlockedError(operation: BlockedPaymentOperation): ApiError {
  return new ApiError({
    status: 0,
    code: PAYMENT_CONTRACT_BLOCKED_CODE,
    message: `Payment ${operation} has no backend HTTP contract; no request was sent.`,
  });
}

/**
 * Thin typed façade over the payment contract. `getPaymentStatus` maps
 * 1:1 to its endpoint (same params, same envelope);
 * `initializePayment`/`confirmPayment` expose the §9.1 typed shapes and
 * short-circuit until the backend lands their paths. There is no mapping
 * here because feature state owns envelope handling.
 */
@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  private readonly api = inject(ApiClient);

  /**
   * `GET /api/payments/{paymentId}` — authenticated (JWT via the
   * interceptor pipeline) + ownership (foreign ids mask as `404` with a
   * server-side warning log — never probe ids on this path).
   *
   * `options.signal` aborts the call silently (Phase 1 `cancelOnAbort`);
   * any other `options` (correlation, culture, extra path params) merge
   * alongside the payment id.
   *
   * Success: `200 ApiResponse<Payment>` (`status` is the backend
   * `PaymentStatus` string — the ONLY success signal is `Succeeded`).
   * Failures: `401` anonymous, `404` unknown-or-foreign id, `400`
   * validation — all propagate untouched through the error channel.
   */
  getPaymentStatus(
    paymentId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<Payment>> {
    return this.api.get<ApiResponseWithData<Payment>>(PAYMENTS_ENDPOINTS.getPayment.path, {
      ...options,
      pathParams: { paymentId, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * Typed initialization surface (`PaymentInitializationRequest
   * { orderId }` → `PaymentInitializationResult { paymentId, orderId,
   * clientSecret, paymentReference, status }`).
   *
   * Contract-blocked: no HTTP endpoint serializes the intent result
   * today, so this short-circuits with `paymentContractBlockedError`
   * and issues ZERO HTTP calls (test-pinned). No `options` are accepted
   * on purpose — there is nothing to cancel, correlate, or localize
   * until the backend lands the path.
   */
  initializePayment(
    request: PaymentInitializationRequest,
  ): Observable<ApiResponseWithData<PaymentInitializationResult>> {
    void request;
    return throwError(() => paymentContractBlockedError('initializePayment'));
  }

  /**
   * Typed confirmation surface (`paymentId` + `ConfirmPaymentRequest
   * { orderId }`).
   *
   * Contract-blocked like `initializePayment`: confirmation executes
   * provider-side via Stripe.js (9.5/9.7) with backend verification
   * through the webhook, so this short-circuits with
   * `paymentContractBlockedError` and issues ZERO HTTP calls
   * (test-pinned). The payload deliberately carries no card data and no
   * client secret — those never cross the API service.
   */
  confirmPayment(paymentId: string, payload: ConfirmPaymentRequest): Observable<never> {
    void paymentId;
    void payload;
    return throwError(() => paymentContractBlockedError('confirmPayment'));
  }

  /**
   * `GET /orders/{orderId}` — authenticated (JWT via the interceptor
   * pipeline) + ownership (foreign ids mask as `404` — never probe ids
   * on this path). Read-only display facts for the payment UI summary
   * (order number, lines, backend-issued totals): the payments feature
   * consumes the order contract here exactly like product-details
   * consumes cart endpoints — no order orchestration, polling, or
   * history lives here (Phase 10 owns those).
   *
   * `options.signal` aborts the call silently (Phase 1 `cancelOnAbort`).
   *
   * Success: `200 ApiResponse<OrderDetailsResponse>` (money is nested
   * `OrderMoneyResponse` on totals, split flat fields on line items —
   * display only, never inputs to math).
   * Failures: `401` anonymous, `404` unknown-or-foreign id — all
   * propagate untouched through the error channel.
   */
  getOrderDetails(
    orderId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<OrderDetailsResponse>> {
    return this.api.get<ApiResponseWithData<OrderDetailsResponse>>(ORDERS_ENDPOINTS.getOrder.path, {
      ...options,
      pathParams: { orderId, ...(options.pathParams ?? {}) },
    });
  }
}
