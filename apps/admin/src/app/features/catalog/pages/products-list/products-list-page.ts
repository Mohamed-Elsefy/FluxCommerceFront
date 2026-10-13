/**
 * Admin product list page for Sub-Phase 13.3 — Product Management.
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `ProductListState` (route-provided `catalogRoutes` entry — never a
 * global store) and the `CategoryLookupState` (display names plus the
 * category filter options), rendering the paged product table through
 * the shared admin primitives.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * ProductsListPage (this file — orchestration only)
 *     ↓ ProductListState (../state — paged slot + committed filters/page)
 *     ↓ CatalogAdminApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Catalog API
 * ```
 *
 * Contract fidelity (13.1 audit — only backend-exposed options):
 * `GET /catalog/products` exposes paging plus `searchTerm` (name/slug,
 * case-insensitive), `status`, `visibility`, and `categoryId` filters —
 * no `sortBy`/`sortDirection` (sorting stays `GET /catalog`-only). Filter
 * commits reset to page 1; blank values travel as omissions (the backend
 * `400`s on empty strings). Pager values always come from the RESPONSE
 * envelope (effective `pageNumber`/`pageSize`/`totalCount`) with page
 * counts from the shared `totalPagesOf` helper. Status and visibility
 * render as localized text with the forward-compatible unknown fallback
 * (`Unknown (<n>)` — see `ENUM_REFERENCE.md` §8).
 *
 * Resource states: idle → loading → success | empty | error through the
 * shared primitives with localized copy and retry (out-of-range pages
 * arrive as `200` with `items: []` — the empty state, never an error).
 * Failures resolve through `resolveApiErrorMessage` (never backend
 * text).
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 13.4–13.6 — no variant/image/specification management affordances.
 * - Sorting on product rows (no backend contract).
 */

import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { ErrorState } from '@flux/ui';
import { AdminDataTable, type AdminDataColumn } from '../../../../shared/data-table/data-table';
import { AdminFilterBar } from '../../../../shared/filters/filter-bar/filter-bar';
import { AdminSearchInput } from '../../../../shared/filters/search-input/search-input';
import { AdminSelect, type AdminSelectOption } from '../../../../shared/forms/select/select';
import {
  AdminPagination,
  type AdminPaginationCopy,
} from '../../../../shared/pagination/pagination';
import { CategoryLookupState } from '../../state/category-lookup-state';
import { ProductListState } from '../../state/product-list-state';
import {
  categoryNameOf,
  productStatusDisplay,
  productVisibilityDisplay,
  type AdminProductRow,
} from '../../models/catalog-admin.models';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

/** Backend wire values behind the product status filter names. */
const PRODUCT_STATUS_NUMBERS: Readonly<Record<string, number>> = {
  Draft: 0,
  Active: 1,
  Inactive: 2,
  Archived: 3,
};

/** Backend wire values behind the product visibility filter names. */
const PRODUCT_VISIBILITY_NUMBERS: Readonly<Record<string, number>> = {
  Visible: 0,
  Hidden: 1,
};

