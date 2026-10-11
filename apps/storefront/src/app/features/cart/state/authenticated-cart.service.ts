/**
 * Authenticated cart lifecycle for Sub-Phase 7.6 — Authenticated Cart —
 * plus the Sub-Phase 7.7 Guest → Login → Cart Merge trigger.
 *
 * Scope: `docs/phases/PHASE_7_SHOPPING_CART.md` §§7.6/7.7 (auth-driven
 * identity lifecycle and merge triggering only — no merge algorithm, no
 * UI).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §3
 * (authenticated = JWT user, no id in the route; `POST /cart`
 * get-or-create returns the existing cart or creates one; `GET /cart`
 * `404`s with no active cart) and `ERROR_CATALOG.md` (`Cart.CartNotFound`
 * for `GET /cart` with no active cart).
 *
 * Responsibility split (each layer owns one concern):
 *
 * ```text
 * AuthenticatedCartService (this file — WHEN identity follows the session)
 *     ↓ GuestCartService (7.5 — anonymous branch, delegated, never reimplemented)
 *     ↓ CartState (WHAT the cart holds — slot, identity, transitions)
 *     ↓ CartApiService (HOW the backend is reached — §7.2 transport)
 * ```
 *
 * - This service holds no cart data (it reads `CartState` signals) and
 *   performs no HTTP (all transport runs through `CartState`). It decides
 *   WHEN the authenticated identity is established; the backend decides
 *   WHAT the cart contains.
 * - Session-driven, not page-driven: the constructor effect tracks
 *   `AuthService.status` and re-synchronizes on every login, logout, and
 *   session restoration — each route instance reacts wherever the user
 *   happens to be. Pages additionally call `synchronize()` on init and
 *   error retry (double entry is safe: the second call meets the
 *   quiescence guard below and returns `EMPTY`).
 * - Transitions (`setIdentity`): adopting the authenticated identity
 *   resets the slot, so guest lines can never render under, mix with, or
 *   survive into the authenticated view — the §7.6 no-mixing rule. The
 *   STORED guest `cartId` is deliberately left untouched: it is the
 *   Sub-Phase 7.7 merge input, not active state (clearing it here would
 *   strand the merge). Conversely, logout re-enters the guest flow, which
 *   reloads that stored cart — pre-login continuity until 7.7 merges.
 * - Establishment is GET-first (`GET /cart`), falling back to
 *   get-or-create (`POST /cart`) only on the settled `Cart.CartNotFound`
 *   verdict (single-shot, same teardown pattern as the 7.5 recovery).
 *   Nothing is persisted locally: backend persistence owns refreshes —
 *   after a reload, session restoration re-authenticates and the effect
 *   reloads the cart from the backend.
 * - Merge (7.7) fires from the same synchronize path whenever the
 *   session is authenticated AND a stored guest id exists — covering
 *   both the login transition and the post-login mount (the common path:
 *   login happens off-route, then navigation remounts already
 *   authenticated). The stored id is the ONLY trigger condition — there
 *   is deliberately no client-side emptiness gate: the backend merge is
 *   authoritative and empty merges are server-side no-ops, while a
 *   client eligibility check would be the custom merge orchestration §7.7
 *   forbids. Identity is adopted BEFORE the merge posts, so the merged
 *   cart lands under the authenticated identity with no reset after.
 *   Success clears the local bookmark (the source died server-side);
 *   dead-source verdicts (`Cart.CartNotFound`, masked
 *   `Cart.CartAccessDenied`, `Cart.InvalidCartId` — the same set as the
 *   7.5 recovery) clear it and fall back to establishment; all other
 *   failures surface with the bookmark preserved, so page retry
 *   re-merges instead of refetching. Duplicate merges are prevented at
 *   three levels: the effect fires once per auth transition, the
 *   quiescence lock serializes overlapping synchronizes, and success
 *   removes the trigger condition itself.
 * - SSR-safe: server-side synchronization is a no-op (the standby shell
 *   renders; the client establishes after hydration). Creating or loading
 *   carts during server rendering would issue unreachable server-side
 *   carts.
 * - Quiescence: synchronization never disturbs in-flight work (the §7.3
 *   one-at-a-time lock is respected — switch while quiescent). Accepted
 *   edge: a login landing mid-request skips the switch (a late guest
 *   response must never land in the authenticated slot); the next
 *   explicit `synchronize` (navigation, retry) completes it. Logins
 *   normally navigate and remount, so this path is near-unreachable.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - Phase 8 — no checkout, payment, or order logic. (The 7.7 merge
 *   algorithm itself lives backend-side — atomic Lua merge, duplicate
 *   handling, and consistency are never implemented here.)
 */

