/**
 * Page tests for the Sub-Phase 7.4 `CartPage` (plus the Sub-Phase 7.5
 * guest lifecycle wiring).
 *
 * Covers page orchestration only (state transitions live in
 * `cart-state.spec.ts`, the guest lifecycle in
 * `guest-cart.service.spec.ts`, presentational contracts in the
 * component specs): the standby shell on the server (initialization is
 * browser-only), guest bootstrap on first visit (creation) and return
 * visits (stored identity), expired-identity recovery, backend-only
 * price display (no locally computed line totals anywhere),
 * quantity/remove/clear bubbling into feature state, error retry
 * through the guest lifecycle, the in-flight control freeze, the
 * checkout navigation boundary, localized document title, and Arabic
 * rendering.
 *
 * The real `CartState` plus the real `GuestCartService` are wired to a
 * stubbed `CartApiService` and the real (cleared per test)
 * `localStorage`-backed storage, so these tests pin the full page →
 * lifecycle → state → data-access delegation path without HTTP.
 */

import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { afterEach, describe, expect, it } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { ApiError, type ApiResponseWithData } from '@flux/api';
import { CultureService, formatCurrency, type Culture } from '@flux/i18n';
import { CartApiService } from '../../data-access/cart-api.service';
import { GUEST_CART_STORAGE_KEY } from '../../state/guest-cart-storage.service';
import { GuestCartService } from '../../state/guest-cart.service';
import { CartState } from '../../state/cart-state';
import type { Cart, CartItem } from '../../models/cart.models';
import { CartPage } from './cart-page';

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

function cartEnvelope(cart: Cart = guestCart()): ApiResponseWithData<Cart> {
  return { isSuccess: true, data: cart };
}

const API_METHODS = [
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

type ApiMethod = (typeof API_METHODS)[number];
type Flow = () => Observable<ApiResponseWithData<Cart>>;

interface RecordedCall {
  method: string;
  args: unknown[];
}

function setup(
  flows: Partial<Record<ApiMethod, Flow>> = {},
  culture: Culture = 'en',
  options: { storedGuestCartId?: string; platform?: 'browser' | 'server' } = {},
): {
  fixture: ComponentFixture<CartPage>;
  element: HTMLElement;
  state: CartState;
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
      { provide: CartApiService, useValue: apiStub },
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
      CartState,
      GuestCartService,
    ],
  });
  window.localStorage.clear();
  if (options.storedGuestCartId !== undefined) {
    window.localStorage.setItem(GUEST_CART_STORAGE_KEY, options.storedGuestCartId);
  }
  TestBed.inject(CultureService).setCulture(culture);
  const fixture = TestBed.createComponent(CartPage);
  fixture.detectChanges();
  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    state: TestBed.inject(CartState),
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
