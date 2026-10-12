/**
 * Customer orders list page for Sub-Phases 10.3 (Orders List), 10.5
 * (Order & Payment Status Experience), and 10.8 (Localization, RTL,
 * Responsive & Accessibility).
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
 *   for the active culture — display only). Status renders through the
 *   §10.5 `OrderStatusBadge` (localized label, tone, unknown-value
 *   fallback) — never derived, never mapped across concepts; no payment
 *   status renders anywhere (no such contract field — §10.3 gap,
 *   documented not approximated).
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
 * Accessibility (§10.8): labelled section heading with entry focus
 * (browser-only, so route changes announce); load failures move focus
 * to the error banner once per failure (checkout §8.8 pattern);
 * loading/error/empty states expose the shared primitives' live
 * semantics; the list is an ordered list of articles with one details
 * destination per row; the pager is a labelled nav with `aria-current`
 * on the current page and visible focus on every control.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.6 — no history reads or post-payment polling.
 * - 10.7 — no routing or guard changes.
 * - 10.9 — no E2E suites.
 */

import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnInit,
  PLATFORM_ID,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
  StorefrontPagination,
  type StorefrontPaginationCopy,
} from '../../../../shared/pagination/pagination';

@Component({
  selector: 'orders-list-page',
  imports: [LoadingIndicator, ErrorState, EmptyState, OrderSummaryRow, StorefrontPagination],
  templateUrl: './orders-list-page.html',
  styleUrl: './orders-list-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersListPage implements OnInit {
  private readonly state = inject(OrdersListState);
  private readonly cultures = inject(CultureService);
  private readonly title = inject(Title);
  private readonly host = inject(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Failures already moved to the error banner (once-per-failure focus
   * record — plain field, never rendered).
   */
  private focusedError: unknown = null;

  constructor() {
    // Post-hydration entry: `ngOnInit` ran on the server there, so the
    // client state is still untouched (`idle`) and the browser schedules
    // its own trigger. Fires only from `idle` — settled outcomes stay
    // stable. Never fires on the server — SSR/hydration safe.
    afterNextRender(() => {
      if (this.state.status() === 'idle') {
        this.state.loadPage();
      }
      // Entry focus skips settled failures so the error banner (focused
      // by the after-render effect below) wins deterministically.
      if (!this.showError()) {
        this.focusHeading();
      }
    });
    effect(() => {
      this.title.setTitle(this.copy().title);
    });
    // Load-failure focus management (§10.8 — the checkout §8.8
    // pattern): once per failure, move focus to the error banner so
    // keyboard and screen-reader users land on the recovery action. An
    // after-render effect (not a plain effect): the banner must exist
    // in the DOM before focusing. Browser-only; no-op for repeats.
    afterRenderEffect(() => {
      const failed = this.showError();
      const error = this.state.error();
      untracked(() => {
        if (failed) {
          this.focusError(error);
        }
      });
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
    const pagerCopy: StorefrontPaginationCopy = {
      label: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listPagerLabel),
      first: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listPagerFirst),
      previous: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listPagerPrevious),
      next: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listPagerNext),
      last: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listPagerLast),
    };
    return {
      title: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listTitle),
      filterLabel: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listFilterLabel),
      filterAll: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.listFilterAll),
      statusOptions: [
        {
          value: 'Pending',
          label: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.statusOrderPending),
        },
        {
          value: 'Cancelled',
          label: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.statusOrderCancelled),
        },
        {
          value: 'Confirmed',
          label: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.statusOrderConfirmed),
        },
      ],
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

  /**
   * Commits a status filter change through the state (resets to page
   * 1). Empty selection clears the filter.
   */
  onStatusFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement | null)?.value ?? '';
    this.state.setStatusFilter(value === '' ? null : value);
  }

  /**
   * Moves keyboard/screen-reader focus to the page heading on entry so
   * route changes announce. Browser-only (SSR never focuses). Targets
   * the heading id (the page heading is an h2 under the shell h1).
   */
  private focusHeading(): void {
    if (!this.isBrowser) {
      return;
    }
    const target = this.host.nativeElement.querySelector('#orders-list-page-title');
    if (target instanceof HTMLElement) {
      target.focus();
    }
  }

  /**
   * Moves focus to the load-error banner for a new failure. Records the
   * failure only once focus actually moves: a missing banner leaves the
   * error unrecorded so a later render retries. Browser-only (SSR never
   * focuses); no-op for repeats. Plain field (never rendered).
   */
  private focusError(error: unknown): void {
    if (!this.isBrowser || error === null || error === this.focusedError) {
      return;
    }
    const target = this.host.nativeElement.querySelector('[data-error-focus]');
    if (target instanceof HTMLElement) {
      this.focusedError = error;
      target.focus();
    }
  }
}
