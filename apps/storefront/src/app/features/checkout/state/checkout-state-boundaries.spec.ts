/**
 * Unit tests for the Sub-Phase 8.1 checkout state boundaries.
 *
 * Covers the declared shapes only (cart snapshot, cart-change detection,
 * empty-cart blocking, initialization resolution, boundary initial value
 * and selectors): there is deliberately no store, no signals
 * implementation, and no HTTP under test — those arrive in
 * Sub-Phases 8.2/8.3.
 *
 * Read-only cart pin: the boundary never stores cart lines, quantities,
 * or prices — only the `cartId`/`version`/`itemCount` freshness anchor.
 */

import { describe, expect, it } from 'vitest';
import { ApiError } from '@flux/api';
import type { CartResponse } from '@flux/models';
import {
  getCheckoutResult,
  getCheckoutSubmissionError,
  getCheckoutSubmissionStatus,
  hasCheckoutCartChanged,
  hasCheckoutFormData,
  hasCheckoutResult,
  initialCheckoutBoundary,
  isCheckoutBlockedForEmptyCart,
  isCheckoutSubmitting,
  resolveCheckoutInitialization,
  takeCheckoutCartSnapshot,
  type CheckoutStateBoundary,
} from './checkout-state-boundaries';

const CART_ID = '11111111-1111-4111-8111-111111111111';

function cart(overrides: Partial<CartResponse> = {}): CartResponse {
  return {
    cartId: CART_ID,
    userId: '33333333-3333-4333-8333-333333333333',
    version: 3,
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:05:00Z',
    items: [
      {
        productId: '22222222-2222-4222-8222-222222222222',
        variantId: 'aaaaaaaa-1111-4111-8111-111111111111',
        sku: 'TEE-BLK-M',
        productName: 'Tee',
        unitPriceAmount: 29.99,
        currency: 'USD',
        quantity: 2,
      },
    ],
    isGuest: false,
    isAuthenticated: true,
    ...overrides,
  };
}

describe('takeCheckoutCartSnapshot (read-only freshness anchor)', () => {
  it('captures cart id, version, and line count only', () => {
    expect(takeCheckoutCartSnapshot(cart())).toEqual({
      cartId: CART_ID,
      version: 3,
      itemCount: 1,
    });
  });

  it('returns null for a missing cart (entry stays blocked)', () => {
    expect(takeCheckoutCartSnapshot(null)).toBeNull();
    expect(takeCheckoutCartSnapshot(undefined)).toBeNull();
  });
});

describe('hasCheckoutCartChanged (stale-review detection)', () => {
  it('reports no change for the identical cart', () => {
    const snapshot = takeCheckoutCartSnapshot(cart());
    expect(hasCheckoutCartChanged(snapshot, cart())).toBe(false);
  });

  it('reports a changed cart id, bumped version, or changed line count', () => {
    const snapshot = takeCheckoutCartSnapshot(cart());
    expect(hasCheckoutCartChanged(snapshot, cart({ cartId: 'other-cart-id' }))).toBe(true);
    expect(hasCheckoutCartChanged(snapshot, cart({ version: 4 }))).toBe(true);
    expect(hasCheckoutCartChanged(snapshot, cart({ items: [] }))).toBe(true);
  });

  it('treats unknown freshness as changed (never silent submit)', () => {
    expect(hasCheckoutCartChanged(null, cart())).toBe(true);
    expect(hasCheckoutCartChanged(undefined, cart())).toBe(true);
    expect(hasCheckoutCartChanged(takeCheckoutCartSnapshot(cart()), null)).toBe(true);
    expect(hasCheckoutCartChanged(takeCheckoutCartSnapshot(cart()), undefined)).toBe(true);
  });
});

describe('isCheckoutBlockedForEmptyCart', () => {
  it('blocks missing and line-free carts', () => {
    expect(isCheckoutBlockedForEmptyCart(null)).toBe(true);
    expect(isCheckoutBlockedForEmptyCart(undefined)).toBe(true);
    expect(isCheckoutBlockedForEmptyCart(cart({ items: [] }))).toBe(true);
  });

  it('allows carts with lines', () => {
    expect(isCheckoutBlockedForEmptyCart(cart())).toBe(false);
  });
});

