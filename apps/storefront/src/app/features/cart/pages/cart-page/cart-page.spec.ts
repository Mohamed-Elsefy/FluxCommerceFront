/**
 * Page tests for the Sub-Phase 7.4 `CartPage` (plus the Sub-Phase 7.5
 * guest lifecycle and Sub-Phases 7.6–7.7 session lifecycle wiring).
 *
 * Covers page orchestration only (state transitions live in
 * `cart-state.spec.ts`, the guest lifecycle in
 * `guest-cart.service.spec.ts`, the session lifecycle and merge trigger
 * in `authenticated-cart.service.spec.ts`, presentational contracts in
 * the component specs): the standby shell on the server and while
 * restoration pends (synchronization is browser-only), guest bootstrap
 * on first visit (creation) and return visits (stored identity),
 * expired-identity recovery, authenticated establishment (GET-first with
 * get-or-create fallback), login merge (stored guest source post,
 * backend-merged adoption, bookmark cleared) and logout/reset flows,
 * backend-only price display (no locally computed line totals anywhere),
 * quantity/remove/clear bubbling into feature state, error retry
 * through the session lifecycle, the in-flight control freeze, the
 * checkout navigation boundary, localized document title, and Arabic
 * rendering.
 *
 * The real `CartState`, `GuestCartService`, `AuthenticatedCartService`,
 * and `AuthService` are wired to a stubbed `CartApiService` and the real
 * (cleared per test) `localStorage`-backed storage, so these tests pin
 * the full page → lifecycle → state → data-access delegation path —
 * including genuine login-merge/logout/restoration transitions —
 * without HTTP.
 */

import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { provideApi, provideAppEnvironment, ApiError, type ApiResponseWithData } from '@flux/api';
import { AuthService, type CurrentUser } from '@flux/auth';
import { CultureService, formatCurrency, type Culture } from '@flux/i18n';
import { CartApiService } from '../../data-access/cart-api.service';
import { GUEST_CART_STORAGE_KEY } from '../../state/guest-cart-storage.service';
import { GuestCartService } from '../../state/guest-cart.service';
import { AuthenticatedCartService } from '../../state/authenticated-cart.service';
import { CartState } from '../../state/cart-state';
import type { Cart, CartItem } from '../../models/cart.models';
import { CartPage } from './cart-page';

const GUEST_ID = '11111111-1111-4111-8111-111111111111';
const AUTH_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = 'cccccccc-3333-4333-8333-333333333333';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const VARIANT_A = 'aaaaaaaa-1111-4111-8111-111111111111';
const VARIANT_B = 'bbbbbbbb-2222-4222-8222-222222222222';

const USER: CurrentUser = {
  id: USER_ID,
  email: 'ada@flux.local',
  displayName: 'Ada Lovelace',
  roles: ['Customer'],
  isEmailVerified: true,
};

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

function guestCart(overrides: Partial<Cart> = {}): Cart {
  return {
    cartId: GUEST_ID,
    userId: null,
    version: 1,
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:05:00Z',
    items: [
      line(),
      line({ variantId: VARIANT_B, sku: 'TEE-WHT-M', unitPriceAmount: 14.5, quantity: 3 }),
    ],
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
    items: [
      line({ variantId: VARIANT_A, sku: 'HOOD-GRY-L', productName: 'Hoodie' }),
      line({ variantId: VARIANT_B, sku: 'HOOD-BLK-L', productName: 'Hoodie', quantity: 1 }),
    ],
    isGuest: false,
    isAuthenticated: true,
    ...overrides,
  };
}

/**
 * Backend-merged cart: guest lines folded into the caller's cart with
 * backend-consolidated quantities — asserted verbatim (the client never
 * computes merge results).
 */
function mergedCart(): Cart {
  return authCart({
    version: 3,
    items: [
      line({ variantId: VARIANT_A, sku: 'HOOD-GRY-L', productName: 'Hoodie' }),
      line({ variantId: VARIANT_B, sku: 'TEE-BLK-M', productName: 'Tee', quantity: 5 }),
    ],
  });
}

function cartEnvelope(cart: Cart = guestCart()): ApiResponseWithData<Cart> {
  return { isSuccess: true, data: cart };
}

