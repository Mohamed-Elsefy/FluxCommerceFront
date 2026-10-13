/**
 * Customer payments-mine list page for Supplement S1, Step S1.9 —
 * Payments: Mine + Admin + Stats (storefront slice).
 *
 * Smart page (route-level composition): drives the feature-scoped
 * `PaymentsMineState` (provided by the `mine` entry — never a global
 * store) and projects the settled backend page into row views. No totals
 * math, no status derivation, no HTTP here.
 *
 * Data flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * PaymentsMinePage (this file — orchestration only)
 *     ↓ PaymentsMineState (state/ — paged resource, page commits)
 *     ↓ PaymentApiService (data-access/ — thin typed façade)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Payments API
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
 *   — never backend text) and a retry action (`PaymentsMineState.retry()`).
 * - The pager renders from RESPONSE-effective
 *   `pageNumber/pageSize/totalCount` and locks while a load is in
 *   flight (no overlapping requests); page moves commit through the
 *   state (`loadPage` clamps via `normalizePagination`).
 * - Rows render backend summaries verbatim (date and money formatted
 *   for the active culture — display only). Status renders through the
 *   `payment-status` component — never derived, never mapped across
 *   concepts; no order status renders anywhere (no such contract field).
 *
 * Copy is localized per the active `CultureService.culture()` through
 * the feature-owned mine bundle; retry through
 * `common.actions.retry`. Document title follows the localized page
 * title (customer area — no SEO metadata beyond the title).
 *
 * SSR-safe: signals, `Title`, and router templating only — the initial
 * load trigger is browser-guarded via `afterNextRender`. RTL safe:
 * logical properties only, no direction branching.
 *
 * Accessibility: labelled section heading with entry focus
 * (browser-only, so route changes announce); load failures move focus
 * to the error banner once per failure; loading/error/empty states
 * expose the shared primitives' live semantics; the list is an ordered
 * list of articles; the pager is a labelled nav with `aria-current`
 * on the current page and visible focus on every control.
 *
 * Explicitly out of scope (must not appear here):
 * - Payment history/timeline (no backend contract).
 * - Payment confirmation (provider-side, owned by the payment flow).
 * - Admin reads (`GET /admin/payments*` — admin app only).
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
import {
  CultureService,
  formatCurrency,
  formatDate,
  resolveApiErrorMessage,
  translateKey,
} from '@flux/i18n';
import { EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { PAYMENTS_MINE_DEFAULT_PAGE_SIZE } from '../../models/payments-mine.models';
import {
  PAYMENTS_MINE_TRANSLATION_KEYS,
  translatePaymentsMineKey,
} from '../../i18n/payments-mine-translations';
import { PaymentsMineState } from '../../state/payments-mine-state';
import { PaymentStatusComponent } from '../../components/payment-status/payment-status';
import {
  StorefrontPagination,
  type StorefrontPaginationCopy,
} from '../../../../shared/pagination/pagination';

@Component({
  selector: 'payments-mine-page',
  imports: [LoadingIndicator, ErrorState, EmptyState, PaymentStatusComponent, StorefrontPagination],
  templateUrl: './payments-mine-page.html',
  styleUrl: './payments-mine-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsMinePage implements OnInit {
  private readonly state = inject(PaymentsMineState);
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
    // Load-failure focus management: once per failure, move focus to the
    // error banner so keyboard and screen-reader users land on the
    // recovery action. An after-render effect (not a plain effect): the
    // banner must exist in the DOM before focusing. Browser-only; no-op
    // for repeats.
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
    const pagerCopy: StorefrontPaginationCopy = {
      label: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.pagerLabel),
      first: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.pagerFirst),
      previous: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.pagerPrevious),
      next: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.pagerNext),
      last: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.pagerLast),
    };
    return {
      title: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.title),
      filterLabel: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.filterLabel),
      filterAll: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.filterAll),
      statusOptions: [
        {
          value: 'Pending',
          label: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.statusPending),
        },
        {
          value: 'Processing',
          label: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.statusProcessing),
        },
        {
          value: 'Succeeded',
          label: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.statusSucceeded),
        },
        {
          value: 'Failed',
          label: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.statusFailed),
        },
        {
          value: 'Cancelled',
          label: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.statusCancelled),
        },
        {
          value: 'Refunded',
          label: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.statusRefunded),
        },
      ],
      loading: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.loading),
      loadErrorTitle: translatePaymentsMineKey(
        culture,
        PAYMENTS_MINE_TRANSLATION_KEYS.loadErrorTitle,
      ),
      retry: translateKey(culture, 'common.actions.retry'),
      emptyTitle: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.emptyTitle),
      emptyMessage: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.emptyMessage),
      fieldOrder: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.fieldOrder),
      fieldAmount: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.fieldAmount),
      fieldStatus: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.fieldStatus),
      fieldDate: translatePaymentsMineKey(culture, PAYMENTS_MINE_TRANSLATION_KEYS.fieldDate),
      pagerCopy,
    };
  });

  /** Preformatted row views for the settled page (backend values only). */
  readonly rows = computed(() => {
    const culture = this.cultures.culture();
    return (this.state.page()?.items ?? []).map((item) => ({
      id: item.id,
      orderId: item.orderId,
      amount: formatCurrency(item.amount, item.currency, culture),
      status: item.status,
      created: formatDate(item.createdAtUtc, culture),
      reference: item.providerPaymentIntentId ?? null,
      provider: item.provider ?? null,
    }));
  });

  /** Response-effective pager values (never request values). */
  readonly pager = computed(() => {
    const page = this.state.page();
    return {
      page: page?.pageNumber ?? this.state.currentPage(),
      pageSize: page?.pageSize ?? PAYMENTS_MINE_DEFAULT_PAGE_SIZE,
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
   * the heading id.
   */
  private focusHeading(): void {
    if (!this.isBrowser) {
      return;
    }
    const target = this.host.nativeElement.querySelector('#payments-mine-page-title');
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
