/**
 * Payments data-access service for Sub-Phases 9.3 (data access) and
 * 9.10 (order-summary display read) — plus Supplement S1, Step S1.9
 * (caller-owned `GET /api/payments/mine` list).
 *
 * Scope: `docs/phases/PHASE_9_PAYMENTS.md` §§9.3/9.10 (data access only
 * — no state implementation, no provider integration, no UI).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §6
 * (`GET /api/payments/{id}` → `ApiResponse<PaymentResponse>`;
 * `GET /api/payments/by-order/{orderId}` →
 * `ApiResponse<PaymentInitializationResponse>`; the webhook is
 * Stripe→API only and never called here),
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
 * - Request/response types come from `@flux/models` — no local
 *   re-declarations, so no contract drift is possible.
 * - The route template comes from `PAYMENTS_ENDPOINTS` with the id as
 *   `pathParams` (interpolated by `ApiClient`) — no scattered string
 *   literals.
 * - The service never unwraps `ApiResponse.data`, never catches or
 *   remaps errors, and never attaches tokens: the envelope stays intact
 *   for feature state (9.4) to map, failures (`401` anonymous, `404`
 *   unknown-or-foreign id, `400` validation (incl. `Payment.OrderIdRequired`
 *   and `Payment.ProviderUnavailable` — `Failure` default branch),
 *   `409 Payment.NotReady` / `Payment.NotPayable`) flow
 *   untouched through the Observable error channel to the Phase 1 error
 *   normalizer, and `Authorization` stays owned by the interceptor
 *   pipeline.
 * - The service performs no business logic: no status derivation, no
 *   verification, no retry policy, no duplicate-submission guard.
 * - Cancellation travels through `ApiRequestOptions.signal` (Phase 1
 *   `cancelOnAbort` completes pre-aborted/in-flight aborts silently —
 *   never as errors). The service forwards the signal; lifecycle
 *   ownership belongs to the 9.4 caller.
 * - Initialization reads the live secret through
 *   `GET /api/payments/by-order/{orderId}` (owner JWT, single intent per
 *   order, secret re-fetched per call). Card confirmation itself stays
 *   provider-side via Stripe.js (9.5/9.7) with backend verification
 *   through the webhook — there is deliberately NO backend confirm
 *   endpoint, so this service exposes no `confirmPayment` method.
 *
 * Security guardrails (this sub-phase's core constraint):
 * - No Stripe-specific details cross this service: it never imports the
 *   §9.1 provider types (`PaymentConfirmationInput`,
 *   `ProviderConfirmationOutcome`), never accepts a client secret, and
 *   never shapes card data. The secret arrives inside the typed
 *   initialization envelope only, straight into feature state memory.
 * - No sensitive values are logged: this file contains no `console`
 *   calls.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.4 — no feature state, no signals, no lifecycle store.
 * - 9.5 — no Stripe SDK, no Elements, no provider abstraction.
 * - 9.6+ — no initialization execution, confirmation execution,
 *   polling, or retry.
 */

import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import {
  ApiClient,
  ORDERS_ENDPOINTS,
  PAYMENTS_ENDPOINTS,
  toQueryParams,
  type ApiRequestOptions,
  type ApiResponseWithData,
  type PagedApiResponse,
} from '@flux/api';
import type {
  OrderDetailsResponse,
  Payment,
  PaymentAdminResponse,
  PaymentInitializationRequest,
  PaymentInitializationResult,
  PaymentsMineQuery,
} from '@flux/models';

/**
 * Thin typed façade over the payment contract. `getPaymentStatus` and
 * `initializePayment` map 1:1 to their endpoints (same params, same
 * envelope). Card confirmation has no backend endpoint by design
 * (provider-side via Stripe.js) — there is intentionally no
 * `confirmPayment` method here. There is no mapping here because feature
 * state owns envelope handling.
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
   * `GET /api/payments/by-order/{orderId}` — authenticated (JWT via the
   * interceptor pipeline) + ownership (foreign ids mask as `404` with a
   * server-side warning log — never probe ids on this path).
   *
   * Read-only: never creates a Stripe intent (saga owns creation). The
   * live secret is re-fetched per call — retries reuse the single intent
   * per order. `options.signal` aborts the call silently (Phase 1
   * `cancelOnAbort`); any other `options` (correlation, culture, extra
   * path params) merge alongside the order id.
   *
   * Success: `200 ApiResponse<PaymentInitializationResult>` (`paymentId`
   * for status polling, runtime-only `clientSecret`, `paymentReference`
   * `pi_*` for support, `status` — expect `Pending`, never success).
   * Failures: `401` anonymous, `404` unknown-or-foreign id, `400`
   * `Payment.OrderIdRequired` / `Payment.ProviderUnavailable`
   * (`Failure` default branch — provider outage, poll-retry),
   * `409 Payment.NotReady` (saga lag — manual retry), `409
   * Payment.NotPayable` (terminal payment) — all propagate untouched
   * through the error channel for feature state (9.4) to map.
   */
  initializePayment(
    request: PaymentInitializationRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<PaymentInitializationResult>> {
    return this.api.get<ApiResponseWithData<PaymentInitializationResult>>(
      PAYMENTS_ENDPOINTS.byOrder.path,
      {
        ...options,
        pathParams: { orderId: request.orderId, ...(options.pathParams ?? {}) },
      },
    );
  }

  /**
   * `GET /api/payments/mine` — caller-owned paged payment list
   * (Supplement S1). Paging plus an optional `status` filter
   * (`Pending|Processing|Succeeded|Failed|Cancelled|Refunded`,
   * case-insensitive; unknown → backend `400 Payment.ValidationFailed`),
   * fixed newest-first — no sort params. Never another customer's
   * payments.
   *
   * `options.signal` aborts the call silently (Phase 1 `cancelOnAbort`).
   *
   * Success: `200 ApiResponse<PagedResult<PaymentAdminResponse>>`.
   * Failures: `400` validation, `401` anonymous — all propagate untouched
   * through the error channel.
   */
  listMine(
    query: PaymentsMineQuery = {},
    options: ApiRequestOptions = {},
  ): Observable<PagedApiResponse<PaymentAdminResponse>> {
    return this.api.get<PagedApiResponse<PaymentAdminResponse>>(PAYMENTS_ENDPOINTS.listMine.path, {
      ...options,
      params: toQueryParams(query),
    });
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
