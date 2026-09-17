/**
 * Storefront Checkout page for Sub-Phase 8.6 — Client Validation &
 * Create Order.
 *
 * Smart page (route-level composition): drives the feature-scoped
 * `CheckoutState` (provided by the parent `checkoutRoutes` entry —
 * never a global store), reads the current cart through the Cart
 * feature's session lifecycle (provided alongside — the product-details
 * pattern, one-way, no cycle), and projects backend snapshots into
 * preformatted view models for the presentational tree.
 *
 * Data flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * CheckoutPage (this file — orchestration only)
 *     ↓ CheckoutState (state/ — submit guards, result, recovery)
 *     ↓ AuthenticatedCartService (cart session lifecycle — current cart)
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
 * - Submission failures render above the preserved form; dismissal
 *   returns to `ready` for a fresh attempt (nuanced retry policy
 *   arrives in 8.7).
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
 * SSR-safe: signals, `Title`, and router templating only — no browser
 * APIs. RTL safe: logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 8.7 — no failure-class recovery paths, no cart-refresh orchestration.
 * - Phase 9 — no payment state, navigation, Stripe, or client secrets.
 * - Phase 10 — no order polling or order-history reads.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  CultureService,
  formatCurrency,
  resolveApiErrorMessage,
  translateKey,
  type Culture,
} from '@flux/i18n';
import { AuthService } from '@flux/auth';
import { EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { CartState } from '../../../cart/state/cart-state';
import { AuthenticatedCartService } from '../../../cart/state/authenticated-cart.service';
import type { OrderMoneyResponse } from '@flux/models';
import { CheckoutState } from '../../state/checkout-state';
import type { CheckoutFormData } from '../../state/checkout-state-boundaries';
import { toCheckoutOrderSummary } from '../../models/checkout.models';
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
  private readonly carts = inject(CartState);
  private readonly authCart = inject(AuthenticatedCartService);
  private readonly auth = inject(AuthService);
  private readonly cultures = inject(CultureService);
  private readonly title = inject(Title);

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
    // checkout-owned signals only — never cart signals).
    effect(() => {
      const status = this.carts.cart().status;
      const data = this.carts.data();
      const authenticated = this.auth.isAuthenticated();
      untracked(() => {
        if (status === 'idle' || status === 'loading') {
          this.checkout.initialize(undefined, authenticated);
        } else if (data !== null) {
          this.checkout.initialize(data, authenticated);
        }
      });
    });
  }

  ngOnInit(): void {
    // First render flows through the cart session lifecycle (standby →
    // established) — no explicit cart call here, so init cannot
    // double-fire. Server pass stays standby (browser-only inside the
    // service).
    this.authCart.synchronize();
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
    this.authCart.synchronize();
  }

  /** Dismisses the submission failure back to `ready` (form preserved). */
  protected onSubmissionRetry(): void {
    this.checkout.clearSubmissionError();
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
