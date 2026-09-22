/**
 * Customer orders list page for Sub-Phase 10.3 — Orders List.
 *
 * Smart page (route-level composition): drives the feature-scoped
 * `OrdersListState` (provided by the parent `ordersRoutes` entry —
 * never a global store) and projects the settled backend page into
 * preformatted row views for the presentational tree. No totals math,
 * no status derivation, no HTTP here.
 *
 * Data flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * OrdersListPage (this file — orchestration only)
 *     ↓ OrdersListState (state/ — paged resource, page commits)
 *     ↓ OrdersApiService (data-access/ — §10.1 thin typed façade)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 *
 * Page contract:
 * - First render triggers `loadPage()` from `ngOnInit` (client
 *   navigations, tests) and — only when nothing was ever attempted
 *   (`idle`) — from browser-only `afterNextRender` (post-hydration
 *   entry, where `ngOnInit` ran on the server). Settled outcomes stay
 *   stable; recovery is the explicit retry action.
 * - Untouched (`idle`) renders as loading — server and client start
 *   idle, so SSR and hydration emit identical markup.
 * - Zero-item pages render the empty state (still `200` — never an
 *   error, including out-of-range pages). Errors render through
 *   `flux-error-state` with status-first copy (`resolveApiErrorMessage`
 *   — never backend text) and a retry action (`OrdersListState.retry()`).
 * - The pager renders from RESPONSE-effective
 *   `pageNumber/pageSize/totalCount` and locks while a load is in
 *   flight (no overlapping requests); page moves commit through the
 *   state (`loadPage` clamps via `normalizePagination`).
 * - Rows render backend summaries verbatim (date and money formatted
 *   for the active culture — display only). Status is plain text, not
 *   a badge (§10.5); no payment status renders anywhere (no such
 *   contract field — §10.3 gap, documented not approximated).
 *
 * Copy is localized per the active `CultureService.culture()` through
 * the feature-owned orders bundle; retry through
 * `common.actions.retry`. Document title follows the localized page
 * title (customer area — no SEO metadata beyond the title).
 *
 * SSR-safe: signals, `Title`, and router templating only — the initial
 * load trigger is browser-guarded via `afterNextRender`. RTL safe:
 * logical properties only, no direction branching.
 *
 * Accessibility: labelled section heading; loading/error/empty states
 * expose the shared primitives' live semantics; the list is an ordered
 * list of articles with one details destination per row; the pager is a
 * labelled nav with `aria-current` on the current page.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.4 — no order-details content (row links land there).
 * - 10.5 — no status badges or localized status labels.
 * - 10.6 — no history reads or post-payment polling.
 */

import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { ORDERS_DEFAULT_PAGE_SIZE } from '../../models/orders.models';
import { ORDERS_TRANSLATION_KEYS, translateOrdersKey } from '../../i18n/orders-translations';
import { OrdersListState } from '../../state/orders-list-state';
import {
  OrderSummaryRow,
  toOrderRowView,
  type OrderRowLabels,
} from '../../components/order-summary-row/order-summary-row';
import {
  OrdersPagination,
  type OrdersPaginationCopy,
} from '../../components/orders-pagination/orders-pagination';

@Component({
  selector: 'orders-list-page',
  imports: [LoadingIndicator, ErrorState, EmptyState, OrderSummaryRow, OrdersPagination],
  templateUrl: './orders-list-page.html',
  styleUrl: './orders-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersListPage implements OnInit {
  private readonly state = inject(OrdersListState);
  private readonly cultures = inject(CultureService);
  private readonly title = inject(Title);

  constructor() {
    // Post-hydration entry: `ngOnInit` ran on the server there, so the
    // client state is still untouched (`idle`) and the browser schedules
    // its own trigger. Fires only from `idle` — settled outcomes stay
    // stable. Never fires on the server — SSR/hydration safe.
    afterNextRender(() => {
      if (this.state.status() === 'idle') {
        this.state.loadPage();
      }
    });
    effect(() => {
      this.title.setTitle(this.copy().title);
    });
  }

  ngOnInit(): void {
    this.state.loadPage();
  }

  /** Localized page copy for the active culture. */
  readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const rowLabels: OrderRowLabels = {
      date: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listFieldDate),
      status: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listFieldStatus),
      items: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listFieldItems),
      total: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listFieldTotal),
    };
    const pagerCopy: OrdersPaginationCopy = {
      label: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listPagerLabel),
      first: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listPagerFirst),
      previous: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listPagerPrevious),
      next: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listPagerNext),
      last: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listPagerLast),
    };
    return {
      title: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listTitle),
      loading: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listLoading),
      loadErrorTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listLoadErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      emptyTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listEmptyTitle),
      emptyMessage: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listEmptyMessage),
      rowLabels,
      pagerCopy,
    };
  });

  /** Preformatted row views for the settled page (backend values only). */
  readonly rows = computed(() => {
    const culture = this.cultures.culture();
    return (this.state.page()?.items ?? []).map((item) => toOrderRowView(item, culture));
  });

  /** Response-effective pager values (never request values). */
  readonly pager = computed(() => {
    const page = this.state.page();
    return {
      page: page?.pageNumber ?? this.state.currentPage(),
      pageSize: page?.pageSize ?? ORDERS_DEFAULT_PAGE_SIZE,
      totalCount: page?.totalCount ?? 0,
    };
  });

  /** Loading shell covers both untouched (`idle`) and in-flight states. */
  readonly showLoading = computed(() => {
    const status = this.state.status();
    return status === 'idle' || status === 'loading';
  });

  /** Whether the last page load failed. */
  readonly showError = computed(() => this.state.status() === 'error');

  /** Whether the last load settled with zero items. */
  readonly showEmpty = computed(() => this.state.status() === 'empty');

  /** Whether a page with items is on screen. */
  readonly showList = computed(() => this.state.isSuccess());

  /** Locks pager navigation while a page load is in flight. */
  readonly pagerDisabled = computed(() => this.state.isLoading());

  /** Localized failure message (status-first, never backend text). */
  readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.state.error(), this.cultures.culture()),
  );

  /** Commits a pager page move through the state. */
  onPageChange(page: number): void {
    this.state.loadPage(page);
  }

  /** Retries the failed page load (forced fresh request). */
  onRetry(): void {
    this.state.retry();
  }
}
