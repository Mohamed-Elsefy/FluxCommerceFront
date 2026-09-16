/**
 * State tests for the Sub-Phase 7.3 `CartState`.
 *
 * `CartApiService` (the feature HTTP boundary, covered by
 * `cart-api.service.spec.ts`) is stubbed at its typed seam so these tests
 * own the feature logic: initial shape; identity establishment and reset;
 * idle → loading → success | empty | error transitions for `loadCart`,
 * `addItem`, `updateQuantity`, `removeItem`, `clearCart`, and `mergeCart`
 * in guest and authenticated contexts; guest/authenticated routing;
 * guard rejection (no identity, blank ids, invalid quantities, blank
 * merge source); dataless-envelope violations; error normalization with
 * data retention; cancellation passthrough; the pessimistic
 * one-at-a-time lock; backend-authoritative derived selectors (counts,
 * currency, totals with null money, owner); and feature-local scoping
 * (no root singleton — every injection site gets an independent
 * instance).
 *
 * Identity transitions and merge triggering belong to Sub-Phases
 * 7.5/7.7 — covering them here would violate the 7.3 boundary, so these
 * tests pin only the explicit `setIdentity` seam and the transport-only
 * `mergeCart` (identity untouched on success).
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { ApiError, type ApiResponseWithData } from '@flux/api';
import type { CartItemResponse } from '@flux/models';
import { CartApiService } from '../data-access/cart-api.service';
import type { Cart } from '../models/cart.models';
import { getCartResourceStatus, isCartBusy } from './cart-state-structure';
import { CartState } from './cart-state';

const GUEST_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const VARIANT_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const VARIANT_B = 'bbbbbbbb-2222-4222-8222-222222222222';
const USER_ID = 'cccccccc-3333-4333-8333-333333333333';

const GUEST_IDENTITY = { kind: 'guest', cartId: GUEST_ID } as const;
const AUTH_IDENTITY = { kind: 'authenticated' } as const;

function line(overrides: Partial<CartItemResponse> = {}): CartItemResponse {
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

function authCart(overrides: Partial<Cart> = {}): Cart {
  return {
    ...guestCart(),
    userId: USER_ID,
    isGuest: false,
    isAuthenticated: true,
    ...overrides,
  };
}

function cartEnvelope(cart: Cart = guestCart()): ApiResponseWithData<Cart> {
  return { isSuccess: true, data: cart };
}

const STATE_METHODS = [
  'createGuestCart',
  'getGuestCart',
  'getCart',
  'addGuestCartItem',
  'addCartItem',
  'updateGuestCartItemQuantity',
  'updateCartItemQuantity',
  'removeGuestCartItem',
  'removeCartItem',
  'clearGuestCart',
  'clearCart',
  'mergeGuestCart',
] as const;

type StateMethod = (typeof STATE_METHODS)[number];
type Flow = () => Observable<ApiResponseWithData<Cart>>;

interface RecordedCall {
  method: string;
  args: unknown[];
}

function setup(flows: Partial<Record<StateMethod, Flow>> = {}): {
  state: CartState;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const apiStub: Record<string, (...args: unknown[]) => Observable<ApiResponseWithData<Cart>>> = {};
  for (const method of STATE_METHODS) {
    apiStub[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return flows[method]?.() ?? of(cartEnvelope());
    };
  }

  TestBed.configureTestingModule({
    providers: [{ provide: CartApiService, useValue: apiStub }, CartState],
  });
  return { state: TestBed.inject(CartState), calls };
}

function methodsOf(calls: RecordedCall[]): string[] {
  return calls.map((call) => call.method);
}

/** Reads the forwarded `signal` out of the trailing options argument. */
function signalOf(call: RecordedCall): AbortSignal | undefined {
  const last = call.args[call.args.length - 1];
  if (typeof last === 'object' && last !== null && 'signal' in last) {
    return (last as { signal?: AbortSignal }).signal;
  }
  return undefined;
}

function guestLoaded(state: CartState): void {
  state.setIdentity({ ...GUEST_IDENTITY });
  state.loadCart();
}

