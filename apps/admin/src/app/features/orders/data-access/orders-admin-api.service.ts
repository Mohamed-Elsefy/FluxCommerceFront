/**
 * Admin Orders data-access service for Sub-Phase 14.2 — Admin Orders
 * Feature Foundation.
 *
 * Scope: the foundation READ surface (paginated order list, single
 * order read) plus the 14.6 payment slice (by-order initialization read
 * plus the single payment read it links to). List/filter/status UI
 * arrives with the slices that own their pages (Sub-Phases 14.3–14.5);
 * payment history, payment mutations, and the Stripe webhook never
 * travel here (no contract supports them from the SPA).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §4 (orders
 * endpoints are `[Authorize]`, any authenticated JWT — NOT `Admin`-only;
 * `GET /orders` is caller-owned only, paging params only, fixed
 * newest-first) and the 14.1 audit
 * (`libs/models/.../orders-payments-contract.ts`).
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * Orders States (../state, route-provided)
 *         ↓ OrdersAdminApiService (this file — thin typed façade)
 *     ApiClient (Phase 1, the ONLY HttpClient user)
 *         ↓ HttpClient → interceptors → ASP.NET Core API
 * ```
 *
 * Contract fidelity rules enforced here (same convention as
 * `CatalogAdminApiService`):
 * - Request/response types come from `@flux/models` — no local
 *   re-declarations, so no contract drift is possible.
 * - Route templates come from `ORDERS_ENDPOINTS` — no scattered string
 *   literals.
 * - Query objects convert through the single `toQueryParams` funnel —
 *   never hand-built query strings.
 * - The service never unwraps `ApiResponse.data`, never catches or
 *   remaps errors, and never attaches tokens: envelopes stay intact
 *   for feature state to map, failures flow untouched to the Phase 1
 *   error normalizer, and `Authorization` stays owned by the
 *   interceptor pipeline.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 14.7–14.8 — no payment history, no failed-payments query (no such
 *   endpoints), no payment status badge mapping (presentation only).
 * - No checkout (customer flow), no cancel (no owning slice), no webhook
 *   (Stripe→API only, never called by the SPA), no totals math, no
 *   status derivation.
 */

import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  OrderDetailsResponse,
  OrderSummaryResponse,
  PaymentInitializationResult,
  PaymentResponse,
} from '@flux/models';
import {
  ApiClient,
  ORDERS_ENDPOINTS,
  PAYMENTS_ENDPOINTS,
  toQueryParams,
  type ApiRequestOptions,
  type ApiResponseWithData,
  type PagedApiResponse,
  type PaginationRequest,
} from '@flux/api';

/**
 * Thin typed façade over the admin Orders read contract. Each method
 * maps 1:1 to one endpoint (same name, same params, same envelope);
 * there is no mapping here because feature state owns envelope handling.
 *
 * Feature-scoped (no `providedIn`): provided at the orders route level
 * alongside the overview state — never a root singleton (Phase 12.8
 * pins the root-provided admin allowlist; this service is not on it).
 */
@Injectable()
export class OrdersAdminApiService {
  private readonly api = inject(ApiClient);

  /**
   * `GET /orders` — paged caller-owned order list (newest-first, paging
   * params only — no sorting, no filtering). There is NO platform-wide
   * admin list: an admin JWT sees its own orders, never every
   * customer's (see the 14.1 audit).
   * Success: `200 ApiResponse<PagedResult<OrderSummaryResponse>>`.
   * Failures: `400` validation (`pageNumber >= 1`, `1 <= pageSize <= 100`),
   * `401` anonymous.
   */
  listOrders(
    query: PaginationRequest = {},
    options: ApiRequestOptions = {},
  ): Observable<PagedApiResponse<OrderSummaryResponse>> {
    return this.api.get<PagedApiResponse<OrderSummaryResponse>>(ORDERS_ENDPOINTS.listOrders.path, {
      ...options,
      params: toQueryParams(query),
    });
  }

  /**
   * `GET /orders/{orderId}` — single order read model (totals, items,
   * addresses, status — all backend-issued, display only).
   * Success: `200 ApiResponse<OrderDetailsResponse>`.
   * Failures: `401` anonymous, `404` unknown order OR other-customer id
   * (IDOR-masked).
   */
  getOrder(
    orderId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<OrderDetailsResponse>> {
    return this.api.get<ApiResponseWithData<OrderDetailsResponse>>(ORDERS_ENDPOINTS.getOrder.path, {
      ...options,
      pathParams: { orderId, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `GET /api/payments/by-order/{orderId}` — payment initialization read
   * for one order (the ONLY order→payment linkage the backend exposes:
   * no order payload carries payment fields). Read-only: never creates a
   * Stripe intent (saga-owned); the live `clientSecret` is re-fetched per
   * call for the single intent per order. The admin discards the secret
   * at the state boundary (memory-only, never stored, never rendered,
   * never logged — see `toOrderPaymentView`).
   * Success: `200 ApiResponse<PaymentInitializationResult>`.
   * Failures: `400` empty id, `401` anonymous, `404` missing payment OR
   * other-customer order (masked), `409` intent not created yet
   * (`NotReady` — poll/retry) or terminal payment (`NotPayable`), `500`
   * provider unreachable. `NotReady`/`NotPayable` share the `409`
   * status with no machine code on the wire — callers branch
   * status-first and retry without interpreting the message text.
   */
  paymentByOrder(
    orderId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<PaymentInitializationResult>> {
    return this.api.get<ApiResponseWithData<PaymentInitializationResult>>(
      PAYMENTS_ENDPOINTS.byOrder.path,
      {
        ...options,
        pathParams: { orderId, ...(options.pathParams ?? {}) },
      },
    );
  }

  /**
   * `GET /api/payments/{paymentId}` — single payment read (amount,
   * currency, provider, intent reference, status — all backend-issued,
   * display only). The id arrives via `paymentByOrder` (no order payload
   * carries it).
   * Success: `200 ApiResponse<PaymentResponse>`.
   * Failures: `401` anonymous, `404` unknown payment OR other-customer
   * payment (masked).
   */
  getPayment(
    paymentId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<PaymentResponse>> {
    return this.api.get<ApiResponseWithData<PaymentResponse>>(PAYMENTS_ENDPOINTS.getPayment.path, {
      ...options,
      pathParams: { paymentId, ...(options.pathParams ?? {}) },
    });
  }
}