const API_METHODS = [
  'createGuestCart',
  'getOrCreateCart',
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

type ApiMethod = (typeof API_METHODS)[number];
type Flow = () => Observable<ApiResponseWithData<Cart>>;
type SessionStatus = 'initializing' | 'anonymous' | 'authenticated';

interface RecordedCall {
  method: string;
  args: unknown[];
}

function setup(
  flows: Partial<Record<ApiMethod, Flow>> = {},
  culture: Culture = 'en',
  options: {
    storedGuestCartId?: string;
    platform?: 'browser' | 'server';
    session?: SessionStatus;
  } = {},
): {
  fixture: ComponentFixture<CartPage>;
  element: HTMLElement;
  state: CartState;
  auth: AuthService;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const apiStub: Record<string, (...args: unknown[]) => Observable<ApiResponseWithData<Cart>>> = {};
  for (const method of API_METHODS) {
    apiStub[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return flows[method]?.() ?? of(cartEnvelope());
    };
  }

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideAppEnvironment({
        name: 'development',
        production: false,
        appName: 'test',
        apiBaseUrl: '/api',
      }),
      provideApi(),
      provideHttpClientTesting(),
      { provide: CartApiService, useValue: apiStub },
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
      CartState,
      GuestCartService,
      AuthenticatedCartService,
    ],
  });
  window.localStorage.clear();
  if (options.storedGuestCartId !== undefined) {
    window.localStorage.setItem(GUEST_CART_STORAGE_KEY, options.storedGuestCartId);
  }
  TestBed.inject(CultureService).setCulture(culture);
  const auth = TestBed.inject(AuthService);
  const session = options.session ?? 'anonymous';
  if (session === 'anonymous') {
    auth.markInitializedAnonymous();
  } else if (session === 'authenticated') {
    auth.setAuthenticated({ user: USER, accessToken: 'test-access-token' });
  }
  const fixture = TestBed.createComponent(CartPage);
  fixture.detectChanges();
  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    state: TestBed.inject(CartState),
    auth,
    calls,
  };
}

/**
 * Drives settled guest content directly through the explicit identity
 * seam (bypasses the 7.5 bootstrap, which already ran once at component
 * creation): lets rendering/action tests control the settled payload
 * per test without re-testing the lifecycle itself.
 */
function loadGuestCart(state: CartState, fixture: ComponentFixture<CartPage>): void {
  state.setIdentity({ kind: 'guest', cartId: GUEST_ID });
  state.loadCart();
  fixture.detectChanges();
}

function methodsOf(calls: RecordedCall[]): string[] {
  return calls.map((call) => call.method);
}

describe('CartPage standby (server render, before browser bootstrap)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the standby state without fetching and titles the document', () => {
    const { element, calls } = setup({}, 'en', { platform: 'server' });

    expect(element.querySelector('#cart-page-title')?.textContent).toBe('Your cart');
    expect(element.querySelector('.cart-page-standby')?.textContent).toBe(
      'Your cart will appear here.',
    );
    expect(calls).toHaveLength(0);
    expect(TestBed.inject(Title).getTitle()).toBe('Your cart | FluxCommerce');
  });

  it('renders the standby copy in Arabic with an Arabic title', () => {
    const { element } = setup({}, 'ar', { platform: 'server' });

    expect(element.querySelector('#cart-page-title')?.textContent).toBe('سلة التسوق');
    expect(element.querySelector('.cart-page-standby')?.textContent).toBe('ستظهر سلة التسوق هنا.');
    expect(TestBed.inject(Title).getTitle()).toBe('سلة التسوق | FluxCommerce');
  });

  it('stands by while session restoration pends (never treats initializing as anonymous)', () => {
    const { element, calls } = setup({}, 'en', { session: 'initializing' });

    expect(element.querySelector('.cart-page-standby')).not.toBeNull();
    expect(calls).toHaveLength(0);
  });
});

