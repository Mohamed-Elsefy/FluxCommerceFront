/**
 * Storefront Cart page for Sub-Phase 7.4 — Cart Page & UI — plus the
 * Sub-Phase 7.5 guest lifecycle and the Sub-Phase 7.6 auth-driven
 * lifecycle.
 *
 * Smart page (route-level composition): drives the feature-scoped
 * `CartState` (provided by the parent `cartRoutes` entry — never a
 * global store) and projects backend cart lines into preformatted view
 * models for the presentational tree.
 *
 * Data flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * CartPage (this file — orchestration only)
 *     ↓ AuthenticatedCartService (7.6 session lifecycle — WHEN identity follows the session)
 *     ↓ GuestCartService (7.5 guest branch) + CartState (state/, feature-owned local Signals)
 *     ↓ CartApiService (feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Cart API
 * ```
 *
 * Page contract:
 * - First render flows through the session lifecycle (owned by the
 *   service constructor effect): restoration pending → standby;
 *   anonymous → guest create/load/recover; authenticated → establish
 *   the backend cart (GET-first, single-shot get-or-create fallback).
 *   Synchronization is browser-only — the server renders the standby
 *   state and the client establishes identity after hydration. The page
 *   never reads `localStorage`, never inspects auth state itself, and
 *   never triggers merges.
 * - Quantity, remove, and clear intents forward to feature state
 *   (validated there — invalid values are ignored; routing follows the
 *   established identity, guest or authenticated).
 * - Error retry re-enters the session lifecycle (a dead identity
 *   recovers instead of refetching the same failure).
 * - Rendering follows stale-while-revalidate: settled content stays
 *   mounted during reloads and in-flight mutations (controls freeze via
 *   `activeOperation`) and on mutation failures (an error banner renders
 *   above the retained content); the full loading/error shells appear
 *   only before the first payload settles.
 * - Culture and formatting live here (single site, same convention as
 *   the details page `copy`): backend snapshots format through
 *   `formatCurrency`/`formatNumber` for the active culture; per-line
 *   view models (`unitPriceText`, interpolated remove labels) project
 *   in one `computed`, so templates stay declarative.
 *
 * Contract fidelity (§7.4 rules — only backend-provided fields):
 * - Unit prices display the backend per-line snapshot only.
 * - Line totals display nowhere (no `lineTotal` on the wire, no local
 *   `unitPrice × quantity` multiplication).
 * - Summary money rows display only backend totals (currently none —
 *   the pending note renders instead). No subtotal/total is ever summed
 *   locally.
 * - Line thumbnails are decorative placeholders (no image URL on the
 *   wire — no product imagery fabricated).
 * - The checkout anchor is a navigation boundary only
 *   (`routerLink="/checkout"`): no checkout, shipping, tax, order, or
 *   payment logic exists here (Phase 8 owns it).
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
 * - 7.7 — no merge wiring or merge triggering.
 * - Phase 8 — no checkout page, shipping, tax, order, or payment logic.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import {
  CultureService,
  formatCurrency,
  formatNumber,
  resolveApiErrorMessage,
  translateKey,
  type Culture,
} from '@flux/i18n';
import { EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { CartItems, type CartLineQuantityChange } from '../../components/cart-items/cart-items';
import type { CartItemLabels, CartItemView } from '../../components/cart-item/cart-item';
import { CartSummary } from '../../components/cart-summary/cart-summary';
import { CartState } from '../../state/cart-state';
import { AuthenticatedCartService } from '../../state/authenticated-cart.service';
import { hasBackendTotals, type CartMoney } from '../../models/cart.models';
import { CART_TRANSLATION_KEYS, translateCartKey } from '../../i18n/cart-translations';

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, LoadingIndicator, EmptyState, ErrorState, CartItems, CartSummary],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPage implements OnInit {
  private readonly state = inject(CartState);
  private readonly authCart = inject(AuthenticatedCartService);
  private readonly cultures = inject(CultureService);
  private readonly title = inject(Title);

  /** Current cart resource (idle → loading → success | empty | error). */
  protected readonly cart = this.state.cart;

  /** Active culture (drives copy, formatting, and interpolation below). */
  protected readonly culture = this.cultures.culture;

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const itemLabels: CartItemLabels = {
      unitPrice: translateCartKey(culture, CART_TRANSLATION_KEYS.itemUnitPrice),
      sku: translateCartKey(culture, CART_TRANSLATION_KEYS.itemSku),
      quantity: translateCartKey(culture, CART_TRANSLATION_KEYS.itemQuantity),
      decrease: translateCartKey(culture, CART_TRANSLATION_KEYS.itemDecrease),
      increase: translateCartKey(culture, CART_TRANSLATION_KEYS.itemIncrease),
      invalidQuantity: translateCartKey(culture, CART_TRANSLATION_KEYS.itemInvalidQuantity),
    };
    return {
      title: translateCartKey(culture, CART_TRANSLATION_KEYS.pageTitle),
      loading: translateCartKey(culture, CART_TRANSLATION_KEYS.pageLoading),
      standby: translateCartKey(culture, CART_TRANSLATION_KEYS.pageStandby),
      errorTitle: translateCartKey(culture, CART_TRANSLATION_KEYS.pageErrorTitle),
      emptyTitle: translateCartKey(culture, CART_TRANSLATION_KEYS.pageEmptyTitle),
      emptyMessage: translateCartKey(culture, CART_TRANSLATION_KEYS.pageEmptyMessage),
      browseCatalog: translateCartKey(culture, CART_TRANSLATION_KEYS.pageBrowseCatalog),
      itemsTitle: translateCartKey(culture, CART_TRANSLATION_KEYS.itemsTitle),
      itemLabels,
      summaryTitle: translateCartKey(culture, CART_TRANSLATION_KEYS.summaryTitle),
      summaryItemsLabel: translateCartKey(culture, CART_TRANSLATION_KEYS.summaryItemsLabel),
      summarySubtotal: translateCartKey(culture, CART_TRANSLATION_KEYS.summarySubtotal),
      summaryTotal: translateCartKey(culture, CART_TRANSLATION_KEYS.summaryTotal),
      summaryTotalsPending: translateCartKey(culture, CART_TRANSLATION_KEYS.summaryTotalsPending),
      summaryClear: translateCartKey(culture, CART_TRANSLATION_KEYS.summaryClear),
      summaryCheckout: translateCartKey(culture, CART_TRANSLATION_KEYS.summaryCheckout),
      retry: translateKey(culture, 'common.actions.retry'),
    };
  });

  /**
   * Preformatted line view models in backend order: backend snapshot
   * formatted for the active culture (display only) plus the
   * interpolated accessible remove label. The single projection site —
   * templates render these strings verbatim.
   */
  protected readonly views = computed((): readonly CartItemView[] => {
    const culture = this.cultures.culture();
    return (this.state.data()?.items ?? []).map((item) => ({
      item,
      unitPriceText: formatCurrency(item.unitPriceAmount, item.currency, culture),
      removeLabel: translateCartKey(culture, CART_TRANSLATION_KEYS.itemRemove, {
        product: item.productName,
      }),
    }));
  });

  /** Page-formatted item count for the active culture. */
  protected readonly summaryItemsValue = computed(() =>
    formatNumber(this.state.itemCount(), this.cultures.culture()),
  );

  /** Page-formatted backend subtotal, or `null` while the backend provides none. */
  protected readonly subtotalText = computed(() =>
    moneyText(this.state.totals().subtotal, this.cultures.culture()),
  );

  /** Page-formatted backend total, or `null` while the backend provides none. */
  protected readonly totalText = computed(() =>
    moneyText(this.state.totals().total, this.cultures.culture()),
  );

  /** Pending-totals note, or `null` once backend money renders. */
  protected readonly totalsNote = computed(() =>
    hasBackendTotals(this.state.totals()) ? null : this.copy().summaryTotalsPending,
  );

  /** Freezes line and clear controls while a cart mutation is in flight. */
  protected readonly controlsDisabled = computed(() => this.state.activeOperation() !== null);

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.state.error(), this.cultures.culture()),
  );

  constructor() {
    // Document title tracks the localized page title (runs on server and
    // client — `ngOnInit` covers the first SSR pass).
    effect(() => {
      this.title.setTitle(`${this.copy().title} | FluxCommerce`);
    });
  }

  ngOnInit(): void {
    // First render flows through the session lifecycle owned by the
    // service constructor effect (standby → guest/authenticated) — no
    // explicit call here, so init cannot double-fire. Server pass stays
    // standby (browser-only inside the service).
    this.title.setTitle(`${this.copy().title} | FluxCommerce`);
  }

  /** Forwards a per-line quantity change to feature state (validated there). */
  protected onQuantityChange(change: CartLineQuantityChange): void {
    this.state.updateQuantity(change.variantId, change.quantity);
  }

  /** Forwards a per-line remove action to feature state. */
  protected onRemove(variantId: string): void {
    this.state.removeItem(variantId);
  }

  /** Forwards the clear-cart action to feature state. */
  protected onClear(): void {
    this.state.clearCart();
  }

  /** Re-enters the session lifecycle (recovers dead identities instead of refetching). */
  protected onRetry(): void {
    this.authCart.synchronize();
  }
}

/**
 * Formats backend money for a culture, or `null` when absent (rows hide)
 * or unformattable (never render broken money). Pure — throws nothing.
 */
function moneyText(money: CartMoney | null, culture: Culture): string | null {
  if (money === null) {
    return null;
  }
  return formatCurrency(money.amount, money.currency, culture) || null;
}
