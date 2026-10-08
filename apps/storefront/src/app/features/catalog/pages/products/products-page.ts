/**
 * Products listing page — the storefront shelf (`/products`).
 *
 * Listing-first sibling of the catalog discovery page: same coherent
 * `CatalogQueryState` funnel, same `CatalogState` slots, same backend
 * contract — but the listing loads unconditionally (the default query
 * fetches page 1) instead of waiting for a category/search scope.
 * Category discovery stays on `/catalog`; this page links back there.
 *
 * Commits serialize to `/products` (canonicals included). Component
 * ownership stays catalog-internal (CategoryNav, ProductGrid, SearchInput,
 * FilterSelect, ProductPagination), so no cross-feature imports exist.
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
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
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
import { FilterSelect, type FilterOption } from '../../components/filter-select/filter-select';
import { ProductGrid } from '../../components/product-grid/product-grid';
import {
  ProductPagination,
  type PaginationCopy,
} from '../../components/product-pagination/product-pagination';
import { SearchInput } from '../../components/search-input/search-input';
import {
  decodeSortSelection,
  encodeSortSelection,
  hasListingCriteria,
  parseProductStatus,
  parseProductVisibility,
  queryStateFromRouteParams,
  setQueryFilters,
  setQueryPage,
  setQuerySearch,
  setQuerySort,
  toBackendQuery,
  toRouteQueryParams,
  defaultCatalogQueryState,
  type CatalogQueryState,
} from '../../state/catalog-query-state';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';
import { PRODUCTS_TRANSLATION_KEYS, translateProductsKey } from '../../i18n/products-translations';

/** Base path for query commits and canonicals from this page. */
export const PRODUCTS_BASE_PATH = '/products';

/** Quiet period before raw keystrokes become a query. */
export const PRODUCTS_SEARCH_DEBOUNCE_MS = 300;