describe('CartPage guest bootstrap (Sub-Phase 7.5)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('creates the guest cart on first visit and persists the issued id', () => {
    const { element, calls } = setup();

    expect(methodsOf(calls)).toEqual(['createGuestCart']);
    expect(element.querySelectorAll('.cart-items-line')).toHaveLength(2);
    expect(window.localStorage.getItem(GUEST_CART_STORAGE_KEY)).toBe(GUEST_ID);
  });

  it('loads the stored guest cart on return visits instead of creating', () => {
    const { element, calls } = setup({}, 'en', { storedGuestCartId: GUEST_ID });

    expect(methodsOf(calls)).toEqual(['getGuestCart']);
    expect(element.querySelectorAll('.cart-items-line')).toHaveLength(2);
  });

  it('recovers an expired stored cart with a fresh guest cart', () => {
    const freshId = '33333333-3333-4333-8333-333333333333';
    const expired = new ApiError({
      status: 404,
      message: 'Cart not found.',
      code: 'Cart.CartNotFound',
    });
    const { element, calls } = setup(
      {
        getGuestCart: () => throwError(() => expired),
        createGuestCart: () => of(cartEnvelope(guestCart({ cartId: freshId, items: [] }))),
      },
      'en',
      { storedGuestCartId: GUEST_ID },
    );

    expect(methodsOf(calls)).toEqual(['getGuestCart', 'createGuestCart']);
    expect(window.localStorage.getItem(GUEST_CART_STORAGE_KEY)).toBe(freshId);
    expect(element.textContent).toContain('Your cart is empty');
  });
});

describe('CartPage authenticated session (Sub-Phases 7.6–7.7)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('establishes the authenticated cart on init without touching guest state', () => {
    const { element, state, calls } = setup({ getCart: () => of(cartEnvelope(authCart())) }, 'en', {
      session: 'authenticated',
    });

    expect(methodsOf(calls)).toEqual(['getCart']);
    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(element.querySelectorAll('.cart-items-line')).toHaveLength(2);
    expect(element.textContent).toContain('HOOD-GRY-L');
    expect(window.localStorage.getItem(GUEST_CART_STORAGE_KEY)).toBeNull();
  });

  it('falls back to get-or-create when the user has no active cart yet', () => {
    const noCart = new ApiError({
      status: 404,
      message: 'Cart not found.',
      code: 'Cart.CartNotFound',
    });
    const { element, calls } = setup(
      {
        getCart: () => throwError(() => noCart),
        getOrCreateCart: () => of(cartEnvelope(authCart({ items: [] }))),
      },
      'en',
      { session: 'authenticated' },
    );

    expect(methodsOf(calls)).toEqual(['getCart', 'getOrCreateCart']);
    expect(element.textContent).toContain('Your cart is empty');
  });

  it('merges the guest cart into the authenticated cart on login (no mixing)', () => {
    const { element, fixture, state, auth, calls } = setup(
      {
        mergeGuestCart: () => of(cartEnvelope(mergedCart())),
      },
      'en',
      { storedGuestCartId: GUEST_ID },
    );
    expect(methodsOf(calls)).toEqual(['getGuestCart']);
    expect(element.querySelectorAll('.cart-items-line')).toHaveLength(2);
    expect(element.textContent).toContain('TEE-BLK-M');

    auth.setAuthenticated({ user: USER, accessToken: 'test-access-token' });
    fixture.detectChanges();

    // Merge — never a plain load while the guest bookmark exists.
    expect(methodsOf(calls)).toEqual(['getGuestCart', 'mergeGuestCart']);
    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(element.textContent).toContain('HOOD-GRY-L');
    expect(element.textContent).toContain('TEE-BLK-M');
    // Source died server-side: the local bookmark is cleared.
    expect(window.localStorage.getItem(GUEST_CART_STORAGE_KEY)).toBeNull();
  });

  it('starts a fresh guest cart on logout after the merge consumed the bookmark', () => {
    const { element, fixture, state, auth, calls } = setup(
      { mergeGuestCart: () => of(cartEnvelope(mergedCart())) },
      'en',
      { session: 'authenticated', storedGuestCartId: GUEST_ID },
    );
    expect(methodsOf(calls)).toEqual(['mergeGuestCart']);
    expect(state.identity()).toEqual({ kind: 'authenticated' });

    auth.clearSession();
    fixture.detectChanges();

    expect(methodsOf(calls)).toEqual(['mergeGuestCart', 'createGuestCart']);
    expect(state.identity()).toEqual({ kind: 'guest', cartId: GUEST_ID });
    expect(element.textContent).toContain('TEE-BLK-M');
  });

  it('loads the persisted cart after session restoration (refresh retention)', () => {
    const { element, fixture, state, auth, calls } = setup(
      { getCart: () => of(cartEnvelope(authCart())) },
      'en',
      { session: 'initializing' },
    );
    expect(element.querySelector('.cart-page-standby')).not.toBeNull();
    expect(calls).toHaveLength(0);

    auth.setAuthenticated({ user: USER, accessToken: 'test-access-token' });
    fixture.detectChanges();

    expect(methodsOf(calls)).toEqual(['getCart']);
    expect(state.identity()).toEqual({ kind: 'authenticated' });
    expect(element.querySelectorAll('.cart-items-line')).toHaveLength(2);
    expect(element.textContent).toContain('HOOD-GRY-L');
    // Backend persistence owns refreshes: guest storage untouched.
    expect(window.localStorage.getItem(GUEST_CART_STORAGE_KEY)).toBeNull();
  });

  it('retries the authenticated load on retry after a failure', () => {
    const rejection = new ApiError({ status: 401, message: 'Anonymous.' });
    let failNext = true;
    const { element, fixture, calls } = setup(
      { getCart: () => (failNext ? throwError(() => rejection) : of(cartEnvelope(authCart()))) },
      'en',
      { session: 'authenticated' },
    );
    expect(element.textContent).toContain('Cart unavailable');

    failNext = false;
    const errorState = element.querySelector('flux-error-state') as HTMLElement | null;
    expect(errorState).not.toBeNull();
    (errorState?.querySelector('.retry') as HTMLButtonElement | null)?.click();
    fixture.detectChanges();

    expect(methodsOf(calls)).toEqual(['getCart', 'getCart']);
    expect(element.querySelectorAll('.cart-items-line')).toHaveLength(2);
  });
});

