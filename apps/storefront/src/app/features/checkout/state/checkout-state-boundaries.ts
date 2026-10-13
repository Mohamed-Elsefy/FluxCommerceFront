/**
 * Storefront Checkout state boundaries for Sub-Phase 8.1 — Checkout
 * Architecture & Contract.
 *
 * Scope: `docs/phases/PHASE_8_CHECKOUT.md` §8.1 (boundary shapes,
 * lifecycle, and initialization behavior — no implementation).
 *
 * State strategy (`ARCHITECTURE.md` §9 — smallest appropriate scope):
 *
 * ```text
 * CheckoutPage (8.4 — not this sub-phase)
 *     ↓ CheckoutState (8.3 — not this sub-phase; feature-owned, local Signals)
 *     ↓ CheckoutApiService (8.2 — not this sub-phase; feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 *
 * Isolation rule (the §8.1 boundary — three slots, three owners):
 *
 * ```text
 * Cart feature state (READ-ONLY consumer)
 *   — owned by the Cart feature; checkout never writes lines, quantities,
 *      totals, or identity. Checkout keeps a snapshot (cartId + version +
 *      itemCount) taken at initialization and compares it before submit.
 *
 * Checkout form state (CUSTOMER-ENTERED data)
 *   — owned by the §8.4 Reactive Form: shipping address, billing address,
 *      and the billing-same-as-shipping flag. Plain data here (no
 *      `FormGroup` — groups, controls, and validators arrive in §8.4).
 *
 * Checkout submission state (RESOURCE ONLY)
 *   — the shared Phase 1 `ResourceState<CreateOrderResponse>` for the
 *      single `POST /orders/checkout` call. `idle` before the first
 *      submit, `loading` in flight, `success` with the created order,
 *      `error` with a normalized `ApiError`. The order payload is stored
 *      only as required by the next step (Phase 9 payment entry).
 * ```
 *
 * Initialization behavior (declared here, implemented in §8.3):
 * - Checkout initializes from the current settled cart. An empty or
 *   missing cart blocks entry (`blocked-empty-cart` — recover back to
 *   Cart, never an empty order attempt).
 * - The snapshot is compared before every submit: a changed `cartId`,
 *   bumped `version`, or changed item count means the underlying cart
 *   moved while checkout was open (`cart-changed` — re-review, never
 *   silent submit against stale lines).
 * - Checkout requires an authenticated session (`POST /orders/checkout`
 *   is `[Authorize]`): anonymous entry is blocked, never worked around
 *   with a guest cart id.
 *
 * What this module defines (and nothing more):
 * - The form-data shape (plain data, no Angular Forms).
 * - The cart snapshot shape plus pure snapshot/compare/blocked-entry
 *   helpers.
 * - The boundary shape (form slot + submission resource slot + snapshot
 *   slot) as plain types plus pure selectors and the initial value.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 8.2 — no API service, no `HttpClient`, no envelope mapping, no
 *   `Idempotency-Key` generation.
 * - 8.3 — no `@Injectable()` store, no signals/computeds, no
 *   load/submit/reset implementations, no SignalStore/NgRx.
 * - 8.4 — no `FormGroup`/`FormControl`, no validators, no pages, no
 *   components, no routes.
 * - Phase 9 — no payment state or redirection.
 *
 * This file imports values only from `@flux/api` barrels
 * (`idleResource`) and types from `../models` + `@flux/models` — no
 * Angular `@Injectable()`, no signals, no `HttpClient`, no browser APIs,
 * and no cart-feature internals (the cart enters only as the canonical
 * `@flux/models` `CartResponse` contract).
 */

import { idleResource, type ApiError, type ResourceState, type ResourceStatus } from '@flux/api';
import type { CartResponse } from '@flux/models';
import type { CheckoutAddressInput, CreateOrderResponse } from '../models/checkout.models';

/**
 * Checkout form data (Sub-Phase 8.4 builds the Reactive Form over this
 * shape — this module only declares the data). Shipping is always
 * entered; billing is either entered or copied from shipping at submit
 * time when `billingSameAsShipping` is set. Copying happens in §8.6, not
 * here.
 */
export interface CheckoutFormData {
  readonly shippingAddress: CheckoutAddressInput;
  readonly billingAddress: CheckoutAddressInput;
  readonly billingSameAsShipping: boolean;
}

/**
 * Read-only snapshot of the cart that checkout was initialized from.
 * Identity + freshness only: `cartId` names the ordered cart, `version`
 * is the backend OCC token, `itemCount` is the structural line count.
 * No lines, no prices, no totals — checkout never holds a second cart.
 */
export interface CheckoutCartSnapshot {
  readonly cartId: string;
  readonly version: number;
  readonly itemCount: number;
}

/**
 * Checkout initialization outcome: `ready` when a settled non-empty cart
 * backs the session, otherwise the blocking reason. The §8.3 store maps
 * these to entry guards; the page maps them to back-to-cart recovery.
 */
export type CheckoutInitialization = 'ready' | 'blocked-empty-cart' | 'blocked-anonymous';

