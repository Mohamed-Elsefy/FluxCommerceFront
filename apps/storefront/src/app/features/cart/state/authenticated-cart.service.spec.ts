/**
 * Lifecycle tests for the Sub-Phase 7.6 `AuthenticatedCartService`.
 *
 * Covers the auth-driven identity lifecycle only (slot transitions live
 * in `cart-state.spec.ts`, guest bootstrap in
 * `guest-cart.service.spec.ts`): standby while restoration pends,
 * anonymous delegation to the guest flow, authenticated establishment
 * (GET-first with single-shot get-or-create fallback), login/logout
 * transitions with guest-data separation and stored-id preservation for
 * the 7.7 merge, refresh-by-reload (no local persistence), the
 * in-flight guard, server-platform standby, and authenticated CRUD
 * routing after establishment.
 *
 * The real `CartState` + real `GuestCartService` are wired to a stubbed
 * `CartApiService`, an in-memory `GUEST_CART_STORAGE` fake, and a
 * stubbed `AuthService` status machine (the lib owns the real machine —
 * covered by `auth.service.spec.ts` — this service consumes its readonly
 * signals). Auth transitions are driven by setting the stubbed status
 * and flushing effects, mirroring login/logout/restoration.
 */

import { PLATFORM_ID, computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { ApiError, type ApiResponseWithData } from '@flux/api';
import { AuthService, type AuthState } from '@flux/auth';
import { CartApiService } from '../data-access/cart-api.service';
import type { Cart } from '../models/cart.models';
import { CartState } from './cart-state';
import { GUEST_CART_STORAGE, type GuestCartStorage } from './guest-cart-storage.service';
import { GuestCartService } from './guest-cart.service';
import { AuthenticatedCartService } from './authenticated-cart.service';

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
    cartId: AUTH_ID,
    userId: USER_ID,
    version: 1,
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:05:00Z',
    items: [line({ sku: 'HOOD-GRY-L', productName: 'Hoodie' })],
    isGuest: false,
    isAuthenticated: true,
    ...overrides,
  };
}

/**
 * Backend-merged cart: guest lines folded into the caller's cart with
 * backend-consolidated quantities (5 = 2 guest + 3 existing — asserted
 * verbatim below; the client never computes this).
 */
function mergedCart(): Cart {
  return authCart({
    version: 3,
    items: [
      line({ sku: 'HOOD-GRY-L', productName: 'Hoodie' }),
      line({
        variantId: 'dddddddd-4444-4444-8444-444444444444',
        sku: 'TEE-BLK-M',
        productName: 'Tee',
        quantity: 5,
      }),
    ],
  });
}

function cartEnvelope(cart: Cart): ApiResponseWithData<Cart> {
  return { isSuccess: true, data: cart };
}

function notFound(): ApiError {
  return new ApiError({ status: 404, message: 'Cart not found.', code: 'Cart.CartNotFound' });
}

const API_METHODS = [
  'createGuestCart',
  'getOrCreateCart',
  'getGuestCart',
  'getCart',
  'mergeGuestCart',
  'addGuestCartItem',
  'addCartItem',
] as const;

type ApiMethod = (typeof API_METHODS)[number];
type Flow = () => Observable<ApiResponseWithData<Cart>>;

interface RecordedCall {
  method: string;
  args: unknown[];
}

function setup(
  flows: Partial<Record<ApiMethod, Flow>> = {},
  options: {
    authStatus?: AuthState;
    storedGuestId?: string | null;
    platform?: 'browser' | 'server';
  } = {},
): {
  service: AuthenticatedCartService;
  state: CartState;
  setAuthStatus: (status: AuthState) => void;
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
      return flows[method]?.() ?? of(cartEnvelope(guestCart()));
    };
  }
  let stored: string | null = options.storedGuestId ?? null;
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
  const authStatus = signal<AuthState>(options.authStatus ?? 'initializing');
  const authStub = {
    status: authStatus.asReadonly(),
    initialized: computed(() => authStatus() !== 'initializing'),
    isAuthenticated: computed(() => authStatus() === 'authenticated'),
  };

  TestBed.configureTestingModule({
    providers: [
      { provide: CartApiService, useValue: apiStub },
      { provide: GUEST_CART_STORAGE, useValue: storage },
      { provide: AuthService, useValue: authStub },
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
      CartState,
      GuestCartService,
      AuthenticatedCartService,
    ],
  });
  return {
    service: TestBed.inject(AuthenticatedCartService),
    state: TestBed.inject(CartState),
    setAuthStatus: (status: AuthState) => authStatus.set(status),
    calls,
    savedIds,
    stored: () => stored,
    clearCount: () => clears,
  };
}