describe('CartPage loading and success', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the loading indicator while the cart is in flight', () => {
    const pending = new Observable<ApiResponseWithData<Cart>>(() => undefined);
    const { element, state, fixture } = setup({ getGuestCart: () => pending });
    state.setIdentity({ kind: 'guest', cartId: GUEST_ID });
    state.loadCart();
    fixture.detectChanges();

    expect(element.textContent).toContain('Loading your cart…');
  });

  it('renders backend lines with unit prices and the summary once loaded', () => {
    const { element, state, fixture } = setup();
    loadGuestCart(state, fixture);
    const text = element.textContent ?? '';

    expect(element.querySelectorAll('.cart-items-line')).toHaveLength(2);
    expect(text).toContain('Tee');
    expect(text).toContain('TEE-BLK-M');
    expect(text).toContain(formatCurrency(29.99, 'USD', 'en'));
    expect(text).toContain(formatCurrency(14.5, 'USD', 'en'));
    expect(text).toContain('Order summary');
    expect(text).toContain('Items');
    expect(text).toContain('5');
    expect(text).toContain('Totals are finalized at checkout.');
    expect(element.querySelector('.cart-summary-checkout')?.getAttribute('href')).toBe('/checkout');
  });

  it('renders no locally computed line totals anywhere on the page', () => {
    const { element, state, fixture } = setup();
    loadGuestCart(state, fixture);
    const text = element.textContent ?? '';
    const forbiddenFirst = formatCurrency(29.99 * 2, 'USD', 'en');
    const forbiddenSecond = formatCurrency(14.5 * 3, 'USD', 'en');

    expect(forbiddenFirst).not.toBe('');
    expect(forbiddenSecond).not.toBe('');
    expect(text).not.toContain(forbiddenFirst);
    expect(text).not.toContain(forbiddenSecond);
  });
});

