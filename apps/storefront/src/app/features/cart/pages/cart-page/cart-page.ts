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
 *   recovers instead of refetching).
 * - Success feedback and focus repair (§7.8): a permanently rendered
 *   polite live region announces settled user-driven mutations
 *   (quantity/remove/clear — silent on first establish and on failures,
 *   which the error banner covers); removing or clearing controls moves
 *   focus to the items or page heading (both `tabindex="-1"`) since the
 *   focused controls unmount. Focus writes stay browser-only; the
 *   observer itself is SSR-safe signals only.
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
  ElementRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import type { ApiError } from '@flux/api';
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
import type { CartOperation } from '../../state/cart-state-structure';
import {
  hasBackendTotals,
  isValidCartQuantity,
  type Cart,
  type CartMoney,
} from '../../models/cart.models';
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Operation awaiting settle (`null` when quiescent). Registered
   * synchronously by the action handlers below — never observed from the
   * transient in-flight state, which synchronous settles skip over.
   * Plain field (never rendered); consumed on the next settle. Handler
   * guards mirror the state's (blank ids, invalid quantities never
   * register), and frozen/standby UI cannot reach the handlers, so a
   * registered intent always corresponds to a real request.
   */
  private pendingOperation: 'updateQuantity' | 'removeItem' | 'clear' | null = null;

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
      statusQuantityUpdated: translateCartKey(culture, CART_TRANSLATION_KEYS.statusQuantityUpdated),
      statusItemRemoved: translateCartKey(culture, CART_TRANSLATION_KEYS.statusItemRemoved),
      statusCartCleared: translateCartKey(culture, CART_TRANSLATION_KEYS.statusCartCleared),
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

  /**
   * Polite success announcement for screen readers (visually hidden —
   * the list change itself is the sighted feedback). Set on settled
   * user-driven mutations only: silent while in flight (cleared at
   * operation start so repeated messages re-announce), silent on the
   * first establish, silent on failures (the `role="alert"` error banner
   * covers those). Always rendered — live regions must exist before the
   * first announcement to be observed.
   */
  protected readonly announcement = signal<string | null>(null);

  constructor() {
    // Document title tracks the localized page title (runs on server and
    // client — `ngOnInit` covers the first SSR pass).
    effect(() => {
      this.title.setTitle(`${this.copy().title} | FluxCommerce`);
    });

    // Settle observer for success announcements and focus repair (runs on
    // server and client — DOM writes stay browser-guarded). Tracks the
    // operation, error, and data signals; everything else runs
    // `untracked` so settled responses can never reschedule it. The
    // one-at-a-time lock guarantees settles arrive one at a time.
    effect(() => {
      const operation = this.state.activeOperation();
      const error = this.state.error();
      const data = this.state.data();
      untracked(() => this.observeSettle(operation, error, data));
    });
  }

  /**
   * Observes one operation settle: announces successful user-driven
   * mutations and repairs focus when the focused controls unmounted
   * (remove/clear). Effect-timing safe: intent arrives synchronously
   * from the handlers (transient in-flight states are invisible to
   * effects when settles land synchronously), while this observer runs
   * post-render — so focus targets always exist when focused. Pure
   * signal reads — DOM writes stay browser-guarded inside.
   */
  private observeSettle(
    operation: CartOperation | null,
    error: ApiError | null,
    data: Cart | null,
  ): void {
    if (operation !== null) {
      // In-flight: clear the previous announcement so repeated messages
      // re-announce on the next settle. Intent is handler-owned.
      this.announcement.set(null);
      return;
    }
    const completed = this.pendingOperation;
    this.pendingOperation = null;
    if (completed === null || error !== null || data === null) {
      return;
    }
    switch (completed) {
      case 'updateQuantity':
        this.announcement.set(this.copy().statusQuantityUpdated);
        break;
      case 'removeItem':
        this.announcement.set(this.copy().statusItemRemoved);
        this.repairFocusAfterRemove(data.items.length > 0);
        break;
      case 'clear':
        this.announcement.set(this.copy().statusCartCleared);
        this.focusHeading('cart-page-title');
        break;
      default:
        break;
    }
  }

  /**
   * Moves focus after a remove settled: the removed line's controls
   * unmounted, so focus returns to the items heading while lines remain,
   * or to the page title when the cart emptied (empty state shows).
   * Browser-only (SSR never focuses); no-op when the target is absent.
   */
  private repairFocusAfterRemove(linesRemain: boolean): void {
    this.focusHeading(linesRemain ? 'cart-items-title' : 'cart-page-title');
  }

  /** Focuses a page heading by id (both carry `tabindex="-1"` — script focus only). */
  private focusHeading(id: string): void {
    if (!this.isBrowser) {
      return;
    }
    const target = this.host.nativeElement.querySelector(`#${id}`);
    if (target instanceof HTMLElement) {
      target.focus();
    }
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
    if (change.variantId.trim() === '' || !isValidCartQuantity(change.quantity)) {
      return;
    }
    this.pendingOperation = 'updateQuantity';
    this.state.updateQuantity(change.variantId, change.quantity);
  }

  /** Forwards a per-line remove action to feature state. */
  protected onRemove(variantId: string): void {
    if (variantId.trim() === '') {
      return;
    }
    this.pendingOperation = 'removeItem';
    this.state.removeItem(variantId);
  }

  /** Forwards the clear-cart action to feature state. */
  protected onClear(): void {
    this.pendingOperation = 'clear';
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
