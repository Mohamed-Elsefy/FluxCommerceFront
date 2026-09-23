/**
 * Orders data-access service for Sub-Phase 10.1 — Orders Contract Audit &
 * Feature Foundation.
 *
 * Scope: `docs/phases/PHASE_10_ORDERS_CUSTOMER_ACCOUNT.md` §10.1 (data
 * access only — no state implementation, no pages, no components, no
 * routes wiring, no polling).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §4 and
 * `docs/frontend-contract/DTO_REFERENCE.md` §4
 * (`FluxCommerce.Modules.Orders.Contracts`, `[Route orders][Authorize]`),
 * plus `docs/frontend-contract/AUTH_FLOW.md` §4 (authenticated +
 * ownership) and `docs/frontend-contract/ERROR_CATALOG.md` §4 (order
 * error codes). Request/response shapes come from `@flux/models` (§1.1
 * mirrors) via the §10.1 feature aliases (`../models/orders.models`) —
 * no local re-declarations, so no contract drift is possible.
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * OrdersState (later sub-phase — not here; feature-owned local Signals)
 *         ↓ OrdersApiService (this file — thin typed façade)
 *     ApiClient (Phase 1, the ONLY HttpClient user)
 *         ↓ HttpClient → interceptors → ASP.NET Core API
 * ```
 *
 * Contract fidelity rules enforced here (same convention as
 * `CatalogApiService`, Phase 5.1, and `CheckoutApiService`, Phase 8.2):
 * - Each method maps 1:1 to one endpoint (same name, same params, same
 *   envelope); route templates come from `ORDERS_ENDPOINTS` — no
 *   scattered string literals.
 * - Query objects convert through the single `toQueryParams` funnel —
 *   never hand-built query strings.
 * - The service never unwraps `ApiResponse.data`, never catches or
 *   remaps errors, and never attaches tokens: envelopes stay intact for
 *   feature state to map, failures (`400` validation, `401` anonymous,
 *   `404` unknown-or-foreign id, `409` late cancel) flow untouched
 *   through the Observable error channel to the Phase 1 error
 *   normalizer, and `Authorization` stays owned by the interceptor
 *   pipeline.
 * - The service performs no business logic: no totals math, no status
 *   derivation, no retry policy, no polling (polling belongs to §10.6
 *   and only if backend behavior requires it).
 * - Cancellation travels through `ApiRequestOptions.signal` (Phase 1
 *   `cancelOnAbort` completes pre-aborted/in-flight aborts silently —
 *   never as errors). The service forwards the signal; lifecycle
 *   ownership belongs to the later-state caller.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.2 — no profile reads (`GET /auth/me` stays in `libs/auth`).
 * - 10.3 — no list state, no pagination UI, no envelope mapping.
 * - 10.4 — no details views or presentation mapping.
 * - 10.5 — no status badges or localized labels.
 * - 10.6 — no history reads, no post-payment polling/sync.
 */

import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import {
  ApiClient,
  ORDERS_ENDPOINTS,
  toQueryParams,
  type ApiRequestOptions,
  type ApiResponseWithData,
  type PagedApiResponse,
} from '@flux/api';
import type { Order, OrderSummary, OrdersQuery } from '../models/orders.models';

/**
 * Thin typed façade over the customer-facing orders contract. `getOrders`
 * and `getOrderById` map 1:1 to their `GET` endpoints (same params, same
 * envelope); `cancelOrder` maps 1:1 to its `POST` endpoint. There is no
 * mapping here because feature state owns envelope handling.
 */
@Injectable({ providedIn: 'root' })
export class OrdersApiService {
  private readonly api = inject(ApiClient);

  /**
   * `GET /orders` — authenticated (JWT via the interceptor pipeline).
   * Paged caller-owned order summaries, newest-first (no sort/filter
   * params by design; `null` query fields are omitted so backend
   * defaults `1/20` apply).
   *
   * `options.signal` aborts the call silently (Phase 1 `cancelOnAbort`);
   * any other `options` (correlation, culture) merge alongside the query.
   *
   * Success: `200 ApiResponse<PagedResult<OrderSummary>>` (`items: []`
   * with `totalCount: 0` means empty — still success, never an error).
   * Failures: `400` bad paging params, `401` anonymous — all propagate
   * untouched through the error channel.
   */
  getOrders(
    query: OrdersQuery = {},
    options: ApiRequestOptions = {},
  ): Observable<PagedApiResponse<OrderSummary>> {
    return this.api.get<PagedApiResponse<OrderSummary>>(ORDERS_ENDPOINTS.listOrders.path, {
      ...options,
      params: toQueryParams(query),
    });
  }

  /**
   * `GET /orders/{orderId}` — authenticated (JWT via the interceptor
   * pipeline) + ownership (foreign ids mask as `404` with no
   * distinguishing signal — never probe ids on this path).
   *
   * `options.signal` aborts the call silently (Phase 1 `cancelOnAbort`);
   * any other `options` (correlation, culture, extra path params) merge
   * alongside the order id.
   *
   * Success: `200 ApiResponse<Order>` (money is nested
   * `OrderMoneyResponse` on totals, split flat fields on line items —
   * display only, never inputs to math; `status` is the backend
   * `OrderStatus` string — `Pending | Cancelled | Confirmed`).
   * Failures: `401` anonymous, `404` unknown-or-foreign id — all
   * propagate untouched through the error channel.
   */
  getOrderById(
    orderId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<Order>> {
    return this.api.get<ApiResponseWithData<Order>>(ORDERS_ENDPOINTS.getOrder.path, {
      ...options,
      pathParams: { orderId, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `POST /orders/{orderId}/cancel` — authenticated (JWT via the
   * interceptor pipeline) + ownership (foreign ids mask as `404`).
   * Valid only while the order is `Pending`; final payload echoes the
   * details shape.
   *
   * `options.signal` aborts the call silently (Phase 1 `cancelOnAbort`).
   *
   * Success: `200 ApiResponse<Order>` (cancelled details).
   * Failures: `401` anonymous, `404` unknown-or-foreign id, `409`
   * `CancelConflict` (too late — the order left `Pending`) — all
   * propagate untouched through the error channel.
   */
  cancelOrder(
    orderId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<Order>> {
    return this.api.post<ApiResponseWithData<Order>>(ORDERS_ENDPOINTS.cancelOrder.path, undefined, {
      ...options,
      pathParams: { orderId, ...(options.pathParams ?? {}) },
    });
  }
}
