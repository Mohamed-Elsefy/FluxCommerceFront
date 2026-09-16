/**
 * Lifecycle tests for the Sub-Phase 7.5 `GuestCartService`.
 *
 * Covers the guest identity lifecycle only (bootstrap + expiration
 * recovery live in `guest-cart.service.ts`, slot transitions in
 * `cart-state.spec.ts`, persistence in
 * `guest-cart-storage.service.spec.ts`): creation on first visit,
 * loading the stored identity, recovery from expired/masked/garbage
 * ids, non-recovery for item-level/transport failures, the in-flight
 * guard, server-platform standby, malformed creation echoes, retry
 * after failed creation, and guest CRUD routing after bootstrap.
 *
 * The real `CartState` is wired to a stubbed `CartApiService` and an
 * in-memory `GUEST_CART_STORAGE` fake, so these tests pin the full
 * service → state → data-access delegation path without HTTP or
 * `localStorage`.
 */

import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { ApiError, NETWORK_ERROR_CODE, type ApiResponseWithData } from '@flux/api';
import { CartApiService } from '../data-access/cart-api.service';
import type { AddCartItemRequest } from '@flux/models';
import type { Cart } from '../models/cart.models';
import { CartState } from './cart-state';
import { GUEST_CART_STORAGE, type GuestCartStorage } from './guest-cart-storage.service';
import { GuestCartService, isInvalidGuestIdentityError } from './guest-cart.service';

const GUEST_ID = '11111111-1111-4111-8111-111111111111';
const FRESH_ID = '22222222-2222-4222-8222-222222222222';
const PRODUCT_ID = '33333333-3333-4333-8333-333333333333';
const VARIANT_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const USER_ID = 'cccccccc-3333-4333-8333-333333333333';

function line(overrides: Partial<Cart['items'][number]> = {}): Cart['items'][number] {
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

function guestCart(overrides: Partial<Cart> = {}): Cart {
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

function cartEnvelope(cart: Cart = guestCart()): ApiResponseWithData<Cart> {
  return { isSuccess: true, data: cart };
}

function identityError(code: string, status: number): ApiError {
  return new ApiError({ status, message: `${code} (test).`, code });
}

const API_METHODS = [
  'createGuestCart',
  'getGuestCart',
  'addGuestCartItem',
  'updateGuestCartItemQuantity',
  'removeGuestCartItem',
  'clearGuestCart',
] as const;

type ApiMethod = (typeof API_METHODS)[number];
type Flow = () => Observable<ApiResponseWithData<Cart>>;

interface RecordedCall {
  method: string;
  args: unknown[];
}

function setup(
  flows: Partial<Record<ApiMethod, Flow>> = {},
  initialStoredId: string | null = null,
  platform: 'browser' | 'server' = 'browser',
): {
  service: GuestCartService;
  state: CartState;
  calls: RecordedCall[];
  savedIds: string[];
  stored: () => string | null;
  clearCount: () => number;
} {
  const calls: RecordedCall[] = [];
  const apiStub: Record<string, (...args: unknown[]) => Observable<ApiResponseWithData<Cart>>> = {};
  for (const method of API_METHODS) {
    apiStub[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return flows[method]?.() ?? of(cartEnvelope());
    };
  }
  let stored: string | null = initialStoredId;
  const savedIds: string[] = [];
  let clears = 0;
  const storage: GuestCartStorage = {
    loadGuestCartId: () => stored,
    saveGuestCartId: (cartId: string) => {
      savedIds.push(cartId);
      stored = cartId;
    },
    clearGuestCartId: () => {
      clears += 1;
      stored = null;
    },
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: CartApiService, useValue: apiStub },
      { provide: GUEST_CART_STORAGE, useValue: storage },
      { provide: PLATFORM_ID, useValue: platform },
      CartState,
      GuestCartService,
    ],
  });
  return {
    service: TestBed.inject(GuestCartService),
    state: TestBed.inject(CartState),
    calls,
    savedIds,
    stored: () => stored,
    clearCount: () => clears,
  };
}

function methodsOf(calls: RecordedCall[]): string[] {
  return calls.map((call) => call.method);
}

