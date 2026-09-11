/**
 * Catalog page for Sub-Phases 5.2–5.5 — Discovery + Listing + Query + Search.
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `CatalogState` (provided by the parent `catalogRoutes` entry — never a
 * global store), derives the coherent `CatalogQueryState` from the route,
 * and renders discovery (categories) plus the category listing (products)
 * with standard resource states through the shared `@flux/ui` primitives.
 *
 * Data flow (`ARCHITECTURE.md` §10 — 5.4 query path, single funnel):
 *
 * ```text
 * CategoriesPage (this file — orchestration only)
 *     ↓ route query params → CatalogQueryState (state/, pure transitions)
 *     ↓ toBackendQuery → CatalogApiService (feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Catalog API
 * ```
 *
 * The page builds no query strings and owns no paging clamps: route
 * parsing, page resets, and wire translation live in `catalog-query-state`
 * (unit-covered), so 5.5–5.7 inputs reuse the same transitions without
 * duplicating logic.
 *
 * Route/query contract (stable for Sub-Phases 5.4–5.7):
 * - This page owns `/catalog` (discovery + listing).
 * - Category links target `/catalog?categoryId=<id>`. The active link
 *   carries `aria-current`; a clear-selection link returns to `/catalog`
 *   and clears the listing slot. Unknown `categoryId` values select
 *   nothing in the nav — the backend still answers the listing request
 *   (empty page or validation error), so the listing states stay honest.
 * - Listing loads the first backend page only (`GET /catalog` defaults
 *   `1/20`); search (5.5), filters/sort (5.6), and pagination (5.7) refine
 *   the same query without changing URLs.
 *
 * Copy is localized per the active `CultureService.culture()`: feature
 * copy through the catalog bundle, retry through `common.actions.retry`,
 * and failures through `resolveApiErrorMessage` (never backend text).
 *
 * SSR: the server renders the idle shell without fetching — production
 * prerendering uses the relative same-origin `/api` base URL, which has no
 * backend at build time, so server-side fetching would hang the render.
 * Data loads in the browser after hydration; server-side catalog fetching
 * (TransferState, request dedupe) arrives in Sub-Phase 5.10.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 5.6 — no filter/sort selector components.
 * - 5.7 — no pagination controls.
 * - Phase 6 — no variants, quantities, or add-to-cart.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  PLATFORM_ID,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, Subject } from 'rxjs';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { CatalogState } from '../../state/catalog-state';
import { CategoryNav } from '../../components/category-nav/category-nav';
import { ProductGrid } from '../../components/product-grid/product-grid';
import { SearchInput } from '../../components/search-input/search-input';
import {
  defaultCatalogQueryState,
  hasListingQuery,
  queryStateFromRouteParams,
  setQuerySearch,
  toBackendQuery,
  toRouteQueryParams,
  type CatalogQueryState,
} from '../../state/catalog-query-state';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

/**
 * Query parameter carrying the selected category (`CatalogSearchQuery`
 * field name, so the listing passes it straight through to
 * `GET /catalog`). Ownership moves to the coherent query state in 5.4.
 */
export const CATEGORY_QUERY_PARAM = 'categoryId';

/**
 * Discovery fetch size: the backend caps pages at 100, and a discovery
 * nav must show the whole set — a truncated first page with no pager
 * (paging UI arrives in 5.7) would hide categories. Refined if catalogs
 * outgrow a single page.
 */
export const CATEGORY_NAV_PAGE_SIZE = 100;

/**
 * Quiet period before raw keystrokes become a query: long enough to cover
 * normal typing bursts, short enough to feel instant. Page-owned (the
 * input component stays timing-free); covered by component tests.
 */
