import { describe, expect, it } from 'vitest';
import type { CartResponse } from '../domains/cart';
import { hasCartSnapshotChanged, isValidCartSnapshot, snapshotCartOf } from './cart-identity';

function cart(overrides: Partial<CartResponse> = {}): CartResponse {
  return {
    cartId: '11111111-1111-4111-8111-111111111111',
    userId: null,
    version: 3,
    createdAtUtc: '2026-01-01T00:00:00Z',
    updatedAtUtc: '2026-01-01T00:00:00Z',
    items: [],
    isGuest: true,
    isAuthenticated: false,
    ...overrides,
  };
}

describe('shared cart snapshot (Refactoring Phase A)', () => {
  it('captures cart id, version, and line count only', () => {
    const snapshot = snapshotCartOf(
      cart({
        items: [
          {
            productId: 'p',
            variantId: 'v',
            sku: 'SKU-1',
            productName: 'Tee',
            unitPriceAmount: 29.99,
            currency: 'USD',
            quantity: 2,
          },
        ],
      }),
    );
    expect(snapshot).toEqual({
      cartId: '11111111-1111-4111-8111-111111111111',
      version: 3,
      itemCount: 1,
    });
  });

  it('validates snapshot structure', () => {
    expect(isValidCartSnapshot({ cartId: 'c', version: 1, itemCount: 0 })).toBe(true);
    expect(isValidCartSnapshot({ cartId: '  ', version: 1, itemCount: 0 })).toBe(false);
    expect(isValidCartSnapshot({ cartId: 'c', version: NaN, itemCount: 0 })).toBe(false);
    expect(isValidCartSnapshot({ cartId: 'c', version: 1, itemCount: -1 })).toBe(false);
    expect(isValidCartSnapshot(null)).toBe(false);
    expect(isValidCartSnapshot(undefined)).toBe(false);
  });

  it('reports a changed cart id, bumped version, or changed line count', () => {
    const snapshot = snapshotCartOf(cart());
    expect(hasCartSnapshotChanged(snapshot, cart())).toBe(false);
    expect(hasCartSnapshotChanged(snapshot, cart({ cartId: 'other-cart-id' }))).toBe(true);
    expect(hasCartSnapshotChanged(snapshot, cart({ version: 4 }))).toBe(true);
    expect(
      hasCartSnapshotChanged(
        snapshot,
        cart({
          items: [
            {
              productId: 'p',
              variantId: 'v',
              sku: 'SKU-1',
              productName: 'Tee',
              unitPriceAmount: 29.99,
              currency: 'USD',
              quantity: 1,
            },
          ],
        }),
      ),
    ).toBe(true);
    expect(hasCartSnapshotChanged(null, cart())).toBe(false);
    expect(hasCartSnapshotChanged(snapshot, null)).toBe(false);
  });
});
