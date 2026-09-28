/**
 * Feature-owned orders list state for Sub-Phase 14.3 — Orders List &
 * Pagination.
 *
 * Scope: the paged orders table only (`GET /orders` — the endpoint
 * exposes paging params only, so the state owns no query transitions
 * beyond the committed page: no sorting, no filtering, no search — see
 * the 14.1 audit. Filter/sort transitions arrive only if a backend
 * contract ever supports them on order rows).
 *
 * Display contract (14.1 audit — only backend-exposed data): rows carry
 * the caller-owned summaries verbatim (`orderNumber`, string `status`,
 * nested `grandTotal`, `itemCount`, `createdAtUtc`). No totals math, no
 * status derivation, no customer-identity resolution.
 *
 * Locality rules (same convention as the catalog states):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to `error`.
 * Pager values always render from the RESPONSE envelope (effective
 * `pageNumber`/`pageSize`/`totalCount`) — never request values. CSR-safe:
 * no browser APIs anywhere in this file.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 14.4 — no filter state, no status badge mapping.
 * - 14.5 — no details slot, no address rendering.
 * - 14.6–14.8 — no payment slots.
 */

import { inject, Injectable, OnDestroy, type Signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  ApiError,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiResponseWithData,
  type PagedApiResponse,
  type PaginationRequest,
  type ResourceState,
  type ResourceStateStore,
} from '@flux/api';
import type { OrderSummaryResponse } from '@flux/models';
import { OrdersAdminApiService } from '../data-access/orders-admin-api.service';
import type { AdminOrderPage } from '../models/orders-admin.models';

/** Default list page size (within the contract `1..100` limits). */
export const ORDER_LIST_PAGE_SIZE = 20;

/**
 * Feature-scoped orders list state. Provide at the orders route level —
 * never at root. All selectors are readonly signals; page moves commit
 * through the explicit `setPage()` driven by the owning page.
 */
@Injectable()
export class OrderListState implements OnDestroy {
  private readonly ordersApi = inject(OrdersAdminApiService);
  private loads = new Subscription();

  private readonly pageStore: ResourceStateStore<AdminOrderPage> =
    createResourceState<AdminOrderPage>();

  /** Current order page (idle → loading → success | empty | error). */
  readonly page: Signal<ResourceState<AdminOrderPage>> = this.pageStore.state;

  /**
   * Loads the given page (response-effective values drive the pager, so
   * callers pass committed page numbers only). A load issued while
   * another is in flight supersedes it: the previous subscription is
   * torn down first, so stale pages can never settle over newer ones.
   */
  load(query: PaginationRequest = {}): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    const request: Observable<AdminOrderPage> = this.ordersApi
      .listOrders({ pageNumber: 1, pageSize: ORDER_LIST_PAGE_SIZE, ...query })
      .pipe(map(requireOrderPage));
    this.loads.add(
      loadResourceState(this.pageStore, request, {
        isEmpty: (page) => page.items.length === 0,
      }),
    );
  }

  /**
   * Commits a page move (pager `pageChange` re-enters here). Out-of-range
   * pages arrive as `200` with `items: []` — the page renders its empty
   * state, never an error.
   */
  setPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  /** Reloads the current effective page (retry and post-action refresh). */
  reload(): void {
    const current = this.pageStore.data();
    this.load(current === null ? {} : { pageNumber: current.pageNumber });
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps a paged envelope; a dataless `200` is a contract violation. */
function requireOrderPage(envelope: PagedApiResponse<OrderSummaryResponse>): AdminOrderPage {
  const data = (envelope as ApiResponseWithData<AdminOrderPage>).data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}
