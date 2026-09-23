/**
 * Storefront Orders list state for Sub-Phase 10.3 — Orders List.
 *
 * Scope: `docs/phases/PHASE_10_ORDERS_CUSTOMER_ACCOUNT.md` §10.3 (paged
 * list resource only — no order-details state, no status mapping, no
 * polling).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §4
 * (`GET /orders` → `ApiResponse<PagedResult<OrderSummaryResponse>>`;
 * authenticated; defaults `1/20`, max `100`; fixed newest-first, no
 * sort/filter params; caller-owned only).
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * OrdersListPage (pages/ — orchestration only)
 *     ↓ OrdersListState (this file — route-provided local Signals)
 *     ↓ OrdersApiService (data-access/ — §10.1 thin typed façade)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 *
 * State rules (the Catalog/Cart/Checkout/Payment pattern —
 * route-provided via `ordersRoutes`, never `providedIn`, never a global
 * store):
 * - One paged resource slot (`idle → loading → success | empty |
 *   error`, shared Phase 1 `createResourceState`/`loadResourceState`).
 *   Empty means `items: []` — including out-of-range pages, which the
 *   backend answers with `200` (never an error). A `200` without `data`
 *   is a contract breach → error, never a rendered list.
 * - Page moves commit through the canonical `normalizePagination`
 *   primitive (1-based, clamped) with the fixed §10.1 default page size;
 *   the pager renders from RESPONSE-effective
 *   `pageNumber/pageSize/totalCount`, never request values.
 * - Loads dedupe: a concurrent same-page load, or a repeat after
 *   success without `force`, is a safe no-op. `retry()` forces a fresh
 *   load of the requested page after errors.
 * - Cancellation travels through `options.signal` (Phase 1
 *   `cancelOnAbort` completes pre-aborted/in-flight aborts silently —
 *   never as errors; state stays untouched).
 * - No business logic in state: no totals math, no status derivation
 *   (order and payment statuses stay independent and verbatim), no
 *   transitions — backend values render as received.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.4 — no order-details slots or cancel orchestration.
 * - 10.5 — no status badges or localized status mapping.
 * - 10.6 — no history reads or post-payment polling.
 */

import { Injectable, inject, signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  createResourceState,
  loadResourceState,
  normalizePagination,
  type ApiRequestOptions,
  type PagedApiResponse,
  type PagedResult,
} from '@flux/api';
import { OrdersApiService } from '../data-access/orders-api.service';
import {
  ORDERS_DEFAULT_PAGE_NUMBER,
  ORDERS_DEFAULT_PAGE_SIZE,
  type OrderSummary,
  type OrdersQuery,
} from '../models/orders.models';

/** Settled orders page (`GET /orders` payload). */
export type OrdersPage = PagedResult<OrderSummary>;

/** Options for `OrdersListState.loadPage`. */
export interface LoadOrdersPageOptions extends ApiRequestOptions {
  /**
   * Reload even after a settled success on the same page (error retries
   * always reload). Defaults to `false`.
   */
  readonly force?: boolean;
}

/**
 * Feature-scoped orders list state: the paged customer-orders resource
 * plus the requested page. Provided on the `ordersRoutes` parent (one
 * instance per orders entry — never a global store, no `providedIn`).
 */
@Injectable()
export class OrdersListState {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly pageStore = createResourceState<OrdersPage>();

  /** Requested page number (committed moves; 1-based). */
  private readonly requestedPage = signal(ORDERS_DEFAULT_PAGE_NUMBER);

  /** Paged orders resource lifecycle (`idle | loading | success | empty | error`). */
  readonly status = this.pageStore.status;

  /** Settled page, or `null` until the first success. */
  readonly page = this.pageStore.data;

  /** Normalized page failure (`ApiError | null`). */
  readonly error = this.pageStore.error;

  /** True while the page request is in flight. */
  readonly isLoading = this.pageStore.isLoading;

  /** True once a page has settled with items. */
  readonly isSuccess = this.pageStore.isSuccess;

  /** True when the last load settled with zero items. */
  readonly isEmpty = this.pageStore.isEmpty;

  /** True when the last page load failed. */
  readonly isError = this.pageStore.isError;

  /** Currently requested page number. */
  readonly currentPage = this.requestedPage.asReadonly();

  /**
   * Loads a page of customer orders into the resource slot. The page
   * number commits through `normalizePagination` (clamped to valid
   * pages); failures — including a `200` without `data` — land in the
   * error slot untouched for the page to render via
   * `resolveApiErrorMessage`. Returns the subscription for
   * owner-managed teardown.
   */
  loadPage(
    pageNumber: number = this.requestedPage(),
    options: LoadOrdersPageOptions = {},
  ): Subscription {
    const { pageNumber: page } = normalizePagination({
      pageNumber,
      pageSize: ORDERS_DEFAULT_PAGE_SIZE,
    });
    if (this.pageStore.isLoading() && page === this.requestedPage()) {
      return Subscription.EMPTY;
    }
    if (!options.force && this.pageStore.isSuccess() && page === this.requestedPage()) {
      return Subscription.EMPTY;
    }
    this.requestedPage.set(page);
    const query: OrdersQuery = { pageNumber: page, pageSize: ORDERS_DEFAULT_PAGE_SIZE };
    return loadResourceState(this.pageStore, this.pageSource(query, options), {
      signal: options.signal,
      isEmpty: (settled) => settled.items.length === 0,
    });
  }

  /** Forces a fresh load of the requested page (error-state retry path). */
  retry(): Subscription {
    return this.loadPage(this.requestedPage(), { force: true });
  }

  /**
   * Live page source: unwraps `ApiResponse.data` (missing data is a
   * contract breach → normalized failure, never a rendered list).
   */
  private pageSource(query: OrdersQuery, options: ApiRequestOptions = {}): Observable<OrdersPage> {
    return this.ordersApi
      .getOrders(query, options)
      .pipe(map((envelope: PagedApiResponse<OrderSummary>) => requireOrdersPage(envelope)));
  }
}

/** Unwraps the paged envelope or fails on a dataless `200`. */
function requireOrdersPage(envelope: PagedApiResponse<OrderSummary>): OrdersPage {
  const page = envelope.data ?? null;
  if (page === null) {
    throw new Error('Orders response carried no data.');
  }
  return page;
}
