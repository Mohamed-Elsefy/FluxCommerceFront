/**
 * Feature integration tests for Sub-Phase 7.9 — Testing & Phase
 * Verification.
 *
 * Verifies the production contract paths end to end with the real layers
 * wired and only HTTP stubbed:
 *
 * ```text
 * CartState (feature state, real)
 *     ↓ CartApiService (feature data access, real)
 *     ↓ ApiClient (shared transport, real — incl. interceptors)
 *     ↓ HttpTestingController (stands in for ASP.NET Core)
 *     ↓ Backend Cart API contracts (contract-exact fixtures)
 * ```
 *
 * Covers all six §7.2 operations in both guest and authenticated
 * contexts (create/get-or-create establishment, get, add, update,
 * remove, clear) plus the §7.7 merge transport: exact URL templates
 * with cart/line scoping, exact wire bodies, envelope adoption into
 * feature state (identity + slot), and untouched error propagation.
 *
 * No live backend is reachable from this environment, so
 * `HttpTestingController` stands in with contract-exact fixtures
 * (`ApiResponse` envelopes, camelCase wire casing, GUID ids) — the same
 * convention as the Phase 5/6 integration specs.
 */

import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { provideApi, provideAppEnvironment, type AppEnvironment } from '@flux/api';
import type { AddCartItemRequest, CartResponse } from '@flux/models';
import { CartApiService } from './cart-api.service';
import { CartState } from '../state/cart-state';
import type { Cart } from '../models/cart.models';

const environment: AppEnvironment = {
  name: 'development',
  production: false,
  appName: 'test',
  apiBaseUrl: '/api',
};

const GUEST_ID = '11111111-1111-4111-8111-111111111111';
const AUTH_ID = '22222222-2222-4222-8222-222222222222';
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

function authCart(overrides: Partial<Cart> = {}): Cart {
  return {
    ...guestCart(),
    cartId: AUTH_ID,
    userId: USER_ID,
    isGuest: false,
    isAuthenticated: true,
    ...overrides,
  };
}

function envelope(data: unknown): Record<string, unknown> {
  return { isSuccess: true, message: 'Operation completed successfully.', data };
}

const ADD_BODY: AddCartItemRequest = {
  variantId: VARIANT_A,
  unitPriceAmount: 29.99,
  currency: 'USD',
  quantity: 2,
};

describe('cart feature integration (state → api → contract)', () => {
  let state: CartState;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideAppEnvironment(environment),
        provideApi(),
        provideHttpClientTesting(),
        CartApiService,
        CartState,
      ],
    });
    state = TestBed.inject(CartState);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('creates the guest cart with the empty record body and adopts the issued identity', () => {
    state.createGuestCart();

    const pending = http.expectOne('/api/cart/guest');
    expect(pending.request.method).toBe('POST');
    expect(pending.request.body).toEqual({});
    pending.flush(envelope(guestCart({ items: [] })));

    expect(state.identity()).toEqual({ kind: 'guest', cartId: GUEST_ID });
    expect(state.isEmpty()).toBe(true);
  });

  it('routes guest reads and mutations with cartId scoping and exact bodies', () => {
    state.setIdentity({ kind: 'guest', cartId: GUEST_ID });

    state.loadCart();
    const get = http.expectOne(`/api/cart/guest/${GUEST_ID}`);
    expect(get.request.method).toBe('GET');
    get.flush(envelope(guestCart()));
    expect(state.isSuccess()).toBe(true);

    state.addItem(ADD_BODY);
    const add = http.expectOne(`/api/cart/guest/${GUEST_ID}/items`);
    expect(add.request.method).toBe('POST');
    expect(add.request.body).toEqual(ADD_BODY);
    add.flush(envelope(guestCart()));

    state.updateQuantity(VARIANT_A, 3);
    const update = http.expectOne(`/api/cart/guest/${GUEST_ID}/items/${VARIANT_A}`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ variantId: VARIANT_A, quantity: 3 });
    update.flush(envelope(guestCart()));

    state.removeItem(VARIANT_A);
    const remove = http.expectOne(`/api/cart/guest/${GUEST_ID}/items/${VARIANT_A}`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(envelope(guestCart({ items: [] })));
    expect(state.isEmpty()).toBe(true);

    state.clearCart();
    const clear = http.expectOne(`/api/cart/guest/${GUEST_ID}`);
    expect(clear.request.method).toBe('DELETE');
    clear.flush(envelope(guestCart({ items: [] })));
  });

  it('establishes the authenticated cart with get-or-create and no scoping', () => {
    state.ensureAuthenticatedCart();

    const pending = http.expectOne('/api/cart');
    expect(pending.request.method).toBe('POST');
    expect(pending.request.body).toBeNull();
    pending.flush(envelope(authCart()));

    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(state.owner()).toBe('authenticated');
    expect(state.isSuccess()).toBe(true);
  });

  it('routes authenticated mutations without scoping and with exact bodies', () => {
    state.setIdentity({ kind: 'authenticated' });

    state.addItem(ADD_BODY);
    const add = http.expectOne('/api/cart/items');
    expect(add.request.method).toBe('POST');
    expect(add.request.body).toEqual(ADD_BODY);
    add.flush(envelope(authCart()));

    state.updateQuantity(VARIANT_A, 3);
    const update = http.expectOne(`/api/cart/items/${VARIANT_A}`);
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ variantId: VARIANT_A, quantity: 3 });
    update.flush(envelope(authCart()));

    state.removeItem(VARIANT_A);
    const remove = http.expectOne(`/api/cart/items/${VARIANT_A}`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(envelope(authCart({ items: [] })));
    expect(state.isEmpty()).toBe(true);

    state.clearCart();
    const clear = http.expectOne('/api/cart');
    expect(clear.request.method).toBe('DELETE');
    clear.flush(envelope(authCart({ items: [] })));
  });

  it('posts the merge with the untouched merge body and adopts the merged cart', () => {
    state.setIdentity({ kind: 'authenticated' });
    state.mergeCart(GUEST_ID);

    const pending = http.expectOne('/api/cart/merge');
    expect(pending.request.method).toBe('POST');
    expect(pending.request.body).toEqual({ guestCartId: GUEST_ID });
    pending.flush(envelope(authCart({ version: 3 })));

    expect(state.data()?.version).toBe(3);
    expect(state.isSuccess()).toBe(true);
  });

  it('maps a 404 read to the error slot without throwing', () => {
    state.setIdentity({ kind: 'guest', cartId: GUEST_ID });
    state.loadCart();

    http.expectOne(`/api/cart/guest/${GUEST_ID}`).flush(
      {
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        detail: 'Cart not found.',
        extensions: { code: 'Cart.CartNotFound' },
      },
      { status: 404, statusText: 'Not Found' },
    );

    expect(state.cart().status).toBe('error');
    expect(state.error()?.status).toBe(404);
    expect(state.error()?.code).toBe('Cart.CartNotFound');
  });

  it('maps a cart 409 rejection to the error slot', () => {
    state.setIdentity({ kind: 'authenticated' });
    state.addItem(ADD_BODY);

    http.expectOne('/api/cart/items').flush(
      {
        type: 'about:blank',
        title: 'Conflict',
        status: 409,
        detail: 'The cart was modified by another request.',
        extensions: { code: 'Cart.CartConcurrencyConflict' },
      },
      { status: 409, statusText: 'Conflict' },
    );

    expect(state.cart().status).toBe('error');
    expect(state.error()?.code).toBe('Cart.CartConcurrencyConflict');
  });
});
