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
 * `GET /catalog/categories` exposes paging only — no `sortBy`, no
 * filters, no search. Sorting/filtering/search UI therefore does not
 * exist here by design; the table shows every backend-issued category
 * field the contract carries (name, slug, status, parent). Hierarchy
 * follows the flat backend model: per-row parent references resolved
 * through the lookup (raw-id fallback outside the first hundred) —
 * no tree widget exists because no tree endpoint exists. Pager values
 * always come from the RESPONSE envelope with page counts from the
 * shared `totalPagesOf` helper. Status renders as localized text with
 * the forward-compatible unknown fallback.
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
 * - Sorting/filtering/search on category rows (no backend contract).
 */

import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { ErrorState } from '@flux/ui';
import { AdminDataTable, type AdminDataColumn } from '../../../../shared/data-table/data-table';
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

@Component({
  selector: 'app-categories-list-page',
  imports: [RouterLink, AdminDataTable, AdminPagination, ErrorState],
  templateUrl: './categories-list-page.html',
  styleUrl: './categories-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesListPage implements OnInit {
  private readonly categories = inject(CategoryListState);
  private readonly lookup = inject(CategoryLookupState);
  private readonly cultures = inject(CultureService);

  /** Current category page (idle → loading → success | empty | error). */
  protected readonly slot = this.categories.page;

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

  /** Commits a pager move (response-effective values re-render the pager). */
  protected onPageChange(pageNumber: number): void {
    this.categories.setPage(pageNumber);
  }

  /** List retry re-enters the current effective page. */
  protected retry(): void {
    this.categories.reload();
  }

  /** Localized status text with the forward-compatible unknown fallback. */
  private statusText(status: AdminCategoryRow['status']): string {
    const culture = this.cultures.culture();
    const display = categoryStatusDisplay(status);
    return translateCatalogKey(culture, display.labelKey, { value: String(status) });
  }
}
