/**
 * Shared purchase-quantity model for Refactoring Phase B (step B2a).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §3 (cart
 * item requests carry `[Range(1, int.MaxValue)] Quantity`).
 *
 * Canonical quantity floor, validity predicate, and textbox parser
 * behind the per-feature mirrors (`MIN_CART_QUANTITY` /
 * `parseCartQuantityInput` in the cart feature, `MIN_QUANTITY` /
 * `parseQuantityInput` in product-details). The contract defines no
 * maximum: over-limit quantities are a backend `QuantityLimitExceeded`
 * rejection at cart/checkout time — this module clamps nothing above
 * the floor. Pure — throws nothing, no Angular, no HTTP, SSR-safe.
 */

/**
 * Minimum purchasable quantity: the contract's cart quantity floor.
 * Both feature mirrors pin the same value (`1`).
 */
export const MIN_QUANTITY = 1;

/**
 * Whether `value` is a submittable quantity: an integer of at least
 * `MIN_QUANTITY`. Rejects negatives, zero, decimals, `NaN`, and
 * non-finite values. Structural pre-check only — not business logic.
 * Pure — throws nothing.
 */
export function isValidQuantity(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_QUANTITY;
}

/**
 * Parses raw quantity textbox text into a quantity: digits-only (after
 * trimming) mapping to a valid quantity, otherwise `null`. Rejects
 * empty text, signs, decimals, and any non-digit characters — so
 * invalid keystrokes never reach feature state. Pure — throws nothing.
 */
export function parseQuantityInput(text: string | null | undefined): number | null {
  if (text === null || text === undefined) {
    return null;
  }
  const candidate = text.trim();
  if (!/^[0-9]+$/.test(candidate)) {
    return null;
  }
  const parsed = Number.parseInt(candidate, 10);
  return isValidQuantity(parsed) ? parsed : null;
}
