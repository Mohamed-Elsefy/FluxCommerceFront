/**
 * Storefront Cart feature models for Sub-Phase 7.1 — Cart Contracts &
 * Feature Foundation.
 *
 * Scope: `docs/phases/PHASE_7_SHOPPING_CART.md` §7.1 (contracts and
 * boundaries only — no API integration, no state implementation, no UI).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §3 and
 * `docs/frontend-contract/DTO_REFERENCE.md` §3
 * (`FluxCommerce.Modules.Cart.Contracts` records). Every cart endpoint
 * returns `ApiResponse<CartResponse>`; cart lines carry NO `lineTotal`
 * and the cart carries NO totals object — unit prices are backend-issued
 * per-line snapshots and checkout reprices authoritatively server-side
 * (`API_CONTRACT.md` Appendix B.3).
 *
 * Backend-authoritative totals rule (this sub-phase's core constraint):
 * `CartTotals` below carries counts plus money slots that are populated
 * ONLY from backend-issued values. This module provides NO price or total
 * computation — no `unitPrice * quantity`, no subtotal/total summation,
 * no float-math money helpers. Money slots stay `null` until a backend
 * totals source provides them (mapped in Sub-Phase 7.2+, never derived
 * here).
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - Contract mirrors live in `@flux/models` and stay the single
 *   declaration site — `Cart`/`CartItem` are aliases, never re-declared,
 *   so no contract drift is possible.
 * - This module owns the storefront-readable view types (`CartTotals`,
 *   product/variant summaries), the Guest vs Authenticated identity
 *   distinction (shape only — no persistence), and pure structural
 *   helpers (emptiness, counts, currency reads, ownership guards).
 *   Envelope mapping and fetching live in `state/` and `data-access/`
 *   (later sub-phases).
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 7.2 — no API client/service, no `HttpClient`, no envelope mapping.
 * - 7.3 — no SignalStore/signals state implementation (shapes only, see
 *   `../state/cart-state-structure`).
 * - 7.4 — no pages, no components, no routes.
 * - 7.5/7.7 — no guest persistence (`localStorage`), no merge wiring.
 * - Phase 8 — no checkout, payment, or order logic.
 */

import type { CartItemResponse, CartResponse } from '@flux/models';

/**
 * Cart read model (every cart endpoint returns
 * `ApiResponse<CartResponse>`). Re-exported — not re-declared — so the
 * backend shape stays canonical.
 */
export type Cart = CartResponse;

/**
 * Cart line read model (`CartItemResponse`: `productId`/`variantId`/`sku`/
 * `productName`/`unitPriceAmount`/`currency`/`quantity`, no `lineTotal`).
 * Re-exported, not re-declared.
 */
export type CartItem = CartItemResponse;

/**
 * Product summary carried by a cart line: the display-facing product
 * fields only. Projected from a backend-issued line — never fabricated.
 */
export interface CartItemProductSummary {
  readonly productId: string;
  readonly productName: string;
}

/**
 * Variant summary carried by a cart line: the display-facing variant
 * fields only. Projected from a backend-issued line — never fabricated.
 */
export interface CartItemVariantSummary {
  readonly variantId: string;
  readonly sku: string;
}

/**
 * Projects the product summary out of a cart line. Pure — throws
 * nothing, performs no HTTP, computes no prices.
 */
export function toCartItemProductSummary(item: CartItem): CartItemProductSummary {
  return { productId: item.productId, productName: item.productName };
}

/**
 * Projects the variant summary out of a cart line. Pure — throws
 * nothing, performs no HTTP, computes no prices.
 */
export function toCartItemVariantSummary(item: CartItem): CartItemVariantSummary {
  return { variantId: item.variantId, sku: item.sku };
}

/**
 * Backend-issued money snapshot (mirrors the `OrderMoneyResponse`
 * `{ amount, currency }` shape used by Orders). Values are assigned only
 * from backend responses — never computed locally.
 */
export interface CartMoney {
  readonly amount: number;
  readonly currency: string;
}