describe('resolveCheckoutInitialization (entry guards)', () => {
  it('resolves ready for a non-empty cart with an authenticated session', () => {
    expect(resolveCheckoutInitialization(cart(), true)).toBe('ready');
  });

  it('blocks empty carts regardless of session', () => {
    expect(resolveCheckoutInitialization(cart({ items: [] }), true)).toBe('blocked-empty-cart');
    expect(resolveCheckoutInitialization(null, true)).toBe('blocked-empty-cart');
    expect(resolveCheckoutInitialization(cart({ items: [] }), false)).toBe('blocked-empty-cart');
  });

  it('blocks anonymous sessions regardless of cart (guest must merge first)', () => {
    expect(resolveCheckoutInitialization(cart(), false)).toBe('blocked-anonymous');
  });
});

describe('initialCheckoutBoundary', () => {
  it('starts with no form data, an untouched submission, and no snapshot', () => {
    const state = initialCheckoutBoundary();
    expect(state.form).toBeNull();
    expect(state.submission.status).toBe('idle');
    expect(state.submission.data).toBeNull();
    expect(state.submission.error).toBeNull();
    expect(state.cartSnapshot).toBeNull();
  });

  it('creates independent snapshots per call', () => {
    expect(initialCheckoutBoundary()).not.toBe(initialCheckoutBoundary());
  });
});

describe('boundary selectors (no store implementation)', () => {
  it('reads the submission lifecycle stage', () => {
    expect(getCheckoutSubmissionStatus(initialCheckoutBoundary())).toBe('idle');
    const loading: CheckoutStateBoundary = {
      ...initialCheckoutBoundary(),
      submission: { ...initialCheckoutBoundary().submission, status: 'loading', isLoading: true },
    };
    expect(getCheckoutSubmissionStatus(loading)).toBe('loading');
    expect(isCheckoutSubmitting(loading)).toBe(true);
    expect(isCheckoutSubmitting(initialCheckoutBoundary())).toBe(false);
  });

  it('exposes the created order only on success', () => {
    const created = {
      orderId: '44444444-4444-4444-8444-444444444444',
      orderNumber: 'ORD-ABC123DEF456',
      status: 'Pending' as const,
      createdAtUtc: '2026-09-04T10:00:00Z',
    };
    const succeeded: CheckoutStateBoundary = {
      form: null,
      submission: {
        status: 'success',
        data: created,
        error: null,
        isLoading: false,
        isSuccess: true,
        isEmpty: false,
        isError: false,
      },
      cartSnapshot: { cartId: CART_ID, version: 3, itemCount: 1 },
    };
    expect(hasCheckoutResult(succeeded)).toBe(true);
    expect(getCheckoutResult(succeeded)).toEqual(created);
    expect(hasCheckoutResult(initialCheckoutBoundary())).toBe(false);
    expect(getCheckoutResult(initialCheckoutBoundary())).toBeNull();
  });

  it('exposes normalized submission failures without throwing on idle states', () => {
    const failed: CheckoutStateBoundary = {
      ...initialCheckoutBoundary(),
      submission: {
        status: 'error',
        data: null,
        error: new ApiError({ status: 409, message: 'Conflict.' }),
        isLoading: false,
        isSuccess: false,
        isEmpty: false,
        isError: true,
      },
    };
    expect(getCheckoutSubmissionError(failed)?.status).toBe(409);
    expect(getCheckoutSubmissionError(initialCheckoutBoundary())).toBeNull();
  });

  it('reports form-data presence for failure-preservation decisions', () => {
    expect(hasCheckoutFormData(initialCheckoutBoundary())).toBe(false);
    const withForm: CheckoutStateBoundary = {
      ...initialCheckoutBoundary(),
      form: {
        shippingAddress: {
          recipientName: 'Ada Lovelace',
          line1: '1 Flux St',
          city: 'Berlin',
          region: 'BE',
          postalCode: '10115',
          countryCode: 'DE',
        },
        billingAddress: {
          recipientName: 'Ada Lovelace',
          line1: '1 Flux St',
          city: 'Berlin',
          region: 'BE',
          postalCode: '10115',
          countryCode: 'DE',
        },
        billingSameAsShipping: true,
      },
    };
    expect(hasCheckoutFormData(withForm)).toBe(true);
  });
});