describe('CartPage empty and error', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the empty state with a catalog link for zero-line carts', () => {
    const { element, state, fixture } = setup({
      getGuestCart: () => of(cartEnvelope(guestCart({ items: [] }))),
    });
    loadGuestCart(state, fixture);

    expect(element.textContent).toContain('Your cart is empty');
    expect(element.textContent).toContain('Browse the catalog and add something you like.');
    const browse = element.querySelector('.cart-page-browse a');
    expect(browse?.getAttribute('href')).toBe('/catalog');
    expect(browse?.textContent).toBe('Browse the catalog');
  });

  it('renders the error state and retries the load on retry', () => {
    const rejection = new ApiError({ status: 404, message: 'Cart not found.' });
    let failNext = true;
    const { element, state, fixture, calls } = setup({
      getGuestCart: () => (failNext ? throwError(() => rejection) : of(cartEnvelope())),
    });
    loadGuestCart(state, fixture);

    expect(element.textContent).toContain('Cart unavailable');

    failNext = false;
    const errorState = element.querySelector('flux-error-state') as HTMLElement | null;
    expect(errorState).not.toBeNull();
    (errorState?.querySelector('.retry') as HTMLButtonElement | null)?.click();
    fixture.detectChanges();

    // Bootstrap creation first, then the failed load, then the retry load
    // (retry re-enters the guest lifecycle against the stored identity).
    expect(methodsOf(calls)).toEqual(['createGuestCart', 'getGuestCart', 'getGuestCart']);
    expect(element.querySelectorAll('.cart-items-line')).toHaveLength(2);
  });

  it('keeps settled content with an error banner when a mutation fails', () => {
    const rejection = new ApiError({ status: 400, message: 'Quantity limit exceeded.' });
    let failNext = false;
    const { element, state, fixture } = setup({
      updateGuestCartItemQuantity: () =>
        failNext ? throwError(() => rejection) : of(cartEnvelope()),
    });
    loadGuestCart(state, fixture);
    expect(element.querySelectorAll('.cart-items-line')).toHaveLength(2);

    failNext = true;
    state.updateQuantity(VARIANT_A, 5);
    fixture.detectChanges();

    expect(element.querySelectorAll('.cart-items-line')).toHaveLength(2);
    expect(element.textContent).toContain('Cart unavailable');
  });
});

describe('CartPage actions', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('forwards per-line quantity changes into feature state', () => {
    const { element, state, fixture, calls } = setup();
    loadGuestCart(state, fixture);
    const increase = element
      .querySelectorAll('.cart-items-line')[0]
      ?.querySelectorAll('.quantity-control-button')[1];

    increase?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    const update = calls.find((call) => call.method === 'updateGuestCartItemQuantity');
    expect(update?.args).toEqual([GUEST_ID, VARIANT_A, { variantId: VARIANT_A, quantity: 3 }, {}]);
  });

  it('forwards per-line removes into feature state', () => {
    const { element, state, fixture, calls } = setup();
    loadGuestCart(state, fixture);
    const remove = element
      .querySelectorAll('.cart-items-line')[1]
      ?.querySelector('.cart-item-remove');

    remove?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    const removal = calls.find((call) => call.method === 'removeGuestCartItem');
    expect(removal?.args).toEqual([GUEST_ID, VARIANT_B, {}]);
  });

  it('forwards the clear action into feature state', () => {
    const { element, state, fixture, calls } = setup();
    loadGuestCart(state, fixture);
    const clear = element.querySelector('.cart-summary-clear');

    clear?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    const clearing = calls.find((call) => call.method === 'clearGuestCart');
    expect(clearing?.args).toEqual([GUEST_ID, {}]);
  });

  it('freezes line controls while a mutation is in flight', () => {
    const pending = new Observable<ApiResponseWithData<Cart>>(() => undefined);
    const { element, state, fixture } = setup({
      updateGuestCartItemQuantity: () => pending,
    });
    loadGuestCart(state, fixture);
    const increase = element
      .querySelectorAll('.cart-items-line')[0]
      ?.querySelectorAll('.quantity-control-button')[1];

    increase?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    const steppers = [...element.querySelectorAll('.quantity-control-button')].map(
      (button) => button as HTMLButtonElement,
    );
    // Non-vacuous: two settled lines stay mounted (stale-while-revalidate),
    // so four steppers exist and freeze.
    expect(steppers).toHaveLength(4);
    expect(steppers.every((button) => button.disabled)).toBe(true);
    expect(
      (element.querySelector('.cart-summary-clear') as HTMLButtonElement | null)?.disabled,
    ).toBe(true);
  });
});