describe('isInvalidGuestIdentityError', () => {
  it('flags only the identity-invalid backend codes', () => {
    expect(isInvalidGuestIdentityError(identityError('Cart.CartNotFound', 404))).toBe(true);
    expect(isInvalidGuestIdentityError(identityError('Cart.CartAccessDenied', 404))).toBe(true);
    expect(isInvalidGuestIdentityError(identityError('Cart.InvalidCartId', 400))).toBe(true);
  });

  it('ignores item-level, concurrency, transport, and missing failures', () => {
    expect(isInvalidGuestIdentityError(identityError('Cart.CartItemNotFound', 404))).toBe(false);
    expect(isInvalidGuestIdentityError(identityError('Cart.CartConcurrencyConflict', 409))).toBe(
      false,
    );
    expect(isInvalidGuestIdentityError(identityError(NETWORK_ERROR_CODE, 0))).toBe(false);
    expect(isInvalidGuestIdentityError(identityError('UnknownError', 500))).toBe(false);
    expect(isInvalidGuestIdentityError(null)).toBe(false);
    expect(isInvalidGuestIdentityError(undefined)).toBe(false);
    expect(isInvalidGuestIdentityError(new ApiError({ status: 500, message: 'No code.' }))).toBe(
      false,
    );
  });
});

describe('GuestCartService first visit (no stored identity)', () => {
  it('creates the guest cart without any GET and persists the issued id', () => {
    const { service, state, calls, savedIds, stored } = setup();

    service.initialize();

    expect(methodsOf(calls)).toEqual(['createGuestCart']);
    expect(state.identity()).toEqual({ kind: 'guest', cartId: GUEST_ID });
    expect(state.data()?.cartId).toBe(GUEST_ID);
    expect(state.isSuccess()).toBe(true);
    expect(savedIds).toEqual([GUEST_ID]);
    expect(stored()).toBe(GUEST_ID);
  });

  it('lands the fresh cart as empty when the backend returns zero lines', () => {
    const { service, state } = setup({
      createGuestCart: () => of(cartEnvelope(guestCart({ items: [] }))),
    });

    service.initialize();

    expect(state.isEmpty()).toBe(true);
    expect(state.data()?.items).toEqual([]);
  });

  it('surfaces creation failures in the slot and persists nothing', () => {
    const rejection = new ApiError({ status: 0, message: 'Offline.', code: NETWORK_ERROR_CODE });
    const { service, state, savedIds, stored } = setup({
      createGuestCart: () => throwError(() => rejection),
    });

    service.initialize();

    expect(state.isError()).toBe(true);
    expect(state.error()?.code).toBe(NETWORK_ERROR_CODE);
    expect(state.identity()).toBeNull();
    expect(savedIds).toEqual([]);
    expect(stored()).toBeNull();
  });

  it('retries creation on the next initialize after a failed creation', () => {
    let failNext = true;
    const { service, calls } = setup({
      createGuestCart: () =>
        failNext ? throwError(() => identityError(NETWORK_ERROR_CODE, 0)) : of(cartEnvelope()),
    });

    service.initialize();
    failNext = false;
    service.initialize();

    expect(methodsOf(calls)).toEqual(['createGuestCart', 'createGuestCart']);
  });

  it('rejects a dataless creation echo as a contract violation', () => {
    const { service, state, savedIds } = setup({
      createGuestCart: () => of({ isSuccess: true }),
    });

    service.initialize();

    expect(state.isError()).toBe(true);
    expect(state.identity()).toBeNull();
    expect(savedIds).toEqual([]);
  });

  it('rejects a non-guest creation echo as a contract violation', () => {
    const { service, state, savedIds } = setup({
      createGuestCart: () =>
        of(
          cartEnvelope({
            ...guestCart(),
            userId: USER_ID,
            isGuest: false,
            isAuthenticated: true,
          }),
        ),
    });

    service.initialize();

    expect(state.isError()).toBe(true);
    expect(state.identity()).toBeNull();
    expect(savedIds).toEqual([]);
  });
});