@Component({
  selector: 'app-products-page',
  imports: [
    RouterLink,
    ProductGrid,
    ProductPagination,
    SearchInput,
    FilterSelect,
    LoadingIndicator,
    EmptyState,
    ErrorState,
  ],
  templateUrl: './products-page.html',
  styleUrl: './products-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsPage implements OnInit {
  private readonly state = inject(CatalogState);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cultures = inject(CultureService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  private readonly searchText = new Subject<string>();
  private listingTeardown: (() => void) | undefined;

  readonly productList = this.state.products;

  readonly queryState = toSignal(this.route.queryParamMap.pipe(map(queryStateFromRouteParams)), {
    initialValue: defaultCatalogQueryState(),
  });

  readonly activeCategoryId = computed(() => this.queryState().category);

  constructor() {
    effect((onCleanup) => {
      if (!this.isBrowser) {
        return;
      }
      const query = this.queryState();
      untracked(() => this.startListingLoad(query));
      onCleanup(() => this.cancelListingLoad());
    });

    this.searchText
      .pipe(debounceTime(PRODUCTS_SEARCH_DEBOUNCE_MS), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((search) => this.applySearch(search));

    effect(() => {
      this.applyMetadata();
    });
  }

  onSearchChange(search: string): void {
    this.searchText.next(search);
  }

  private applySearch(search: string): void {
    this.commitQuery(setQuerySearch(this.queryState(), search));
  }

  private commitQuery(next: CatalogQueryState): void {
    void this.router.navigate([PRODUCTS_BASE_PATH], {
      queryParams: toRouteQueryParams(next),
      replaceUrl: true,
    });
  }

  onPageChange(page: number): void {
    this.commitQuery(setQueryPage(this.queryState(), page));
  }

  onStatusChange(value: string): void {
    this.commitQuery(setQueryFilters(this.queryState(), { status: parseProductStatus(value) }));
  }

  onVisibilityChange(value: string): void {
    this.commitQuery(
      setQueryFilters(this.queryState(), { visibility: parseProductVisibility(value) }),
    );
  }

  onSortChange(value: string): void {
    this.commitQuery(setQuerySort(this.queryState(), decodeSortSelection(value)));
  }

  clearFilters(): void {
    this.commitQuery(
      setQuerySort(setQueryFilters(this.queryState(), { status: null, visibility: null }), {
        by: null,
      }),
    );
  }

  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateProductsKey(culture, PRODUCTS_TRANSLATION_KEYS.title),
      subtitle: translateProductsKey(culture, PRODUCTS_TRANSLATION_KEYS.subtitle),
      loading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingLoading),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
    };
  });

  protected readonly searchCopy = computed(() => {
    const culture = this.cultures.culture();
    return {
      label: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.searchLabel),
      placeholder: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.searchPlaceholder),
    };
  });

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

  protected readonly statusOptions = computed((): readonly FilterOption[] => [
    { value: '', label: this.filtersCopy().all },
    { value: String(ProductStatus.Draft), label: this.filtersCopy().statusDraft },
    { value: String(ProductStatus.Active), label: this.filtersCopy().statusActive },
    { value: String(ProductStatus.Inactive), label: this.filtersCopy().statusInactive },
    { value: String(ProductStatus.Archived), label: this.filtersCopy().statusArchived },
  ]);

  protected readonly visibilityOptions = computed((): readonly FilterOption[] => [
    { value: '', label: this.filtersCopy().all },
    { value: String(ProductVisibility.Visible), label: this.filtersCopy().visibilityVisible },
    { value: String(ProductVisibility.Hidden), label: this.filtersCopy().visibilityHidden },
  ]);

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

  protected readonly statusValue = computed(() => {
    const status = this.queryState().filters.status;
    return status === null ? '' : String(status);
  });

  protected readonly visibilityValue = computed(() => {
    const visibility = this.queryState().filters.visibility;
    return visibility === null ? '' : String(visibility);
  });

  protected readonly sortValue = computed(() => encodeSortSelection(this.queryState().sort));

  protected readonly hasActiveFilters = computed(() => {
    const query = this.queryState();
    return (
      query.filters.status !== null || query.filters.visibility !== null || query.sort.by !== null
    );
  });

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

  protected readonly resultCount = computed(() =>
    translateCatalogKey(this.cultures.culture(), CATALOG_TRANSLATION_KEYS.listingResultCount, {
      count: this.productList().data?.totalCount ?? 0,
    }),
  );

  protected readonly emptyCopy = computed(() => {
    const culture = this.cultures.culture();
    if (hasListingCriteria(this.queryState())) {
      return {
        title: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingNoResultsTitle),
        message: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingNoResultsMessage),
      };
    }
    return {
      title: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingNoProductsTitle),
      message: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingNoProductsMessage, {
        category: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listingThisCategory),
      }),
    };
  });

  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.productList().error, this.cultures.culture()),
  );

  ngOnInit(): void {
    this.applyMetadata();
  }

  private applyMetadata(): void {
    const culture = this.cultures.culture();
    const query = this.queryState();
    const pageLabel =
      query.search !== ''
        ? `"${query.search}"`
        : translateProductsKey(culture, PRODUCTS_TRANSLATION_KEYS.title);
    const description = translateProductsKey(culture, PRODUCTS_TRANSLATION_KEYS.subtitle);
    const title = `${pageLabel} | FluxCommerce`;
    const serialized = buildQueryString(toRouteQueryParams(query));
    const canonical =
      serialized === '' ? PRODUCTS_BASE_PATH : `${PRODUCTS_BASE_PATH}?${serialized}`;
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

  reloadProducts(): void {
    this.startListingLoad(this.queryState());
  }

  private cancelListingLoad(): void {
    this.listingTeardown?.();
    this.listingTeardown = undefined;
  }

  private startListingLoad(query: CatalogQueryState): void {
    this.cancelListingLoad();
    const controller = new AbortController();
    this.state.loadProducts(toBackendQuery(query), { signal: controller.signal });
    this.listingTeardown = () => controller.abort();
  }
}
