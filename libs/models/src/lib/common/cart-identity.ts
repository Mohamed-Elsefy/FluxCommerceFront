/**
 * Shared cart-snapshot model for Refactoring Phase A (step A1).
 *
 * Source of truth: `docs/frontend-contract/DTO_REFERENCE.md` §3
 * (`CartResponse { cartId, version, items }`) and `API_CONTRACT.md`
 * Appendix B.3 (checkout reprices server-side — the snapshot is an
 * identity + freshness anchor, never lines or prices).
 *
 * Canonical shape behind the per-feature mirrors (checkout's
 * `CheckoutCartSnapshot { cartId, version, itemCount }` in
 * `checkout-state-boundaries.ts`). Cross-feature consumers (checkout,
 * product-details) project this snapshot instead of importing cart
 * state internals — the cart feature stays the sole owner of its
 * state, identity lifecycle, and merge transport.
 *
 * Snapshot-only by construction: `cartId` names the ordered cart,
 * `version` is the backend OCC token, `itemCount` is the line count.
 * No lines, no prices, no totals. Pure — throws nothing, no Angular,
 * no HTTP, SSR-safe.
 */

import type { CartResponse } from '../domains/cart';

/**
 * Minimal cart snapshot for cross-feature consumption: identity plus
 * freshness only. Projected from a backend-issued cart — never
 * fabricated.
 */
export interface CartSnapshot {
  readonly cartId: string;
  readonly version: number;
  readonly itemCount: number;
}

/**
 * Projects the snapshot out of a backend-issued cart (`cartId` +
 * backend `version` + line count). Pure — throws nothing.
 */
export function snapshotCartOf(cart: CartResponse): CartSnapshot {
  return { cartId: cart.cartId, version: cart.version, itemCount: cart.items.length };
}

/**
 * Whether `value` is a usable cart snapshot (non-blank id, finite
 * version, non-negative count). Structural pre-check only. Pure.
 */
export function isValidCartSnapshot(value: unknown): value is CartSnapshot {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Partial<CartSnapshot>;
  return (
    typeof candidate.cartId === 'string' &&
    candidate.cartId.trim() !== '' &&
    typeof candidate.version === 'number' &&
    Number.isFinite(candidate.version) &&
    typeof candidate.itemCount === 'number' &&
    Number.isInteger(candidate.itemCount) &&
    candidate.itemCount >= 0
  );
}

/**
 * Whether the underlying cart moved since the snapshot was captured:
 * a different `cartId`, a bumped backend `version`, or a changed line
 * count. Pure — throws nothing.
 */
export function hasCartSnapshotChanged(
  snapshot: CartSnapshot | null | undefined,
  cart: CartResponse | null | undefined,
): boolean {
  if (!snapshot || !cart) {
    return false;
  }
  return (
    snapshot.cartId !== cart.cartId ||
    snapshot.version !== cart.version ||
    snapshot.itemCount !== cart.items.length
  );
}
