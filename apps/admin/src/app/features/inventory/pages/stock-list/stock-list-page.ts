/**
 * Admin stock list page for Supplement S1, Step S1.7 — Inventory Lists
 * & Counts (stock slice).
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `StockListState` (route-provided `inventoryRoutes` entry — never a
 * global store), rendering the paged stock table through the shared
 * admin primitives.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * StockListPage (this file — orchestration only)
 *     ↓ StockListState (../state — paged slot + committed filters/page)
 *     ↓ InventoryAdminApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Inventory API
 * ```
 *
 * Contract fidelity (S1.1 audit — only backend-exposed options):
 * `GET /inventory` exposes paging plus `search` (SKU substring,
 * case-insensitive) and `maxAvailable` (available-quantity ceiling),
 * fixed by-SKU ordering — no `sortBy`, no other filters. Filter commits
 * reset to page 1; the ceiling parses locally (non-numeric input is
 * omitted, never sent). Pager values always come from the RESPONSE
 * envelope (effective `pageNumber`/`pageSize`/`totalCount`) with page
 * counts from the shared `totalPagesOf` helper. Quantities render
 * backend-issued verbatim (never derived client-side). SKU cells
 * deep-link to the lookup page through the sanctioned per-column row
 * links — every listed route exists, so no dead links ship.
 *
 * Resource states: idle → loading → success | empty | error through the
 * shared primitives with localized copy and retry (out-of-range pages
 * arrive as `200` with `items: []` — the empty state, never an error).
 * Failures resolve through `resolveApiErrorMessage` (never backend
 * text, `Inventory.ValidationFailed` included).
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 */

import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  CultureService,
  formatDate,
  formatNumber,
  resolveApiErrorMessage,
  translateKey,
} from '@flux/i18n';
import { ErrorState } from '@flux/ui';
import { AdminDataTable, type AdminDataColumn } from '../../../../shared/data-table/data-table';
import { AdminFilterBar } from '../../../../shared/filters/filter-bar/filter-bar';
import { AdminSearchInput } from '../../../../shared/filters/search-input/search-input';
import { AdminTextInput } from '../../../../shared/forms/text-input/text-input';
import {
  AdminPagination,
  type AdminPaginationCopy,
} from '../../../../shared/pagination/pagination';
import { StockListState } from '../../state/stock-list-state';
import type { AdminStockRow } from '../../models/inventory-admin.models';
import {
  INVENTORY_TRANSLATION_KEYS,
  translateInventoryKey,
} from '../../i18n/inventory-translations';

@Component({
  selector: 'app-stock-list-page',
  imports: [
    ReactiveFormsModule,
    AdminDataTable,
    AdminFilterBar,
    AdminSearchInput,
    AdminTextInput,
    AdminPagination,
    ErrorState,
  ],
  templateUrl: './stock-list-page.html',
  styleUrl: './stock-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StockListPage implements OnInit {
  private readonly stock = inject(StockListState);
  private readonly cultures = inject(CultureService);
  private readonly formBuilder = inject(FormBuilder);

  /** Current stock page (idle → loading → success | empty | error). */
  protected readonly slot = this.stock.page;

  /**
   * Filter form (search substring plus available-quantity ceiling text —
   * parsed on apply, non-numeric ceilings omitted).
   */
  protected readonly filters = this.formBuilder.nonNullable.group({
    search: [''],
    maxAvailable: [''],
  });

  /** Whether the table body shows the loading state. */
  protected readonly tableLoading = computed(() => {
    const status = this.slot().status;
    return status === 'idle' || status === 'loading';
  });

  /** Localized table columns for the active culture. */
  protected readonly columns = computed((): readonly AdminDataColumn<AdminStockRow>[] => {
    const culture = this.cultures.culture();
    return [
      {
        key: 'sku',
        header: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListColSku),
        value: (row) => row.sku,
        link: (row) => `/inventory/stock/${row.sku}`,
      },
      {
        key: 'onHand',
        header: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListColOnHand),
        value: (row) => formatNumber(row.onHandQuantity, culture),
      },
      {
        key: 'reserved',
        header: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListColReserved),
        value: (row) => formatNumber(row.reservedQuantity, culture),
      },
      {
        key: 'available',
        header: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListColAvailable),
        value: (row) => formatNumber(row.availableQuantity, culture),
      },
      {
        key: 'updated',
        header: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListColUpdated),
        value: (row) => formatDate(row.updatedAtUtc, culture),
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
      heading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListHeading),
      subheading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListSubheading),
      caption: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListCaption),
      loading: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListLoading),
      emptyTitle: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListEmptyTitle),
      emptyMessage: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.stockListEmptyMessage,
      ),
      errorTitle: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      filterTitle: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListFilterTitle),
      filterSearch: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.stockListFilterSearch,
      ),
      filterSearchPlaceholder: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.stockListFilterSearchPlaceholder,
      ),
      filterMax: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListFilterMax),
      filterMaxPlaceholder: translateInventoryKey(
        culture,
        INVENTORY_TRANSLATION_KEYS.stockListFilterMaxPlaceholder,
      ),
      filterClear: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListFilterClear),
      filterApply: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.stockListFilterApply),
    };
  });

  /** Localized pager copy for the active culture. */
  protected readonly pagerCopy = computed((): AdminPaginationCopy => {
    const culture = this.cultures.culture();
    return {
      label: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.paginationLabel),
      first: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.paginationFirst),
      previous: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.paginationPrevious),
      next: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.paginationNext),
      last: translateInventoryKey(culture, INVENTORY_TRANSLATION_KEYS.paginationLast),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.slot().error, this.cultures.culture()),
  );

  ngOnInit(): void {
    this.stock.load();
  }

  /**
   * Commits the filter form (resets to page 1). The ceiling parses
   * locally: non-numeric input is omitted (the backend `400`s on
   * negative values, never on omission).
   */
  protected applyFilters(): void {
    const raw = this.filters.getRawValue();
    const ceiling = raw.maxAvailable.trim();
    this.stock.setFilters({
      search: raw.search,
      ...(/^\d+$/.test(ceiling) ? { maxAvailable: Number(ceiling) } : {}),
    });
  }

  /** Clears the filter form and reloads unfiltered. */
  protected clearFilters(): void {
    this.filters.reset({ search: '', maxAvailable: '' });
    this.stock.setFilters({});
  }

  /** Commits a pager move (response-effective values re-render the pager). */
  protected onPageChange(pageNumber: number): void {
    this.stock.setPage(pageNumber);
  }

  /** List retry re-enters the current effective page. */
  protected retry(): void {
    this.stock.reload();
  }
}