describe('CartPage success announcements and focus repair (Sub-Phase 7.8)', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  function settledGuest(flows: Partial<Record<ApiMethod, Flow>> = {}): ReturnType<typeof setup> {
    const harness = setup(flows);
    loadGuestCart(harness.state, harness.fixture);
    return harness;
  }

  function announcementOf(element: HTMLElement): HTMLElement | null {
    return element.querySelector('.cart-page-announcement');
  }

  it('renders a permanent polite live region (initially empty)', () => {
    const { element } = settledGuest();

    const region = announcementOf(element);
    expect(region).not.toBeNull();
    expect(region?.getAttribute('role')).toBe('status');
    expect(region?.textContent).toBe('');
  });

  it('stays silent on the initial establish', () => {
    const { element } = setup();

    expect(announcementOf(element)?.textContent).toBe('');
  });

  it('announces settled quantity updates in the active culture', () => {
    const { element, fixture } = settledGuest();

    element
      .querySelectorAll('.cart-items-line')[0]
      ?.querySelectorAll('.quantity-control-button')[1]
      ?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(announcementOf(element)?.textContent).toBe('Quantity updated.');
  });

  it('announces quantity updates in Arabic for the RTL culture', () => {
    const harness = setup({}, 'ar');
    loadGuestCart(harness.state, harness.fixture);

    harness.element
      .querySelectorAll('.cart-items-line')[0]
      ?.querySelectorAll('.quantity-control-button')[1]
      ?.dispatchEvent(new Event('click'));
    harness.fixture.detectChanges();

    expect(announcementOf(harness.element)?.textContent).toBe('تم تحديث الكمية.');
  });

  it('announces settled removals and moves focus to the items heading', () => {
    const { element, fixture } = settledGuest();

    (
      element
        .querySelectorAll('.cart-items-line')[0]
        ?.querySelector('.cart-item-remove') as HTMLButtonElement | null
    )?.click();
    fixture.detectChanges();

    expect(announcementOf(element)?.textContent).toBe('Item removed from your cart.');
    expect(document.activeElement).toBe(element.querySelector('#cart-items-title'));
  });

  it('moves focus to the page title when the last line is removed', () => {
    const { element, fixture } = settledGuest({
      removeGuestCartItem: () => of(cartEnvelope(guestCart({ items: [] }))),
    });

    (
      element
        .querySelectorAll('.cart-items-line')[0]
        ?.querySelector('.cart-item-remove') as HTMLButtonElement | null
    )?.click();
    fixture.detectChanges();

    expect(element.textContent).toContain('Your cart is empty');
    expect(document.activeElement).toBe(element.querySelector('#cart-page-title'));
  });

  it('announces a settled clear and moves focus to the page title', () => {
    const { element, fixture } = settledGuest({
      clearGuestCart: () => of(cartEnvelope(guestCart({ items: [] }))),
    });

    (element.querySelector('.cart-summary-clear') as HTMLButtonElement | null)?.click();
    fixture.detectChanges();

    expect(announcementOf(element)?.textContent).toBe('Your cart was cleared.');
    expect(document.activeElement).toBe(element.querySelector('#cart-page-title'));
  });

  it('stays silent on failures (the alert error banner covers those)', () => {
    const rejection = new ApiError({ status: 400, message: 'Quantity limit exceeded.' });
    const { element, fixture } = settledGuest({
      updateGuestCartItemQuantity: () => throwError(() => rejection),
    });

    element
      .querySelectorAll('.cart-items-line')[0]
      ?.querySelectorAll('.quantity-control-button')[1]
      ?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(announcementOf(element)?.textContent).toBe('');
    expect(element.querySelector('flux-error-state')).not.toBeNull();
  });

  it('renders the error shell with retry when the login merge fails', () => {
    const rejection = new ApiError({ status: 500, message: 'Server error.' });
    const { element, fixture, calls } = setup(
      { mergeGuestCart: () => throwError(() => rejection) },
      'en',
      { session: 'authenticated', storedGuestCartId: GUEST_ID },
    );
    expect(element.querySelector('flux-error-state')).not.toBeNull();

    const errorState = element.querySelector('flux-error-state') as HTMLElement | null;
    (errorState?.querySelector('.retry') as HTMLButtonElement | null)?.click();
    fixture.detectChanges();

    // Retry re-merges (the bookmark survived the failure).
    expect(methodsOf(calls)).toEqual(['mergeGuestCart', 'mergeGuestCart']);
  });
});
