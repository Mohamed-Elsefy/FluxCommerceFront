/**
 * Catalog page for Sub-Phases 5.2–5.10 — Discovery + Listing + Query +
 * Search + Filtering, Sorting, Pagination, Resource States,
 * Localization/RTL & SSR/SEO.
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
 * (unit-covered) — search, filters, sort, and (in 5.7) pagination all
 * commit through the same transitions without duplicating logic.
 *
 * Route/query contract (stable for Sub-Phases 5.4–5.7):
 * - This page owns `/catalog` (discovery + listing).
 * - Category links target `/catalog?categoryId=<id>`. The active link
 *   carries `aria-current`; a clear-selection link returns to `/catalog`
 *   and clears the listing slot. Unknown `categoryId` values select
 *   nothing in the nav — the backend still answers the listing request
 *   (empty page or validation error), so the listing states stay honest.
 * - Filter/sort controls commit through the 5.4 transitions
 *   (`setQueryFilters`/`setQuerySort` — page reset included) into the same
 *   URL schema, so deep links round-trip every dimension.
 * - Listing loads the first backend page only (`GET /catalog` defaults
 *   `1/20`); pagination commits page moves through the same query without
 *   new URLs, preserving search/filter/sort/category by construction
 *   (`setQueryPage`).
 *
 * Pager values always come from the RESPONSE envelope (effective
 * `pageNumber`/`pageSize`/`totalCount`) — never request values — and page
 * counts derive from the shared `totalPagesOf` helper (the backend sends
 * no `totalPages`).
 *
 * Contract fidelity (5.6 rule — only backend-exposed options): status and
 * visibility are the backend's filter fields; name/creation-date are its
 * sort fields. Price-like filters/sorts and availability signals do not
 * exist in the catalog contract and are not offered.
 *
 * Resource states (5.8): every slot renders idle → loading → success |
 * empty | error through the shared primitives with localized copy and
 * retry. Listing emptiness differentiates "no products here" (bare
 * category scope, naming the category when its data is available) from
 * "no results match" (active search/filter/sort criteria).
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
 * - 5.11 — no E2E suites (unit/component coverage only).
 * - Phase 6 — no variants, quantities, or add-to-cart.
 *
 * SSR/SEO (5.10): `Title`/`Meta` apply in `ngOnInit` (server + client)
 * and refresh in an effect on query/category/culture changes; list data
 * transfers server → client once per query via `CatalogState`, so
 * hydration never refetches transferred pages. The prerender build has no
 * backend, so it emits the idle shell with base metadata by design.
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
import { DOCUMENT, isPlatformBrowser, NgTemplateOutlet } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { debounceTime, distinctUntilChanged, map, Subject } from 'rxjs';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { buildQueryString } from '@flux/api';
import { FALLBACK_SOCIAL_IMAGE, setCanonicalUrl } from '@flux/utils';
import {
  CatalogProductSortBy,
  CatalogProductSortDirection,
  ProductStatus,
  ProductVisibility,
} from '@flux/models';
import { EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { CatalogState } from '../../state/catalog-state';
import { CategoryNav } from '../../components/category-nav/category-nav';
import { FilterSelect, type FilterOption } from '../../components/filter-select/filter-select';
import { ProductGrid } from '../../components/product-grid/product-grid';
import {
  ProductPagination,
  type PaginationCopy,
} from '../../components/product-pagination/product-pagination';
import { SearchInput } from '../../components/search-input/search-input';
import {
  decodeSortSelection,
  defaultCatalogQueryState,
  encodeSortSelection,
  hasListingCriteria,
  hasListingQuery,
  parseProductStatus,
  parseProductVisibility,
  queryStateFromRouteParams,
  setQueryFilters,
  setQueryPage,
  setQuerySearch,
  setQuerySort,
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
    NgTemplateOutlet,
    CategoryNav,
    ProductGrid,
    ProductPagination,
    SearchInput,
    FilterSelect,
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
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

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

  /**
   * Whether the listing renders inside the active category card: only
   * when a category is selected AND its card actually rendered (settled
   * categories). Otherwise the standalone section below owns it, so
   * loading/failed/empty discovery never swallows the listing.
   */
  protected readonly inlineListing = computed(
    () => this.activeCategoryId() !== null && this.categories().isSuccess,
  );

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

    // Dynamic metadata (5.10): tracks the query, the loaded categories,
    // and the culture; `Title`/`Meta` write the document only (no signals
    // touched inside, so no dependency besides the tracked reads above).
    // Effects never run on the server — `ngOnInit` covers the SSR pass.
    effect(() => {
      this.applyMetadata();
    });
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
    this.commitQuery(setQuerySearch(this.queryState(), search));
  }

  /**
   * Commits a transitioned query to the route: full-state serialization
   * (cleared fields drop their keys) with `replaceUrl`, so control
   * interactions never spam the browser history. The listing effect then
   * loads the committed state — one funnel for search, filters, and sort.
   */
  private commitQuery(next: CatalogQueryState): void {
    void this.router.navigate(['/catalog'], {
      queryParams: toRouteQueryParams(next),
      replaceUrl: true,
    });
  }

  /**
   * Commits a page move: `setQueryPage` preserves search, category,
   * filters, and sort while clamping to valid pages — pagination never
   * loses the active query and never throws on invalid input.
   */
  onPageChange(page: number): void {
    this.commitQuery(setQueryPage(this.queryState(), page));
  }

  /**
   * Commits a status selection (`''` clears via the shared parser) with
   * page reset; category/search/sort survive untouched.
   */
  onStatusChange(value: string): void {
    this.commitQuery(setQueryFilters(this.queryState(), { status: parseProductStatus(value) }));
  }

  /**
   * Commits a visibility selection (`''` clears via the shared parser)
   * with page reset; category/search/sort survive untouched.
   */
  onVisibilityChange(value: string): void {
    this.commitQuery(
      setQueryFilters(this.queryState(), { visibility: parseProductVisibility(value) }),
    );
  }

  /**
   * Commits a sort selection (decoded through the shared codec, page
   * reset); category/search/filters survive untouched.
   */
  onSortChange(value: string): void {
    this.commitQuery(setQuerySort(this.queryState(), decodeSortSelection(value)));
  }

  /**
   * Resets status, visibility, and sort to defaults (page reset included)
   * while preserving search and category — each keeps its dedicated
   * affordance (input text, clear-selection link).
   */
  clearFilters(): void {
    this.commitQuery(
      setQuerySort(setQueryFilters(this.queryState(), { status: null, visibility: null }), {
        by: null,
      }),
    );
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

  /**
   * Localized filter/sort copy for the active culture. Option labels cover
   * exactly the backend-supported values — price-like or availability
   * options do not exist in the contract and are not offered.
   */
  protected readonly filtersCopy = computed(() => {
    const culture = this.cultures.culture();
    return {
      statusLabel: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.filtersStatusLabel),
      visibilityLabel: translateCatalogKey(
        culture,
        CATALOG_TRANSLATION_KEYS.filtersVisibilityLabel,
      ),
      sortLabel: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.filtersSortLabel),
      all: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.filtersAll),
      clearAll: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.filtersClearAll),
      statusDraft: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.filtersStatusDraft),
      statusActive: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.filtersStatusActive),
      statusInactive: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.filtersStatusInactive),
      statusArchived: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.filtersStatusArchived),
      visibilityVisible: translateCatalogKey(
        culture,
        CATALOG_TRANSLATION_KEYS.filtersVisibilityVisible,
      ),
      visibilityHidden: translateCatalogKey(
        culture,
        CATALOG_TRANSLATION_KEYS.filtersVisibilityHidden,
      ),
      sortDefault: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.filtersSortDefault),
      sortNameAsc: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.filtersSortNameAsc),
      sortNameDesc: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.filtersSortNameDesc),
      sortNewest: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.filtersSortNewest),
      sortOldest: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.filtersSortOldest),
    };
  });

  /** Status options: "all" plus every backend `ProductStatus` (by wire value). */
  protected readonly statusOptions = computed((): readonly FilterOption[] => [
    { value: '', label: this.filtersCopy().all },
    { value: String(ProductStatus.Draft), label: this.filtersCopy().statusDraft },
    { value: String(ProductStatus.Active), label: this.filtersCopy().statusActive },
    { value: String(ProductStatus.Inactive), label: this.filtersCopy().statusInactive },
    { value: String(ProductStatus.Archived), label: this.filtersCopy().statusArchived },
  ]);

  /** Visibility options: "all" plus every backend `ProductVisibility`. */
  protected readonly visibilityOptions = computed((): readonly FilterOption[] => [
    { value: '', label: this.filtersCopy().all },
    { value: String(ProductVisibility.Visible), label: this.filtersCopy().visibilityVisible },
    { value: String(ProductVisibility.Hidden), label: this.filtersCopy().visibilityHidden },
  ]);

  /** Sort options: default plus every backend `sortBy × direction` combination. */
  protected readonly sortOptions = computed((): readonly FilterOption[] => [
    { value: '', label: this.filtersCopy().sortDefault },
    {
      value: encodeSortSelection({
        by: CatalogProductSortBy.Name,
        direction: CatalogProductSortDirection.Ascending,
      }),
      label: this.filtersCopy().sortNameAsc,
    },
    {
      value: encodeSortSelection({
        by: CatalogProductSortBy.Name,
        direction: CatalogProductSortDirection.Descending,
      }),
      label: this.filtersCopy().sortNameDesc,
    },
    {
      value: encodeSortSelection({
        by: CatalogProductSortBy.CreatedAtUtc,
        direction: CatalogProductSortDirection.Descending,
      }),
      label: this.filtersCopy().sortNewest,
    },
    {
      value: encodeSortSelection({
        by: CatalogProductSortBy.CreatedAtUtc,
        direction: CatalogProductSortDirection.Ascending,
      }),
      label: this.filtersCopy().sortOldest,
    },
  ]);

  /** Current status token (`''` when unfiltered). */
  protected readonly statusValue = computed(() => {
    const status = this.queryState().filters.status;
    return status === null ? '' : String(status);
  });

  /** Current visibility token (`''` when unfiltered). */
  protected readonly visibilityValue = computed(() => {
    const visibility = this.queryState().filters.visibility;
    return visibility === null ? '' : String(visibility);
  });

  /** Current sort token (`''` for default order). */
  protected readonly sortValue = computed(() => encodeSortSelection(this.queryState().sort));

  /** Whether any filter/sort dimension is active (clear-all visibility). */
  protected readonly hasActiveFilters = computed(() => {
    const query = this.queryState();
    return (
      query.filters.status !== null || query.filters.visibility !== null || query.sort.by !== null
    );
  });

  /** Localized pager copy for the active culture. */
  protected readonly paginationCopy = computed((): PaginationCopy => ({
    label: translateCatalogKey(this.cultures.culture(), CATALOG_TRANSLATION_KEYS.paginationLabel),
    first: translateCatalogKey(this.cultures.culture(), CATALOG_TRANSLATION_KEYS.paginationFirst),
    previous: translateCatalogKey(
      this.cultures.culture(),
      CATALOG_TRANSLATION_KEYS.paginationPrevious,
    ),
    next: translateCatalogKey(this.cultures.culture(), CATALOG_TRANSLATION_KEYS.paginationNext),
    last: translateCatalogKey(this.cultures.culture(), CATALOG_TRANSLATION_KEYS.paginationLast),
  }));

  /** Localized result count for the current page (`{count}` interpolated). */
  protected readonly resultCount = computed(() =>
    translateCatalogKey(this.cultures.culture(), CATALOG_TRANSLATION_KEYS.listingResultCount, {
      count: this.productList().data?.totalCount ?? 0,
    }),
  );

  /**
   * Differentiated empty copy (5.8): active search/filter/sort criteria
   * mean "no results match", while a bare category scope means "no
   * products here". The category slot names the scope when its data is
   * available, else a generic localized noun.
   */
  protected readonly emptyCopy = computed(() => {
    const culture = this.cultures.culture();
    if (hasListingCriteria(this.queryState())) {
      return {
        title: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingNoResultsTitle),
        message: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingNoResultsMessage),
      };
    }
    const categoryId = this.queryState().category;
    const known = this.categories().data?.items.find((category) => category.id === categoryId);
    return {
      title: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingNoProductsTitle),
      message: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingNoProductsMessage, {
        category:
          known?.name ?? translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingThisCategory),
      }),
    };
  });

  /** Localized discovery failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.categories().error, this.cultures.culture()),
  );

  /** Localized listing failure message (never backend text). */
  protected readonly listingErrorMessage = computed(() =>
    resolveApiErrorMessage(this.productList().error, this.cultures.culture()),
  );

  ngOnInit(): void {
    // Runs on server and client alike: metadata applies during SSR (the
    // only catalog write in the server pass — no fetch, no browser APIs),
    // while data loads stay browser-only (see above).
    this.applyMetadata();
    if (this.isBrowser) {
      this.reload();
    }
  }

  /**
   * Applies dynamic page metadata for the current query (5.10): document
   * title, standard description, and OpenGraph tags. Search takes
   * precedence, then the loaded category name (falling back to the
   * localized catalog title), then the category description (falling back
   * to the localized subtitle). `Title`/`Meta` are SSR-safe Angular
   * services — on the server they render into the prerendered `<head>`.
   *
   * Canonical (11.3) reflects the addressable listing URL: the catalog
   * path plus the content-bearing query (category/search/filters/sort),
   * so each distinct listing has its own canonical and re-runs never
   * duplicate the tag (`setCanonicalUrl` updates in place).
   *
   * Social (11.4): `og:url` mirrors the canonical; `og:image` is the
   * bundled fallback (a listing has no single representative image);
   * `twitter:card` mirrors the OpenGraph tags for X previews.
   */
  private applyMetadata(): void {
    const culture = this.cultures.culture();
    const query = this.queryState();
    const category =
      query.category === null
        ? null
        : (this.categories().data?.items.find((item) => item.id === query.category) ?? null);
    const pageLabel =
      query.search !== ''
        ? `"${query.search}"`
        : (category?.name ??
          translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.metaCatalogTitle));
    const description =
      category?.description ??
      translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesSubtitle);
    const title = `${pageLabel} | FluxCommerce`;
    const canonical = canonicalForQuery(query);
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: canonical });
    this.meta.updateTag({ property: 'og:image', content: FALLBACK_SOCIAL_IMAGE });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    setCanonicalUrl(this.document, canonical);
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

/**
 * Canonical listing URL (11.3) for a query state: the catalog path plus
 * the route-schema query (same `toRouteQueryParams` funnel the page
 * commits to the URL — no parallel query-building logic), serialized
 * through the shared `buildQueryString`. Paging travels explicitly, so
 * each page has its own deterministic canonical on server and client.
 */
function canonicalForQuery(query: CatalogQueryState): string {
  const serialized = buildQueryString(toRouteQueryParams(query));
  return serialized === '' ? '/catalog' : `/catalog?${serialized}`;
}
