/**
 * Unit tests for the Sub-Phase 7.1 cart state boundary.
 *
 * Covers the declared shape only (initial state, lifecycle selectors,
 * operation set): there is deliberately no store, no signals
 * implementation, and no HTTP under test — those arrive in
 * Sub-Phases 7.2/7.3.
 */

import { describe, expect, it } from 'vitest';
import { ApiError } from '@flux/api';
import type { Cart } from '../models/cart.models';
import {
  CART_OPERATIONS,
  getCartData,
  getCartError,
  getCartResourceStatus,
  hasCartData,
  initialCartState,
  isCartBusy,
  isCartEmptyState,
  isCartOperation,
  type CartStateShape,
} from './cart-state-structure';

const GUEST_ID = '11111111-1111-4111-8111-111111111111';

function guestCart(): Cart {
  return {
    cartId: GUEST_ID,
    userId: null,
    version: 1,
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:05:00Z',
    items: [],
    isGuest: true,
    isAuthenticated: false,
  };
}

describe('initialCartState', () => {
  it('starts untouched with no identity and no active operation', () => {
    const state = initialCartState();
    expect(state.cart.status).toBe('idle');
    expect(state.cart.data).toBeNull();
    expect(state.cart.error).toBeNull();
    expect(state.identity).toBeNull();
    expect(state.activeOperation).toBeNull();
  });

  it('creates independent snapshots per call', () => {
    expect(initialCartState()).not.toBe(initialCartState());
  });
});

describe('resource lifecycle selectors', () => {
  it('reads the lifecycle stage from the cart slot', () => {
    expect(getCartResourceStatus(initialCartState())).toBe('idle');
    const loading: CartStateShape = {
      ...initialCartState(),
      cart: { ...initialCartState().cart, status: 'loading', isLoading: true },
    };
    expect(getCartResourceStatus(loading)).toBe('loading');
    expect(isCartBusy(loading)).toBe(true);
    expect(isCartBusy(initialCartState())).toBe(false);
  });

  it('classifies the settled-empty status for zero-line carts', () => {
    const settledEmpty: CartStateShape = {
      cart: {
        status: 'empty',
        data: guestCart(),
        error: null,
        isLoading: false,
        isSuccess: false,
        isEmpty: true,
        isError: false,
      },
      identity: { kind: 'guest', cartId: GUEST_ID },
      activeOperation: null,
    };
    expect(isCartEmptyState(settledEmpty)).toBe(true);
    expect(hasCartData(settledEmpty)).toBe(true);
    expect(getCartData(settledEmpty)).toEqual(guestCart());
    expect(getCartError(settledEmpty)).toBeNull();
    expect(isCartEmptyState(initialCartState())).toBe(false);
    expect(hasCartData(initialCartState())).toBe(false);
    expect(getCartData(initialCartState())).toBeNull();
  });

  it('exposes normalized failures without throwing on idle states', () => {
    const failed: CartStateShape = {
      cart: {
        status: 'error',
        data: null,
        error: new ApiError({ status: 404, message: 'Cart not found.' }),
        isLoading: false,
        isSuccess: false,
        isEmpty: false,
        isError: true,
      },
      identity: { kind: 'guest', cartId: GUEST_ID },
      activeOperation: 'load',
    };
    expect(getCartError(failed)?.status).toBe(404);
    expect(getCartError(initialCartState())).toBeNull();
  });
});

describe('cart operations (names only — no implementations)', () => {
  it('declares the closed load/mutate/merge operation set', () => {
    expect([...CART_OPERATIONS]).toEqual([
      'load',
      'addItem',
      'updateQuantity',
      'removeItem',
      'clear',
      'merge',
    ]);
  });

  it('narrows operation names without throwing', () => {
    expect(isCartOperation('load')).toBe(true);
    expect(isCartOperation('merge')).toBe(true);
    expect(isCartOperation('checkout')).toBe(false);
    expect(isCartOperation(null)).toBe(false);
    expect(isCartOperation(undefined)).toBe(false);
    expect(isCartOperation('')).toBe(false);
  });
});
