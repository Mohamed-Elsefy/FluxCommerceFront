/**
 * Storefront Payment Result page for Sub-Phases 9.8 (result handling),
 * 9.9 (unknown-outcome verification), and 9.10 (UI & checkout
 * integration).
 *
 * Outcome hub (route-level composition): reads the `:orderId` route
 * param through the pure §9.2 `readPaymentRouteParams` helper and
 * renders one dedicated block per resolved outcome from the
 * route-provided `PaymentState` (shared with the payment page — same
 * route subtree, same instance):
 *
 * - `succeeded` — success presentation with the order reference and the
 *   backend-verified status. Never shown on provider claims alone:
 *   entry triggers a backend verification read first (`refreshStatus`),
 *   and only the backend-resolved stage renders.
 * - `failed` — localized failure message with retry (back to the
 *   payment route, whose entry re-initializes) and return-to-checkout
 *   navigation.
 * - `cancelled` — cancellation message with re-attempt and
 *   modify-checkout navigation.
 * - `pending` — pending presentation with the manual status-check
 *   affordance (single-shot verification — no polling, 9.9 owns loops).
 * - `processing` holding `unknown` — unknown presentation with the
 *   verification affordance and no retry surface (never a blind retry).
 * - anything else (direct deep link, mid-flow arrival) — neutral
 *   fallback with a back-to-payment link, never fabricated outcomes.
 *
 * Backend-truth rule (the §9.8 enforcement): provider-reported stages
 * are claims, not proof. `succeeded`/`pending`/unknown entries verify
 * through `refreshStatus` before final presentation; `failed`/
 * `cancelled` present from resolved state (provider-reported or
 * backend-resolved — both terminal, both retryable through re-entry,
 * never edited here). This page performs no confirmation, no polling,
 * and no order writes — it reads state and routes.
 *
 * Copy is localized per the active `CultureService.culture()` through
 * the feature-owned bundle; failures resolve through
 * `resolvePaymentErrorMessage` (never backend text, never technical
 * internals). Document title follows the localized page title
 * (customer area — no SEO metadata beyond the title).
 *
 * The backend order facts (when loaded on the payment page) project
 * into the shared order summary (display only — backend-issued lines
 * and totals, never local math).
 *
 * SSR-safe: signals, router templating, and platform-guarded
 * verification only — no browser APIs. RTL safe: logical properties
 * only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.11 — no security/SSR audit changes.
 * - Phase 10 — no order polling, no order-history reads.
 */

import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { CultureService, formatCurrency, type Culture } from '@flux/i18n';
import type { OrderMoneyResponse } from '@flux/models';
import {
  PaymentOrderSummaryComponent,
  toPaymentOrderSummaryView,
  type PaymentOrderSummaryLabels,
  type PaymentOrderSummaryView,
} from '../../components/payment-order-summary/payment-order-summary';
import { PAYMENT_TRANSLATION_KEYS, translatePaymentKey } from '../../i18n/payment-translations';
import { resolvePaymentErrorMessage } from '../../i18n/payment-errors';
import { readPaymentRouteParams, paymentPath } from '../../models/payment.models';
import { PaymentState } from '../../state/payment-state';

