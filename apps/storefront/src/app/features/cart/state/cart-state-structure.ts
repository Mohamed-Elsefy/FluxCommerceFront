/**
 * Storefront Cart feature state boundary for Sub-Phase 7.1 — Cart
 * Contracts & Feature Foundation.
 *
 * Scope: `docs/phases/PHASE_7_SHOPPING_CART.md` §7.1 (state structure
 * only — shapes, lifecycle, and identity, no implementation).
 *
 * State strategy (`ARCHITECTURE.md` §9 — smallest appropriate scope):
 *
 * ```text
 * CartPage (7.4 — not this sub-phase)
 *     ↓ CartState (7.3 — not this sub-phase; feature-owned, local Signals)
 *     ↓ CartApiService (7.2 — not this sub-phase; feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Cart API
 * ```
 *
 * What this module defines (and nothing more):
 * - The cart resource lifecycle: the shared Phase 1 `ResourceStatus`
 *   (`idle → loading → success | empty | error`) applied to the cart
 *   payload, with `empty` meaning "settled cart with zero lines".
 * - The feature state shape: one cart resource slot plus the cart
 *   identity plus the active operation — as plain types and pure
 *   selectors, ready for the Sub-Phase 7.3 store to implement.
 * - The Guest vs Authenticated identity boundary (shape only): guest
 *   identity names a backend-issued `cartId`; authenticated identity
 *   names the JWT session. No persistence, no merge wiring.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 7.2 — no API service, no `HttpClient`, no envelope mapping.
 * - 7.3 — no `@Injectable()` store, no signals/computeds, no
 *   `loadCart`/`addItem`/`updateQuantity`/`removeItem`/`clearCart`/
 *   `mergeCart` implementations, no SignalStore/NgRx.
 * - 7.4 — no pages, no components, no routes.
 * - 7.5/7.7 — no `localStorage` persistence, no merge triggering or
 *   merge-effect guards.
 * - Phase 8 — no checkout, payment, or order state.
 *
 * This file imports values only from `@flux/api` barrels
 * (`idleResource`) and types from `../models` — no Angular
 * `@Injectable()`, no signals, no `HttpClient`, no browser APIs.
 */

import { idleResource, type ApiError, type ResourceState, type ResourceStatus } from '@flux/api';
import type { Cart, CartIdentity } from '../models/cart.models';

/**
 * Cart feature operations (names only — implementations arrive in
 * Sub-Phases 7.2/7.3/7.7). Mirrors `PHASE_7_SHOPPING_CART.md` §§7.2–7.3
 * plus the §7.7 merge: `load` reads the cart, `addItem`/`updateQuantity`/
 * `removeItem`/`clear` mutate lines, `merge` folds the guest cart into
 * the authenticated cart after login.
 */
export type CartOperation =
  'load' | 'addItem' | 'updateQuantity' | 'removeItem' | 'clear' | 'merge';

/** Closed operation set: every future transition names one of these. */
export const CART_OPERATIONS: readonly CartOperation[] = [
  'load',
  'addItem',
  'updateQuantity',
  'removeItem',
  'clear',
  'merge',
];

/**
 * Whether `value` names a cart feature operation. Pure — throws
 * nothing.
 */
export function isCartOperation(value: unknown): value is CartOperation {
  return (
    value === 'load' ||
    value === 'addItem' ||
    value === 'updateQuantity' ||
    value === 'removeItem' ||
    value === 'clear' ||
    value === 'merge'
  );
}

/**
 * Cart feature state shape (Sub-Phase 7.3 implements this shape — this
 * module only declares it).
 *
 * - `cart`: the single cart resource slot. `idle` before the first
 *   load, `loading` in flight (previous data retained), `success` for a
 *   settled cart with lines, `empty` for a settled cart with zero lines,
 *   `error` with a normalized `ApiError` on failure.
 * - `identity`: which cart the slot holds. `null` before any identity
 *   is established (no guest `cartId` issued yet and no authenticated
 *   session resolved) — never a fabricated id.
 * - `activeOperation`: the in-flight operation, if any. `null` when the
 *   feature is quiescent. Pessimistic one-at-a-time tracking is the
 *   declared contract; enforcement arrives with the store.
 */
export interface CartStateShape {
  readonly cart: ResourceState<Cart>;
  readonly identity: CartIdentity | null;
  readonly activeOperation: CartOperation | null;
}

/**
 * Initial cart feature state: untouched resource, no identity, no
 * active operation. SSR-safe (pure value — no browser APIs). Pure —
 * performs no HTTP and throws nothing.
 */
export function initialCartState(): CartStateShape {
  return { cart: idleResource<Cart>(), identity: null, activeOperation: null };
}

/**
 * Reads the cart resource lifecycle stage out of the feature state.
 * Pure — throws nothing.
 */
export function getCartResourceStatus(state: CartStateShape): ResourceStatus {
  return state.cart.status;
}

/**
 * Whether the cart slot is in flight. Pure — throws nothing.
 */
export function isCartBusy(state: CartStateShape): boolean {
  return state.cart.isLoading;
}

/**
 * Whether the cart slot holds the `empty` status (settled cart with
 * zero lines — the feature-defined emptiness for the object-shaped cart
 * payload). Pure — throws nothing.
 */
export function isCartEmptyState(state: CartStateShape): boolean {
  return state.cart.isEmpty;
}

/**
 * Whether the cart slot holds settled data (`success` or `empty` with
 * a payload). Pure — throws nothing.
 */
export function hasCartData(state: CartStateShape): boolean {
  return state.cart.data !== null;
}

/**
 * Reads the settled cart payload, if any. Pure — throws nothing.
 */
export function getCartData(state: CartStateShape): Cart | null {
  return state.cart.data;
}

/**
 * Reads the normalized cart failure, if any. Pure — throws nothing.
 */
export function getCartError(state: CartStateShape): ApiError | null {
  return state.cart.error;
}
