/**
 * Admin Payments landing page for Supplement S1, Step S1.9 — Payments:
 * Mine + Admin + Stats.
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `PaymentsStatsState` (provided by the `paymentsRoutes` entry — never a
 * global store) and renders the payments overview — one summary card
 * with the backend-issued stats plus the per-currency succeeded totals
 * — through the shared `@flux/ui` async primitives.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * PaymentsHomePage (this file — orchestration only)
 *     ↓ PaymentsStatsState (../state — feature-owned, local Signals)
 *     ↓ PaymentsAdminApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Payments API
 * ```
 *
 * Resource states: idle → loading → success | error through the
 * shared primitives with localized copy and retry. Every bucket echoes
 * verbatim (culture-formatted for display only — never an input to
 * math). Failures resolve through `resolveApiErrorMessage` (never
 * backend text).
 *
 * Copy is localized per the active `CultureService.culture()`: feature
 * copy through the payments bundle, retry through
 * `common.actions.retry`.
 *
 * SSR/hydration safe: signals plus metadata-free markup, no browser APIs.
 * RTL safe: grid auto-flow follows the document direction; logical
 * properties only.
 */

import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import {
  CultureService,
  formatCurrency,
  formatNumber,
  resolveApiErrorMessage,
  translateKey,
} from '@flux/i18n';
import { Card, ErrorState, LoadingIndicator } from '@flux/ui';
import { PaymentsStatsState } from '../../state/payments-stats-state';
import { PAYMENTS_TRANSLATION_KEYS, translatePaymentsKey } from '../../i18n/payments-translations';

@Component({
  selector: 'app-payments-home-page',
  imports: [Card, ErrorState, LoadingIndicator],
  templateUrl: './payments-home-page.html',
  styleUrl: './payments-home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsHomePage implements OnInit {
  private readonly overview = inject(PaymentsStatsState);
  private readonly cultures = inject(CultureService);

  /** Current stats snapshot (idle → loading → success | error). */
  protected readonly slot = this.overview.stats;

  /** Localized page and summary copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.title),
      subtitle: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.subtitle),
      summaryHeading: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.summaryHeading),
      summaryTotal: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.summaryTotal, {
        count: formatNumber(this.slot().data?.total ?? 0, culture),
      }),
      byCurrencyTitle: translatePaymentsKey(
        culture,
        PAYMENTS_TRANSLATION_KEYS.statsByCurrencyTitle,
      ),
      statusPending: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.statusPending),
      statusProcessing: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.statusProcessing),
      statusSucceeded: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.statusSucceeded),
      statusFailed: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.statusFailed),
      statusCancelled: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.statusCancelled),
      statusRefunded: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.statusRefunded),
      loading: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.loading),
      errorTitle: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.errorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.slot().error, this.cultures.culture()),
  );

  /** Culture-formatted per-status facts (display only — never inputs to math). */
  protected readonly facts = computed(() => {
    const culture = this.cultures.culture();
    const data = this.slot().data;
    if (data === null) {
      return [];
    }
    const copy = this.copy();
    return [
      { label: copy.statusPending, value: formatNumber(data.pending, culture) },
      { label: copy.statusProcessing, value: formatNumber(data.processing, culture) },
      { label: copy.statusSucceeded, value: formatNumber(data.succeeded, culture) },
      { label: copy.statusFailed, value: formatNumber(data.failed, culture) },
      { label: copy.statusCancelled, value: formatNumber(data.cancelled, culture) },
      { label: copy.statusRefunded, value: formatNumber(data.refunded, culture) },
    ];
  });

  /** Culture-formatted per-currency succeeded totals (display only). */
  protected readonly currencyTotals = computed(() => {
    const culture = this.cultures.culture();
    const data = this.slot().data;
    if (data === null) {
      return [];
    }
    return data.totalsByCurrency.map((entry) => ({
      label: entry.currency,
      value: `${formatNumber(entry.succeededCount, culture)} · ${formatCurrency(entry.succeededTotalAmount, entry.currency, culture)}`,
    }));
  });

  ngOnInit(): void {
    this.overview.refresh();
  }

  /** Landing retry re-enters the state refresh (duplicate-safe by design). */
  protected retry(): void {
    this.overview.refresh();
  }
}
