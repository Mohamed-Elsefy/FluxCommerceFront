/**
 * Admin category list page for Sub-Phase 13.5 — Category Management.
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `CategoryListState` (route-provided `catalogRoutes` entry — never a
 * global store) and the `CategoryLookupState` (parent display names),
 * rendering the paged category table through the shared admin
 * primitives.
 *
 * Contract fidelity (13.1 audit — only backend-exposed options):
 * `GET /catalog/categories` exposes paging plus `searchTerm` (name/slug,
 * case-insensitive) and `status` filters — no `sortBy`, no other
 * filters. Filter commits reset to page 1; blank values travel as
 * omissions (the backend `400`s on empty strings). Hierarchy follows
 * the flat backend model: per-row parent references resolved through
 * the lookup (raw-id fallback outside the first hundred) — no tree
 * widget exists because no tree endpoint exists. Pager values always
 * come from the RESPONSE envelope with page counts from the shared
 * `totalPagesOf` helper. Status renders as localized text with the
 * forward-compatible unknown fallback.
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
 * - 13.6 — no image/specification management affordances.
 * - Sorting on category rows (no backend contract).
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
import { CategoryListState } from '../../state/category-list-state';
import { CategoryLookupState } from '../../state/category-lookup-state';
import {
  categoryNameOf,
  categoryStatusDisplay,
  type AdminCategoryRow,
} from '../../models/catalog-admin.models';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

/** Backend wire values behind the category status filter names. */
const CATEGORY_STATUS_NUMBERS: Readonly<Record<string, number>> = {
  Active: 0,
  Inactive: 1,
};

@Component({
  selector: 'app-categories-list-page',
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
  templateUrl: './categories-list-page.html',
  styleUrl: './categories-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesListPage implements OnInit {
  private readonly categories = inject(CategoryListState);
  private readonly lookup = inject(CategoryLookupState);
  private readonly cultures = inject(CultureService);
  private readonly formBuilder = inject(FormBuilder);

  /** Current category page (idle → loading → success | empty | error). */
  protected readonly slot = this.categories.page;

  /**
   * Filter form (search substring plus status select — `''` means "no
   * filter" and travels as an omission).
   */
  protected readonly filters = this.formBuilder.nonNullable.group({
    search: [''],
    status: [''],
  });

  /** Whether the table body shows the loading state. */
  protected readonly tableLoading = computed(() => {
    const status = this.slot().status;
    return status === 'idle' || status === 'loading';
  });

  /** Localized table columns for the active culture. */
  protected readonly columns = computed((): readonly AdminDataColumn<AdminCategoryRow>[] => {
    const culture = this.cultures.culture();
    const lookup = this.lookup.categories().data ?? [];
    return [
      {
        key: 'name',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesColName),
        value: (row) => row.name,
        link: (row) => `/catalog/categories/${row.id}`,
      },
      {
        key: 'slug',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesColSlug),
        value: (row) => row.slug,
      },
      {
        key: 'status',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesColStatus),
        value: (row) => this.statusText(row.status),
      },
      {
        key: 'parent',
        header: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesColParent),
        value: (row) =>
          typeof row.parentId !== 'string' ? '—' : categoryNameOf(lookup, row.parentId),
      },
    ];
  });

  /** Localized status select options (All + backend status names). */
  protected readonly statusOptions = computed((): readonly AdminSelectOption[] => {
    const culture = this.cultures.culture();
    return [
      {
        value: '',
        label: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesFilterAll),
      },
      ...Object.keys(CATEGORY_STATUS_NUMBERS).map((status) => ({
        value: String(CATEGORY_STATUS_NUMBERS[status] ?? -1),
        label: this.statusText(CATEGORY_STATUS_NUMBERS[status] ?? -1),
      })),
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
      heading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesHeading),
      subheading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesSubheading),
      new: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesNew),
      caption: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesCaption),
      loading: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesLoading),
      emptyTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesEmptyTitle),
      emptyMessage: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesEmptyMessage),
      errorTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      filterTitle: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesFilterTitle),
      filterSearch: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesFilterSearch),
      filterSearchPlaceholder: translateCatalogKey(
        culture,
        CATALOG_TRANSLATION_KEYS.categoriesFilterSearchPlaceholder,
      ),
      filterStatus: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesFilterStatus),
      filterClear: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesFilterClear),
      filterApply: translateCatalogKey(culture, CATALOG_TRANSLATION_KEYS.categoriesFilterApply),
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
    this.categories.load();
    this.lookup.load();
  }

  /**
   * Commits the filter form (resets to page 1). The status select value
   * is a numeric wire string (`''` = no filter, omitted); the search
   * travels verbatim and blank values are omitted state-side.
   */
  protected applyFilters(): void {
    const raw = this.filters.getRawValue();
    this.categories.setFilters({
      searchTerm: raw.search,
      ...(raw.status.trim() === '' ? {} : { status: Number(raw.status) }),
    });
  }

  /** Clears the filter form and reloads unfiltered. */
  protected clearFilters(): void {
    this.filters.reset({ search: '', status: '' });
    this.categories.setFilters({});
  }

  /** Commits a pager move (response-effective values re-render the pager). */
  protected onPageChange(pageNumber: number): void {
    this.categories.setPage(pageNumber);
  }

  /** List retry re-enters the current effective page plus the name lookup. */
  protected retry(): void {
    this.categories.reload();
    this.lookup.load();
  }

  /** Localized status text with the forward-compatible unknown fallback. */
  private statusText(status: AdminCategoryRow['status']): string {
    const culture = this.cultures.culture();
    const display = categoryStatusDisplay(status);
    return translateCatalogKey(culture, display.labelKey, { value: String(status) });
  }
}
