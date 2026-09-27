/**
 * Feature-owned category list state for Sub-Phase 13.5 — Category
 * Management.
 *
 * Scope: the paged category table only (`GET /catalog/categories` — the
 * endpoint exposes no sorting/filtering/search params, so the state owns
 * no query transitions beyond the committed page; see the list page docs
 * for the documented backend gap).
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
 * - 13.6 — no image/specification slots or writes.
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
import type { CategoryResponse } from '@flux/models';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';
import type { AdminCategoryPage } from '../models/catalog-admin.models';

/** Default list page size (within the contract `1..100` limits). */
export const CATEGORY_LIST_PAGE_SIZE = 20;

/**
 * Feature-scoped category list state. Provide at the catalog route level —
 * never at root. All selectors are readonly signals; page moves commit
 * through the explicit `setPage()` driven by the owning page.
 */
@Injectable()
export class CategoryListState implements OnDestroy {
  private readonly catalogApi = inject(CatalogAdminApiService);
  private loads = new Subscription();

  private readonly pageStore: ResourceStateStore<AdminCategoryPage> =
    createResourceState<AdminCategoryPage>();

  /** Current category page (idle → loading → success | empty | error). */
  readonly page: Signal<ResourceState<AdminCategoryPage>> = this.pageStore.state;

  /**
   * Loads the given page (response-effective values drive the pager, so
   * callers pass committed page numbers only). A load issued while
   * another is in flight supersedes it: the previous subscription is
   * torn down first, so stale pages can never settle over newer ones.
   */
  load(query: PaginationRequest = {}): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    const request: Observable<AdminCategoryPage> = this.catalogApi
      .listCategories({ pageNumber: 1, pageSize: CATEGORY_LIST_PAGE_SIZE, ...query })
      .pipe(map(requireCategoryPage));
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

  /** Reloads the current effective page (retry and post-mutation refresh). */
  reload(): void {
    const current = this.pageStore.data();
    this.load(current === null ? {} : { pageNumber: current.pageNumber });
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps a paged envelope; a dataless `200` is a contract violation. */
function requireCategoryPage(envelope: PagedApiResponse<CategoryResponse>): AdminCategoryPage {
  const data = (envelope as ApiResponseWithData<AdminCategoryPage>).data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}