@Component({
  selector: 'payment-result-page',
  imports: [RouterLink, PaymentOrderSummaryComponent],
  templateUrl: './payment-result-page.html',
  styleUrl: './payment-result-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentResultPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly state = inject(PaymentState);
  private readonly cultures = inject(CultureService);
  private readonly title = inject(Title);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Order whose result displays, from the `:orderId` route param.
   * `null` renders the fallback (nothing to display — never a
   * fabricated id).
   */
  protected readonly params = readPaymentRouteParams(this.route.snapshot.paramMap);

  /** Resolved lifecycle stage driving the outcome blocks. */
  protected readonly lifecycle = this.state.lifecycle;
  /** Latest provider confirmation outcome, if any (distinguishes unknown holds). */
  protected readonly confirmationOutcome = this.state.confirmationOutcome;
  /** Backend-reported payment status facts, if verified. */
  protected readonly paymentStatus = this.state.paymentStatus;
  /**
   * Localized failure message, if any (resolved through the feature
   * resolver — never backend text, never technical internals).
   */
  protected readonly errorMessage = computed(() =>
    resolvePaymentErrorMessage(this.state.statusError(), this.cultures.culture()),
  );

  /** Back-to-payment path for retry/re-attempt (`/payment/:orderId`). */
  protected readonly retryPath = computed(() => {
    const params = this.params;
    return params === null ? '/checkout' : paymentPath(params.orderId);
  });

  /**
   * Localized page copy for the active culture (headings, messages, and
   * navigation labels — no interpolation left).
   */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const t = (key: string): string => translatePaymentKey(culture, key);
    const keys = PAYMENT_TRANSLATION_KEYS;
    return {
      title: t(keys.pageResultTitle),
      orderLabel: (orderId: string): string =>
        translatePaymentKey(culture, keys.pageOrderLabel, { orderId }),
      missingReference: t(keys.pageMissingReference),
      successTitle: t(keys.resultSuccessTitle),
      orderReference: t(keys.resultOrderReference),
      verifiedStatus: t(keys.resultVerifiedStatus),
      failureTitle: t(keys.resultFailureTitle),
      cancelledTitle: t(keys.resultCancelledTitle),
      cancelledMessage: t(keys.resultCancelledMessage),
      pendingTitle: t(keys.resultPendingTitle),
      pendingMessage: t(keys.resultPendingMessage),
      unknownTitle: t(keys.resultUnknownTitle),
      unknownMessage: t(keys.resultUnknownMessage),
      tryAgain: t(keys.resultTryAgain),
      backToCheckout: t(keys.resultBackToCheckout),
      backToPayment: t(keys.resultBackToPayment),
      waitingMessage: t(keys.resultWaitingMessage),
      checkStatus: t(keys.resultCheckStatus),
      summaryLabels: {
        title: t(keys.summaryTitle),
        items: t(keys.summaryItems),
        orderNumber: t(keys.summaryOrderNumber),
        quantity: t(keys.summaryQuantity),
        unitPrice: t(keys.summaryUnitPrice),
        sku: t(keys.summarySku),
        subtotal: t(keys.summarySubtotal),
        shippingCost: t(keys.summaryShippingCost),
        discount: t(keys.summaryDiscount),
        grandTotal: t(keys.summaryGrandTotal),
      } satisfies PaymentOrderSummaryLabels,
    };
  });

  /**
   * Preformatted order-summary view projected from the backend order
   * facts (display only). `null` until loaded — the success block
   * renders the reference line regardless.
   */
  protected readonly orderSummaryView = computed((): PaymentOrderSummaryView | null => {
    const culture = this.cultures.culture();
    return toPaymentOrderSummaryView(this.state.orderDetails(), (money) =>
      moneyText(money, culture),
    );
  });

  constructor() {
    // Document title tracks the localized page title (runs on server and
    // client — `ngOnInit` covers the first SSR pass).
    effect(() => {
      this.title.setTitle(`${this.copy().title} | FluxCommerce`);
    });
  }

  ngOnInit(): void {
    if (!this.isBrowser) {
      return;
    }
    if (this.params === null) {
      return;
    }
    // Backend authority before final presentation: provider-reported
    // `succeeded`/`pending` verify through one explicit status read, as
    // does an outstanding-unknown hold (`processing` with an `unknown`
    // outcome — sent-but-unread resolves through backend truth, never a
    // blind retry). `failed`/`cancelled` already resolve terminally;
    // anything earlier has no payment id to verify yet (the guard inside
    // `refreshStatus` drops those calls structurally).
    const stage = this.state.lifecycle();
    const unknown = stage === 'processing' && this.state.confirmationOutcome() === 'unknown';
    if (stage === 'succeeded' || stage === 'pending' || unknown) {
      this.state.refreshStatus();
    }
    this.title.setTitle(`${this.copy().title} | FluxCommerce`);
  }

  /**
   * Manual status verification for the pending and unknown blocks
   * (one explicit single-shot read per press; no polling, no automatic
   * recovery).
   */
  protected onCheckStatus(): void {
    if (!this.isBrowser) {
      return;
    }
    this.state.refreshStatus();
  }
}

/**
 * Formats backend money for a culture, falling back to the raw
 * `amount currency` pair when unformattable (never renders broken or
 * empty money). Pure — throws nothing.
 */
function moneyText(money: OrderMoneyResponse, culture: Culture): string {
  return (
    formatCurrency(money.amount, money.currency, culture) || `${money.amount} ${money.currency}`
  );
}
