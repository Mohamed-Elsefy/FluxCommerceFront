/**
 * Feature-owned reservation list state for Supplement S1, Step S1.7 —
 * Inventory Lists & Counts (reservation slice).
 *
 * Scope: the paged reservation table only (`GET /inventory/reservations`
 * — paging plus `status`/`sku`/`orderId` filters, fixed newest-first
 * ordering; no sorting — see the S1.1 audit). Filter transitions commit
 * through the explicit `setFilters()` (page resets to 1); page moves
 * commit through `setPage()`.
 *
 * Display contract (S1.1 audit — only backend-exposed data): rows carry
 * the backend-issued reservation facts verbatim (ids, SKU, quantity,
 * status, timestamps). The lifecycle itself stays entirely
 * backend-owned: this state performs no transitions and gates none.
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
 * - single-reservation lookups (owned by `ReservationState`).
 * - stock lists, counts snapshots, adjustments.
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
import type { InventoryReservationResponse } from '@flux/models';
import { InventoryAdminApiService } from '../data-access/inventory-admin-api.service';
import type { AdminReservationPage } from '../models/inventory-admin.models';

/** Default list page size (within the contract `1..100` limits). */
export const RESERVATION_LIST_PAGE_SIZE = 20;

/** Committed reservation list query (paging plus contract filters). */
export interface ReservationListQuery {
  readonly pageNumber?: number;
  readonly pageSize?: number;
  readonly status?: string;
  readonly sku?: string;
  readonly orderId?: string;
}

/**
 * Feature-scoped reservation list state. Provide at the inventory route
 * level — never at root. All selectors are readonly signals; filter and
 * page moves commit through the explicit setters driven by the owning
 * page.
 */
@Injectable()
export class ReservationListState implements OnDestroy {
  private readonly inventoryApi = inject(InventoryAdminApiService);
  private loads = new Subscription();

  private readonly pageStore: ResourceStateStore<AdminReservationPage> =
    createResourceState<AdminReservationPage>();

  /** Current reservation page (idle → loading → success | empty | error). */
  readonly page: Signal<ResourceState<AdminReservationPage>> = this.pageStore.state;

  /** Currently committed filters (page moves preserve them). */
  private committed: ReservationListQuery = {};

  /**
   * Loads the given page under the committed filters (response-effective
   * values drive the pager, so callers pass committed page numbers
   * only). A load issued while another is in flight supersedes it: the
   * previous subscription is torn down first, so stale pages can never
   * settle over newer ones. Blank filter values travel as omissions
   * (the backend `400`s on empty strings).
   */
  load(query: ReservationListQuery = {}): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    this.committed = { ...this.committed, ...query };
    const { pageNumber, pageSize, status, sku, orderId } = this.committed;
    this.loads.add(
      loadResourceState(
        this.pageStore,
        this.inventoryApi
          .listReservations({
            pageNumber: pageNumber ?? 1,
            pageSize: pageSize ?? RESERVATION_LIST_PAGE_SIZE,
            ...omitBlank({ status, sku, orderId }),
          })
          .pipe(map(requireReservationPage)),
        {
          isEmpty: (page: AdminReservationPage) => page.items.length === 0,
        },
      ),
    );
  }

  /**
   * Commits new filters (filter-bar apply/clear re-enter here). The page
   * resets to 1: filtered result sets never preserve the old page.
   */
  setFilters(filters: Omit<ReservationListQuery, 'pageNumber' | 'pageSize'>): void {
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

/** Drops blank filter values (the backend rejects empty strings). */
function omitBlank(
  filters: Omit<ReservationListQuery, 'pageNumber' | 'pageSize'>,
): Omit<ReservationListQuery, 'pageNumber' | 'pageSize'> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'string' && value.trim() !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/** Unwraps a paged envelope; a dataless `200` is a contract violation. */
function requireReservationPage(
  envelope: PagedApiResponse<InventoryReservationResponse>,
): AdminReservationPage {
  const data = (envelope as ApiResponseWithData<AdminReservationPage>).data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}
