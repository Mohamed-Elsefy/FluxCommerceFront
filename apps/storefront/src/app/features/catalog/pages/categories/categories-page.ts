/**
 * Catalog page for Sub-Phases 5.2–5.3 — Category Discovery + Product Listing.
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `CatalogState` (provided by the parent `catalogRoutes` entry — never a
 * global store), drives discovery (categories) and the category listing
 * (products) from the `categoryId` query parameter, and renders the
 * standard resource states through the shared `@flux/ui` primitives.
 *
 * Data flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * CatalogPage (this file — orchestration only)
 *     ↓ CatalogState (feature-owned local Signals)
 *     ↓ CatalogApiService (feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Catalog API
 * ```
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
 * - 5.4 — no coherent query-state store (one mirrored parameter only).
 * - 5.5 — no search input or stale-request guards.
 * - 5.6 — no filter/sort selectors beyond the 5.2 category nav.
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
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { CatalogState } from '../../state/catalog-state';
import { CategoryNav } from '../../components/category-nav/category-nav';
import { ProductGrid } from '../../components/product-grid/product-grid';
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

@Component({
  selector: 'app-categories-page',
  imports: [RouterLink, CategoryNav, ProductGrid, LoadingIndicator, EmptyState, ErrorState],
  templateUrl: './categories-page.html',
  styleUrl: './categories-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesPage implements OnInit {
  private readonly state = inject(CatalogState);
  private readonly route = inject(ActivatedRoute);
  private readonly cultures = inject(CultureService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Current paged category result (idle → loading → success | empty | error). */
  readonly categories = this.state.categories;

  /** Current storefront search result for the selection (same lifecycle). */
  readonly productList = this.state.products;

  /** Selected category mirrored from the `categoryId` query parameter. */
  readonly activeCategoryId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(CATEGORY_QUERY_PARAM))),
    { initialValue: null },
  );

  constructor() {
    // Browser only: drives the listing from the selection (initial value
    // included, updates followed) without touching discovery state. Runs
    // after the first render; the server keeps the idle shell (see above).
    effect(() => {
      if (!this.isBrowser) {
        return;
      }
      const categoryId = this.activeCategoryId();
      if (categoryId === null) {
        this.state.clearProducts();
      } else {
        this.state.loadProducts({ categoryId });
      }
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

  /** (Re)loads the listing for the current selection; listing retry re-enters here. */
  reloadProducts(): void {
    const categoryId = this.activeCategoryId();
    if (categoryId !== null) {
      this.state.loadProducts({ categoryId });
    }
  }
}