@Component({
  selector: 'app-products-list-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AdminDataTable,
    AdminFilterBar,
    AdminSearchInput,
    AdminSelect,
    AdminPagination,
    ErrorState,
  ],
  templateUrl: './products-list-page.html',
  styleUrl: './products-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsListPage implements OnInit {
  private readonly products = inject(ProductListState);
  private readonly lookup = inject(CategoryLookupState);
  private readonly cultures = inject(CultureService);
  private readonly formBuilder = inject(FormBuilder);

  /** Current product page (idle → loading → success | empty | error). */
  protected readonly slot = this.products.page;

  /**
   * Filter form (search substring plus status/visibility/category selects —
   * `''` means "no filter" and travels as an omission).
   */
  protected readonly filters = this.formBuilder.nonNullable.group({
    search: [''],
    status: [''],
    visibility: [''],
    categoryId: [''],
  });

  /** Whether the table body shows the loading state. */
  protected readonly tableLoading = computed(() => {
    const status = this.slot().status;
    return status === 'idle' || status === 'loading';
  });

  /** Localized table columns for the active culture. */
  protected readonly columns = computed((): readonly AdminDataColumn<AdminProductRow>[] => {
    const culture = this.cultures.culture();
    const categories = this.lookup.categories().data ?? [];
    return [
      {
        key: 'name',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listColName),
        value: (row) => row.name,
        link: (row) => `/catalog/products/${row.id}`,
      },
      {
        key: 'slug',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listColSlug),
        value: (row) => row.slug,
      },
      {
        key: 'status',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listColStatus),
        value: (row) => this.statusText(row.status),
      },
      {
        key: 'visibility',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listColVisibility),
        value: (row) => this.visibilityText(row.visibility),
      },
      {
        key: 'category',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listColCategory),
        value: (row) => categoryNameOf(categories, row.categoryId),
      },
    ];
  });

  /** Localized status select options (All + backend status names). */
  protected readonly statusOptions = computed((): readonly AdminSelectOption[] => {
    const culture = this.cultures.culture();
    return [
      { value: '', label: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listFilterAll) },
      ...Object.keys(PRODUCT_STATUS_NUMBERS).map((status) => ({
        value: String(PRODUCT_STATUS_NUMBERS[status] ?? -1),
        label: this.statusText(PRODUCT_STATUS_NUMBERS[status] ?? -1),
      })),
    ];
  });

  /** Localized visibility select options (All + backend visibility names). */
  protected readonly visibilityOptions = computed((): readonly AdminSelectOption[] => {
    const culture = this.cultures.culture();
    return [
      { value: '', label: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listFilterAll) },
      ...Object.keys(PRODUCT_VISIBILITY_NUMBERS).map((visibility) => ({
        value: String(PRODUCT_VISIBILITY_NUMBERS[visibility] ?? -1),
        label: this.visibilityText(PRODUCT_VISIBILITY_NUMBERS[visibility] ?? -1),
      })),
    ];
  });

  /** Localized category select options (All + lookup names). */
  protected readonly categoryOptions = computed((): readonly AdminSelectOption[] => {
    const culture = this.cultures.culture();
    return [
      { value: '', label: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listFilterAll) },
      ...this.lookup.options().map((option) => ({ value: option.value, label: option.label })),
    ];
  });

  /** Current page rows (`[]` until settled). */
  protected readonly rows = computed(() => this.slot().data?.items ?? []);

  /** Whether the pager renders (a settled page exists). */
  protected readonly showPager = computed(() => this.slot().data !== null);

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listHeading),
      subheading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listSubheading),
      new: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listNew),
      caption: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listCaption),
      loading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listLoading),
      emptyTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listEmptyTitle),
      emptyMessage: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listEmptyMessage),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      filterTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listFilterTitle),
      filterSearch: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listFilterSearch),
      filterSearchPlaceholder: translateCatalogKey(
        culture,
        CATALOG_TRANSLATION_KEYS.listFilterSearchPlaceholder,
      ),
      filterStatus: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listFilterStatus),
      filterVisibility: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listFilterVisibility),
      filterCategory: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listFilterCategory),
      filterClear: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listFilterClear),
      filterApply: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.listFilterApply),
    };
  });

  /** Localized pager copy for the active culture. */
  protected readonly pagerCopy = computed((): AdminPaginationCopy => {
    const culture = this.cultures.culture();
    return {
      label: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.paginationLabel),
      first: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.paginationFirst),
      previous: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.paginationPrevious),
      next: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.paginationNext),
      last: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.paginationLast),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.slot().error, this.cultures.culture()),
  );

  ngOnInit(): void {
    this.products.load();
    this.lookup.load();
  }

  /**
   * Commits the filter form (resets to page 1). Select values are numeric
   * wire strings (`''` = no filter, omitted); the search travels verbatim
   * and blank values are omitted state-side.
   */
  protected applyFilters(): void {
    const raw = this.filters.getRawValue();
    this.products.setFilters({
      searchTerm: raw.search,
      ...(raw.status.trim() === '' ? {} : { status: Number(raw.status) }),
      ...(raw.visibility.trim() === '' ? {} : { visibility: Number(raw.visibility) }),
      categoryId: raw.categoryId,
    });
  }

  /** Clears the filter form and reloads unfiltered. */
  protected clearFilters(): void {
    this.filters.reset({ search: '', status: '', visibility: '', categoryId: '' });
    this.products.setFilters({});
  }

  /** Commits a pager move (response-effective values re-render the pager). */
  protected onPageChange(pageNumber: number): void {
    this.products.setPage(pageNumber);
  }

  /** List retry re-enters the current effective page plus the name lookup. */
  protected retry(): void {
    this.products.reload();
    this.lookup.load();
  }

  /** Localized status text with the forward-compatible unknown fallback. */
  private statusText(status: AdminProductRow['status']): string {
    const culture = this.cultures.culture();
    const display = productStatusDisplay(status);
    return translateCatalogKey(culture, display.labelKey, { value: String(status) });
  }

  /** Localized visibility text with the forward-compatible unknown fallback. */
  private visibilityText(visibility: AdminProductRow['visibility']): string {
    const culture = this.cultures.culture();
    const display = productVisibilityDisplay(visibility);
    return translateCatalogKey(culture, display.labelKey, { value: String(visibility) });
  }
}