import { Injectable, PLATFORM_ID, effect, inject, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { AuthService } from '@flux/auth';
import { CartState, type CartActionOptions } from './cart-state';
import { GUEST_CART_STORAGE } from './guest-cart-storage.service';
import {
  GuestCartService,
  isInvalidGuestIdentityError,
  isMissingResourceError,
} from './guest-cart.service';

/**
 * Feature-scoped authenticated cart lifecycle. Provide at the cart route
 * level next to `CartState`/`GuestCartService` — never at root. Pages
 * drive `synchronize()` on first render and error retry; auth transitions
 * drive themselves through the constructor effect.
 */
@Injectable()
export class AuthenticatedCartService {
  private readonly auth = inject(AuthService);
  private readonly state = inject(CartState);
  private readonly guests = inject(GuestCartService);
  private readonly storage = inject(GUEST_CART_STORAGE);
  private readonly isBrowser: boolean;

  constructor() {
    this.isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    // Session-driven identity: re-synchronize on every login, logout,
    // and restoration. The effect depends on the auth status alone —
    // cart signals are read `untracked` so settled responses can never
    // reschedule it (same discipline as the product-details page loads).
    // Disposed automatically with the route injector.
    effect(() => {
      this.auth.status();
      untracked(() => this.synchronize());
    });
  }

  /**
   * Synchronizes cart identity with the settled session:
   * - Restoration pending (`initializing`) → ignored (`EMPTY`): standby
   *   renders until the session decision lands, then the effect refires.
   * - Authenticated → establishes the authenticated cart (existing or
   *   get-or-created).
   * - Anonymous → delegates to the guest lifecycle (create/load/recover).
   * In-flight work is never disturbed (returns `EMPTY` instead).
   */
  synchronize(options: CartActionOptions = {}): Subscription {
    if (!this.isBrowser || !this.auth.initialized() || this.state.activeOperation() !== null) {
      return Subscription.EMPTY;
    }
    if (this.auth.isAuthenticated()) {
      return this.establishAuthenticated(options);
    }
    return this.guests.initialize(options);
  }

  /**
   * Establishes the authenticated cart for the current session.
   *
   * With a stored guest id → merges it (`POST /cart/merge`, backend
   * atomic merge + source clear): the authenticated identity is adopted
   * FIRST so the merged cart lands under it with no reset after, and the
   * local bookmark is cleared on success (or on dead-source verdicts,
   * with fallback to establishment below).
   *
   * Without one → adopts the authenticated identity (resetting the slot —
   * guest data never survives the switch) and loads (`GET /cart`). When
   * the load settles with `Cart.CartNotFound` (no active cart yet), falls
   * back to get-or-create (`POST /cart`) once. Other failures surface in
   * the slot for the page error state.
   */
  establishAuthenticated(options: CartActionOptions = {}): Subscription {
    if (!this.isBrowser || this.state.activeOperation() !== null) {
      return Subscription.EMPTY;
    }
    const guestId = this.storage.loadGuestCartId();
    this.state.setIdentity({ kind: 'authenticated' });
    if (guestId === null) {
      return this.loadAuthenticated(options);
    }
    const merge = this.state.mergeCart(guestId, options);
    // The backend verdict arrives asynchronously: success adopts the
    // merged cart (bookmark cleared — the source died server-side);
    // dead-source verdicts clear it and fall back to establishment;
    // other failures surface with the bookmark preserved for retry.
    merge.add(() => this.afterMerge(options));
    return merge;
  }

  /**
   * Loads the authenticated cart (`GET /cart`) for the adopted identity.
   * Single-shot get-or-create fallback on the settled no-active-cart
   * verdict lives in `recoverIfNoAuthCart`.
   */
  private loadAuthenticated(options: CartActionOptions): Subscription {
    const load = this.state.loadCart(options);
    load.add(() => this.recoverIfNoAuthCart(options));
    return load;
  }

  /**
   * Settles a merge attempt: success clears the local bookmark (landed
   * data proves the merge ran); dead-source verdicts clear it and fall
   * back to establishment; anything else (including aborts, which leave
   * no data and no error) leaves slot and bookmark for explicit retry.
   * Stale teardowns (identity moved on — e.g. logout mid-merge) are
   * no-ops.
   */
  private afterMerge(options: CartActionOptions): void {
    if (this.state.identity()?.kind !== 'authenticated') {
      return;
    }
    const error = this.state.error();
    if (error === null) {
      if (this.state.data() !== null) {
        this.storage.clearGuestCartId();
      }
      return;
    }
    // Dead merge source: the contract 404 (guest cart must exist) arrives
    // codeless on the real wire, so a bare 404 on this endpoint counts too.
    if (!isInvalidGuestIdentityError(error) && !isMissingResourceError(error)) {
      return;
    }
    if (!this.isBrowser || this.state.activeOperation() !== null) {
      return;
    }
    this.storage.clearGuestCartId();
    this.loadAuthenticated(options);
  }

  /**
   * Falls back to get-or-create — only when the slot still holds the
   * authenticated identity, the settled failure is the no-active-cart
   * verdict (coded or codeless `404` — `GET /cart` 404s exactly then),
   * and no operation is in flight.
   */
  private recoverIfNoAuthCart(options: CartActionOptions): void {
    if (this.state.identity()?.kind !== 'authenticated') {
      return;
    }
    const error = this.state.error();
    if (error?.code !== 'Cart.CartNotFound' && !isMissingResourceError(error)) {
      return;
    }
    if (!this.isBrowser || this.state.activeOperation() !== null) {
      return;
    }
    this.state.ensureAuthenticatedCart(options);
  }
}
