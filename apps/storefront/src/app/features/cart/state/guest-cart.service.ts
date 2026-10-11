/**
 * Guest cart lifecycle for Sub-Phase 7.5 — Guest Cart.
 *
 * Scope: `docs/phases/PHASE_7_SHOPPING_CART.md` §7.5 (guest identity
 * lifecycle only — no authenticated flows, no merge wiring, no UI).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §3 (guest =
 * `AllowAnonymous` + opaque `cartId` in the route, "persist in
 * localStorage") and `docs/frontend-contract/ERROR_CATALOG.md` (cart
 * error codes).
 *
 * Responsibility split (each layer owns one concern):
 *
 * ```text
 * GuestCartService (this file — WHEN: bootstrap + expiration recovery)
 *     ↓ CartState (WHAT the cart holds — slot, identity, transitions)
 *     ↓ GuestCartStorageService (WHERE the opaque id rests — bookmark only)
 *     ↓ CartApiService (HOW the backend is reached — §7.2 transport)
 * ```
 *
 * - This service holds no cart data (it reads `CartState` signals) and
 *   performs no HTTP (all transport runs through `CartState`, which is
 *   the only `CartApiService` consumer here). It decides WHEN identity
 *   is established or re-established; the backend decides WHAT the cart
 *   contains.
 * - Identity persistence is the opaque `cartId` string only — never cart
 *   contents (that would be the independent frontend persistence §7.5
 *   forbids). Storage failures degrade to repeat creation, never to a
 *   crash.
 * - Expiration/invalidation is the backend's verdict: only the
 *   identity-invalid codes below (`Cart.CartNotFound` for unknown or
 *   expired carts, masked `Cart.CartAccessDenied`, `Cart.InvalidCartId`
 *   for garbage ids) drop the dead id and recreate. Item-level
 *   (`Cart.CartItemNotFound`), concurrency (`409`), transport, and
 *   validation failures surface untouched in the slot — a network blip
 *   must never nuke a valid stored identity.
 * - SSR-safe: initialization is browser-only (`isPlatformBrowser`) — the
 *   server renders the standby shell and the client establishes identity
 *   after hydration. Creating guest carts during server rendering would
 *   issue server-side carts whose ids are immediately lost.
 * - Quiescence: initialization never disturbs in-flight work (the §7.3
 *   one-at-a-time lock is respected — switch while quiescent). Recovery
 *   is single-shot per dead identity: it runs only from the load path
 *   that observed the verdict, so a persistently failing backend cannot
 *   loop (every retry is an explicit `initialize` call, e.g. page retry).
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 7.6 — no authenticated identity, no auth-state inspection, no
 *   session-driven transitions.
 * - 7.7 — no merge triggering or merge-effect guards (`mergeCart` stays
 *   transport-only in `CartState`).
 * - Phase 8 — no checkout, payment, or order logic.
 */

