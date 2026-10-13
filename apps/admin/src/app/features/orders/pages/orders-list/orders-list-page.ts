/**
 * Admin orders list page for Sub-Phases 14.3–14.5 — Orders List &
 * Pagination + Orders Filtering & Status Presentation + Order Details &
 * Customer Information (row deep-links) — plus Supplement S1, Step S1.8
 * (platform-wide filters).
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `OrderListState` (route-provided `ordersRoutes` entry — never a global
 * store), rendering the paged orders table through the shared admin
 * primitives.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * OrdersListPage (this file — orchestration only)
 *     ↓ OrderListState (../state — paged slot + committed filters/page)
 *     ↓ OrdersAdminApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 *
 * Contract fidelity (S1.1 audit — only backend-exposed options):
 * `GET /admin/orders` exposes paging plus `status`/`customerId`/`search`
 * (`order-number` substring)/`from`/`to`, fixed newest-first — no
 * `sortBy`, no other filters. Filter commits reset to page 1; unknown
 * `status` or `from > to` surfaces as backend `400` (never validated
 * client-side beyond presence). The table shows every backend-issued
 * summary field the contract carries (order number, status, grand
 * total, item count, creation time). Pager values always come from the
 * RESPONSE envelope (effective `pageNumber`/`pageSize`/`totalCount`)
 * with page counts from the shared `totalPagesOf` helper. Status
 * renders through the feature-owned `OrderStatusBadge` (localized label
 * + tone, verbatim fallback for unknown values — the single status
 * mapping site, no scattered string comparisons). Money and counts
 * render culture-formatted for display only (never inputs to math).
 *
 * Resource states: idle → loading → success | empty | error through the
 * shared primitives with localized copy and retry (out-of-range pages
 * arrive as `200` with `items: []` — the empty state, never an error).
 * Failures resolve through `resolveApiErrorMessage` (never backend
 * text). Order numbers deep-link to the details route through the
 * sanctioned per-column row links — every listed route exists, so no
 * dead links ship.
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  CultureService,
  formatCurrency,
  formatDate,
  formatNumber,
  resolveApiErrorMessage,
  translateKey,
} from '@flux/i18n';
import { ErrorState } from '@flux/ui';
import {
  AdminDataTable,
  type AdminDataColumn,
  type AdminDataRowContext,
} from '../../../../shared/data-table/data-table';
import { AdminDateRange } from '../../../../shared/filters/date-range/date-range';
import { AdminFilterBar } from '../../../../shared/filters/filter-bar/filter-bar';
import { AdminSearchInput } from '../../../../shared/filters/search-input/search-input';
import { AdminSelect, type AdminSelectOption } from '../../../../shared/forms/select/select';
import { AdminTextInput } from '../../../../shared/forms/text-input/text-input';
import {
  AdminPagination,
  type AdminPaginationCopy,
} from '../../../../shared/pagination/pagination';
import { OrderStatusBadge } from '../../components/order-status-badge/order-status-badge';
import { OrderListState } from '../../state/orders-list-state';
import type { AdminOrderRow } from '../../models/orders-admin.models';
import { ORDERS_TRANSLATION_KEYS, translateOrdersKey } from '../../i18n/orders-translations';

@Component({
  selector: 'app-orders-list-page',
  imports: [
    ReactiveFormsModule,
    AdminDataTable,
    AdminDateRange,
    AdminFilterBar,
    AdminSearchInput,
    AdminSelect,
    AdminTextInput,
    AdminPagination,
    ErrorState,
    OrderStatusBadge,
  ],
  templateUrl: './orders-list-page.html',
  styleUrl: './orders-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersListPage implements OnInit {
  private readonly orders = inject(OrderListState);
  private readonly cultures = inject(CultureService);
  private readonly formBuilder = inject(FormBuilder);

  /** Status cell template (badge per row — resolved after view init). */
  private readonly statusCell =
    viewChild<TemplateRef<AdminDataRowContext<AdminOrderRow>>>('statusCell');

  /** Current order page (idle → loading → success | empty | error). */
  protected readonly slot = this.orders.page;

  /**
   * Filter form (status select plus customer/search/date text — all
   * optional; blanks travel as omissions). Dates ride as ISO strings;
   * `from > to` surfaces as backend `400` (never validated here).
   */
  protected readonly filters = this.formBuilder.nonNullable.group({
    status: [''],
    customerId: [''],
    search: [''],
    from: [''],
    to: [''],
  });

  /** Whether the table body shows the loading state. */
  protected readonly tableLoading = computed(() => {
    const status = this.slot().status;
    return status === 'idle' || status === 'loading';
  });

  /** Localized table columns for the active culture. */
  protected readonly columns = computed((): readonly AdminDataColumn<AdminOrderRow>[] => {
    const culture = this.cultures.culture();
    return [
      {
        key: 'orderNumber',
        header: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listColNumber),
        value: (row) => row.orderNumber,
        link: (row) => `/orders/${row.orderId}`,
      },
      {
        key: 'status',
        header: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listColStatus),
        value: (row) => row.status,
        template: this.statusCell() ?? null,
      },
      {
        key: 'total',
        header: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listColTotal),
        value: (row) => formatCurrency(row.grandTotal.amount, row.grandTotal.currency, culture),
      },
      {
        key: 'items',
        header: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listColItems),
        value: (row) => formatNumber(row.itemCount, culture),
      },
      {
        key: 'created',
        header: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listColCreated),
        value: (row) => formatDate(row.createdAtUtc, culture),
      },
    ];
  });

  /** Current page rows (`[]` until settled). */
  protected readonly rows = computed(() => this.slot().data?.items ?? []);

  /** Whether the pager renders (a settled page exists). */
  protected readonly showPager = computed(() => this.slot().data !== null);

  /** Localized status select options (All + backend status names). */
  protected readonly statusOptions = computed((): readonly AdminSelectOption[] => {
    const culture = this.cultures.culture();
    return [
      { value: '', label: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.filterAll) },
      {
        value: 'Pending',
        label: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.statusPending),
      },
      {
        value: 'Cancelled',
        label: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.statusCancelled),
      },
      {
        value: 'Confirmed',
        label: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.statusConfirmed),
      },
    ];
  });

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listHeading),
      subheading: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listSubheading),
      caption: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listCaption),
      loading: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listLoading),
      emptyTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listEmptyTitle),
      emptyMessage: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listEmptyMessage),
      errorTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      filterTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.filterTitle),
      filterStatus: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.filterStatus),
      filterCustomer: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.filterCustomer),
      filterSearch: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.filterSearch),
      filterSearchPlaceholder: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.filterSearchPlaceholder,
      ),
      filterFrom: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.filterFrom),
      filterTo: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.filterTo),
      filterClear: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.filterClear),
      filterApply: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.filterApply),
    };
  });

  /** Localized pager copy for the active culture. */
  protected readonly pagerCopy = computed((): AdminPaginationCopy => {
    const culture = this.cultures.culture();
    return {
      label: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.paginationLabel),
      first: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.paginationFirst),
      previous: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.paginationPrevious),
      next: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.paginationNext),
      last: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.paginationLast),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.slot().error, this.cultures.culture()),
  );

  ngOnInit(): void {
    this.orders.load();
  }

  /** Commits the filter form (resets to page 1). */
  protected applyFilters(): void {
    const raw = this.filters.getRawValue();
    this.orders.setFilters({
      status: raw.status,
      customerId: raw.customerId,
      search: raw.search,
      from: raw.from,
      to: raw.to,
    });
  }

  /** Clears the filter form and reloads unfiltered. */
  protected clearFilters(): void {
    this.filters.reset({ status: '', customerId: '', search: '', from: '', to: '' });
    this.orders.setFilters({});
  }

  /** Commits a pager move (response-effective values re-render the pager). */
  protected onPageChange(pageNumber: number): void {
    this.orders.setPage(pageNumber);
  }

  /** List retry re-enters the current effective page. */
  protected retry(): void {
    this.orders.reload();
  }
}
