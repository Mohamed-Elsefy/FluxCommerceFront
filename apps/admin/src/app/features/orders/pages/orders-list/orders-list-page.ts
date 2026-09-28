/**
 * Admin orders list page for Sub-Phases 14.3–14.5 — Orders List &
 * Pagination + Orders Filtering & Status Presentation + Order Details &
 * Customer Information (row deep-links).
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
 *     ↓ OrderListState (../state — paged slot + committed page)
 *     ↓ OrdersAdminApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 *
 * Contract fidelity (14.1 audit — only backend-exposed options):
 * `GET /orders` exposes paging only (`pageNumber`/`pageSize`, fixed
 * newest-first, caller-owned) — no `sortBy`, no filters, no search on
 * order rows. Sorting/filtering UI therefore does not exist here by
 * design (Sub-Phase 14.4 confirms the supported filter set is empty:
 * status filtering has no backend contract, so no filter controls, no
 * debounce, and no filter-driven reloads ship — the 14.1
 * `order-status-filter` gap stays pinned instead of fabricated); the
 * table shows every backend-issued summary field the contract carries
 * (order number, status, grand total, item count, creation time).
 * Pager values always come from the RESPONSE envelope (effective
 * `pageNumber`/`pageSize`/`totalCount`) with page counts from the
 * shared `totalPagesOf` helper. Status renders through the feature-owned
 * `OrderStatusBadge` (localized label + tone, verbatim fallback for
 * unknown values — the single status mapping site, no scattered string
 * comparisons). Money and counts render culture-formatted for display
 * only (never inputs to math).
 *
 * Resource states: idle → loading → success | empty | error through the
 * shared primitives with localized copy and retry (out-of-range pages
 * arrive as `200` with `items: []` — the empty state, never an error).
 * Failures resolve through `resolveApiErrorMessage` (never backend
 * text). Order numbers deep-link to the details route (Sub-Phase 14.5)
 * through the sanctioned per-column row links — every listed route
 * exists, so no dead links ship.
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 14.5 — no details navigation, no address rendering.
 * - 14.6–14.8 — no payment presentation.
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
  imports: [AdminDataTable, AdminPagination, ErrorState, OrderStatusBadge],
  templateUrl: './orders-list-page.html',
  styleUrl: './orders-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersListPage implements OnInit {
  private readonly orders = inject(OrderListState);
  private readonly cultures = inject(CultureService);

  /** Status cell template (badge per row — resolved after view init). */
  private readonly statusCell =
    viewChild<TemplateRef<AdminDataRowContext<AdminOrderRow>>>('statusCell');

  /** Current order page (idle → loading → success | empty | error). */
  protected readonly slot = this.orders.page;

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

  /** Commits a pager move (response-effective values re-render the pager). */
  protected onPageChange(pageNumber: number): void {
    this.orders.setPage(pageNumber);
  }

  /** List retry re-enters the current effective page. */
  protected retry(): void {
    this.orders.reload();
  }
}