export const SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-categories-page',
  imports: [
    RouterLink,
    CategoryNav,
    ProductGrid,
    SearchInput,
    LoadingIndicator,
    EmptyState,
    ErrorState,
  ],
  templateUrl: './categories-page.html',
  styleUrl: './categories-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesPage implements OnInit {
  private readonly state = inject(CatalogState);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cultures = inject(CultureService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Raw search keystrokes from the input (debounced below, never sent raw). */
  private readonly searchText = new Subject<string>();

  /** Tears down the in-flight listing request, if any (idempotent). */
  private listingTeardown: (() => void) | undefined;

  /** Current paged category result (idle → loading → success | empty | error). */
  readonly categories = this.state.categories;

  /** Current storefront search result for the selection (same lifecycle). */
  readonly productList = this.state.products;

  /** Coherent listing query derived from the route (single funnel — see above). */
  readonly queryState = toSignal(this.route.queryParamMap.pipe(map(queryStateFromRouteParams)), {
    initialValue: defaultCatalogQueryState(),
  });

  /** Selected category mirrored from the query state (nav marking). */
  readonly activeCategoryId = computed(() => this.queryState().category);

  /** Whether the query selects a listing (category and/or search text). */
  protected readonly showListing = computed(() => hasListingQuery(this.queryState()));

  constructor() {
    // Browser only: drives the listing from the query state (initial value
    // included, updates followed) without touching discovery state. Runs
    // after the first render; the server keeps the idle shell (see above).
    //
    // The state calls run `untracked` on purpose: `loadProducts` reads the
    // products signal (`loadResourceState` retains current data across
    // reloads) and writes it on settle, so without `untracked` the products
    // slot would become an effect dependency and every settled response
    // would reschedule the effect — an infinite fetch loop. The effect
    // depends on the query state alone.
    //
    // Stale safety: every run owns an `AbortController` torn down before
    // the next run (and on destroy via effect cleanup), so an older pending
    // search can never settle over newer results — `cancelOnAbort`
    // (Phase 1.7) completes aborted calls silently without touching state.
    // The same tracked teardown covers listing retries, so a retried
    // request supersedes (rather than races) any in-flight one.
    effect((onCleanup) => {
      if (!this.isBrowser) {
        return;
      }
      const query = this.queryState();
      untracked(() => {
        if (!hasListingQuery(query)) {
          this.cancelListingLoad();
          this.state.clearProducts();
        } else {
          this.startListingLoad(query);
        }
      });
      onCleanup(() => this.cancelListingLoad());
    });

    // Raw keystrokes settle here: debounced (no per-keystroke requests),
    // deduplicated, and torn down with the page. Committed text flows into
    // the URL through the 5.4 transition (page reset included), which the
    // listing effect above then loads — one funnel, end to end.
    this.searchText
      .pipe(debounceTime(SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => this.applySearch(search));
  }

  /**
   * Receives raw input text (every keystroke); timing, reset, and loading
   * stay downstream in the debounced pipeline above.
   */
  onSearchChange(search: string): void {
    this.searchText.next(search);
  }

  /**
   * Commits settled search text to the route: the 5.4 `setQuerySearch`
   * transition resets the page while preserving category/filter/sort, and
   * `toRouteQueryParams` serializes the full state (empty text drops the
   * key, restoring the normal listing). `replaceUrl` keeps typing bursts
   * out of the browser history.
   */
  private applySearch(search: string): void {
    const next = setQuerySearch(this.queryState(), search);
    void this.router.navigate(['/catalog'], {
      queryParams: toRouteQueryParams(next),
      replaceUrl: true,
    });
  }

  /** Localized discovery copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesTitle),
      subtitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesSubtitle),
      loading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesLoading),
      emptyTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesEmptyTitle),
      emptyMessage: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesEmptyMessage),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      clearSelection: translateCatalogKey(
        culture,
        CATALOG_TRANSLATION_KEYS.categoriesClearSelection,
      ),
    };
  });

  /** Localized listing copy for the active culture. */
  protected readonly listingCopy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingTitle),
      loading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingLoading),
      emptyTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingEmptyTitle),
      emptyMessage: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingEmptyMessage),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
    };
  });

  /** Localized search field copy for the active culture. */
  protected readonly searchCopy = computed(() => {
    const culture = this.cultures.culture();
    return {
      label: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.searchLabel),
      placeholder: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.searchPlaceholder),
    };
  });

  /** Localized result count for the current page (`{count}` interpolated). */
  protected readonly resultCount = computed(() =>
    translateCatalogKey(this.cultures.culture(), CATALOG_TRANSLATION_KEYS.listingResultCount, {
      count: this.productList().data?.totalCount ?? 0,
    }),
  );

  /** Localized discovery failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.categories().error, this.cultures.culture()),
  );

  /** Localized listing failure message (never backend text). */
  protected readonly listingErrorMessage = computed(() =>
    resolveApiErrorMessage(this.productList().error, this.cultures.culture()),
  );

  ngOnInit(): void {
    // Browser only: the server prerenders the idle shell (see above).
    if (this.isBrowser) {
      this.reload();
    }
  }

  /** (Re)loads the discovery set; discovery retry re-enters here. */
  reload(): void {
    this.state.loadCategories({ pageNumber: 1, pageSize: CATEGORY_NAV_PAGE_SIZE });
  }

  /** (Re)loads the listing for the current query; listing retry re-enters here. */
  reloadProducts(): void {
    if (hasListingQuery(this.queryState())) {
      this.startListingLoad(this.queryState());
    }
  }

  /** Cancels the in-flight listing request, if any (idempotent). */
  private cancelListingLoad(): void {
    this.listingTeardown?.();
    this.listingTeardown = undefined;
  }

  /**
   * Starts a listing request for `query`, superseding any in-flight one —
   * latest request wins by construction. Aborting is sufficient teardown:
   * `cancelOnAbort` (Phase 1.7) completes the aborted call silently (never
   * delivered to state) and tears down the underlying fetch, so no
   * subscription bookkeeping is needed here.
   */
  private startListingLoad(query: CatalogQueryState): void {
    this.cancelListingLoad();
    const controller = new AbortController();
    this.state.loadProducts(toBackendQuery(query), { signal: controller.signal });
    this.listingTeardown = () => controller.abort();
  }
}
