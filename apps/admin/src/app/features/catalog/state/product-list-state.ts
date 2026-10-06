/**
 * Feature-owned product list state for Sub-Phase 13.3 — Product
 * Management.
 *
 * Scope: the paged product table only (`GET /catalog/products` — paging
 * plus `searchTerm`/`status`/`visibility`/`categoryId` filters, no
 * sorting; see `docs/frontend-contract/API_CONTRACT.md` §2). Filter
 * transitions commit through the explicit `setFilters()` (page resets to
 * 1); page moves commit through `setPage()`.
 *
 * Locality rules (same convention as `catalog-overview-state`, 13.2):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to `error`.
 * Pager values always render from the RESPONSE envelope (effective
 * `pageNumber`/`pageSize`/`totalCount`) — never request values. CSR-safe:
 * no browser APIs anywhere in this file.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 13.4–13.6 — no variant/image/specification slots or writes.
 * - Sorting on product rows (`sortBy`/`sortDirection` stay
 *   `GET /catalog`-only).
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
import type { AdminProductListQuery, ProductResponse } from '@flux/models';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';
import type { AdminProductPage } from '../models/catalog-admin.models';

/** Default list page size (within the contract `1..100` limits). */
export const PRODUCT_LIST_PAGE_SIZE = 20;

/**
 * Feature-scoped product list state. Provide at the catalog route level —
 * never at root. All selectors are readonly signals; filter and page
 * moves commit through the explicit setters driven by the owning page.
 */
@Injectable()
export class ProductListState implements OnDestroy {
  private readonly catalogApi = inject(CatalogAdminApiService);
  private loads = new Subscription();

  private readonly pageStore: ResourceStateStore<AdminProductPage> =
    createResourceState<AdminProductPage>();

  /** Current product page (idle → loading → success | empty | error). */
  readonly page: Signal<ResourceState<AdminProductPage>> = this.pageStore.state;

  /** Currently committed filters (page moves preserve them). */
  private committed: AdminProductListQuery = {};

  /**
   * Loads the given page under the committed filters (response-effective
   * values drive the pager, so callers pass committed page numbers
   * only). A load issued while another is in flight supersedes it: the
   * previous subscription is torn down first, so stale pages can never
   * settle over newer ones. Blank filter values travel as omissions
   * (the backend `400`s on empty strings).
   */
  load(query: AdminProductListQuery = {}): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    this.committed = { ...this.committed, ...query };
    const { pageNumber, pageSize, ...filters } = this.committed;
    const request: Observable<AdminProductPage> = this.catalogApi
      .listProducts({
        pageNumber: pageNumber ?? 1,
        pageSize: pageSize ?? PRODUCT_LIST_PAGE_SIZE,
        ...omitBlankFilters(filters),
      })
      .pipe(map(requireProductPage));
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
  setFilters(filters: Omit<AdminProductListQuery, 'pageNumber' | 'pageSize'>): void {
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

  /** Reloads the current effective page (retry and post-mutation refresh). */
  reload(): void {
    const current = this.pageStore.data();
    this.load(current === null ? {} : { pageNumber: current.pageNumber });
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Drops blank string filters (the backend rejects empty strings); numbers pass through. */
function omitBlankFilters(
  filters: Omit<AdminProductListQuery, 'pageNumber' | 'pageSize'>,
): Omit<AdminProductListQuery, 'pageNumber' | 'pageSize'> {
  const cleaned: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'number') {
      cleaned[key] = value;
    } else if (typeof value === 'string' && value.trim() !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/** Unwraps a paged envelope; a dataless `200` is a contract violation. */
function requireProductPage(envelope: PagedApiResponse<ProductResponse>): AdminProductPage {
  const data = (envelope as ApiResponseWithData<AdminProductPage>).data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}
