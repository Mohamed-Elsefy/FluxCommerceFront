/**
 * Feature-owned stock list state for Supplement S1, Step S1.7 —
 * Inventory Lists & Counts (stock slice).
 *
 * Scope: the paged stock table only (`GET /inventory` — paging plus
 * `search`/`maxAvailable` filters, fixed by-SKU ordering; no sorting —
 * see the S1.1 audit). Filter transitions commit through the explicit
 * `setFilters()` (page resets to 1); page moves commit through
 * `setPage()`.
 *
 * Display contract (S1.1 audit — only backend-exposed data): rows carry
 * the backend-issued quantities verbatim (`onHandQuantity`,
 * `reservedQuantity`, `availableQuantity` — never derived client-side).
 * No status or threshold is invented here; the low-stock bucket comes
 * from the counts snapshot, never from row math.
 *
 * Locality rules (same convention as the catalog states):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to `error`.
 * Pager values always render from the RESPONSE envelope (effective
 * `pageNumber`/`pageSize`/`totalCount`) — never request values.
 * CSR-safe: no browser APIs anywhere in this file.
 *
 * Explicitly out of scope (later slices, must not appear here):
 * - single-SKU lookups (owned by `StockState`).
 * - reservation lists, counts snapshots, adjustments.
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
import type { InventoryItemResponse } from '@flux/models';
import { InventoryAdminApiService } from '../data-access/inventory-admin-api.service';
import type { AdminStockPage } from '../models/inventory-admin.models';

/** Default list page size (within the contract `1..100` limits). */
export const STOCK_LIST_PAGE_SIZE = 20;

/** Committed stock list query (paging plus contract-supported filters). */
export interface StockListQuery {
  readonly pageNumber?: number;
  readonly pageSize?: number;
  readonly search?: string;
  readonly maxAvailable?: number;
}

/**
 * Feature-scoped stock list state. Provide at the inventory route level
 * — never at root. All selectors are readonly signals; filter and page
 * moves commit through the explicit setters driven by the owning page.
 */
@Injectable()
export class StockListState implements OnDestroy {
  private readonly inventoryApi = inject(InventoryAdminApiService);
  private loads = new Subscription();

  private readonly pageStore: ResourceStateStore<AdminStockPage> =
    createResourceState<AdminStockPage>();

  /** Current stock page (idle → loading → success | empty | error). */
  readonly page: Signal<ResourceState<AdminStockPage>> = this.pageStore.state;

  /** Currently committed filters (page moves preserve them). */
  private committed: StockListQuery = {};

  /**
   * Loads the given page under the committed filters (response-effective
   * values drive the pager, so callers pass committed page numbers
   * only). A load issued while another is in flight supersedes it: the
   * previous subscription is torn down first, so stale pages can never
   * settle over newer ones. Blank search values travel as omissions
   * (the backend `400`s on empty strings).
   */
  load(query: StockListQuery = {}): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    this.committed = { ...this.committed, ...query };
    const { pageNumber, pageSize, search, maxAvailable } = this.committed;
    const request: Observable<AdminStockPage> = this.inventoryApi
      .listItems({
        pageNumber: pageNumber ?? 1,
        pageSize: pageSize ?? STOCK_LIST_PAGE_SIZE,
        ...(typeof search === 'string' && search.trim() !== '' ? { search } : {}),
        ...(maxAvailable === undefined || maxAvailable === null ? {} : { maxAvailable }),
      })
      .pipe(map(requireStockPage));
    this.loads.add(
      loadResourceState(this.pageStore, request, {
        isEmpty: (page) => page.items.length === 0,
      }),
    );
  }

  /**
   * Commits new filters (filter-bar apply/clear re-enter here). The page
   * resets to 1: filtered result sets never preserve the old page.
   */
  setFilters(filters: Omit<StockListQuery, 'pageNumber' | 'pageSize'>): void {
    this.load({ ...filters, pageNumber: 1 });
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
function requireStockPage(envelope: PagedApiResponse<InventoryItemResponse>): AdminStockPage {
  const data = (envelope as ApiResponseWithData<AdminStockPage>).data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}
