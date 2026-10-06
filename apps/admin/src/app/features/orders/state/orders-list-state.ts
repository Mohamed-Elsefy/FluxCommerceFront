/**
 * Feature-owned orders list state for Sub-Phase 14.3 — Orders List &
 * Pagination — plus Supplement S1, Step S1.8 (platform-wide filters).
 *
 * Scope: the paged orders table only (`GET /admin/orders` — paging
 * plus `status`/`customerId`/`search`/`from`/`to` filters, fixed
 * newest-first ordering; no sorting — see the S1.1 audit).
 * Filter transitions commit through the explicit `setFilters()` (page
 * resets to 1); page moves commit through `setPage()`.
 *
 * Display contract (14.1 audit — only backend-exposed data): rows carry
 * the backend summaries verbatim (`orderNumber`, string `status`,
 * nested `grandTotal`, `itemCount`, `createdAtUtc`). No totals math, no
 * status derivation, no customer-identity resolution (no `userId`/
 * `customerId`/email exists on any order payload).
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
  type ResourceState,
  type ResourceStateStore,
} from '@flux/api';
import type { OrderSummaryResponse } from '@flux/models';
import {
  OrdersAdminApiService,
  type AdminOrderListQuery,
} from '../data-access/orders-admin-api.service';
import type { AdminOrderPage } from '../models/orders-admin.models';

/** Default list page size (within the contract `1..100` limits). */
export const ORDER_LIST_PAGE_SIZE = 20;

/**
 * Feature-scoped orders list state. Provide at the orders route level —
 * never at root. All selectors are readonly signals; filter and page
 * moves commit through the explicit setters driven by the owning page.
 */
@Injectable()
export class OrderListState implements OnDestroy {
  private readonly ordersApi = inject(OrdersAdminApiService);
  private loads = new Subscription();

  private readonly pageStore: ResourceStateStore<AdminOrderPage> =
    createResourceState<AdminOrderPage>();

  /** Current order page (idle → loading → success | empty | error). */
  readonly page: Signal<ResourceState<AdminOrderPage>> = this.pageStore.state;

  /** Currently committed filters (page moves preserve them). */
  private committed: AdminOrderListQuery = {};

  /**
   * Loads the given page under the committed filters (response-effective
   * values drive the pager, so callers pass committed page numbers
   * only). A load issued while another is in flight supersedes it: the
   * previous subscription is torn down first, so stale pages can never
   * settle over newer ones. Blank filter values travel as omissions
   * (the backend `400`s on empty strings and on `from > to`).
   */
  load(query: AdminOrderListQuery = {}): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    this.committed = { ...this.committed, ...query };
    const { pageNumber, pageSize, ...filters } = this.committed;
    const request: Observable<AdminOrderPage> = this.ordersApi
      .listOrders({
        pageNumber: pageNumber ?? 1,
        pageSize: pageSize ?? ORDER_LIST_PAGE_SIZE,
        ...omitBlankFilters(filters),
      })
      .pipe(map(requireOrderPage));
    this.loads.add(
      loadResourceState(this.pageStore, request, {
        isEmpty: (page) => page.items.length === 0,
      }),
    );
  }

  /**
   * Commits new filters (filter-bar apply/clear re-enter here). The page
   * resets to 1: filtered result sets never preserve the old page.
   * Filters replace (never merge): omitted keys are cleared so
   * `clearFilters()` really reloads unfiltered. The page size survives.
   */
  setFilters(filters: Omit<AdminOrderListQuery, 'pageNumber' | 'pageSize'>): void {
    const { pageSize } = this.committed;
    this.committed = {};
    this.load({ ...filters, pageNumber: 1, ...(pageSize === undefined ? {} : { pageSize }) });
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

/** Drops blank filter values (the backend rejects empty strings). */
function omitBlankFilters(
  filters: Omit<AdminOrderListQuery, 'pageNumber' | 'pageSize'>,
): Omit<AdminOrderListQuery, 'pageNumber' | 'pageSize'> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'string' && value.trim() !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
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