/**
 * Storefront cart totals view model.
 *
 * - `itemCount` / `distinctItemCount` are structural counts derived from
 *   backend-issued lines (quantities and line presence, never prices).
 * - `currency` echoes the backend-issued line currency when the cart is
 *   single-currency, otherwise `null` (mixed-currency carts are rejected
 *   at checkout per `API_CONTRACT.md` §4 — detection, not resolution,
 *   lives here).
 * - `subtotal` / `total` are backend-authoritative money slots. The cart
 *   contract exposes NO totals object, so both stay `null` until a
 *   backend totals source provides them (Sub-Phase 7.2+ mapping). There
 *   is deliberately NO helper in this module that fills them from
 *   `unitPriceAmount * quantity`.
 */
export interface CartTotals {
  readonly itemCount: number;
  readonly distinctItemCount: number;
  readonly currency: string | null;
  readonly subtotal: CartMoney | null;
  readonly total: CartMoney | null;
}

/**
 * Empty totals fallback: zero counts, unknown currency, and no
 * backend-issued money. Pure — performs no HTTP and computes no prices.
 */
export function emptyCartTotals(): CartTotals {
  return { itemCount: 0, distinctItemCount: 0, currency: null, subtotal: null, total: null };
}

/**
 * Whether backend-issued money is present on a totals view. In
 * Sub-Phase 7.1 this is always `false` for freshly built views (money
 * arrives only via later backend mapping) — the guard exists so
 * consumers never mistake absent totals for zero totals. Pure.
 */
export function hasBackendTotals(totals: CartTotals | null | undefined): boolean {
  return totals?.subtotal !== null && totals?.subtotal !== undefined;
}

/**
 * Minimum cart line quantity. Mirrors the contract's cart quantity floor
 * (`[Range(1, int.MaxValue)]` on every cart item request —
 * `API_CONTRACT.md` §3): the storefront accepts nothing below this, and
 * clamps nothing above it (over-limit quantities are a backend
 * `QuantityLimitExceeded` rejection at cart time).
 */
export const MIN_CART_QUANTITY = 1;

/**
 * Whether `value` is a submittable cart quantity: an integer of at least
 * `MIN_CART_QUANTITY`. Rejects negatives, zero, decimals, `NaN`, and
 * non-finite values. Structural pre-check only — not business logic.
 * Pure — throws nothing.
 */
export function isValidCartQuantity(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_CART_QUANTITY;
}

/**
 * Parses raw quantity textbox text into a cart quantity: digits-only
 * (after trimming) mapping to a valid quantity, otherwise `null`.
 * Rejects empty text, signs, decimals, and any non-digit characters —
 * so invalid keystrokes never reach feature state. Consumed by the
 * §7.4 quantity control. Pure — throws nothing.
 */
export function parseCartQuantityInput(text: string | null | undefined): number | null {
  if (text === null || text === undefined) {
    return null;
  }
  const candidate = text.trim();
  if (!/^[0-9]+$/.test(candidate)) {
    return null;
  }
  const parsed = Number.parseInt(candidate, 10);
  return isValidCartQuantity(parsed) ? parsed : null;
}

/**
 * Whether a cart holds no lines. `null`/`undefined` carts count as
 * empty (nothing loaded is nothing to render). Pure — throws nothing.
 */
export function isCartEmpty(cart: Cart | null | undefined): boolean {
  return !cart || cart.items.length === 0;
}

/**
 * Emptiness predicate for `loadResourceState` (`isEmpty` option): a
 * settled cart with zero lines resolves to the `empty` resource status.
 * Pure — throws nothing.
 */
export function isEmptyCartData(cart: Cart): boolean {
  return cart.items.length === 0;
}

/**
 * Total unit count across all lines (sum of backend-issued quantities).
 * A count — never money math: prices are not read here. Guards against
 * non-finite values so malformed lines cannot poison the count. Pure —
 * throws nothing.
 */
export function getCartItemCount(cart: Cart | null | undefined): number {
  if (!cart) {
    return 0;
  }
  return cart.items.reduce((count, item) => {
    const quantity = Number.isInteger(item.quantity) ? item.quantity : 0;
    return count + Math.max(0, quantity);
  }, 0);
}

/**
 * Distinct line count (`items.length`). Pure — throws nothing.
 */
