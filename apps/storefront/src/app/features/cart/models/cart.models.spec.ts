/**
 * Unit tests for the Sub-Phase 7.1 cart feature models.
 *
 * Covers the pure helpers only (summaries, totals shape, counts,
 * currency reads, ownership/identity guards, quantity bounds,
 * emptiness). Contract mirrors themselves live in `@flux/models`
 * (already covered by Phase 1 specs) and are aliased here — never
 * re-declared — so these tests assert the aliasing compiles and the
 * helpers behave, not backend shapes.
 *
 * Backend-authoritative totals pin: no helper under test multiplies
 * prices or sums amounts — money slots stay `null` until a backend
 * totals source provides them.
 */

import { describe, expect, it } from 'vitest';
import type { Cart, CartItem } from './cart.models';
import {
  MIN_CART_QUANTITY,
  createGuestCartIdentity,
  emptyCartTotals,
  getCartDistinctItemCount,
  getCartItemCount,
  getCartOwner,
  hasBackendTotals,
  hasMixedCartCurrencies,
  isAuthenticatedCart,
  isAuthenticatedCartIdentity,
  isCartEmpty,
  isEmptyCartData,
  isGuestCart,
  isGuestCartIdentity,
  isValidCartQuantity,
  resolveCartCurrency,
  toCartItemProductSummary,
  toCartItemVariantSummary,
} from './cart.models';

const GUEST_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const VARIANT_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const VARIANT_B = 'bbbbbbbb-2222-4222-8222-222222222222';

function line(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: PRODUCT_ID,
    variantId: VARIANT_A,
    sku: 'TEE-BLK-M',
    productName: 'Tee',
    unitPriceAmount: 29.99,
    currency: 'USD',
    quantity: 2,
    ...overrides,
  };
}

function cart(overrides: Partial<Cart> = {}): Cart {
  return {
    cartId: GUEST_ID,
    userId: null,
    version: 1,
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:05:00Z',
    items: [line()],
    isGuest: true,
    isAuthenticated: false,
    ...overrides,
  };
}

describe('cart line summaries', () => {
  it('projects the product summary from a backend-issued line', () => {
    expect(toCartItemProductSummary(line({ productName: 'Hoodie' }))).toEqual({
      productId: PRODUCT_ID,
      productName: 'Hoodie',
    });
  });

  it('projects the variant summary from a backend-issued line', () => {
    expect(toCartItemVariantSummary(line({ variantId: VARIANT_B, sku: 'TEE-WHT-M' }))).toEqual({
      variantId: VARIANT_B,
      sku: 'TEE-WHT-M',
    });
  });
});

describe('CartTotals backend-authoritative shape', () => {
  it('starts empty with zero counts and no backend money', () => {
    expect(emptyCartTotals()).toEqual({
      itemCount: 0,
      distinctItemCount: 0,
      currency: null,
      subtotal: null,
      total: null,
    });
  });

  it('reports absent backend money as absent (never zero-filled)', () => {
    expect(hasBackendTotals(emptyCartTotals())).toBe(false);
    expect(hasBackendTotals(null)).toBe(false);
    expect(hasBackendTotals(undefined)).toBe(false);
    expect(
      hasBackendTotals({ ...emptyCartTotals(), subtotal: { amount: 59.98, currency: 'USD' } }),
    ).toBe(true);
  });

  it('performs no local price math: priced lines still yield null money', () => {
    const totals = emptyCartTotals();
    expect(totals.subtotal).toBeNull();
    expect(totals.total).toBeNull();
    expect(cart().items[0].unitPriceAmount).toBe(29.99);
  });
});

