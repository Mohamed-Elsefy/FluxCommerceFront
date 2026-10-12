/**
 * Storefront Checkout page for Sub-Phase 8.6 — Client Validation &
 * Create Order.
 *
 * Smart page (route-level composition): drives the feature-scoped
 * `CheckoutState` (provided by the parent `checkoutRoutes` entry —
 * never a global store), reads the current cart through the cart
 * capabilities seam (`CART_CAPABILITIES`, provided alongside —
 * Refactoring Phase C: interface-based, one-way, no cycle), and
 * projects backend snapshots into preformatted view models for the
 * presentational tree.
 *
 * Data flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * CheckoutPage (this file — orchestration only)
 *     ↓ CheckoutState (state/ — submit guards, result, recovery)
 *     ↓ CART_CAPABILITIES (cart seam — current cart + session lifecycle)
 *     ↓ CheckoutApiService (data-access — createOrder transport)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 *
 * Page contract:
 * - First render flows through the cart session lifecycle
 *   (browser-only — the server renders the loading shell and the client
 *   establishes the cart after hydration). The page never reads
 *   `localStorage` and never establishes cart identity itself.
 * - Checkout initialization tracks the settled cart plus the auth
 *   session (`CheckoutState.initialize`): unsettled cart data holds the
 *   `loading` workflow; empty carts block with a back-to-cart recovery;
 *   anonymous sessions stay blocked (the route guard owns entry — this
 *   covers mid-checkout expiry).
 * - Validated form data arrives through the form's `formSubmit` output
 *   only (the form gates validity itself): the page stores it
 *   (`setFormData`) and submits against the live cart
 *   (`submitOrder({ currentCart })` — the pre-submit freshness check
 *   rejects stale reviews). No other request construction exists here.
 * - The created order stays in `CheckoutState.result` verbatim — the
 *   handoff boundary Phase 9 consumes (`orderId` entry to payment).
 *   This page navigates nowhere and executes no payment.
 * - Submission failures render above the preserved form with a
 *   recovery action mapped from the failure (`checkoutRecoveryFor`,
 *   §8.1 models — status-first, never message text):
 *   transport failures retry with the SAME idempotency key
 *   (`retrySubmission` — replay-or-create-once, never a duplicate);
 *   missing/denied carts re-validate the cart in the background and
 *   guide back to Cart (the stale snapshot is abandoned, never
 *   resubmitted); every other rejection dismisses back to `ready`
 *   with the form preserved for correction and a fresh attempt.
 *   Backend technical details never reach the UI — all copy resolves
 *   through `resolveApiErrorMessage` and the feature bundle.
 *
 * Contract fidelity (only backend-provided fields):
 * - Money formats the backend snapshot for the active culture (display
 *   only — never an input to math).
 * - Line totals display nowhere; totals rows display backend money only
 *   (the pending note renders until the backend provides money).
 *
 * Copy is localized per the active `CultureService.culture()` through
 * the feature-owned bundle; retry through `common.actions.retry` and
 * failures through `resolveApiErrorMessage` (never backend text).
 * Document title follows the localized page title (customer area — no
 * SEO metadata beyond the title).
 *
 * SSR-safe: signals, `Title`, and router templating only — focus
 * writes stay browser-guarded. RTL safe: logical properties only, no
 * direction branching.
 *
 * Accessibility (§8.8): the form exposes `role="form"` with labelled
 * controls in DOM order (natural Tab sequence, no positive tabindex);
 * field errors announce through `role="alert"`; loading and success
 * states expose `role="status"`; every input carries `aria-invalid`
 * plus `aria-describedby`. Submission failures move focus to the error
 * banner once per failure (browser-only, script focus via
 * `tabindex="-1"` — same convention as the cart page focus repair).
 *
 * Explicitly out of scope (later work, must not appear here):
 * - Phase 9 — no payment state, navigation, Stripe, or client secrets.
 * - Phase 10 — no order polling or order-history reads.
 */

