/**
 * Feature-owned Catalog overview state for Sub-Phase 13.2 — Admin Catalog
 * Feature Foundation.
 *
 * Scope: the landing-page overview only (two first-page reads whose
 * backend-issued `totalCount` values prove the API connection and feed the
 * section facts). List/detail/write slots for products, variants,
 * categories, images, and specifications arrive with the business slices
 * that own their pages (Sub-Phases 13.3–13.6).
 *
 * State strategy (`ARCHITECTURE.md` §9 — smallest appropriate scope):
 *
 * ```text
 * CatalogHomePage (./pages — orchestration only)
 *     ↓ CatalogOverviewState (this file — feature-owned, local Signals)
 *     ↓ CatalogAdminApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Catalog API
 * ```
 *
 * Locality rules enforced here (same convention as the storefront
 * `CatalogState`, Phase 5.1):
 * - `@Injectable()` WITHOUT `providedIn` — the state is feature-scoped and
 *   must be provided at the catalog route level (`catalogRoutes`
 *   providers). It is never a root singleton and never global state (no
 *   NgRx, no SignalStore, no shared library).
 * - Signals stay local via the Phase 1 `createResourceState` primitive
 *   (idle → loading → success | empty | error, data retained across
 *   reloads, failures normalized to `ApiError`). No global store touched.
 * - The state never touches `HttpClient`, never builds query strings, and
 *   never performs DTO→view-model mapping beyond the pure
 *   `toCatalogOverview` projection: envelopes unwrap here, wire errors
 *   flow into the `error` state through `loadResourceState`.
 * - A dataless `200` envelope is a contract violation (same rule as the
 *   storefront state) and resolves to `error`, never to silent zeros.
 * - CSR-safe: no `window`/`document`/`localStorage` anywhere in this file.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 13.3–13.6 — no product/variant/category/image/spec slots, no query
 *   state, no pagination/filter/sort transitions, no forms.
 */

import { computed, inject, Injectable, OnDestroy, type Signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  ApiError,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiResponseWithData,
  type PagedApiResponse,
  type PagedResult,
  type ResourceState,
  type ResourceStateStore,
  type ResourceStatus,
} from '@flux/api';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';
import {
  toCatalogOverview,
  type AdminCategoryPage,
  type AdminProductPage,
  type CatalogOverview,
} from '../models/catalog-admin.models';

/**
 * Overview fetch size: the landing page needs backend-issued `totalCount`
 * values only, so one row per list minimizes payload while keeping the
 * envelope (and its effective paging values) intact.
 */
export const CATALOG_OVERVIEW_PAGE_SIZE = 1;

/**
 * Feature-scoped catalog overview state. Provide at the catalog route
 * level — never at root. All selectors are readonly signals; the only
 * transition is the explicit `refresh()` driven by the owning page.
 */
@Injectable()
export class CatalogOverviewState implements OnDestroy {
  private readonly catalogApi = inject(CatalogAdminApiService);
  private readonly loads = new Subscription();

  private readonly productsStore: ResourceStateStore<AdminProductPage> =
    createResourceState<AdminProductPage>();
  private readonly categoriesStore: ResourceStateStore<AdminCategoryPage> =
    createResourceState<AdminCategoryPage>();

  /** Current first-page product result (idle → loading → success | empty | error). */
  readonly products: Signal<ResourceState<AdminProductPage>> = this.productsStore.state;
  /** Current first-page category result (same lifecycle). */
  readonly categories: Signal<ResourceState<AdminCategoryPage>> = this.categoriesStore.state;

  /**
   * Combined landing status: `loading` while either slot loads, `error`
   * when either slot fails (products first), `empty` only when both slots
   * settle empty (no catalog data at all), `success` once both slots carry
   * data, `idle` before the first refresh.
   */
  readonly status: Signal<ResourceStatus> = computed(() => {
    const products = this.productsStore.state();
    const categories = this.categoriesStore.state();
    if (products.isLoading || categories.isLoading) {
      return 'loading';
    }
    if (products.isError || categories.isError) {
      return 'error';
    }
    if (products.isEmpty && categories.isEmpty) {
      return 'empty';
    }
    if ((products.isSuccess || products.isEmpty) && (categories.isSuccess || categories.isEmpty)) {
      return 'success';
    }
    return 'idle';
  });

  /**
   * Projected overview once both slots settle with data (either slot may
   * be `empty` — an empty page still carries its zero `totalCount`);
   * `null` while loading, failed, or untouched.
   */
  readonly overview: Signal<CatalogOverview | null> = computed(() => {
    const products = this.productsStore.data();
    const categories = this.categoriesStore.data();
    if (products === null || categories === null) {
      return null;
    }
    return toCatalogOverview(products, categories);
  });

  /** First normalized failure (products slot wins ties). */
  readonly error = computed(() => this.productsStore.error() ?? this.categoriesStore.error());

  /**
   * (Re)loads both overview slots; landing retry re-enters here. A refresh
   * issued while a load is in flight is a no-op (duplicate-submit
   * prevention at the state level — the page holds no request flags).
   */
  refresh(): void {
    if (this.status() === 'loading') {
      return;
    }
    const productsRequest: Observable<AdminProductPage> = this.catalogApi
      .listProducts({ pageNumber: 1, pageSize: CATALOG_OVERVIEW_PAGE_SIZE })
      .pipe(map(requirePage));
    const categoriesRequest: Observable<AdminCategoryPage> = this.catalogApi
      .listCategories({ pageNumber: 1, pageSize: CATALOG_OVERVIEW_PAGE_SIZE })
      .pipe(map(requirePage));
    this.loads.add(
      loadResourceState(this.productsStore, productsRequest, {
        isEmpty: (page) => page.items.length === 0,
      }),
    );
    this.loads.add(
      loadResourceState(this.categoriesStore, categoriesRequest, {
        isEmpty: (page) => page.items.length === 0,
      }),
    );
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps a paged envelope; a dataless `200` is a contract violation. */
function requirePage<T>(envelope: PagedApiResponse<T>): PagedResult<T> {
  const data = (envelope as ApiResponseWithData<PagedResult<T>>).data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}
