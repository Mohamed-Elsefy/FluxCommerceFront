/**
 * Admin Orders landing page for Sub-Phase 14.2 — Admin Orders Feature
 * Foundation.
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `OrdersOverviewState` (provided by the `ordersRoutes` entry — never a
 * global store) and renders the orders overview — one summary card with
 * the backend-issued total — through the shared `@flux/ui` async
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
 * Resource states: idle → loading → success | empty | error through the
 * shared primitives with localized copy and retry. The fact echoes the
 * backend `totalCount` verbatim (culture-formatted for display only —
 * never an input to math). Failures resolve through
 * `resolveApiErrorMessage` (never backend text). The summary card stays
 * non-interactive: the orders list and details routes do not exist yet
 * (Sub-Phases 14.3/14.5), so no links ship with the foundation.
 *
 * Copy is localized per the active `CultureService.culture()`: feature
 * copy through the orders bundle, retry through
 * `common.actions.retry`.
 *
 * SSR/hydration safe: signals plus metadata-free markup, no browser APIs.
 * RTL safe: grid auto-flow follows the document direction; logical
 * properties only.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 14.3–14.4 — no tables, pagination, filters, badges, or list
 *   navigation.
 * - 14.5 — no details navigation, no address rendering.
 * - 14.6–14.8 — no payment presentation.
 */

import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { CultureService, formatNumber, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { Card, EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { OrdersOverviewState } from '../../state/orders-overview-state';
import { ORDERS_TRANSLATION_KEYS, translateOrdersKey } from '../../i18n/orders-translations';

@Component({
  selector: 'app-orders-home-page',
  imports: [Card, EmptyState, ErrorState, LoadingIndicator],
  templateUrl: './orders-home-page.html',
  styleUrl: './orders-home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersHomePage implements OnInit {
  private readonly overview = inject(OrdersOverviewState);
  private readonly cultures = inject(CultureService);

  /** Combined landing status (idle → loading → success | empty | error). */
  protected readonly status = this.overview.status;

  /** Localized page and summary copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const data = this.overview.overview();
    return {
      title: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.title),
      subtitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.subtitle),
      summaryHeading: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.summaryHeading),
      summaryTotal: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.summaryTotal, {
        count: formatNumber(data?.orderTotal ?? 0, culture),
      }),
      loading: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.loading),
      errorTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.errorTitle),
      emptyTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.emptyTitle),
      emptyMessage: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.emptyMessage),
      retry: translateKey(culture, 'common.actions.retry'),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.overview.error(), this.cultures.culture()),
  );

  ngOnInit(): void {
    this.overview.refresh();
  }

  /** Landing retry re-enters the state refresh (duplicate-safe by design). */
  protected retry(): void {
    this.overview.refresh();
  }
}
