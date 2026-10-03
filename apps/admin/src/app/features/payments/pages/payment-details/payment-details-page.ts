/**
 * Admin payment details page for Supplement S1, Step S1.9 — Payments:
 * Mine + Admin + Stats.
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `PaymentDetailsState` (route-provided `paymentsRoutes` entry — never a
 * global store) for the single payment slot, rendering backend-issued
 * facts through the shared admin primitives. Read-only: no mutations,
 * no confirmation, no history.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * PaymentDetailsPage (this file — orchestration only)
 *     ↓ PaymentDetailsState (../state — single payment slot)
 *     ↓ PaymentsAdminApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Payments API
 * ```
 *
 * Display contract (S1.1 audit — only backend-exposed data): the single
 * `GET /admin/payments/{paymentId}` payload carries everything below
 * verbatim — intent reference, provider, amount, currency, string status
 * (through the feature-owned `AdminPaymentStatusBadge`), order and
 * customer ids (opaque keys — no identity resolution), timestamps, and
 * version. No totals math, no status derivation (unknown ids mask as
 * `404`, rendered through the shared error state with retry, never
 * probed). Money renders culture-formatted for display only (never
 * inputs to math). Failures resolve through `resolveApiErrorMessage`
 * (never backend text).
 *
 * Resource states: idle → loading → success | error through the shared
 * primitives with localized copy and retry.
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 *
 * Explicitly out of scope (must not appear here):
 * - Payment history (no such endpoint), mutations (none exist).
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  CultureService,
  formatCurrency,
  formatDate,
  resolveApiErrorMessage,
  translateKey,
} from '@flux/i18n';
import { Card, ErrorState, LoadingIndicator } from '@flux/ui';
import { AdminPaymentStatusBadge } from '../../components/payment-status-badge/payment-status-badge';
import { PaymentDetailsState } from '../../state/payment-details-state';
import { PAYMENTS_TRANSLATION_KEYS, translatePaymentsKey } from '../../i18n/payments-translations';

@Component({
  selector: 'app-payment-details-page',
  imports: [RouterLink, Card, ErrorState, LoadingIndicator, AdminPaymentStatusBadge],
  templateUrl: './payment-details-page.html',
  styleUrl: './payment-details-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentDetailsPage {
  private readonly details = inject(PaymentDetailsState);
  private readonly cultures = inject(CultureService);

  /** Route payment id (`null` until the first param emission). */
  private readonly paymentId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: null as string | null },
  );

  /** Current payment details (idle → loading → success | error). */
  protected readonly payment = this.details.payment;

  constructor() {
    // Drives the slot from the route id (initial value included,
    // changes followed). Runs `untracked` on purpose: loads read and
    // write the slot, so without `untracked` every settled response
    // would reschedule the effect into an infinite fetch loop. The
    // effect depends on the route id alone.
    effect(() => {
      const id = this.paymentId();
      untracked(() => {
        this.details.load(id);
      });
    });
  }

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const payment = this.payment().data;
    return {
      back: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.detailsBack),
      loading: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.detailsLoading),
      errorTitle: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.detailsErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      title: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.detailsTitle),
      heading: payment?.providerPaymentIntentId ?? payment?.id ?? '',
      factReference: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.detailsFactReference),
      factProvider: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.detailsFactProvider),
      factAmount: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.detailsFactAmount),
      factOrder: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.detailsFactOrder),
      factCustomer: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.detailsFactCustomer),
      factCreated: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.detailsFactCreated),
      factUpdated: translatePaymentsKey(culture, PAYMENTS_TRANSLATION_KEYS.detailsFactUpdated),
      reference: payment?.providerPaymentIntentId ?? null,
      provider: payment?.provider ?? null,
      amount: payment === null ? '' : formatCurrency(payment.amount, payment.currency, culture),
      orderId: payment?.orderId ?? '',
      customerId: payment?.customerId ?? '',
      created: payment === null ? '' : formatDate(payment.createdAtUtc, culture),
      updated:
        payment?.updatedAtUtc === null || payment?.updatedAtUtc === undefined || payment === null
          ? null
          : formatDate(payment.updatedAtUtc, culture),
    };
  });

  /** Payment status for the badge (`''` until settled — the badge is gated on data). */
  protected readonly paymentStatus = computed(() => this.payment().data?.status ?? '');

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.payment().error, this.cultures.culture()),
  );

  /** Details retry reloads the slot for the current route id. */
  protected retry(): void {
    this.details.load(this.paymentId());
  }
}
