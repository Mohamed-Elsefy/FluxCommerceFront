/**
 * Admin product list page for Sub-Phase 13.3 — Product Management.
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `ProductListState` (route-provided `catalogRoutes` entry — never a
 * global store) and the `CategoryLookupState` (display names), rendering
 * the paged product table through the shared admin primitives.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * ProductsListPage (this file — orchestration only)
 *     ↓ ProductListState (../state — paged slot + committed page)
 *     ↓ CatalogAdminApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Catalog API
 * ```
 *
 * Contract fidelity (13.1 audit — only backend-exposed options):
 * `GET /catalog/products` exposes paging only — no `sortBy`,
 * no filters, no search on full product rows (the search endpoint
 * returns thin rows without status, so a status-bearing admin table
 * cannot source from it). Sorting/filtering/search UI therefore does
 * not exist here by design; the table shows every backend-issued
 * product field the contract carries (name, slug, status, visibility,
 * category, creation time). Pager values always come from the RESPONSE
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
 * - Sorting/filtering/search on product rows (no backend contract).
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
import { CategoryLookupState } from '../../state/category-lookup-state';
import { ProductListState } from '../../state/product-list-state';
import {
  categoryNameOf,
  productStatusDisplay,
  productVisibilityDisplay,
  type AdminProductRow,
} from '../../models/catalog-admin.models';
import { CATALOG_TRANSLATION_KEYS, translateCatalogKey } from '../../i18n/catalog-translations';

@Component({
  selector: 'app-products-list-page',
  imports: [RouterLink, AdminDataTable, AdminPagination, ErrorState],
  templateUrl: './products-list-page.html',
  styleUrl: './products-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsListPage implements OnInit {
  private readonly products = inject(ProductListState);
  private readonly lookup = inject(CategoryLookupState);
  private readonly cultures = inject(CultureService);

  /** Current product page (idle → loading → success | empty | error). */
  protected readonly slot = this.products.page;

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