function methodsOf(calls: RecordedCall[]): string[] {
  return calls.map((call) => call.method);
}

describe('AuthenticatedCartService session standby', () => {
  it('fetches nothing while restoration pends', () => {
    const { service, state, calls } = setup({}, { authStatus: 'initializing' });
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual([]);
    expect(state.identity()).toBeNull();
    expect(state.cart().status).toBe('idle');
    expect(service).toBeDefined();
  });

  it('stands by on the server platform without fetching', () => {
    const { state, calls } = setup({}, { authStatus: 'authenticated', platform: 'server' });
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual([]);
    expect(state.identity()).toBeNull();
    expect(state.cart().status).toBe('idle');
  });
});

describe('AuthenticatedCartService anonymous session', () => {
  it('delegates to the guest lifecycle (create on first visit)', () => {
    const { state, calls, stored } = setup({}, { authStatus: 'anonymous' });
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual(['createGuestCart']);
    expect(state.identity()).toEqual({ kind: 'guest', cartId: GUEST_ID });
    expect(stored()).toBe(GUEST_ID);
  });

  it('delegates to the stored guest cart on return visits', () => {
    const { state, calls } = setup({}, { authStatus: 'anonymous', storedGuestId: GUEST_ID });
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual(['getGuestCart']);
    expect(state.identity()).toEqual({ kind: 'guest', cartId: GUEST_ID });
  });
});

describe('AuthenticatedCartService authenticated session', () => {
  it('establishes the authenticated cart with GET-first (no creation call)', () => {
    const { state, calls } = setup(
      { getCart: () => of(cartEnvelope(authCart())) },
      { authStatus: 'authenticated' },
    );
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual(['getCart']);
    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(state.data()?.cartId).toBe(AUTH_ID);
    expect(state.isSuccess()).toBe(true);
  });

  it('falls back to get-or-create once when no active cart exists', () => {
    const { state, calls } = setup(
      {
        getCart: () => throwError(() => notFound()),
        getOrCreateCart: () => of(cartEnvelope(authCart({ items: [] }))),
      },
      { authStatus: 'authenticated' },
    );
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual(['getCart', 'getOrCreateCart']);
    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(state.isEmpty()).toBe(true);
  });

  it('falls back to get-or-create on a codeless 404 (real wire shape)', () => {
    const codeless = new ApiError({ status: 404, message: 'Not found.' });
    const { state, calls } = setup(
      {
        getCart: () => throwError(() => codeless),
        getOrCreateCart: () => of(cartEnvelope(authCart({ items: [] }))),
      },
      { authStatus: 'authenticated' },
    );
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual(['getCart', 'getOrCreateCart']);
    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(state.isEmpty()).toBe(true);
  });

  it('surfaces non-404 establish failures without get-or-create', () => {
    const rejection = new ApiError({ status: 401, message: 'Anonymous.' });
    const { state, calls } = setup(
      { getCart: () => throwError(() => rejection) },
      { authStatus: 'authenticated' },
    );
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual(['getCart']);
    expect(state.isError()).toBe(true);
    expect(state.error()).toBe(rejection);
  });

  it('routes authenticated CRUD through the session (no cart id)', () => {
    const { service, state, calls } = setup(
      { getCart: () => of(cartEnvelope(authCart())) },
      { authStatus: 'authenticated' },
    );
    TestBed.flushEffects();

    expect(service).toBeDefined();
    state.addItem({ variantId: VARIANT_A, unitPriceAmount: 29.99, currency: 'USD', quantity: 1 });

    const add = calls.find((call) => call.method === 'addCartItem');
    expect(add?.args).toEqual([
      { variantId: VARIANT_A, unitPriceAmount: 29.99, currency: 'USD', quantity: 1 },
      {},
    ]);
  });
});

