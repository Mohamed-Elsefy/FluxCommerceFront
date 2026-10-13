/**
 * Admin Orders landing page for Sub-Phase 14.2 — Admin Orders Feature
 * Foundation — plus Supplement S1, Step S1.8 (counts snapshot).
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `OrdersOverviewState` (provided by the `ordersRoutes` entry — never a
 * global store) and renders the orders overview — one summary card with
 * the backend-issued counters — through the shared `@flux/ui` async
 * primitives.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * OrdersHomePage (this file — orchestration only)
 *     ↓ OrdersOverviewState (../state — feature-owned, local Signals)
 *     ↓ OrdersAdminApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 *
 * Resource states: idle → loading → success | error through the
 * shared primitives with localized copy and retry. Every bucket echoes
 * verbatim (culture-formatted for display only — never an input to
 * math). Failures resolve through `resolveApiErrorMessage` (never
 * backend text).
 *
 * Copy is localized per the active `CultureService.culture()`: feature
 * copy through the orders bundle, retry through
 * `common.actions.retry`.
 *
 * SSR/hydration safe: signals plus metadata-free markup, no browser APIs.
 * RTL safe: grid auto-flow follows the document direction; logical
 * properties only.
 */

import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { CultureService, formatNumber, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { Card, ErrorState, LoadingIndicator } from '@flux/ui';
import { OrdersOverviewState } from '../../state/orders-overview-state';
import { ORDERS_TRANSLATION_KEYS, translateOrdersKey } from '../../i18n/orders-translations';

@Component({
  selector: 'app-orders-home-page',
  imports: [Card, ErrorState, LoadingIndicator],
  templateUrl: './orders-home-page.html',
  styleUrl: './orders-home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersHomePage implements OnInit {
  private readonly overview = inject(OrdersOverviewState);
  private readonly cultures = inject(CultureService);

  /** Current counts snapshot (idle → loading → success | error). */
  protected readonly slot = this.overview.counts;

  /** Localized page and summary copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.title),
      subtitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.subtitle),
      summaryHeading: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.summaryHeading),
      summaryTotal: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.summaryTotal, {
        count: formatNumber(this.slot().data?.total ?? 0, culture),
      }),
      statusPending: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.statusPending),
      statusConfirmed: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.statusConfirmed),
      statusCancelled: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.statusCancelled),
      loading: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.loading),
      errorTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.errorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.slot().error, this.cultures.culture()),
  );

  /** Culture-formatted counter facts (display only — never inputs to math). */
  protected readonly facts = computed(() => {
    const culture = this.cultures.culture();
    const data = this.slot().data;
    if (data === null) {
      return [];
    }
    const copy = this.copy();
    return [
      { label: copy.statusPending, value: formatNumber(data.pending, culture) },
      { label: copy.statusConfirmed, value: formatNumber(data.confirmed, culture) },
      { label: copy.statusCancelled, value: formatNumber(data.cancelled, culture) },
    ];
  });

  ngOnInit(): void {
    this.overview.refresh();
  }

  /** Landing retry re-enters the state refresh (duplicate-safe by design). */
  protected retry(): void {
    this.overview.refresh();
  }
}
