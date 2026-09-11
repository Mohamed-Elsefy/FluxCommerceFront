/**
 * Category discovery page for Sub-Phase 5.2 — Home & Category Discovery.
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `CatalogState` (provided by the parent `catalogRoutes` entry — never a
 * global store), triggers the category load, mirrors the `categoryId`
 * query parameter into the active selection, and renders the standard
 * resource states through the shared `@flux/ui` primitives.
 *
 * Data flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * CategoriesPage (this file — orchestration only)
 *     ↓ CatalogState (feature-owned local Signals)
 *     ↓ CatalogApiService (feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Catalog API
 * ```
 *
 * Route/query contract (shared with the Sub-Phase 5.3 listing page):
 * - This page owns `/catalog` (discovery).
 * - Category links target `/catalog?categoryId=<id>` — the same route with
 *   selection state. The active link carries `aria-current`; a
 *   clear-selection link returns to `/catalog`. The 5.3 listing consumes
 *   the same `categoryId` parameter, so selection URLs stay stable.
 * - Unknown `categoryId` values select nothing (graceful, never an error).
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
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 5.3 — no product grid, search, filters, or sorting.
 * - 5.4 — no coherent query-state store (one mirrored parameter only).
 * - Phase 6 — no variants, quantities, or add-to-cart.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

/**
 * Query parameter carrying the selected category (`CatalogSearchQuery`
 * field name, so the Sub-Phase 5.3 listing passes it straight through to
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
  imports: [RouterLink, CategoryNav, LoadingIndicator, EmptyState, ErrorState],
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

  /** Selected category mirrored from the `categoryId` query parameter. */
  readonly activeCategoryId = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(CATEGORY_QUERY_PARAM))),
    { initialValue: null },
  );

  /** Localized page copy for the active culture. */
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

  /** Localized failure message for the current error (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.categories().error, this.cultures.culture()),
  );

  ngOnInit(): void {
    // Browser only: the server prerenders the idle shell (see above).
    if (this.isBrowser) {
      this.reload();
    }
  }

  /** (Re)loads the discovery set; retry re-enters here. */
  reload(): void {
    this.state.loadCategories({ pageNumber: 1, pageSize: CATEGORY_NAV_PAGE_SIZE });
  }
}