describe('AuthenticatedCartService auth transitions', () => {
  function loginSetup(): ReturnType<typeof setup> {
    return setup(
      {
        getGuestCart: () => of(cartEnvelope(guestCart())),
        getCart: () => of(cartEnvelope(authCart())),
        mergeGuestCart: () => of(cartEnvelope(mergedCart())),
      },
      { authStatus: 'anonymous', storedGuestId: GUEST_ID },
    );
  }

  it('replaces guest state with the merged cart on login (no mixing)', () => {
    const harness = loginSetup();
    const { state, calls, setAuthStatus, stored, clearCount } = harness;
    TestBed.flushEffects();
    expect(state.identity()).toEqual({ kind: 'guest', cartId: GUEST_ID });
    expect(state.data()?.cartId).toBe(GUEST_ID);

    setAuthStatus('authenticated');
    TestBed.flushEffects();

    // Merge — never a plain load while the guest bookmark exists.
    expect(methodsOf(calls)).toEqual(['getGuestCart', 'mergeGuestCart']);
    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(state.data()?.cartId).toBe(AUTH_ID);
    expect(state.data()?.items.map((item) => item.sku)).toEqual(['HOOD-GRY-L', 'TEE-BLK-M']);
    expect(state.data()?.items.map((item) => item.quantity)).toEqual([2, 5]);
    // Source died server-side: the local bookmark is cleared (merge input consumed).
    expect(stored()).toBeNull();
    expect(clearCount()).toBe(1);
  });

  it('returns to a fresh guest cart on logout (merge input already consumed)', () => {
    const { state, calls, setAuthStatus, stored } = setup(
      {
        getGuestCart: () => of(cartEnvelope(guestCart())),
        getCart: () => of(cartEnvelope(authCart())),
        mergeGuestCart: () => of(cartEnvelope(mergedCart())),
      },
      { authStatus: 'anonymous', storedGuestId: GUEST_ID },
    );
    TestBed.flushEffects();
    setAuthStatus('authenticated');
    TestBed.flushEffects();
    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(stored()).toBeNull();

    setAuthStatus('anonymous');
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual(['getGuestCart', 'mergeGuestCart', 'createGuestCart']);
    expect(state.identity()).toEqual({ kind: 'guest', cartId: GUEST_ID });
    expect(state.data()?.cartId).toBe(GUEST_ID);
  });

  it('loads the persisted cart after session restoration (refresh retention)', () => {
    const { state, calls, setAuthStatus, stored, clearCount } = setup(
      { getCart: () => of(cartEnvelope(authCart())) },
      { authStatus: 'initializing' },
    );
    TestBed.flushEffects();
    expect(methodsOf(calls)).toEqual([]);

    // Restoration settles the session (the lib's 2.8 path, same signal).
    setAuthStatus('authenticated');
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual(['getCart']);
    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(state.data()?.cartId).toBe(AUTH_ID);
    // No local cart persistence involved: storage untouched.
    expect(stored()).toBeNull();
    expect(clearCount()).toBe(0);
  });

  it('never disturbs in-flight work on auth transitions', () => {
    const pending = new Observable<ApiResponseWithData<Cart>>(() => undefined);
    const { state, calls, setAuthStatus } = setup(
      { getGuestCart: () => pending },
      { authStatus: 'anonymous', storedGuestId: GUEST_ID },
    );
    TestBed.flushEffects();
    expect(state.isLoading()).toBe(true);

    setAuthStatus('authenticated');
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual(['getGuestCart']);
    expect(state.identity()).toEqual({ kind: 'guest', cartId: GUEST_ID });
  });
});