describe('CartState initial', () => {
  it('starts idle with no identity, no operation, and zeroed projections', () => {
    const { state, calls } = setup();

    expect(state.cart().status).toBe('idle');
    expect(state.cart().data).toBeNull();
    expect(state.cart().error).toBeNull();
    expect(state.isLoading()).toBe(false);
    expect(state.identity()).toBeNull();
    expect(state.activeOperation()).toBeNull();
    expect(state.itemCount()).toBe(0);
    expect(state.distinctItemCount()).toBe(0);
    expect(state.currency()).toBeNull();
    expect(state.totals()).toEqual({
      itemCount: 0,
      distinctItemCount: 0,
      currency: null,
      subtotal: null,
      total: null,
    });
    expect(state.owner()).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('exposes the §7.1 shape through the state snapshot', () => {
    const { state } = setup();

    expect(getCartResourceStatus(state.state())).toBe('idle');
    expect(isCartBusy(state.state())).toBe(false);
  });
});

describe('CartState identity', () => {
  it('stores the guest identity and resets the slot on switch', () => {
    const { state } = setup();
    guestLoaded(state);
    expect(state.cart().status).toBe('success');

    state.setIdentity({ ...AUTH_IDENTITY });

    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(state.cart().status).toBe('idle');
    expect(state.cart().data).toBeNull();
    expect(state.activeOperation()).toBeNull();
    expect(state.itemCount()).toBe(0);
  });

  it('returns to unaddressable when identity is cleared', () => {
    const { state, calls } = setup();
    state.setIdentity({ ...GUEST_IDENTITY });
    state.setIdentity(null);

    state.loadCart();

    expect(state.identity()).toBeNull();
    expect(calls).toHaveLength(0);
    expect(state.cart().status).toBe('idle');
  });

  it('resets the whole feature back to the initial shape', () => {
    const { state } = setup();
    guestLoaded(state);
    state.reset();

    expect(state.cart().status).toBe('idle');
    expect(state.cart().data).toBeNull();
    expect(state.identity()).toBeNull();
    expect(state.activeOperation()).toBeNull();
    expect(state.itemCount()).toBe(0);
  });
});

describe('CartState loadCart', () => {
  it('loads guest carts through getGuestCart with the identity cartId', () => {
    const { state, calls } = setup();
    state.setIdentity({ ...GUEST_IDENTITY });
    state.loadCart();

    expect(methodsOf(calls)).toEqual(['getGuestCart']);
    expect(calls[0].args[0]).toBe(GUEST_ID);
    expect(state.cart().status).toBe('success');
    expect(state.cart().data?.cartId).toBe(GUEST_ID);
    expect(state.isLoading()).toBe(false);
    expect(state.activeOperation()).toBeNull();
  });

  it('resolves zero-line carts to empty while keeping the payload', () => {
    const { state } = setup({
      getGuestCart: () => of(cartEnvelope(guestCart({ items: [] }))),
    });
    state.setIdentity({ ...GUEST_IDENTITY });
    state.loadCart();

    expect(state.cart().status).toBe('empty');
    expect(state.isEmpty()).toBe(true);
    expect(state.cart().data?.items).toEqual([]);
  });

  it('loads authenticated carts through getCart with no scoping', () => {
    const { state, calls } = setup({ getCart: () => of(cartEnvelope(authCart())) });
    state.setIdentity({ ...AUTH_IDENTITY });
    state.loadCart();

    expect(methodsOf(calls)).toEqual(['getCart']);
    expect(state.cart().status).toBe('success');
    expect(state.owner()).toBe('authenticated');
  });

  it('ignores loads with no identity (state stays idle)', () => {
    const { state, calls } = setup();
    state.loadCart();

    expect(calls).toHaveLength(0);
    expect(state.cart().status).toBe('idle');
  });

  it('transitions through loading with the operation tracked while in flight', () => {
    let settle: (() => void) | undefined;
    const pending = new Observable<ApiResponseWithData<Cart>>((subscriber) => {
      settle = () => {
        subscriber.next(cartEnvelope());
        subscriber.complete();
      };
    });
    const { state } = setup({ getGuestCart: () => pending });
    state.setIdentity({ ...GUEST_IDENTITY });

    state.loadCart();
    expect(state.cart().status).toBe('loading');
    expect(state.isLoading()).toBe(true);
    expect(state.activeOperation()).toBe('load');
    expect(isCartBusy(state.state())).toBe(true);

    settle?.();
    expect(state.cart().status).toBe('success');
    expect(state.activeOperation()).toBeNull();
  });

  it('resolves failures to error and retains previous data', () => {
    const rejection = new ApiError({ status: 404, message: 'Cart not found.' });
    let failNext = false;
    const { state } = setup({
      getGuestCart: () => (failNext ? throwError(() => rejection) : of(cartEnvelope())),
    });
    state.setIdentity({ ...GUEST_IDENTITY });
    state.loadCart();
    expect(state.cart().data?.cartId).toBe(GUEST_ID);

    failNext = true;
    state.loadCart();

    expect(state.cart().status).toBe('error');
    expect(state.isError()).toBe(true);
    expect(state.cart().error).toBe(rejection);
    expect(state.cart().data?.cartId).toBe(GUEST_ID);
    expect(state.activeOperation()).toBeNull();
  });

  it('resolves dataless success envelopes to error (contract violation)', () => {
    const { state } = setup({
      getCart: () => of({ isSuccess: true, data: null }),
    });
    state.setIdentity({ ...AUTH_IDENTITY });
    state.loadCart();

    expect(state.cart().status).toBe('error');
  });

  it('stays stable on non-protocol failures (never throws, always normalized)', () => {
    const { state } = setup({
      getCart: () => throwError(() => new TypeError('Failed to fetch')),
    });
    state.setIdentity({ ...AUTH_IDENTITY });
    let status: string | undefined;
    expect(() => {
      state.loadCart();
      status = state.cart().status;
    }).not.toThrow();

    expect(status).toBe('error');
    expect(state.cart().error).not.toBeNull();
  });

  it('aborts silently: lock clears, no error, no data write', () => {
    let settle: (() => void) | undefined;
    const pending = new Observable<ApiResponseWithData<Cart>>((subscriber) => {
      settle = () => {
        subscriber.next(cartEnvelope());
        subscriber.complete();
      };
    });
    const { state } = setup({ getCart: () => pending });
    state.setIdentity({ ...AUTH_IDENTITY });
    const controller = new AbortController();

    state.loadCart({ signal: controller.signal });
    expect(state.cart().status).toBe('loading');
    controller.abort();

    // The shared primitive sets loading first, then the abort completes
    // silently: no success/error transition, no payload, lock released.
    expect(state.activeOperation()).toBeNull();
    expect(state.isError()).toBe(false);
    expect(state.cart().data).toBeNull();
    settle?.();
    expect(state.cart().data).toBeNull();
  });

  it('forwards the AbortSignal to data access', () => {
    const { state, calls } = setup();
    state.setIdentity({ ...AUTH_IDENTITY });
    const controller = new AbortController();
    state.loadCart({ signal: controller.signal });

    expect(signalOf(calls[0])).toBe(controller.signal);
  });
});

describe('CartState addItem', () => {
  const body = {
    variantId: VARIANT_A,
    unitPriceAmount: 29.99,
    currency: 'USD',
    quantity: 2,
  };

  it('adds guest lines with cartId scoping and the untouched body', () => {
    const updated = guestCart({ items: [line(), line({ variantId: VARIANT_B, quantity: 1 })] });
    const { state, calls } = setup({
      addGuestCartItem: () => of(cartEnvelope(updated)),
    });
    state.setIdentity({ ...GUEST_IDENTITY });
    state.addItem(body);

    expect(methodsOf(calls)).toEqual(['addGuestCartItem']);
    expect(calls[0].args).toEqual([GUEST_ID, body, {}]);
    expect(state.cart().status).toBe('success');
    expect(state.distinctItemCount()).toBe(2);
    expect(state.activeOperation()).toBeNull();
  });

  it('adds authenticated lines with the body and no scoping', () => {
    const { state, calls } = setup({
      addCartItem: () => of(cartEnvelope(authCart())),
    });
    state.setIdentity({ ...AUTH_IDENTITY });
    state.addItem(body);

    expect(methodsOf(calls)).toEqual(['addCartItem']);
    expect(calls[0].args).toEqual([body, {}]);
    expect(state.cart().status).toBe('success');
  });

  it('ignores adds with no identity', () => {
    const { state, calls } = setup();
    state.addItem(body);

    expect(calls).toHaveLength(0);
    expect(state.cart().status).toBe('idle');
  });

  it('resolves add failures to error', () => {
    const rejection = new ApiError({ status: 400, message: 'Quantity limit exceeded.' });
    const { state } = setup({ addCartItem: () => throwError(() => rejection) });
    state.setIdentity({ ...AUTH_IDENTITY });
    state.addItem(body);

    expect(state.cart().status).toBe('error');
    expect(state.cart().error).toBe(rejection);
  });
});

describe('CartState updateQuantity', () => {
  it('updates guest lines with a quantity-only body and trimmed scoping', () => {
    const updated = guestCart({ items: [line({ quantity: 5 })] });
    const { state, calls } = setup({
      updateGuestCartItemQuantity: () => of(cartEnvelope(updated)),
    });
    state.setIdentity({ ...GUEST_IDENTITY });
    state.updateQuantity(`  ${VARIANT_A}  `, 5);

    expect(methodsOf(calls)).toEqual(['updateGuestCartItemQuantity']);
    expect(calls[0].args).toEqual([GUEST_ID, VARIANT_A, { variantId: VARIANT_A, quantity: 5 }, {}]);
    expect(state.cart().status).toBe('success');
    expect(state.itemCount()).toBe(5);
  });

  it('updates authenticated lines with line scoping', () => {
    const { state, calls } = setup({
      updateCartItemQuantity: () => of(cartEnvelope(authCart())),
    });
    state.setIdentity({ ...AUTH_IDENTITY });
    state.updateQuantity(VARIANT_A, 3);

    expect(methodsOf(calls)).toEqual(['updateCartItemQuantity']);
    expect(calls[0].args).toEqual([VARIANT_A, { variantId: VARIANT_A, quantity: 3 }, {}]);
  });

  it.each([0, -2, 1.5, Number.NaN])('rejects invalid quantity %s without fetching', (quantity) => {
    const { state, calls } = setup();
    state.setIdentity({ ...AUTH_IDENTITY });
    state.updateQuantity(VARIANT_A, quantity);

    expect(calls).toHaveLength(0);
    expect(state.cart().status).toBe('idle');
  });

  it('rejects blank line ids without fetching', () => {
    const { state, calls } = setup();
    state.setIdentity({ ...AUTH_IDENTITY });
    state.updateQuantity('   ', 2);

    expect(calls).toHaveLength(0);
    expect(state.cart().status).toBe('idle');
  });

  it('ignores updates with no identity', () => {
    const { state, calls } = setup();
    state.updateQuantity(VARIANT_A, 2);

    expect(calls).toHaveLength(0);
    expect(state.cart().status).toBe('idle');
  });
});

describe('CartState removeItem', () => {
  it('removes guest lines with cart and line scoping', () => {
    const { state, calls } = setup({
      removeGuestCartItem: () => of(cartEnvelope(guestCart({ items: [] }))),
    });
    state.setIdentity({ ...GUEST_IDENTITY });
    state.removeItem(VARIANT_A);

    expect(methodsOf(calls)).toEqual(['removeGuestCartItem']);
    expect(calls[0].args).toEqual([GUEST_ID, VARIANT_A, {}]);
    expect(state.cart().status).toBe('empty');
  });

  it('removes authenticated lines with line scoping', () => {
    const { state, calls } = setup({
      removeCartItem: () => of(cartEnvelope(authCart({ items: [] }))),
    });
    state.setIdentity({ ...AUTH_IDENTITY });
    state.removeItem(VARIANT_A);

    expect(methodsOf(calls)).toEqual(['removeCartItem']);
    expect(calls[0].args).toEqual([VARIANT_A, {}]);
    expect(state.cart().status).toBe('empty');
  });

  it('rejects blank line ids without fetching', () => {
    const { state, calls } = setup();
    state.setIdentity({ ...AUTH_IDENTITY });
    state.removeItem('  ');

    expect(calls).toHaveLength(0);
    expect(state.cart().status).toBe('idle');
  });

  it('ignores removals with no identity', () => {
    const { state, calls } = setup();
    state.removeItem(VARIANT_A);

    expect(calls).toHaveLength(0);
    expect(state.cart().status).toBe('idle');
  });
});

describe('CartState clearCart', () => {
  it('clears guest carts and resolves the emptied cart to empty', () => {
    const { state, calls } = setup({
      clearGuestCart: () => of(cartEnvelope(guestCart({ items: [] }))),
    });
    state.setIdentity({ ...GUEST_IDENTITY });
    state.clearCart();

    expect(methodsOf(calls)).toEqual(['clearGuestCart']);
    expect(calls[0].args).toEqual([GUEST_ID, {}]);
    expect(state.cart().status).toBe('empty');
    expect(state.itemCount()).toBe(0);
  });

  it('clears authenticated carts with no scoping', () => {
    const { state, calls } = setup({
      clearCart: () => of(cartEnvelope(authCart({ items: [] }))),
    });
    state.setIdentity({ ...AUTH_IDENTITY });
    state.clearCart();

    expect(methodsOf(calls)).toEqual(['clearCart']);
    expect(calls[0].args).toEqual([{}]);
    expect(state.cart().status).toBe('empty');
  });

  it('ignores clears with no identity', () => {
    const { state, calls } = setup();
    state.clearCart();

    expect(calls).toHaveLength(0);
    expect(state.cart().status).toBe('idle');
  });
});

describe('CartState mergeCart', () => {
  it('merges through the merge transport and leaves identity untouched', () => {
    const merged = authCart({ items: [line(), line({ variantId: VARIANT_B })] });
    const { state, calls } = setup({
      mergeGuestCart: () => of(cartEnvelope(merged)),
    });
    state.setIdentity({ ...GUEST_IDENTITY });
    state.mergeCart(GUEST_ID);

    expect(methodsOf(calls)).toEqual(['mergeGuestCart']);
    expect(calls[0].args).toEqual([{ guestCartId: GUEST_ID }, {}]);
    expect(state.cart().status).toBe('success');
    expect(state.distinctItemCount()).toBe(2);
    // Transport only: post-merge identity adoption belongs to 7.7.
    expect(state.identity()).toEqual({ kind: 'guest', cartId: GUEST_ID });
    expect(state.activeOperation()).toBeNull();
  });

  it('rejects blank merge sources without fetching', () => {
    const { state, calls } = setup();
    state.setIdentity({ ...AUTH_IDENTITY });
    state.mergeCart('   ');

    expect(calls).toHaveLength(0);
    expect(state.cart().status).toBe('idle');
  });

  it('resolves merge failures to error', () => {
    const rejection = new ApiError({ status: 404, message: 'Guest cart not found.' });
    const { state } = setup({ mergeGuestCart: () => throwError(() => rejection) });
    state.setIdentity({ ...AUTH_IDENTITY });
    state.mergeCart(GUEST_ID);

    expect(state.cart().status).toBe('error');
    expect(state.cart().error).toBe(rejection);
    expect(state.activeOperation()).toBeNull();
  });
});

describe('CartState one-at-a-time lock', () => {
  it('blocks new actions while one is in flight and releases on settle', () => {
    let settle: (() => void) | undefined;
    const pending = new Observable<ApiResponseWithData<Cart>>((subscriber) => {
      settle = () => {
        subscriber.next(cartEnvelope());
        subscriber.complete();
      };
    });
    const { state, calls } = setup({ getGuestCart: () => pending });
    state.setIdentity({ ...GUEST_IDENTITY });

    state.loadCart();
    state.addItem({ variantId: VARIANT_A, unitPriceAmount: 29.99, currency: 'USD', quantity: 1 });

    expect(methodsOf(calls)).toEqual(['getGuestCart']);
    expect(state.activeOperation()).toBe('load');

    settle?.();
    expect(state.activeOperation()).toBeNull();

    state.addItem({ variantId: VARIANT_A, unitPriceAmount: 29.99, currency: 'USD', quantity: 1 });
    expect(methodsOf(calls)).toEqual(['getGuestCart', 'addGuestCartItem']);
  });

  it('releases the lock on failure so recovery stays possible', () => {
    const rejection = new ApiError({ status: 500, message: 'Server error.' });
    let failNext = true;
    const { state, calls } = setup({
      getGuestCart: () => (failNext ? throwError(() => rejection) : of(cartEnvelope())),
    });
    state.setIdentity({ ...GUEST_IDENTITY });

    state.loadCart();
    expect(state.cart().status).toBe('error');
    expect(state.activeOperation()).toBeNull();

    failNext = false;
    state.loadCart();
    expect(methodsOf(calls)).toEqual(['getGuestCart', 'getGuestCart']);
    expect(state.cart().status).toBe('success');
  });
});

describe('CartState derived selectors', () => {
  it('projects counts, currency, backend-authoritative totals, and owner', () => {
    const loaded = guestCart({
      items: [line({ quantity: 2 }), line({ variantId: VARIANT_B, quantity: 3 })],
    });
    const { state } = setup({ getGuestCart: () => of(cartEnvelope(loaded)) });
    state.setIdentity({ ...GUEST_IDENTITY });
    state.loadCart();

    expect(state.itemCount()).toBe(5);
    expect(state.distinctItemCount()).toBe(2);
    expect(state.currency()).toBe('USD');
    expect(state.totals()).toEqual({
      itemCount: 5,
      distinctItemCount: 2,
      currency: 'USD',
      subtotal: null,
      total: null,
    });
    expect(state.owner()).toBe('guest');
  });

  it('resolves unknown currency for mixed-currency carts without converting', () => {
    const loaded = guestCart({
      items: [line({ currency: 'USD' }), line({ variantId: VARIANT_B, currency: 'EUR' })],
    });
    const { state } = setup({ getGuestCart: () => of(cartEnvelope(loaded)) });
    state.setIdentity({ ...GUEST_IDENTITY });
    state.loadCart();

    expect(state.currency()).toBeNull();
    expect(state.itemCount()).toBe(4);
  });
});

describe('CartState locality (no global state)', () => {
  it('is feature-scoped: independent instances per injection site', () => {
    const first = setup({});
    guestLoaded(first.state);
    expect(first.state.cart().status).toBe('success');

    TestBed.resetTestingModule();
    const second = setup({});
    expect(second.state.cart().status).toBe('idle');
    expect(second.state.identity()).toBeNull();
  });

  it('is not a root singleton (no providedIn root)', () => {
    const metadata = (CartState as unknown as { ɵprov?: { providedIn?: unknown } }).ɵprov;
    expect(metadata?.providedIn).not.toBe('root');
  });
});

describe('CartState guest creation (Sub-Phase 7.5)', () => {
  it('creates the guest cart with no prior identity and adopts the issued identity', () => {
    const { state, calls } = setup();

    state.createGuestCart();

    expect(methodsOf(calls)).toEqual(['createGuestCart']);
    expect(state.identity()).toEqual({ kind: 'guest', cartId: GUEST_ID });
    expect(state.cart().status).toBe('success');
    expect(state.data()?.cartId).toBe(GUEST_ID);
    expect(state.activeOperation()).toBeNull();
  });

  it('lands a freshly created zero-line cart as empty', () => {
    const { state } = setup({
      createGuestCart: () => of(cartEnvelope(guestCart({ items: [] }))),
    });

    state.createGuestCart();

    expect(state.cart().status).toBe('empty');
    expect(state.identity()).toEqual({ kind: 'guest', cartId: GUEST_ID });
  });

  it('resolves creation failures to error without adopting identity', () => {
    const rejection = new ApiError({ status: 0, message: 'Offline.' });
    const { state } = setup({ createGuestCart: () => throwError(() => rejection) });

    state.createGuestCart();

    expect(state.cart().status).toBe('error');
    expect(state.cart().error).toBe(rejection);
    expect(state.identity()).toBeNull();
    expect(state.activeOperation()).toBeNull();
  });

  it('rejects a dataless creation echo as a contract violation', () => {
    const { state } = setup({ createGuestCart: () => of({ isSuccess: true }) });

    state.createGuestCart();

    expect(state.cart().status).toBe('error');
    expect(state.identity()).toBeNull();
  });

  it('rejects a creation echo without a usable guest identity', () => {
    const { state } = setup({
      createGuestCart: () =>
        of(
          cartEnvelope({ ...guestCart(), userId: USER_ID, isGuest: false, isAuthenticated: true }),
        ),
    });

    state.createGuestCart();

    expect(state.cart().status).toBe('error');
    expect(state.identity()).toBeNull();
  });

  it('rejects a creation echo with a blank issued id', () => {
    const { state } = setup({
      createGuestCart: () => of(cartEnvelope(guestCart({ cartId: '   ' }))),
    });

    state.createGuestCart();

    expect(state.cart().status).toBe('error');
    expect(state.identity()).toBeNull();
  });

  it('respects the one-at-a-time lock while creating', () => {
    const pending = new Observable<ApiResponseWithData<Cart>>(() => undefined);
    const { state, calls } = setup({ createGuestCart: () => pending });

    state.createGuestCart();
    state.createGuestCart();

    expect(methodsOf(calls)).toEqual(['createGuestCart']);
    expect(state.activeOperation()).toBe('load');
  });
});