import {
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
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import type { ApiError } from '@flux/api';
import {
  CultureService,
  formatCurrency,
  resolveApiErrorMessage,
  translateKey,
  type Culture,
} from '@flux/i18n';
import { AuthService } from '@flux/auth';
import { EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { CART_CAPABILITIES, type CartCapabilities } from '../../../cart/cart-capabilities';
import type { OrderMoneyResponse } from '@flux/models';
import { CheckoutState } from '../../state/checkout-state';
import type { CheckoutFormData } from '../../state/checkout-state-boundaries';
import {
  checkoutRecoveryFor,
  toCheckoutOrderSummary,
  type CheckoutRecovery,
} from '../../models/checkout.models';
import {
  CheckoutFormComponent,
  type CheckoutFormLabels,
} from '../../components/checkout-form/checkout-form';
import type { CheckoutAddressLabels } from '../../components/address-form/address-form';
import type { CheckoutFieldTemplates } from '../../components/field-errors/field-errors';
import {
  OrderSummaryComponent,
  toOrderSummaryView,
  type OrderSummaryLabels,
  type OrderSummaryView,
} from '../../components/order-summary/order-summary';
import { CHECKOUT_TRANSLATION_KEYS, translateCheckoutKey } from '../../i18n/checkout-translations';

@Component({
  selector: 'app-checkout-page',
  imports: [
    RouterLink,
    LoadingIndicator,
    EmptyState,
    ErrorState,
    CheckoutFormComponent,
    OrderSummaryComponent,
  ],
  templateUrl: './checkout-page.html',
  styleUrl: './checkout-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutPage implements OnInit {
  private readonly checkout = inject(CheckoutState);
  private readonly carts: CartCapabilities = inject(CART_CAPABILITIES);
  private readonly auth = inject(AuthService);
  private readonly cultures = inject(CultureService);
  private readonly title = inject(Title);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Submission failure already moved to the error banner (focus fires
   * once per failure instance — retries and re-renders must not steal
   * focus back).
   */
  private focusedSubmissionError: ApiError | null = null;

  /** Current cart resource (idle → loading → success | empty | error). */
  protected readonly cart = this.carts.cart;

  /** Active culture (drives copy, formatting, and interpolation below). */
  protected readonly culture = this.cultures.culture;

  /** Checkout workflow stage (`initial` → `loading` → `ready` → `submitting` → `success` | `failure`). */
  protected readonly workflow = this.checkout.workflow;

  /** Initialization outcome (`null` while the cart is unsettled). */
  protected readonly initialization = this.checkout.initialization;

  /** Created order for the Phase 9 handoff (`null` until `success`). */
  protected readonly orderResult = this.checkout.result;

  /** Normalized submission failure, if any. */
  protected readonly submissionError = this.checkout.submissionError;

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const templates: CheckoutFieldTemplates = {
      required: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.validationRequired),
      tooLong: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.validationTooLong),
      invalidCountryCode: translateCheckoutKey(
        culture,
        CHECKOUT_TRANSLATION_KEYS.validationInvalidCountryCode,
      ),
    };
    const addressLabels = (section: string): CheckoutAddressLabels => ({
      sectionTitle: section,
      recipientName: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.fieldsRecipientName),
      line1: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.fieldsLine1),
      line2: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.fieldsLine2),
      line2Optional: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.fieldsLine2Optional),
      city: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.fieldsCity),
      region: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.fieldsRegion),
      postalCode: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.fieldsPostalCode),
      countryCode: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.fieldsCountryCode),
    });
    const formLabels: CheckoutFormLabels = {
      shipping: addressLabels(
        translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.sectionsShipping),
      ),
      billing: addressLabels(
        translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.sectionsBilling),
      ),
      billingSameAsShipping: translateCheckoutKey(
        culture,
        CHECKOUT_TRANSLATION_KEYS.billingSameAsShipping,
      ),
      submit: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.submit),
      templates,
    };
    const summaryLabels: OrderSummaryLabels = {
      title: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.summaryTitle),
      items: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.summaryItems),
      emptyTitle: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.summaryEmptyTitle),
      emptyMessage: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.summaryEmptyMessage),
      quantity: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.summaryQuantity),
      unitPrice: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.summaryUnitPrice),
      sku: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.summarySku),
      subtotal: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.summarySubtotal),
      shippingCost: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.summaryShippingCost),
      discount: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.summaryDiscount),
      grandTotal: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.summaryGrandTotal),
      totalsPending: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.summaryTotalsPending),
    };
    return {
      title: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.pageTitle),
      loading: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.pageLoading),
      emptyTitle: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.pageEmptyTitle),
      emptyMessage: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.pageEmptyMessage),
      backToCart: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.pageBackToCart),
      successTitle: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.pageSuccessTitle),
      continueToPayment: translateCheckoutKey(
        culture,
        CHECKOUT_TRANSLATION_KEYS.pageContinueToPayment,
      ),
      loadErrorTitle: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.pageLoadErrorTitle),
      orderNumber: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.pageOrderNumber),
      orderStatus: translateCheckoutKey(culture, CHECKOUT_TRANSLATION_KEYS.pageOrderStatus),
      submitErrorTitle: translateCheckoutKey(
        culture,
        CHECKOUT_TRANSLATION_KEYS.pageSubmitErrorTitle,
      ),
      retry: translateKey(culture, 'common.actions.retry'),
      formLabels,
      summaryLabels,
    };
  });

  /**
   * Preformatted order-summary view projected live from the current
   * cart: backend snapshots formatted for the active culture (display
   * only) through the §8.5 projector. `null` while the cart is
   * unsettled or empty — the template renders its shells instead. New
   * cart data projects a new view object, so the summary tracks the
   * cart with no in-place mutation and no local math.
   */
  protected readonly summaryView = computed((): OrderSummaryView | null => {
    const culture = this.cultures.culture();
    return toOrderSummaryView(toCheckoutOrderSummary(this.carts.data()), (money) =>
      moneyText(money, culture),
    );
  });

  /** Freezes the form while a submission is in flight. */
  protected readonly formDisabled = computed(() => this.checkout.isSubmitting());

  /** Localized submission failure message (never backend text). */
  protected readonly submissionErrorMessage = computed(() =>
    resolveApiErrorMessage(this.checkout.submissionError(), this.cultures.culture()),
  );

  /**
   * Recovery path for the current submission failure (`null` while no
   * failure is present). Drives the retry action below.
   */
  protected readonly recovery = computed((): CheckoutRecovery | null =>
    checkoutRecoveryFor(this.checkout.submissionError()),
  );

  /** Localized cart failure message (never backend text). */
  protected readonly cartErrorMessage = computed(() =>
    resolveApiErrorMessage(this.carts.error(), this.cultures.culture()),
  );

  constructor() {
    // Document title tracks the localized page title (runs on server and
    // client — `ngOnInit` covers the first SSR pass).
    effect(() => {
      this.title.setTitle(`${this.copy().title} | FluxCommerce`);
    });

    // Checkout initialization tracks the settled cart plus the auth
    // session. Everything else runs `untracked` so settled responses
    // can never reschedule the effect into a loop (`initialize` writes
    // checkout-owned signals only — never cart signals). A cart load
    // failure invalidates the review even when stale data is retained
    // (stale-while-revalidate must never leave an orderable snapshot
    // behind a dead cart) — the template guides back to Cart.
    effect(() => {
      const status = this.carts.cart().status;
      const data = this.carts.data();
      const authenticated = this.auth.isAuthenticated();
      untracked(() => {
        if (status === 'idle' || status === 'loading') {
          this.checkout.initialize(undefined, authenticated);
        } else if (status === 'error' || data === null) {
          this.checkout.initialize(null, authenticated);
        } else {
          this.checkout.initialize(data, authenticated);
        }
      });
    });

    // Submission-failure focus management (§8.8): once per failure,
    // move focus to the error banner so keyboard and screen-reader
    // users land on the recovery action. An after-render effect (not a
    // plain effect): the banner must exist in the DOM before focusing
    // — focusing too early would record the error as handled while
    // focusing nothing. DOM writes stay browser-guarded; the observer
    // itself is SSR-safe signals only (after-render hooks never run on
    // the server).
    afterRenderEffect(() => {
      const error = this.checkout.submissionError();
      untracked(() => this.focusSubmissionError(error));
    });
  }

  /**
   * Moves focus to the submission error banner for a new failure.
   * Records the failure only once focus actually moves: a missing
   * banner leaves the error unrecorded so a later render retries.
   * Browser-only (SSR never focuses); no-op for repeats. Plain field
   * (never rendered).
   */
  private focusSubmissionError(error: ApiError | null): void {
    if (!this.isBrowser || error === null || error === this.focusedSubmissionError) {
      return;
    }
    const target = this.host.nativeElement.querySelector('#checkout-submit-error');
    if (target instanceof HTMLElement) {
      this.focusedSubmissionError = error;
      target.focus();
    }
  }

  ngOnInit(): void {
    // First render flows through the cart session lifecycle (standby →
    // established) — no explicit cart call here, so init cannot
    // double-fire. Server pass stays standby (browser-only inside the
    // service).
    this.carts.synchronize();
    this.title.setTitle(`${this.copy().title} | FluxCommerce`);
  }

  /**
   * Handles validated form data: stores it, then submits against the
   * live cart (the state guards uninitialized, formless, stale, and
   * duplicate attempts — the factory is never invoked for those).
   */
  protected onFormSubmit(data: CheckoutFormData): void {
    this.checkout.setFormData(data);
    this.checkout.submitOrder({ currentCart: this.carts.data() });
  }

  /** Re-enters the cart session lifecycle (cart error retry). */
  protected onCartRetry(): void {
    this.carts.synchronize();
  }

  /** Dismisses the submission failure back to `ready` (form preserved). */
  protected onSubmissionRetry(): void {
    switch (this.recovery()) {
      case 'retry':
        // Transport failure (no response): the order may or may not
        // exist server-side — retry reuses the recorded key for the
        // identical payload (replay-or-create-once, never a duplicate).
        this.checkout.retrySubmission({ currentCart: this.carts.data() });
        break;
      case 'cart':
        // Cart gone or denied: the snapshot is stale by definition.
        // Re-validate the cart in the background and abandon the
        // snapshot — the template guides back to Cart. Never resubmit
        // against the dead snapshot.
        this.carts.loadCart();
        this.checkout.initialize(null, this.auth.isAuthenticated());
        break;
      default:
        // Validation, business, auth, and server rejections: dismiss
        // with the form preserved for correction (and re-login where
        // the session expired), then resubmit as a fresh attempt.
        this.checkout.clearSubmissionError();
        break;
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
