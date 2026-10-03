/**
 * Admin Orders data-access service for Sub-Phase 14.2 — Admin Orders
 * Feature Foundation — plus Supplement S1, Step S1.8 (admin surface).
 *
 * Scope: the `[Route admin/orders]` surface (platform-wide paged list
 * with filters, counts snapshot, unscoped details read, force-cancel,
 * and refund submission) plus the 14.6 payment slice (by-order
 * initialization read plus the single payment read it links to).
 * Payment history, payment mutations, and the Stripe webhook never
 * travel here (no contract supports them from the SPA).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §4.5
 * (permission-gated admin orders: `orders.read` for list/counts/
 * details, `orders.cancel` for force-cancel, `orders.refund` for
 * refund) and §6 (payments), plus the 14.1 audit
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
 * - Route templates come from `ADMIN_ORDERS_ENDPOINTS` — no scattered
 *   string literals.
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
 * - No checkout (customer flow), no webhook (Stripe→API only, never
 *   called by the SPA), no totals math, no status derivation.
 */

import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AdminOrderCountsResponse,
  OrderDetailsResponse,
  OrderSummaryResponse,
  PaymentInitializationResult,
  PaymentResponse,
  RefundOrderRequest,
} from '@flux/models';
import {
  ApiClient,
  ADMIN_ORDERS_ENDPOINTS,
  PAYMENTS_ENDPOINTS,
  toQueryParams,
  type ApiRequestOptions,
  type ApiResponseWithData,
  type PagedApiResponse,
} from '@flux/api';

/** `GET /admin/orders` query (paging plus contract-supported filters). */
export interface AdminOrderListQuery {
  readonly pageNumber?: number;
  readonly pageSize?: number;
  readonly status?: string;
  readonly customerId?: string;
  readonly search?: string;
  readonly from?: string;
  readonly to?: string;
}

/**
 * Thin typed façade over the admin Orders contract. Each method maps
 * 1:1 to one endpoint (same name, same params, same envelope); there is
 * no mapping here because feature state owns envelope handling.
 *
 * Feature-scoped (no `providedIn`): provided at the orders route level
 * alongside the overview state — never a root singleton (Phase 12.8
 * pins the root-provided admin allowlist; this service is not on it).
 */
@Injectable()
export class OrdersAdminApiService {
  private readonly api = inject(ApiClient);

  /**
   * `GET /admin/orders` — paged platform-wide order list, newest-first.
   * Filters: `status?` (`Pending|Cancelled|Confirmed`), `customerId?`,
   * `search?` (order-number substring), `from?`/`to?` (unknown status or
   * `from > to` → `400`). No ownership scoping — the caller sees every
   * customer's orders.
   * Success: `200 ApiResponse<PagedResult<OrderSummaryResponse>>`.
   * Failures: `400` validation, `401` anonymous, `403` missing
   * `orders.read`.
   */
  listOrders(
    query: AdminOrderListQuery = {},
    options: ApiRequestOptions = {},
  ): Observable<PagedApiResponse<OrderSummaryResponse>> {
    return this.api.get<PagedApiResponse<OrderSummaryResponse>>(
      ADMIN_ORDERS_ENDPOINTS.listAdminOrders.path,
      { ...options, params: toQueryParams(query) },
    );
  }

  /**
   * `GET /admin/orders/counts` — order counters snapshot
   * (`total/pending/confirmed/cancelled`).
   * Success: `200 ApiResponse<AdminOrderCountsResponse>`.
   * Failures: `401` anonymous, `403` missing `orders.read`.
   */
  orderCounts(
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<AdminOrderCountsResponse>> {
    return this.api.get<ApiResponseWithData<AdminOrderCountsResponse>>(
      ADMIN_ORDERS_ENDPOINTS.orderCounts.path,
      options,
    );
  }

  /**
   * `GET /admin/orders/{orderId}` — single order read model (totals,
   * items, addresses, status — all backend-issued, display only). No
   * ownership scoping (unlike the customer read, strangers do not mask
   * as `404` here — unknown ids do).
   * Success: `200 ApiResponse<OrderDetailsResponse>`.
   * Failures: `401` anonymous, `403` missing `orders.read`, `404`
   * unknown order.
   */
  getOrder(
    orderId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<OrderDetailsResponse>> {
    return this.api.get<ApiResponseWithData<OrderDetailsResponse>>(
      ADMIN_ORDERS_ENDPOINTS.getAdminOrder.path,
      { ...options, pathParams: { orderId, ...(options.pathParams ?? {}) } },
    );
  }

  /**
   * `POST /admin/orders/{orderId}/cancel` — force-cancels any `Pending`
   * order (compensation flows via `order_cancelled` as for customer
   * cancel). Must be `Pending`; use refund for `Confirmed`.
   * Success: `200 ApiResponse<OrderDetailsResponse>` (updated order).
   * Failures: `401` anonymous, `403` missing `orders.cancel`, `404`
   * unknown order, `409 Order.CancelConflict`.
   */
  cancelOrder(
    orderId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<OrderDetailsResponse>> {
    return this.api.post<ApiResponseWithData<OrderDetailsResponse>>(
      ADMIN_ORDERS_ENDPOINTS.cancelAdminOrder.path,
      {},
      { ...options, pathParams: { orderId, ...(options.pathParams ?? {}) } },
    );
  }

  /**
   * `POST /admin/orders/{orderId}/refund` — refunds a paid order
   * (`reason` 1..500 chars, required). The refund completes
   * asynchronously via the saga → Stripe → `PaymentRefunded`; in-flight
   * duplicates stay `200` idempotent.
   * Success: `200 ApiResponse<OrderDetailsResponse>` (current order).
   * Failures: `400` validation, `401` anonymous, `403` missing
   * `orders.refund`, `404` unknown order, `409 Order.RefundConflict`
   * (non-paid order).
   */
  refundOrder(
    orderId: string,
    body: RefundOrderRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<OrderDetailsResponse>> {
    return this.api.post<ApiResponseWithData<OrderDetailsResponse>>(
      ADMIN_ORDERS_ENDPOINTS.refundAdminOrder.path,
      body,
      { ...options, pathParams: { orderId, ...(options.pathParams ?? {}) } },
    );
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
