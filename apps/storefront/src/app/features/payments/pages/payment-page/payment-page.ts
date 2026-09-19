/**
 * Storefront Payment page for Sub-Phases 9.6 (initialization), 9.7
 * (confirmation), and 9.10 (UI & checkout integration).
 *
 * Smart page (route-level composition): validates the `:orderId` route
 * param through the pure §9.2 `readPaymentRouteParams` helper, drives
 * the route-provided `PaymentState` initialization, binds the
 * foundation shells to state (status, error message, submit gating),
 * and sets up the route-provided `PaymentProvider` (Stripe Elements
 * mount) once the state reaches `ready`. No API access, no HTTP, no
 * Stripe surface beyond the provider abstraction, no navigation lives
 * here.
 *
 * Data flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * PaymentPage (this file — live-flow orchestration + outcome routing)
 *     ↓ PaymentState (state/ — lifecycle + context, provided at route)
 *     ↓ PaymentApiService (data-access — initializePayment transport)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Payments API
 *
 * PaymentPage (provider setup, once ready; outcome routing, once resolved)
 *     ↓ PAYMENT_PROVIDER (abstraction — never the concrete adapter)
 *     ↓ StripePaymentProvider (integrations/ — route-provided)
 *     ↓ Stripe.js / Elements
 * ```
 *
 * Initialization rules enforced here (same convention as the checkout
 * page, Phase 8.6):
 * - The server renders the shell only: initialization fires in
 *   `ngOnInit` behind an `isPlatformBrowser` guard (client initializes
 *   post-hydration). A missing `:orderId` blocks entry (the template
 *   fallback — never a fabricated id, never an initialization attempt).
 * - Duplicate prevention is structural: the state gate drops re-entry
 *   while a flow is active, and this page keeps a single in-flight
 *   subscription (replaced on retry, released on destroy).
 * - Provider setup runs once per initialized intent (keyed by
 *   `paymentId`) after `ready`: provider initialize with the
 *   environment key → Elements creation with the runtime secret →
 *   mount into the page container. Setup failures record a normalized
 *   `ApiError` on the state (the error shell renders it; retry
 *   re-enters initialization).
 * - The secret travels state-signal → provider call only (in-memory;
 *   never persisted, logged, or placed in URLs — see `PaymentState`).
 * - Submit stays disabled until `ready`; confirmation executes
 *   through `PaymentState.confirmPayment` (Sub-Phase 9.7 — provider
 *   boundary only, never backend orchestration).
 *
 * Copy is localized per the active `CultureService.culture()` through
 * the feature-owned bundle; failures resolve through
 * `resolvePaymentErrorMessage` (never backend text, never technical
 * internals). Document title follows the localized page title
 * (customer area — no SEO metadata beyond the title).
 *
 * SSR-safe: signals, router templating, and platform-guarded init only
 * — provider and DOM work stay browser-side. RTL safe: logical
 * properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.11 — no security/SSR audit changes.
 */

import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { ApiError } from '@flux/api';
import { CultureService, formatCurrency, translateKey, type Culture } from '@flux/i18n';
import type { OrderMoneyResponse } from '@flux/models';
import { PaymentErrorComponent } from '../../components/payment-error/payment-error';
import { PaymentFormComponent } from '../../components/payment-form/payment-form';
import { PaymentLoadingComponent } from '../../components/payment-loading/payment-loading';
import {
  PaymentOrderSummaryComponent,
  toPaymentOrderSummaryView,
  type PaymentOrderSummaryLabels,
  type PaymentOrderSummaryView,
} from '../../components/payment-order-summary/payment-order-summary';
import { PaymentStatusComponent } from '../../components/payment-status/payment-status';
import { PAYMENT_TRANSLATION_KEYS, translatePaymentKey } from '../../i18n/payment-translations';
import { resolvePaymentErrorMessage } from '../../i18n/payment-errors';
import { PAYMENT_PROVIDER } from '../../integrations/payment-provider';
import { STRIPE_PUBLISHABLE_KEY } from '../../integrations/stripe-payment-provider';
import { paymentRecoveryFor, readPaymentRouteParams } from '../../models/payment.models';
import { PaymentState } from '../../state/payment-state';