/**
 * Takes the read-only cart snapshot at checkout initialization. Returns
 * `null` for a missing cart (nothing to snapshot — entry stays
 * blocked). Pure — throws nothing, performs no HTTP.
 */
export function takeCheckoutCartSnapshot(
  cart: CartResponse | null | undefined,
): CheckoutCartSnapshot | null {
  if (!cart) {
    return null;
  }
  return { cartId: cart.cartId, version: cart.version, itemCount: cart.items.length };
}

/**
 * Whether the underlying cart moved since checkout initialization: a
 * different `cartId`, a bumped backend `version`, or a changed line
 * count. Any change means the review is stale — re-review before
 * submit, never silent submit. A missing snapshot or cart counts as
 * changed (unknown freshness is unsafe freshness). Pure — throws
 * nothing.
 */
export function hasCheckoutCartChanged(
  snapshot: CheckoutCartSnapshot | null | undefined,
  cart: CartResponse | null | undefined,
): boolean {
  if (!snapshot || !cart) {
    return true;
  }
  return (
    snapshot.cartId !== cart.cartId ||
    snapshot.version !== cart.version ||
    snapshot.itemCount !== cart.items.length
  );
}

/**
 * Whether checkout entry is blocked for an empty or missing cart
 * (nothing to order — recover back to Cart). `null`/`undefined` carts
 * count as blocked (nothing loaded is nothing to check out). Pure —
 * throws nothing.
 */
export function isCheckoutBlockedForEmptyCart(cart: CartResponse | null | undefined): boolean {
  return !cart || cart.items.length === 0;
}

/**
 * Resolves checkout initialization for a settled cart plus the
 * authenticated-session flag. Empty/missing carts block regardless of
 * session; anonymous sessions block regardless of cart (checkout is
 * `[Authorize]` — guest carts must merge via the Cart feature first,
 * never check out directly). Pure — throws nothing.
 */
export function resolveCheckoutInitialization(
  cart: CartResponse | null | undefined,
  isAuthenticated: boolean,
): CheckoutInitialization {
  if (isCheckoutBlockedForEmptyCart(cart)) {
    return 'blocked-empty-cart';
  }
  if (!isAuthenticated) {
    return 'blocked-anonymous';
  }
  return 'ready';
}

/**
 * Checkout feature boundary shape (Sub-Phase 8.3 implements this shape —
 * this module only declares it).
 *
 * - `form`: customer-entered data (never backend data, never cart data).
 * - `submission`: the single order-creation resource (`idle` before the
 *   first submit; `loading` in flight with previous data retained;
 *   `success` with the created order; `error` with a normalized
 *   `ApiError`). Previous submission data is retained across retries so
 *   the UI can distinguish "never submitted" from "retrying".
 * - `cartSnapshot`: the read-only freshness anchor taken at
 *   initialization. `null` before initialization (no cart consumed yet)
 *   — never a fabricated id.
 */
export interface CheckoutStateBoundary {
  readonly form: CheckoutFormData | null;
  readonly submission: ResourceState<CreateOrderResponse>;
  readonly cartSnapshot: CheckoutCartSnapshot | null;
}

/**
 * Initial checkout boundary: no form data, untouched submission
 * resource, no cart consumed. SSR-safe (pure value — no browser APIs).
 * Pure — performs no HTTP and throws nothing.
 */
export function initialCheckoutBoundary(): CheckoutStateBoundary {
  return { form: null, submission: idleResource<CreateOrderResponse>(), cartSnapshot: null };
}

/**
 * Reads the submission lifecycle stage out of the boundary. Pure —
 * throws nothing.
 */
export function getCheckoutSubmissionStatus(state: CheckoutStateBoundary): ResourceStatus {
  return state.submission.status;
}

/**
 * Whether a submission is in flight. While `true` the UI must prevent
 * duplicate order-submission attempts (the `Idempotency-Key` header is
 * the server-side backstop — this flag is the client-side guard).
 * Pure — throws nothing.
 */
export function isCheckoutSubmitting(state: CheckoutStateBoundary): boolean {
  return state.submission.isLoading;
}

/**
 * Whether the boundary holds a created order (`success` with a payload).
 * Pure — throws nothing.
 */
export function hasCheckoutResult(state: CheckoutStateBoundary): boolean {
  return state.submission.data !== null;
}

/**
 * Reads the created order, if any. Stored only as required by the next
 * frontend step (Phase 9 payment entry). Pure — throws nothing.
 */
export function getCheckoutResult(state: CheckoutStateBoundary): CreateOrderResponse | null {
  return state.submission.data;
}

/**
 * Reads the normalized submission failure, if any. Pure — throws
 * nothing.
 */
export function getCheckoutSubmissionError(state: CheckoutStateBoundary): ApiError | null {
  return state.submission.error;
}

/**
 * Whether entered form data exists on the boundary (safe to preserve
 * across recoverable failures per `isFormPreservingCheckoutFailure`).
 * Pure — throws nothing.
 */
export function hasCheckoutFormData(state: CheckoutStateBoundary): boolean {
  return state.form !== null;
}