describe('AuthenticatedCartService merge (Sub-Phase 7.7)', () => {
  it('merges on mount while already authenticated (post-login navigation path)', () => {
    const { state, calls, stored, clearCount } = setup(
      { mergeGuestCart: () => of(cartEnvelope(mergedCart())) },
      { authStatus: 'authenticated', storedGuestId: GUEST_ID },
    );
    TestBed.flushEffects();

    // No plain load first: the bookmark is the merge trigger.
    expect(methodsOf(calls)).toEqual(['mergeGuestCart']);
    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(state.data()?.items.map((item) => item.quantity)).toEqual([2, 5]);
    expect(stored()).toBeNull();
    expect(clearCount()).toBe(1);
  });

  it('sends the stored guest identity as the merge source and nothing else', () => {
    const { calls } = setup(
      { mergeGuestCart: () => of(cartEnvelope(mergedCart())) },
      { authStatus: 'authenticated', storedGuestId: GUEST_ID },
    );
    TestBed.flushEffects();

    const merge = calls.find((call) => call.method === 'mergeGuestCart');
    expect(merge?.args).toEqual([{ guestCartId: GUEST_ID }, {}]);
  });

  it('falls back to establishment when the guest source expired (404)', () => {
    const expired = new ApiError({
      status: 404,
      message: 'Cart not found.',
      code: 'Cart.CartNotFound',
    });
    const { state, calls, stored } = setup(
      {
        mergeGuestCart: () => throwError(() => expired),
        getCart: () => of(cartEnvelope(authCart({ items: [] }))),
      },
      { authStatus: 'authenticated', storedGuestId: GUEST_ID },
    );
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual(['mergeGuestCart', 'getCart']);
    expect(state.isEmpty()).toBe(true);
    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(stored()).toBeNull();
  });

  it('falls back to establishment on a codeless merge 404 (real wire shape)', () => {
    const codeless = new ApiError({ status: 404, message: 'Not found.' });
    const { state, calls, stored } = setup(
      {
        mergeGuestCart: () => throwError(() => codeless),
        getCart: () => of(cartEnvelope(authCart({ items: [] }))),
      },
      { authStatus: 'authenticated', storedGuestId: GUEST_ID },
    );
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual(['mergeGuestCart', 'getCart']);
    expect(state.isEmpty()).toBe(true);
    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(stored()).toBeNull();
  });

  it('falls back to establishment on invalid merge sources (400)', () => {
    const invalid = new ApiError({
      status: 400,
      message: 'Bad cart id.',
      code: 'Cart.InvalidCartId',
    });
    const { state, calls, stored } = setup(
      {
        mergeGuestCart: () => throwError(() => invalid),
        getCart: () => of(cartEnvelope(authCart())),
      },
      { authStatus: 'authenticated', storedGuestId: GUEST_ID },
    );
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual(['mergeGuestCart', 'getCart']);
    expect(state.isSuccess()).toBe(true);
    expect(stored()).toBeNull();
  });

  it('surfaces merge failures with the bookmark preserved for retry', () => {
    const rejection = new ApiError({ status: 500, message: 'Server error.' });
    const { service, state, calls, stored, clearCount } = setup(
      { mergeGuestCart: () => throwError(() => rejection) },
      { authStatus: 'authenticated', storedGuestId: GUEST_ID },
    );
    TestBed.flushEffects();

    expect(methodsOf(calls)).toEqual(['mergeGuestCart']);
    expect(state.isError()).toBe(true);
    expect(state.error()).toBe(rejection);
    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(stored()).toBe(GUEST_ID);
    expect(clearCount()).toBe(0);

    // Explicit retry re-merges (the trigger condition is intact).
    service.synchronize();
    expect(methodsOf(calls)).toEqual(['mergeGuestCart', 'mergeGuestCart']);
  });

  it('never merges twice: post-merge synchronization establishes instead', () => {
    const { service, calls } = setup(
      {
        mergeGuestCart: () => of(cartEnvelope(mergedCart())),
        getCart: () => of(cartEnvelope(authCart())),
      },
      { authStatus: 'authenticated', storedGuestId: GUEST_ID },
    );
    TestBed.flushEffects();
    expect(methodsOf(calls)).toEqual(['mergeGuestCart']);

    service.synchronize();

    expect(methodsOf(calls)).toEqual(['mergeGuestCart', 'getCart']);
  });
});
