/**
 * Delegation tests for the Sub-Phase 7.2 `CartApiService`.
 *
 * `ApiClient` (the shared-lib HTTP boundary, already covered by `libs/api`
 * specs) is stubbed at its typed seam so these tests own the feature logic:
 * correct route templates from `CART_ENDPOINTS`, correct `pathParams`
 * interpolation keys for guest (`cartId`) and line (`variantId`) scoping,
 * verb/body fidelity across all six §7.2 operations in both guest and
 * authenticated contexts, envelope passthrough without unwrapping, and
 * request-options forwarding. Validation and business failures propagate
 * untouched — the service never catches, remaps, or throws.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiClient, ApiError, CART_ENDPOINTS } from '@flux/api';
import type {
  AddCartItemRequest,
  MergeCartRequest,
  UpdateCartItemQuantityRequest,
} from '@flux/models';
import { CartApiService } from './cart-api.service';

const GUEST_ID = '11111111-1111-4111-8111-111111111111';
const VARIANT_A = 'aaaaaaaa-1111-4111-8111-111111111111';

const ADD_BODY: AddCartItemRequest = {
  variantId: VARIANT_A,
  unitPriceAmount: 29.99,
  currency: 'USD',
  quantity: 2,
};

const UPDATE_BODY: UpdateCartItemQuantityRequest = {
  variantId: VARIANT_A,
  quantity: 3,
};

const MERGE_BODY: MergeCartRequest = { guestCartId: GUEST_ID };

interface ApiCalls {
  paths: string[];
  bodies: unknown[];
  options: unknown[];
}

function setup(): { service: CartApiService; api: ApiClient; calls: ApiCalls } {
  const calls: ApiCalls = { paths: [], bodies: [], options: [] };
  const apiStub = {
    get: vi.fn((path: string, options: unknown = {}) => {
      calls.paths.push(path);
      calls.options.push(options);
      return of({ isSuccess: true, data: null });
    }),
    post: vi.fn((path: string, body: unknown, options: unknown = {}) => {
      calls.paths.push(path);
      calls.bodies.push(body);
      calls.options.push(options);
      return of({ isSuccess: true, data: null });
    }),
    put: vi.fn((path: string, body: unknown, options: unknown = {}) => {
      calls.paths.push(path);
      calls.bodies.push(body);
      calls.options.push(options);
      return of({ isSuccess: true, data: null });
    }),
    delete: vi.fn((path: string, options: unknown = {}) => {
      calls.paths.push(path);
      calls.options.push(options);
      return of({ isSuccess: true, data: null });
    }),
  } as unknown as ApiClient;

  TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: apiStub }] });
  return { service: TestBed.inject(CartApiService), api: apiStub, calls };
}

describe('CartApiService guest routes', () => {
  it('creates guest carts through the canonical route template with the empty record body', () => {
    const { service, calls } = setup();
    service.createGuestCart().subscribe();

    expect(calls.paths).toEqual([CART_ENDPOINTS.createGuestCart.path]);
    expect(calls.bodies).toEqual([{}]);
    expect(calls.options).toEqual([{}]);
  });

  it('reads guest carts with cartId scoping', () => {
    const { service, calls } = setup();
    service.getGuestCart(GUEST_ID).subscribe();

    expect(calls.paths).toEqual([CART_ENDPOINTS.getGuestCart.path]);
    expect(calls.options).toEqual([{ pathParams: { cartId: GUEST_ID } }]);
  });

  it('posts guest lines with cartId scoping and the untouched add body', () => {
    const { service, calls } = setup();
    service.addGuestCartItem(GUEST_ID, ADD_BODY).subscribe();

    expect(calls.paths).toEqual([CART_ENDPOINTS.addGuestItem.path]);
    expect(calls.bodies).toEqual([ADD_BODY]);
    expect(calls.options).toEqual([{ pathParams: { cartId: GUEST_ID } }]);
  });

  it('puts guest quantities with cart and line scoping and the untouched update body', () => {
    const { service, calls } = setup();
    service.updateGuestCartItemQuantity(GUEST_ID, VARIANT_A, UPDATE_BODY).subscribe();

    expect(calls.paths).toEqual([CART_ENDPOINTS.updateGuestItem.path]);
    expect(calls.bodies).toEqual([UPDATE_BODY]);
    expect(calls.options).toEqual([{ pathParams: { cartId: GUEST_ID, variantId: VARIANT_A } }]);
  });

  it('deletes guest lines with cart and line scoping and no body', () => {
    const { service, calls } = setup();
    service.removeGuestCartItem(GUEST_ID, VARIANT_A).subscribe();

    expect(calls.paths).toEqual([CART_ENDPOINTS.removeGuestItem.path]);
    expect(calls.bodies).toEqual([]);
    expect(calls.options).toEqual([{ pathParams: { cartId: GUEST_ID, variantId: VARIANT_A } }]);
  });

  it('clears guest carts with cartId scoping and no body', () => {
    const { service, calls } = setup();
    service.clearGuestCart(GUEST_ID).subscribe();

    expect(calls.paths).toEqual([CART_ENDPOINTS.clearGuestCart.path]);
    expect(calls.bodies).toEqual([]);
    expect(calls.options).toEqual([{ pathParams: { cartId: GUEST_ID } }]);
  });
});

describe('CartApiService authenticated routes', () => {
  it('gets or creates the caller cart with no body and no scoping', () => {
    const { service, calls } = setup();
    service.getOrCreateCart().subscribe();

    expect(calls.paths).toEqual([CART_ENDPOINTS.getOrCreateCart.path]);
    expect(calls.bodies).toEqual([undefined]);
    expect(calls.options).toEqual([{}]);
  });

  it('reads the caller cart with no scoping', () => {
    const { service, calls } = setup();
    service.getCart().subscribe();

    expect(calls.paths).toEqual([CART_ENDPOINTS.getCart.path]);
    expect(calls.options).toEqual([{}]);
  });

  it('posts caller lines with the untouched add body and no scoping', () => {
    const { service, calls } = setup();
    service.addCartItem(ADD_BODY).subscribe();

    expect(calls.paths).toEqual([CART_ENDPOINTS.addItem.path]);
    expect(calls.bodies).toEqual([ADD_BODY]);
    expect(calls.options).toEqual([{}]);
  });

  it('puts caller quantities with line scoping and the untouched update body', () => {
    const { service, calls } = setup();
    service.updateCartItemQuantity(VARIANT_A, UPDATE_BODY).subscribe();

    expect(calls.paths).toEqual([CART_ENDPOINTS.updateItem.path]);
    expect(calls.bodies).toEqual([UPDATE_BODY]);
    expect(calls.options).toEqual([{ pathParams: { variantId: VARIANT_A } }]);
  });

  it('deletes caller lines with line scoping and no body', () => {
    const { service, calls } = setup();
    service.removeCartItem(VARIANT_A).subscribe();

    expect(calls.paths).toEqual([CART_ENDPOINTS.removeItem.path]);
    expect(calls.bodies).toEqual([]);
    expect(calls.options).toEqual([{ pathParams: { variantId: VARIANT_A } }]);
  });

  it('clears the caller cart with no scoping and no body', () => {
    const { service, calls } = setup();
    service.clearCart().subscribe();

    expect(calls.paths).toEqual([CART_ENDPOINTS.clearCart.path]);
    expect(calls.bodies).toEqual([]);
    expect(calls.options).toEqual([{}]);
  });

  it('merges guest carts with the untouched merge body and no scoping', () => {
    const { service, calls } = setup();
    service.mergeGuestCart(MERGE_BODY).subscribe();

    expect(calls.paths).toEqual([CART_ENDPOINTS.mergeCarts.path]);
    expect(calls.bodies).toEqual([MERGE_BODY]);
    expect(calls.options).toEqual([{}]);
  });
});

describe('CartApiService passthrough', () => {
  it('passes cart envelopes through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: { cartId: GUEST_ID, items: [], isGuest: true, isAuthenticated: false },
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));
    let observed: unknown;
    service.getGuestCart(GUEST_ID).subscribe((result) => {
      observed = result;
    });

    expect(observed).toBe(envelope);
  });

  it('passes guest add envelopes through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = { isSuccess: true, data: { cartId: GUEST_ID, items: [{}] } };
    vi.mocked(api.post).mockReturnValueOnce(of(envelope));
    let observed: unknown;
    service.addGuestCartItem(GUEST_ID, ADD_BODY).subscribe((result) => {
      observed = result;
    });

    expect(observed).toBe(envelope);
  });

  it('passes quantity-update envelopes through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = { isSuccess: true, data: { cartId: GUEST_ID, items: [{}] } };
    vi.mocked(api.put).mockReturnValueOnce(of(envelope));
    let observed: unknown;
    service.updateCartItemQuantity(VARIANT_A, UPDATE_BODY).subscribe((result) => {
      observed = result;
    });

    expect(observed).toBe(envelope);
  });

  it('passes clear envelopes through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = { isSuccess: true, data: { cartId: GUEST_ID, items: [] } };
    vi.mocked(api.delete).mockReturnValueOnce(of(envelope));
    let observed: unknown;
    service.clearCart().subscribe((result) => {
      observed = result;
    });

    expect(observed).toBe(envelope);
  });
});

describe('CartApiService error propagation', () => {
  it('propagates guest validation failures untouched for feature state to normalize', () => {
    const { service, api } = setup();
    const rejection = new ApiError({ status: 400, message: 'Quantity limit exceeded.' });
    vi.mocked(api.post).mockReturnValueOnce(throwError(() => rejection));
    let observed: unknown;
    service.addGuestCartItem(GUEST_ID, ADD_BODY).subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
  });

  it('propagates missing-cart failures untouched', () => {
    const { service, api } = setup();
    const rejection = new ApiError({ status: 404, message: 'Cart not found.' });
    vi.mocked(api.get).mockReturnValueOnce(throwError(() => rejection));
    let observed: unknown;
    service.getGuestCart(GUEST_ID).subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
  });

  it('propagates concurrency conflicts untouched', () => {
    const { service, api } = setup();
    const rejection = new ApiError({ status: 409, message: 'Cart version conflict.' });
    vi.mocked(api.put).mockReturnValueOnce(throwError(() => rejection));
    let observed: unknown;
    service.updateCartItemQuantity(VARIANT_A, UPDATE_BODY).subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
  });

  it('propagates authentication failures on caller reads untouched', () => {
    const { service, api } = setup();
    const rejection = new ApiError({ status: 401, message: 'Authentication required.' });
    vi.mocked(api.get).mockReturnValueOnce(throwError(() => rejection));
    let observed: unknown;
    service.getCart().subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
  });

  it('propagates merge failures untouched', () => {
    const { service, api } = setup();
    const rejection = new ApiError({ status: 404, message: 'Guest cart not found.' });
    vi.mocked(api.post).mockReturnValueOnce(throwError(() => rejection));
    let observed: unknown;
    service.mergeGuestCart(MERGE_BODY).subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
  });
});

describe('CartApiService request options', () => {
  it('forwards request options (e.g. cancellation signal) on reads', () => {
    const { service, calls } = setup();
    const controller = new AbortController();
    service.getCart({ signal: controller.signal }).subscribe();

    expect(calls.options[0]).toMatchObject({ signal: controller.signal });
  });

  it('forwards request options on writes, including merge', () => {
    const { service, calls } = setup();
    const controller = new AbortController();
    service.mergeGuestCart(MERGE_BODY, { signal: controller.signal }).subscribe();

    expect(calls.options[0]).toMatchObject({ signal: controller.signal });
  });
});