@Component({
  selector: 'payment-page',
  imports: [
    PaymentErrorComponent,
    PaymentFormComponent,
    PaymentLoadingComponent,
    PaymentOrderSummaryComponent,
    PaymentStatusComponent,
  ],
  templateUrl: './payment-page.html',
  styleUrl: './payment-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentPage implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly state = inject(PaymentState);
  private readonly provider = inject(PAYMENT_PROVIDER);
  private readonly publishableKey = inject(STRIPE_PUBLISHABLE_KEY);
  private readonly cultures = inject(CultureService);
  private readonly title = inject(Title);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Order being paid, from the `:orderId` route param. `null` blocks
   * entry (nothing to initialize — the template fallback renders, never
   * a fabricated id).
   */
  protected readonly params = readPaymentRouteParams(this.route.snapshot.paramMap);

  /** Lifecycle stage driving shell visibility. */
  protected readonly lifecycle = this.state.lifecycle;
  /** Backend payment status facts, if known. */
  protected readonly paymentStatus = this.state.paymentStatus;
  /** Active culture (drives copy and money formatting). */
  protected readonly culture = this.cultures.culture;
  /**
   * Localized failure message, if any (resolved through the feature
   * resolver — never backend text, never technical internals).
   */
  protected readonly errorMessage = computed(() =>
    resolvePaymentErrorMessage(this.state.statusError(), this.cultures.culture()),
  );
  /** Localized error-shell title. */
  protected readonly errorTitle = computed(() =>
    translatePaymentKey(this.cultures.culture(), PAYMENT_TRANSLATION_KEYS.resultFailureTitle),
  );
  /** Submit stays gated until initialization provides intent context. */
  protected readonly submitDisabled = computed(() => this.state.lifecycle() !== 'ready');
  /**
   * Whether the error shell offers retry (Sub-Phase 9.9 recovery
   * table — retry only where re-entry is legal; pending check-errors
   * display without a dead-end button).
   */
  protected readonly canRetry = computed(
    () =>
      paymentRecoveryFor(this.state.lifecycle(), this.state.confirmationOutcome()) ===
      'retry-initialization',
  );

  /** Elements mount container (always rendered, populated once ready). */
  private readonly mountPoint = viewChild<ElementRef<HTMLElement>>('paymentMount');

  private initSub: Subscription | null = null;
  private confirmSub: Subscription | null = null;
  private orderSub: Subscription | null = null;
  private preparedPaymentId: string | null = null;

  /**
   * Localized page copy for the active culture (shell labels, headings,
   * and placeholders — no interpolation left except `{orderId}`).
   */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const t = (key: string, params = {}): string => translatePaymentKey(culture, key, params);
    const keys = PAYMENT_TRANSLATION_KEYS;
    return {
      title: t(keys.pageTitle),
      orderLabel: (orderId: string): string => t(keys.pageOrderLabel, { orderId }),
      missingReference: t(keys.pageMissingReference),
      formTitle: t(keys.formTitle),
      formPlaceholder: t(keys.formPlaceholder),
      submit: t(keys.formSubmit),
      retry: translateKey(culture, 'common.actions.retry'),
      statusWaiting: t(keys.statusWaiting),
      loadingLabel: t(keys.loadingLabel),
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
   * facts (display only — backend-issued lines and totals, never local
   * math). `null` until the order read settles — the template renders
   * its shells instead.
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

    // Provider setup — once per initialized intent, after `ready`.
    // Keyed by `paymentId` so re-entry with a fresh intent re-prepares
    // while lifecycle re-renders never double-mount.
    effect(() => {
      if (!this.isBrowser) {
        return;
      }
      const stage = this.state.lifecycle();
      if (stage === 'idle') {
        this.preparedPaymentId = null;
        return;
      }
      if (stage !== 'ready') {
        return;
      }
      const paymentId = this.state.paymentId();
      const clientSecret = this.state.clientSecret();
      const mount = this.mountPoint();
      if (paymentId === null || clientSecret === null || !mount) {
        return;
      }
      if (this.preparedPaymentId === paymentId) {
        return;
      }
      this.preparedPaymentId = paymentId;
      void this.setupProvider(clientSecret, mount.nativeElement);
    });

    // Outcome routing — resolved, waiting, and unknown outcomes belong
    // to the result route (`/payment/:orderId/result`), which presents
    // them with backend verification (Sub-Phases 9.8–9.9). This page owns
    // the live flow only: terminal (`succeeded`, `failed`, `cancelled`),
    // waiting (`pending`), and outstanding-unknown (`processing` with an
    // `unknown` provider outcome — the call settled unread, so leaving
    // is safe) navigate out exactly once per entry. Genuinely in-flight
    // confirmations (`processing` without an outcome) never navigate.
    effect(() => {
      if (!this.isBrowser) {
        return;
      }
      const stage = this.state.lifecycle();
      const terminal = stage === 'succeeded' || stage === 'failed' || stage === 'cancelled';
      const waiting = stage === 'pending';
      const unknown = stage === 'processing' && this.state.confirmationOutcome() === 'unknown';
      if (!terminal && !waiting && !unknown) {
        return;
      }
      const params = this.params;
      if (params === null) {
        return;
      }
      void this.router.navigate(['/payment', params.orderId, 'result']);
    });
  }

  ngOnInit(): void {
    if (!this.isBrowser) {
      return;
    }
    this.startInitialization();
    this.loadOrderSummary();
    this.title.setTitle(`${this.copy().title} | FluxCommerce`);
  }

  ngOnDestroy(): void {
    this.initSub?.unsubscribe();
    this.initSub = null;
    this.confirmSub?.unsubscribe();
    this.confirmSub = null;
    this.orderSub?.unsubscribe();
    this.orderSub = null;
    this.provider.destroy();
  }

  /**
   * Submits confirmation (Sub-Phase 9.7): delegates to the state, which
   * submit-locks (`ready` only), moves to `processing`, confirms
   * through the provider boundary, and maps the outcome. In-place
   * confirmation carries no return URL. The previous confirmation
   * subscription is released first — a single outstanding confirmation
   * by construction (the state gate makes overlaps no-ops regardless).
   */
  protected onFormSubmit(): void {
    if (!this.isBrowser) {
      return;
    }
    this.confirmSub?.unsubscribe();
    this.confirmSub = this.state.confirmPayment();
  }

  /**
   * Safe initialization retry: re-enters through the state gate (failed
   * or cancelled only — active and resolved flows stay locked) with a
   * fresh subscription. No blind re-fire: the service re-issues the
   * call, and idempotency stays server-side.
   */
  protected onRetry(): void {
    if (!this.isBrowser) {
      return;
    }
    this.startInitialization();
  }

  /**
   * Starts (or retries) initialization for the route order. Missing
   * params never attempt (template fallback owns that case). The
   * previous subscription is released first — a single in-flight
   * attempt by construction.
   */
  private startInitialization(): void {
    const params = this.params;
    if (params === null) {
      return;
    }
    this.initSub?.unsubscribe();
    this.initSub = this.state.initializePayment(params.orderId);
  }

  /**
   * Loads the backend order facts for the payment UI summary (best
   * effort — failures hide the summary without touching the payment
   * flow, see `PaymentState.loadOrder`). Missing params never attempt.
   * The previous read is released first — a single outstanding read by
   * construction (the state dedupes repeat loads regardless).
   */
  private loadOrderSummary(): void {
    const params = this.params;
    if (params === null) {
      return;
    }
    this.orderSub?.unsubscribe();
    this.orderSub = this.state.loadOrder(params.orderId);
  }

  /**
   * Prepares the provider for an initialized intent: SDK setup with the
   * environment key, Elements creation with the runtime secret, then
   * mount. Setup failures record a normalized failure on the state
   * (retry re-enters initialization — the secret is never retried
   * blindly, a fresh intent re-issues it).
   */
  private async setupProvider(clientSecret: string, container: HTMLElement): Promise<void> {
    try {
      await this.provider.initialize({ publishableKey: this.publishableKey });
      await this.provider.createElements(clientSecret);
      this.provider.mountPaymentElement(container);
    } catch {
      this.preparedPaymentId = null;
      this.state.markFailed(
        new ApiError({ status: 0, code: 'ProviderSetupFailed', message: 'Payment setup failed.' }),
      );
    }
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
