/**
 * Cart capabilities seam for Refactoring Phase C — Cart Isolation.
 *
 * The single public contract of the cart feature. Cross-feature
 * consumers (checkout, product-details) depend ONLY on this file —
 * never on `cart/state`, `cart/models`, or `cart/data-access`
 * internals. Route composition roots additionally use
 * `provideCartCapabilities()` (next to this file) to install the
 * route-scoped implementation; pages and components inject
 * `CART_CAPABILITIES` only.
 *
 * Dependency direction (`ARCHITECTURE.md` §7 — cross-feature needs go
 * through a stable contract, never feature internals):
 *
 * ```text
 * checkout / product-details (pages, routes)
 *     ↓ CART_CAPABILITIES (this file — token + interfaces, erased at runtime)
 * cart (CartCapabilitiesService — sole implementation, route-provided)
 *     ↓ CartState / GuestCartService / AuthenticatedCartService (internals)
 *     ↓ CartApiService → ApiClient (@flux/api — the ONLY HttpClient user)
 * ```
 *
 * What travels here (and only this):
 * - Reader: the current cart resource (`cart`/`data`/`error` signals)
 *   plus an explicit `loadCart()` revalidation trigger. Snapshots only
 *   (`cartId`/`version`/line count via `@flux/models` `CartSnapshot`) —
 *   never lines or prices beyond the settled payload itself.
 * - Session: the guest identity signal plus the lifecycle triggers
 *   (`initializeGuest`, `synchronize`, `establishAuthenticated`).
 *   Identity establishment stays browser-guarded inside the
 *   implementation; the server pass is a standby no-op.
 * - The dead-guest-identity classifier below (moved from
 *   `GuestCartService` — pure, no dependencies): consumers healing for
 *   the next attempt branch on it instead of importing service
 *   internals.
 *
 * The cart feature stays the single owner of cart state, identity
 * lifecycle, persistence, merge transport, and totals discipline. This
 * file performs no HTTP, holds no state, and imports no cart
 * internals — token + interfaces + pure classifiers only, SSR-safe.
 */

import { InjectionToken, type Signal } from '@angular/core';
import type { Subscription } from 'rxjs';
import type { ApiError, ResourceState } from '@flux/api';
import type { CartResponse } from '@flux/models';
import type { CartIdentity, GuestCartIdentity } from './models/cart.models';

export type { CartIdentity, GuestCartIdentity };

/**
 * Backend codes proving a guest identity is dead (the stored `cartId`
 * names no usable cart). `Cart.CartNotFound` covers unknown or expired
 * carts; `Cart.CartAccessDenied` is the IDOR-masked denial for guessed
 * or foreign ids; `Cart.InvalidCartId` covers garbage ids.
 */
export const INVALID_GUEST_IDENTITY_CODES: readonly string[] = [
  'Cart.CartNotFound',
  'Cart.CartAccessDenied',
  'Cart.InvalidCartId',
];

/**
 * Whether a normalized failure proves the guest identity dead (→ drop
 * the stored id and recreate). Branches on the stable `code`, never on
 * message text (`ARCHITECTURE.md` §12). Pure — throws nothing.
 */
export function isInvalidGuestIdentityError(error: ApiError | null | undefined): boolean {
  if (error?.code === undefined) {
    return false;
  }
  return (INVALID_GUEST_IDENTITY_CODES as readonly string[]).includes(error.code);
}

/**
 * Read-only cart capabilities consumed across features. Implemented
 * once by the cart feature (`CartCapabilitiesService`, route-provided
 * next to the real cart services); injected everywhere else through
 * `CART_CAPABILITIES`.
 */
export interface CartCapabilities {
  /** Current cart resource (`idle → loading → success | empty | error`). */
  readonly cart: Signal<ResourceState<CartResponse>>;
  /** Settled cart payload, if any. */
  readonly data: Signal<CartResponse | null>;
  /** Normalized cart failure, if any. */
  readonly error: Signal<ApiError | null>;
  /**
   * Revalidates the cart for the current identity (explicit user or
   * recovery action — never polled). With no identity established the
   * call is ignored and state stays idle.
   */
  loadCart(): Subscription;

  /** Guest identity (`null` until established — anonymous sessions only). */
  readonly guestIdentity: Signal<CartIdentity | null>;
  /**
   * Establishes the guest lifecycle (browser-only no-op on the server)
   * for the next attempt. Never sends a doomed request itself.
   */
  initializeGuest(): Subscription;
  /**
   * Re-enters the authenticated session lifecycle (current-cart
   * resolution plus guest → authenticated merge upstream). First render
   * and error retry drive this — never loops by itself.
   */
  synchronize(): Subscription;
  /**
   * Heals a missing authenticated cart (`Cart.CartNotFound` verdict)
   * for the next attempt. Other failures stay with the caller.
   */
  establishAuthenticated(): Subscription;
}

/** Injection token for the route-provided cart capabilities. */
export const CART_CAPABILITIES = new InjectionToken<CartCapabilities>('CartCapabilities');