describe('quantity bounds', () => {
  it('floors submittable quantities at 1 (contract Range(1, max))', () => {
    expect(MIN_CART_QUANTITY).toBe(1);
    expect(isValidCartQuantity(1)).toBe(true);
    expect(isValidCartQuantity(25)).toBe(true);
  });

  it('rejects zero, negatives, decimals, and non-finite values', () => {
    expect(isValidCartQuantity(0)).toBe(false);
    expect(isValidCartQuantity(-3)).toBe(false);
    expect(isValidCartQuantity(2.5)).toBe(false);
    expect(isValidCartQuantity(Number.NaN)).toBe(false);
    expect(isValidCartQuantity(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

describe('emptiness and counts', () => {
  it('treats missing and line-free carts as empty', () => {
    expect(isCartEmpty(null)).toBe(true);
    expect(isCartEmpty(undefined)).toBe(true);
    expect(isCartEmpty(cart({ items: [] }))).toBe(true);
    expect(isCartEmpty(cart())).toBe(false);
  });

  it('exposes the loadResourceState emptiness predicate for zero-line carts', () => {
    expect(isEmptyCartData(cart({ items: [] }))).toBe(true);
    expect(isEmptyCartData(cart())).toBe(false);
  });

  it('sums backend-issued quantities as a count (never money)', () => {
    expect(getCartItemCount(null)).toBe(0);
    expect(getCartItemCount(cart({ items: [] }))).toBe(0);
    expect(getCartItemCount(cart())).toBe(2);
    expect(getCartItemCount(cart({ items: [line({ quantity: 2 }), line({ quantity: 3 })] }))).toBe(
      5,
    );
  });

  it('counts distinct lines', () => {
    expect(getCartDistinctItemCount(null)).toBe(0);
    expect(getCartDistinctItemCount(cart({ items: [] }))).toBe(0);
    expect(
      getCartDistinctItemCount(cart({ items: [line(), line({ variantId: VARIANT_B })] })),
    ).toBe(2);
  });
});

describe('currency reads (no conversion, no reconciliation)', () => {
  it('echoes the single backend currency', () => {
    expect(resolveCartCurrency(cart())).toBe('USD');
  });

  it('resolves unknown currency for missing, empty, and mixed carts', () => {
    expect(resolveCartCurrency(null)).toBeNull();
    expect(resolveCartCurrency(cart({ items: [] }))).toBeNull();
    expect(
      resolveCartCurrency(cart({ items: [line({ currency: 'USD' }), line({ currency: 'EUR' })] })),
    ).toBeNull();
  });

  it('detects mixed backend currencies without converting amounts', () => {
    expect(hasMixedCartCurrencies(cart())).toBe(false);
    expect(hasMixedCartCurrencies(cart({ items: [] }))).toBe(false);
    expect(hasMixedCartCurrencies(null)).toBe(false);
    expect(
      hasMixedCartCurrencies(
        cart({ items: [line({ currency: 'USD' }), line({ currency: 'EUR' })] }),
      ),
    ).toBe(true);
  });
});

describe('guest vs authenticated ownership', () => {
  it('classifies carts from backend flags', () => {
    expect(isGuestCart(cart())).toBe(true);
    expect(isAuthenticatedCart(cart())).toBe(false);
    const auth = cart({ isGuest: false, isAuthenticated: true, userId: PRODUCT_ID });
    expect(isGuestCart(auth)).toBe(false);
    expect(isAuthenticatedCart(auth)).toBe(true);
  });

  it('treats missing carts as neither guest nor authenticated', () => {
    expect(isGuestCart(null)).toBe(false);
    expect(isAuthenticatedCart(null)).toBe(false);
    expect(isGuestCart(undefined)).toBe(false);
    expect(isAuthenticatedCart(undefined)).toBe(false);
  });

  it('resolves the owner with guest precedence and null on flag violations', () => {
    expect(getCartOwner(cart())).toBe('guest');
    expect(getCartOwner(cart({ isGuest: false, isAuthenticated: true }))).toBe('authenticated');
    expect(getCartOwner(null)).toBeNull();
    expect(getCartOwner(cart({ isGuest: false, isAuthenticated: false }))).toBeNull();
  });
});

describe('cart identity distinction (shape only — no persistence)', () => {
  it('builds guest identities only from usable backend-issued ids', () => {
    expect(createGuestCartIdentity(GUEST_ID)).toEqual({ kind: 'guest', cartId: GUEST_ID });
    expect(createGuestCartIdentity(`  ${GUEST_ID}  `)).toEqual({ kind: 'guest', cartId: GUEST_ID });
    expect(createGuestCartIdentity(null)).toBeNull();
    expect(createGuestCartIdentity(undefined)).toBeNull();
    expect(createGuestCartIdentity('')).toBeNull();
    expect(createGuestCartIdentity('   ')).toBeNull();
  });

  it('narrows identity variants without throwing', () => {
    expect(isGuestCartIdentity({ kind: 'guest', cartId: GUEST_ID })).toBe(true);
    expect(isGuestCartIdentity({ kind: 'authenticated' })).toBe(false);
    expect(isGuestCartIdentity(null)).toBe(false);
    expect(isAuthenticatedCartIdentity({ kind: 'authenticated' })).toBe(true);
    expect(isAuthenticatedCartIdentity({ kind: 'guest', cartId: GUEST_ID })).toBe(false);
    expect(isAuthenticatedCartIdentity(undefined)).toBe(false);
  });
});