import { Injectable, PLATFORM_ID, inject, type Signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import type { ApiError } from '@flux/api';
import { CartState, type CartActionOptions } from './cart-state';
import { GUEST_CART_STORAGE } from './guest-cart-storage.service';
import type { CartIdentity } from '../models/cart.models';

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
 * Whether a normalized failure is a codeless `404` (the real wire shape
 * for missing resources — business errors carry no `extensions.code`,
 * only `detail`). Used alongside `isInvalidGuestIdentityError` on paths
 * where the endpoint makes `404` unambiguous (unknown guest cart,
 * unknown merge source, no active auth cart): a present code keeps its
 * documented meaning (so e.g. a coded item-level `404` still does not
 * recover), while a missing code falls back to `status` — exactly the
 * "branch on `code` when present and on `status` otherwise" rule the
 * error normalizer documents. Branches on `status`, never on message
 * text. Pure — throws nothing.
 */
export function isMissingResourceError(error: ApiError | null | undefined): boolean {
  return error?.status === 404 && error?.code === undefined;
}

/**
 * Feature-scoped guest cart lifecycle. Provide at the cart route level
 * next to `CartState` — never at root. The owning page drives
 * `initialize()` on first render and on error retry; mutations stay on
 * `CartState` directly (7.4 wiring, unchanged).
 */
@Injectable()
export class GuestCartService {
  private readonly state = inject(CartState);
  private readonly storage = inject(GUEST_CART_STORAGE);
  private readonly isBrowser: boolean;

  /**
   * Current cart identity (`null` before establishment). Read-only
   * passthrough of the owned `CartState` identity — the stable seam for
   * cross-feature consumers (e.g. product-details gates its guest
   * add-to-cart affordance on guest readiness): readers observe WHEN
   * identity exists; establishment and transitions stay in
   * `initialize()`/recovery here, and cart contents stay in `CartState`.
   */
  readonly identity: Signal<CartIdentity | null> = this.state.identity;

  constructor() {
    this.isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  }

  /**
   * Bootstraps the guest cart for the current route instance:
   * - No stored id → creates the guest cart (`POST /cart/guest`),
   *   adopts the backend-issued identity, and persists the issued id
   *   once the creation settles.
   * - Stored id → establishes it and loads (`GET /cart/guest/{id}`);
   *   when the load settles with an identity-invalid verdict, the dead
   *   id is dropped and a fresh cart is created (single-shot — the
   *   recovery runs only for the identity this call attempted).
   * - Server platform or in-flight operation → ignored (`EMPTY`):
   *   SSR renders the standby shell, and in-flight work is never
   *   disturbed. Re-calling while settled simply reloads (page retry).
   */
  initialize(options: CartActionOptions = {}): Subscription {
    if (!this.isBrowser || this.state.activeOperation() !== null) {
      return Subscription.EMPTY;
    }
    const stored = this.storage.loadGuestCartId();
    if (stored === null) {
      return this.createFreshGuestCart(options);
    }
    this.state.setIdentity({ kind: 'guest', cartId: stored });
    const load = this.state.loadCart(options);
    // The backend verdict arrives asynchronously: when the load settles,
    // an identity-invalid code means the stored id is dead → recreate.
    // (Teardown runs on settle, completion, or early unsubscribe; the
    // recovery itself re-checks quiescence and identity, so stray runs
    // are no-ops.)
    load.add(() => this.recoverIfIdentityInvalid(options, stored));
    return load;
  }

  /**
   * Drops a dead guest identity and creates a fresh cart — only when the
   * slot still holds the attempted identity, the settled failure proves
   * it dead, and no operation is in flight. All other failures surface
   * untouched for the page error state.
   */
  private recoverIfIdentityInvalid(options: CartActionOptions, attemptedCartId: string): void {
    const identity = this.state.identity();
    if (identity?.kind !== 'guest' || identity.cartId !== attemptedCartId) {
      return;
    }
    const error = this.state.error();
    if (!isInvalidGuestIdentityError(error) && !isMissingResourceError(error)) {
      return;
    }
    if (!this.isBrowser || this.state.activeOperation() !== null) {
      return;
    }
    this.storage.clearGuestCartId();
    this.createFreshGuestCart(options);
  }

  /**
   * Creates the guest cart through feature state and persists the
   * backend-issued id once the creation settles. Creation failures stay
   * in the slot for the page error state (there is no dead id to clear —
   * this path runs only with no usable stored id).
   */
  private createFreshGuestCart(options: CartActionOptions): Subscription {
    const creation = this.state.createGuestCart(options);
    // Teardown runs on settle; persisting the settled id re-anchors
    // storage to the displayed cart (idempotent, self-healing).
    creation.add(() => {
      if (!this.isBrowser) {
        return;
      }
      const cart = this.state.data();
      if (cart !== null) {
        this.storage.saveGuestCartId(cart.cartId);
      }
    });
    return creation;
  }
}
