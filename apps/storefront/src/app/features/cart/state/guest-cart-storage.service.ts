/**
 * Guest cart identity storage for Sub-Phase 7.5 — Guest Cart.
 *
 * Scope: `docs/phases/PHASE_7_SHOPPING_CART.md` §7.5 (guest identity
 * persistence only — no state implementation, no UI, no merge wiring).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §3 (guest =
 * `AllowAnonymous` + opaque `cartId` in the route, "persist in
 * localStorage") and §3.3 ("guest keeps `cartId` in localStorage").
 *
 * What is persisted vs what stays backend-authoritative (same convention
 * as `TokenStorageService`, Phase 2.3):
 * - Persisted: ONLY the opaque backend-issued `cartId` string — the
 *   identity reference naming the guest cart in route templates
 *   (`/cart/guest/{cartId}…`). It originates from `POST /cart/guest`
 *   and is never fabricated here.
 * - Never persisted: cart contents, lines, quantities, prices, or totals.
 *   The backend response remains the single source of truth after every
 *   transition (`CartState`); this store is an identity bookmark, not a
 *   cart cache. Storing cart contents here would be the independent
 *   frontend persistence mechanism §7.5 forbids.
 * - No backend storage details: the id is opaque — this file knows
 *   nothing of Redis, TTLs, or expiry bookkeeping. Expiry is the
 *   backend's verdict (`404 Cart.CartNotFound` → the 7.5 lifecycle
 *   drops the dead id and creates a fresh cart in `guest-cart.service`).
 *
 * Hard rules enforced below (same as `TokenStorageService`): every
 * browser-API access is platform-guarded (server: reads → `null`,
 * writes → no-op, so SSR renders the standby shell) and exception-safe
 * (private-mode denials, quota errors, blank/corrupt entries degrade to
 * no-op/null — startup must never crash); nothing here logs or exposes
 * the stored id. Reads are lenient (any non-blank string): a garbage id
 * is the backend's verdict (`400 Cart.InvalidCartId` → recovery), not a
 * reason to invent frontend-side id syntax rules.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 7.6 — no authenticated identity, no auth-state inspection.
 * - 7.7 — no merge triggering or merge-effect guards.
 * - Phase 8 — no checkout, payment, or order logic.
 */

import { Injectable, InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Versioned key isolating the guest cart id from every other local entry. */
export const GUEST_CART_STORAGE_KEY = 'fluxcommerce.cart.guest-cart-id.v1';

/**
 * Guest cart identity storage abstraction. Platform behavior is an
 * implementation detail: callers use these three lifecycle operations
 * and stay SSR-agnostic.
 */
export interface GuestCartStorage {
  /**
   * Reads the persisted guest `cartId`, or `null` when absent (server
   * platform, first visit, post-recovery) or blank (cleared as a side
   * effect). Never throws.
   */
  loadGuestCartId(): string | null;
  /**
   * Persists the backend-issued guest `cartId` (creation path).
   * Overwrites any existing entry. Blank ids are refused (no-op).
   * No-op on the server. Never throws.
   */
  saveGuestCartId(cartId: string): void;
  /**
   * Removes the persisted guest `cartId` (expiration recovery:
   * the backend verdict proved the id dead). Idempotent. Never throws.
   */
  clearGuestCartId(): void;
}

/**
 * SSR-safe `localStorage` implementation. Every method guards on
 * `isPlatformBrowser` first and then on `try/catch`, so startup and
 * recovery never crash.
 */
@Injectable({ providedIn: 'root' })
export class GuestCartStorageService implements GuestCartStorage {
  private readonly isBrowser: boolean;

  constructor() {
    this.isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  }

  loadGuestCartId(): string | null {
    if (!this.isBrowser) {
      return null;
    }
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(GUEST_CART_STORAGE_KEY);
    } catch {
      return null;
    }
    if (raw === null) {
      return null;
    }
    const cartId = parseStoredGuestCartId(raw);
    if (cartId === null) {
      this.clearGuestCartId();
    }
    return cartId;
  }

  saveGuestCartId(cartId: string): void {
    const parsed = parseStoredGuestCartId(cartId);
    if (!this.isBrowser || parsed === null) {
      return;
    }
    try {
      window.localStorage.setItem(GUEST_CART_STORAGE_KEY, parsed);
    } catch {
      // Storage unavailable or full: the guest cart simply does not
      // survive reloads; the settled backend cart still renders.
    }
  }

  clearGuestCartId(): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      window.localStorage.removeItem(GUEST_CART_STORAGE_KEY);
    } catch {
      // Removal failure leaves at most a stale entry, which the backend
      // verdict (404/400 recovery) treats as dead on the next visit.
    }
  }
}

/**
 * DI seam for the storage abstraction. Defaults to the platform-guarded
 * `GuestCartStorageService`; tests override with fakes without touching
 * `localStorage`.
 */
export const GUEST_CART_STORAGE = new InjectionToken<GuestCartStorage>('GUEST_CART_STORAGE', {
  providedIn: 'root',
  factory: () => inject(GuestCartStorageService),
});

/**
 * Trims a raw storage entry; `null` for blank entries (absent ids must
 * never be constructed — see `createGuestCartIdentity`). Lenient by
 * design: id syntax is the backend's verdict, not a frontend rule.
 */
function parseStoredGuestCartId(raw: string): string | null {
  const cartId = raw.trim();
  return cartId === '' ? null : cartId;
}
