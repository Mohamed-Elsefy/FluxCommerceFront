/**
 * Feature-owned Catalog state for Sub-Phase 5.1 — Catalog Feature Foundation.
 *
 * Scope: `docs/phases/PHASE_5_CATALOG.md` §5.1 (foundation only — no UI).
 *
 * State strategy (`ARCHITECTURE.md` §9 — smallest appropriate scope):
 *
 * ```text
 * Component (5.2+ pages — not this sub-phase)
 *     ↓ CatalogState (this file — feature-owned, local Signals)
 *     ↓ CatalogApiService (./data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Catalog API
 * ```
 *
 * Locality rules enforced here:
 * - `@Injectable()` WITHOUT `providedIn` — the state is feature-scoped and
 *   must be provided at the catalog route level (`catalogRoutes` providers).
 *   It is never a root singleton and never global state (no NgRx, no
 *   SignalStore, no shared library). Each catalog route subtree gets its own
 *   instance; providing it twice yields two independent states.
 * - Signals stay local via the Phase 1 `createResourceState` primitive
 *   (idle → loading → success | empty | error, data retained across reloads,
 *   failures normalized to `ApiError`). No global store is touched.
 * - The state never touches `HttpClient`, never builds query strings, and
 *   never performs DTO→view-model mapping beyond the pure `toProductList` /
 *   `toCategoryList` fallbacks: envelopes unwrap here, wire errors flow into
 *   the `error` state through `loadResourceState`.
 * - SSR-safe: no `window`/`document`/`localStorage` anywhere in this file —
 *   server rendering only exercises the initial `idle` snapshots.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 5.2 — no pages, no category discovery orchestration.
 * - 5.4 — no coherent query-state store (callers pass the query per load).
 * - 5.5 — no debouncing or stale-request guards beyond `AbortSignal`
 *   forwarding through `ApiRequestOptions.signal`.
 * - Phase 6 — no variant selection, quantities, or add-to-cart.
 */

import { inject, Injectable } from '@angular/core';
import type { Signal } from '@angular/core';
import { map, type Observable, type Subscription } from 'rxjs';
import {
  ApiError,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiRequestOptions,
  type ApiResponseWithData,
  type PagedApiResponse,
  type PaginationRequest,
  type ResourceState,
  type ResourceStateStore,
} from '@flux/api';
import { CatalogApiService } from '../data-access/catalog-api.service';
import {
  emptyCategoryList,
  emptyProductList,
  type CatalogQuery,
  type Category,
  type CategoryList,
  type Product,
  type ProductList,
} from '../models/catalog.models';

/** Options for every `CatalogState` load: cancellation only, never mapping. */
export interface CatalogLoadOptions {
  /** Lifecycle signal — aborts complete silently and leave state untouched. */
  readonly signal?: AbortSignal;
}

/**
 * Feature-scoped catalog state. Provide at the catalog route level —
 * never at root. All selectors are readonly signals; all transitions are
 * explicit `load*` calls driven by the owning page (5.2+).
 */
@Injectable()
export class CatalogState {
  private readonly catalogApi = inject(CatalogApiService);

  private readonly productsStore: ResourceStateStore<ProductList> =
    createResourceState<ProductList>();
  private readonly categoriesStore: ResourceStateStore<CategoryList> =
    createResourceState<CategoryList>();
  private readonly productStore: ResourceStateStore<Product> = createResourceState<Product>();
  private readonly categoryStore: ResourceStateStore<Category> = createResourceState<Category>();

  /** Current paged storefront search result (`GET /catalog`). */
  readonly products: Signal<ResourceState<ProductList>> = this.productsStore.state;
  /** Current paged category result (`GET /catalog/categories`). */
  readonly categories: Signal<ResourceState<CategoryList>> = this.categoriesStore.state;
  /** Currently selected product (`GET /catalog/products/{id}`). */
  readonly product: Signal<ResourceState<Product>> = this.productStore.state;
  /** Currently selected category (`GET /catalog/categories/{id}`). */
  readonly category: Signal<ResourceState<Category>> = this.categoryStore.state;

  /** Whether the product list is currently loading. */
  readonly productsLoading: Signal<boolean> = this.productsStore.isLoading;
  /** Whether the category list is currently loading. */
  readonly categoriesLoading: Signal<boolean> = this.categoriesStore.isLoading;

  /**
   * Loads the storefront search result for `query`. An empty page
   * (`items: []`, including out-of-range pages which the backend answers
   * with `200`) resolves to `empty`; a dataless envelope resolves to
   * `error` (contract violation); aborts leave state untouched.
   */
  loadProducts(query: CatalogQuery = {}, options: CatalogLoadOptions = {}): Subscription {
    const request: Observable<ProductList> = this.catalogApi
      .searchCatalog(query, toApiOptions(options))
      .pipe(map((envelope) => requirePagedData(envelope, emptyProductList(query.pageSize ?? 20))));
    return loadResourceState(this.productsStore, request, {
      signal: options.signal,
      isEmpty: (page) => page.items.length === 0,
    });
  }

  /**
   * Loads the paged category list. Same lifecycle rules as `loadProducts`.
   */
  loadCategories(query: PaginationRequest = {}, options: CatalogLoadOptions = {}): Subscription {
    const request: Observable<CategoryList> = this.catalogApi
      .listCategories(query, toApiOptions(options))
      .pipe(map((envelope) => requirePagedData(envelope, emptyCategoryList(query.pageSize ?? 20))));
    return loadResourceState(this.categoriesStore, request, {
      signal: options.signal,
      isEmpty: (page) => page.items.length === 0,
    });
  }

  /** Loads a single product by id into the `product` slot. */
  loadProduct(id: string, options: CatalogLoadOptions = {}): Subscription {
    const request: Observable<Product> = this.catalogApi
      .getProduct(id, toApiOptions(options))
      .pipe(map(requireEnvelopeData));
    return loadResourceState(this.productStore, request, { signal: options.signal });
  }

  /** Loads a single category by id into the `category` slot. */
  loadCategory(id: string, options: CatalogLoadOptions = {}): Subscription {
    const request: Observable<Category> = this.catalogApi
      .getCategory(id, toApiOptions(options))
      .pipe(map(requireEnvelopeData));
    return loadResourceState(this.categoryStore, request, { signal: options.signal });
  }

  /** Resets every slot to `idle` (e.g. on feature teardown). */
  reset(): void {
    this.productsStore.reset();
    this.categoriesStore.reset();
    this.productStore.reset();
    this.categoryStore.reset();
  }
}

function toApiOptions(options: CatalogLoadOptions): ApiRequestOptions {
  return options.signal === undefined ? {} : { signal: options.signal };
}

/** Unwraps a paged envelope; a dataless `200` is a contract violation. */
function requirePagedData<T>(
  envelope: PagedApiResponse<T>,
  fallback: { items: T[]; totalCount: number; pageNumber: number; pageSize: number },
): { items: T[]; totalCount: number; pageNumber: number; pageSize: number } {
  const data = (envelope as ApiResponseWithData<typeof fallback>).data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}

/** Unwraps a single-resource envelope; a dataless `200` is a contract violation. */
function requireEnvelopeData<T>(envelope: ApiResponseWithData<T>): T {
  const data = envelope.data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}