describe('GuestCartService return visit (stored identity)', () => {
  it('loads the stored guest cart instead of creating', () => {
    const { service, state, calls, savedIds, clearCount } = setup({}, GUEST_ID);

    service.initialize();

    expect(methodsOf(calls)).toEqual(['getGuestCart']);
    expect(state.identity()).toEqual({ kind: 'guest', cartId: GUEST_ID });
    expect(state.data()?.cartId).toBe(GUEST_ID);
    expect(savedIds).toEqual([]);
    expect(clearCount()).toBe(0);
  });

  it('recovers with a fresh guest cart when the stored cart expired', () => {
    const { service, state, calls, savedIds, stored, clearCount } = setup(
      {
        getGuestCart: () => throwError(() => identityError('Cart.CartNotFound', 404)),
        createGuestCart: () => of(cartEnvelope(guestCart({ cartId: FRESH_ID, items: [] }))),
      },
      GUEST_ID,
    );

    service.initialize();

    expect(methodsOf(calls)).toEqual(['getGuestCart', 'createGuestCart']);
    expect(clearCount()).toBe(1);
    expect(state.identity()).toEqual({ kind: 'guest', cartId: FRESH_ID });
    expect(state.isEmpty()).toBe(true);
    expect(savedIds).toEqual([FRESH_ID]);
    expect(stored()).toBe(FRESH_ID);
  });

  for (const code of ['Cart.CartAccessDenied', 'Cart.InvalidCartId']) {
    it(`recovers with a fresh guest cart on ${code}`, () => {
      const status = code === 'Cart.InvalidCartId' ? 400 : 404;
      const { service, state, clearCount, stored } = setup(
        {
          getGuestCart: () => throwError(() => identityError(code, status)),
          createGuestCart: () => of(cartEnvelope(guestCart({ cartId: FRESH_ID, items: [] }))),
        },
        GUEST_ID,
      );

      service.initialize();

      expect(clearCount()).toBe(1);
      expect(state.identity()).toEqual({ kind: 'guest', cartId: FRESH_ID });
      expect(stored()).toBe(FRESH_ID);
    });
  }

  for (const code of [
    'Cart.CartItemNotFound',
    'Cart.CartConcurrencyConflict',
    NETWORK_ERROR_CODE,
  ]) {
    it(`does not recover on ${code} (surfaces the failure instead)`, () => {
      const status =
        code === NETWORK_ERROR_CODE ? 0 : code === 'Cart.CartConcurrencyConflict' ? 409 : 404;
      const { service, state, calls, savedIds, stored, clearCount } = setup(
        {
          getGuestCart: () => throwError(() => identityError(code, status)),
        },
        GUEST_ID,
      );

      service.initialize();

      expect(methodsOf(calls)).toEqual(['getGuestCart']);
      expect(state.isError()).toBe(true);
      expect(state.error()?.code).toBe(code);
      expect(clearCount()).toBe(0);
      expect(savedIds).toEqual([]);
      expect(stored()).toBe(GUEST_ID);
    });
  }
});

describe('GuestCartService guards', () => {
  it('ignores initialize while an operation is in flight', () => {
    const pending = new Observable<ApiResponseWithData<Cart>>(() => undefined);
    const { service, state, calls } = setup({ getGuestCart: () => pending }, GUEST_ID);

    service.initialize();
    expect(state.isLoading()).toBe(true);

    service.initialize();

    expect(methodsOf(calls)).toEqual(['getGuestCart']);
  });

  it('stands by on the server platform without fetching', () => {
    const { service, state, calls } = setup({}, null, 'server');

    service.initialize();

    expect(methodsOf(calls)).toEqual([]);
    expect(state.identity()).toBeNull();
    expect(state.cart().status).toBe('idle');
  });

  it('exposes the owned state identity as a read-only cross-feature seam', () => {
    const { service, state } = setup();

    expect(service.identity()).toBeNull();

    service.initialize();

    expect(service.identity()).toEqual({ kind: 'guest', cartId: GUEST_ID });
    expect(state.identity()).toEqual(service.identity());
  });

  it('routes guest CRUD through the established identity after bootstrap', () => {
    const { service, state, calls } = setup();
    service.initialize();

    const body: AddCartItemRequest = {
      variantId: VARIANT_A,
      unitPriceAmount: 29.99,
      currency: 'USD',
      quantity: 1,
    };
    state.addItem(body);

    const add = calls.find((call) => call.method === 'addGuestCartItem');
    expect(add?.args).toEqual([GUEST_ID, body, {}]);
  });
});
