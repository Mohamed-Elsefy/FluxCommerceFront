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
 *   server rendering only exercises the initial `idle` snapshots, and
 *   `TransferState`/`PLATFORM_ID` are the only platform seams (both
 *   SSR-safe by Angular design).
 * - Hydration (5.10): settled list pages transfer server → client once
 *   per query (keyed by the canonical query hash, consumed on read, never
 *   stored on failure), so hydration never refetches transferred data and
 *   never serves stale data. Prerendering without a backend yields idle
 *   shells by design (the page skips server fetches); the mechanism
 *   activates whenever a server render settles loads.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 5.2 — no pages, no category discovery orchestration.
 * - 5.5 — no debouncing or stale-request guards beyond `AbortSignal`
 *   forwarding through `ApiRequestOptions.signal`.
 * - Phase 6 — no variant selection, quantities, or add-to-cart.
 *
 * Query transitions (5.4) live in `catalog-query-state` — this service
 * executes backend queries and owns the resource slots, never the query.
 */

import {
  inject,
  Injectable,
  makeStateKey,
  PLATFORM_ID,
  TransferState,
  type Signal,
  type StateKey,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { map, Subscription, tap, type Observable } from 'rxjs';
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
  toCatalogQueryParams,
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
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly transfer = inject(TransferState, { optional: true });

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
   *
   * Hydration: a server-rendered page for the same query is reused once
   * from `TransferState` (no HTTP); misses and errors always fetch live.
   */
  loadProducts(query: CatalogQuery = {}, options: CatalogLoadOptions = {}): Subscription {
    const key = makeStateKey<ProductList>(`catalog.products.${queryHash(query)}`);
    const transferred = this.consumeTransferred(key);
    if (transferred !== null) {
      if (transferred.items.length === 0) {
        this.productsStore.setEmpty(transferred);
      } else {
        this.productsStore.setSuccess(transferred);
      }
      return Subscription.EMPTY;
    }
    const request: Observable<ProductList> = this.catalogApi
      .searchCatalog(query, toApiOptions(options))
      .pipe(
        map((envelope) => requirePagedData(envelope, emptyProductList(query.pageSize ?? 20))),
        tap((page) => this.storeTransferred(key, page)),
      );
    return loadResourceState(this.productsStore, request, {
      signal: options.signal,
      isEmpty: (page) => page.items.length === 0,
    });
  }

  /**
   * Loads the paged category list. Same lifecycle and hydration rules as
   * `loadProducts`.
   */
  loadCategories(query: PaginationRequest = {}, options: CatalogLoadOptions = {}): Subscription {
    const key = makeStateKey<CategoryList>(`catalog.categories.${queryHash(query)}`);
    const transferred = this.consumeTransferred(key);
    if (transferred !== null) {
      if (transferred.items.length === 0) {
        this.categoriesStore.setEmpty(transferred);
      } else {
        this.categoriesStore.setSuccess(transferred);
      }
      return Subscription.EMPTY;
    }
    const request: Observable<CategoryList> = this.catalogApi
      .listCategories(query, toApiOptions(options))
      .pipe(
        map((envelope) => requirePagedData(envelope, emptyCategoryList(query.pageSize ?? 20))),
        tap((page) => this.storeTransferred(key, page)),
      );
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

  /**
   * Clears only the product-list slot back to `idle` (e.g. when the
   * selection driving the listing is removed while discovery state stays).
   */
  clearProducts(): void {
    this.productsStore.reset();
  }

  /**
   * Reuses a server-rendered page once: on the browser, a stored payload
   * is consumed (and removed — single use, never stale) instead of
   * fetching; on the server, or on a miss, returns `null` so the caller
   * loads live. Pure lookup — performs no HTTP.
   */
  private consumeTransferred<T>(key: StateKey<T>): T | null {
    if (!this.isBrowser) {
      return null;
    }
    const stored = this.transfer?.get<T | null>(key, null) ?? null;
    if (stored === null) {
      return null;
    }
    this.transfer?.remove(key);
    return stored;
  }

  /**
   * Stores a settled page for hydration: server-only (the browser renders
   * from live data or consumed transfers). Failures are never stored, so
   * the client always retries live after a server error.
   */
  private storeTransferred<T>(key: StateKey<T>, page: T): void {
    if (!this.isBrowser) {
      this.transfer?.set(key, page);
    }
  }
}

function toApiOptions(options: CatalogLoadOptions): ApiRequestOptions {
  return options.signal === undefined ? {} : { signal: options.signal };
}

/**
 * Stable transfer key suffix for a backend query: the canonical funnel
 * form (`toCatalogQueryParams` — normalized, nulls omitted, fixed field
 * order) hashed compactly, so server and client derive identical keys
 * for identical queries without embedding long strings.
 */
function queryHash(query: CatalogQuery): string {
  const text = JSON.stringify(toCatalogQueryParams(query));
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
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