export function getCartDistinctItemCount(cart: Cart | null | undefined): number {
  return cart?.items.length ?? 0;
}

/**
 * Reads the cart currency from backend-issued lines: the single currency
 * when every line agrees, otherwise `null` (empty cart or mixed
 * currencies). A read — never a computation over amounts. Pure — throws
 * nothing.
 */
export function resolveCartCurrency(cart: Cart | null | undefined): string | null {
  const currencies = new Set((cart?.items ?? []).map((item) => item.currency));
  return currencies.size === 1 ? [...currencies][0] : null;
}

/**
 * Whether the cart mixes backend-issued currencies (checkout rejects
 * these with `CurrencyMismatch` — `API_CONTRACT.md` §4). Detection only:
 * this helper never converts or reconciles amounts. Pure — throws
 * nothing.
 */
export function hasMixedCartCurrencies(cart: Cart | null | undefined): boolean {
  return (
    (cart?.items.length ?? 0) > 0 &&
    new Set((cart?.items ?? []).map((item) => item.currency)).size > 1
  );
}

/**
 * Whether the payload is a guest cart per backend flags. Null-safe —
 * missing payloads are not guest carts. Pure — throws nothing.
 */
export function isGuestCart(cart: Cart | null | undefined): boolean {
  return cart?.isGuest === true;
}

/**
 * Whether the payload is an authenticated cart per backend flags.
 * Null-safe. Pure — throws nothing.
 */
export function isAuthenticatedCart(cart: Cart | null | undefined): boolean {
  return cart?.isAuthenticated === true;
}

/** Cart ownership context (identity only — no persistence, no merge). */
export type CartOwner = 'guest' | 'authenticated';

/**
 * Guest cart identity: the backend-issued opaque `cartId` carried in
 * guest route templates (`/cart/guest/{cartId}…`). The `cartId` value
 * originates from `POST /cart/guest` — it is never fabricated here, and
 * its storage lifecycle belongs to Sub-Phase 7.5 (explicitly not here).
 */
export interface GuestCartIdentity {
  readonly kind: 'guest';
  readonly cartId: string;
}

/**
 * Authenticated cart identity: the server resolves the cart from the
 * JWT user, so no id travels in the route (`/cart…`). There is nothing
 * to store — identity is the session itself.
 */
export interface AuthenticatedCartIdentity {
  readonly kind: 'authenticated';
}

/**
 * Cart identity distinction for Sub-Phase 7.1: shape only. Guest means
 * "a backend-issued `cartId` names the cart"; authenticated means "the
 * JWT session names the cart". Persistence, refresh behavior, and merge
 * triggering arrive in Sub-Phases 7.5/7.7.
 */
export type CartIdentity = GuestCartIdentity | AuthenticatedCartIdentity;

/**
 * Whether an identity is the guest variant. Pure — throws nothing.
 */
export function isGuestCartIdentity(identity: CartIdentity | null | undefined): boolean {
  return identity?.kind === 'guest';
}

/**
 * Whether an identity is the authenticated variant. Pure — throws
 * nothing.
 */
export function isAuthenticatedCartIdentity(identity: CartIdentity | null | undefined): boolean {
  return identity?.kind === 'authenticated';
}

/**
 * Builds a guest identity from a backend-issued `cartId`. Returns `null`
 * for missing/blank ids (an unusable identity must never be
 * constructed). Performs no storage — persistence belongs to
 * Sub-Phase 7.5. Pure — throws nothing.
 */
export function createGuestCartIdentity(
  cartId: string | null | undefined,
): GuestCartIdentity | null {
  if (cartId === null || cartId === undefined || cartId.trim() === '') {
    return null;
  }
  return { kind: 'guest', cartId: cartId.trim() };
}

/**
 * Resolves cart ownership from backend flags: `isGuest` wins when set,
 * otherwise `isAuthenticated`; `null` when neither flag is set (a
 * contract violation the caller surfaces as an error, never guesses
 * past). Pure — throws nothing.
 */
export function getCartOwner(cart: Cart | null | undefined): CartOwner | null {
  if (cart?.isGuest === true) {
    return 'guest';
  }
  if (cart?.isAuthenticated === true) {
    return 'authenticated';
  }
  return null;
}
