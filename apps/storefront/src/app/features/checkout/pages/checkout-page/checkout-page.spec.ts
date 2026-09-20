/**
 * Page tests for the Sub-Phase 8.6 `CheckoutPage`.
 *
 * Covers page orchestration only (form validation lives in
 * `checkout-forms.spec.ts`/`checkout-validators.spec.ts`, submission
 * guards in `checkout-state.spec.ts`, transport in
 * `checkout-api.service.spec.ts`): the loading shell before the cart
 * settles, the empty shell with back-to-cart recovery, ready rendering
 * of the composed form plus the live order summary, validated submit
 * driving `createOrder` with the snapshot cart id and verbatim
 * addresses, invalid-submit prevention, the in-flight submit lock, the
 * stale-cart freshness block, failure rendering with preserved form and
 * dismissal recovery, and the created-order handoff for Phase 9 — all
 * with localized copy and the document title.
 *
 * The real `CartState`, `GuestCartService`,
 * `AuthenticatedCartService`, `CheckoutState`, `AuthService`, and
 * `CultureService` are wired to stubbed `CartApiService` /
 * `CheckoutApiService` transports, so these tests pin the full page →
 * state → data-access delegation path without HTTP. Failure recovery
 * orchestration beyond dismissal belongs to Sub-Phase 8.7; payment
 * belongs to Phase 9.
 */

import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PLATFORM_ID } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { provideApi, provideAppEnvironment, ApiError, type ApiResponseWithData } from '@flux/api';
import { AuthService, type CurrentUser } from '@flux/auth';
import { CultureService, type Culture } from '@flux/i18n';
import { CartApiService } from '../../../cart/data-access/cart-api.service';
import { GuestCartService } from '../../../cart/state/guest-cart.service';
import { AuthenticatedCartService } from '../../../cart/state/authenticated-cart.service';
import { CartState } from '../../../cart/state/cart-state';
import type { Cart, CartItem } from '../../../cart/models/cart.models';
import { CheckoutApiService } from '../../data-access/checkout-api.service';
import { CheckoutState } from '../../state/checkout-state';
import type { CreateOrderResponse } from '../../models/checkout.models';
import { CheckoutPage } from './checkout-page';

const CART_ID = '11111111-1111-4111-8111-111111111111';
const GUEST_CART_ID = '99999999-9999-4999-8999-999999999999';
const ORDER_ID = '44444444-4444-4444-8444-444444444444';
const USER_ID = 'cccccccc-3333-4333-8333-333333333333';
const PRODUCT_ID = '22222222-2222-4222-8222-222222222222';
const VARIANT_A = 'aaaaaaaa-1111-4111-8111-111111111111';

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

function authCart(overrides: Partial<Cart> = {}): Cart {
  return {
    cartId: CART_ID,
    userId: USER_ID,
    version: 3,
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:05:00Z',
    items: [line()],
    isGuest: false,
    isAuthenticated: true,
    ...overrides,
  };
}

function cartEnvelope(cart: Cart = authCart()): ApiResponseWithData<Cart> {
  return { isSuccess: true, data: cart };
}

function orderEnvelope(
  result: Partial<CreateOrderResponse> = {},
): ApiResponseWithData<CreateOrderResponse> {
  return {
    isSuccess: true,
    data: {
      orderId: ORDER_ID,
      orderNumber: 'ORD-ABC123DEF456',
      status: 'Pending',
      createdAtUtc: '2026-09-04T10:00:00Z',
      ...result,
    },
  };
}

type CartFlow = () => Observable<ApiResponseWithData<Cart>>;
type OrderFlow = () => Observable<ApiResponseWithData<CreateOrderResponse>>;

interface RecordedOrderCall {
  body: unknown;
  key: unknown;
  options: unknown;
}

function setup(
  flows: { cart?: CartFlow; order?: OrderFlow } = {},
  culture: Culture = 'en',
  options: { platform?: 'browser' | 'server' } = {},
): {
  fixture: ComponentFixture<CheckoutPage>;
  element: HTMLElement;
  checkout: CheckoutState;
  carts: CartState;
  orderCalls: RecordedOrderCall[];
  cartApi: {
    getCart: ReturnType<typeof vi.fn>;
    getOrCreateCart: ReturnType<typeof vi.fn>;
    createGuestCart: ReturnType<typeof vi.fn>;
  };
} {
  const cartApi = {
    getCart: vi.fn(() => flows.cart?.() ?? of(cartEnvelope())),
    getOrCreateCart: vi.fn(() => flows.cart?.() ?? of(cartEnvelope())),
    mergeGuestCart: vi.fn(() => of(cartEnvelope())),
    createGuestCart: vi.fn(() => of(cartEnvelope())),
    getGuestCart: vi.fn(() => of(cartEnvelope())),
  };
  const orderCalls: RecordedOrderCall[] = [];
  const orderApiStub = {
    createOrder: vi.fn((body: unknown, key: unknown, requestOptions: unknown = {}) => {
      orderCalls.push({ body, key, options: requestOptions });
      return flows.order?.() ?? of(orderEnvelope());
    }),
  } as unknown as CheckoutApiService;

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
      { provide: CartApiService, useValue: cartApi },
      { provide: CheckoutApiService, useValue: orderApiStub },
      { provide: PLATFORM_ID, useValue: options.platform ?? 'browser' },
      CartState,
      GuestCartService,
      AuthenticatedCartService,
      CheckoutState,
    ],
  });
  window.localStorage.clear();
  TestBed.inject(CultureService).setCulture(culture);
  const auth = TestBed.inject(AuthService);
  auth.setAuthenticated({ user: USER, accessToken: 'test-access-token' });
  const fixture = TestBed.createComponent(CheckoutPage);
  fixture.detectChanges();
  return {
    fixture,
    element: fixture.nativeElement as HTMLElement,
    checkout: TestBed.inject(CheckoutState),
    carts: TestBed.inject(CartState),
    orderCalls,
    cartApi,
  };
}

const ADDRESS = {
  recipientName: 'Ada Lovelace',
  line1: '1 Flux St',
  line2: '',
  city: 'Berlin',
  region: 'BE',
  postalCode: '10115',
  countryCode: 'DE',
};

function fillSection(
  element: HTMLElement,
  fixture: ComponentFixture<CheckoutPage>,
  prefix: 'shipping' | 'billing',
  values: Record<string, string> = ADDRESS,
): void {
  for (const [name, value] of Object.entries(values)) {
    const input = element.querySelector(`#${prefix}-${name}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
  fixture.detectChanges();
}

function submitForm(element: HTMLElement, fixture: ComponentFixture<CheckoutPage>): void {
  element.querySelector('checkout-form form')?.dispatchEvent(new Event('submit'));
  fixture.detectChanges();
}

describe('CheckoutPage shells', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the loading shell while the cart settles and titles the document', () => {
    const { element } = setup({ cart: () => new Observable<never>(() => {}) });

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('checkout-form')).toBeNull();
    expect(TestBed.inject(Title).getTitle()).toBe('Checkout | FluxCommerce');
  });

  it('renders the standby loading shell on the server without fetching', () => {
    const { element, cartApi } = setup({}, 'en', { platform: 'server' });

    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(cartApi.getCart).not.toHaveBeenCalled();
    expect(cartApi.getOrCreateCart).not.toHaveBeenCalled();
  });

  it('renders the empty shell with back-to-cart recovery for an empty cart', () => {
    const { element, orderCalls } = setup({
      cart: () => of(cartEnvelope(authCart({ items: [] }))),
    });

    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    expect(element.textContent).toContain('Your cart is empty');
    expect(element.querySelector('a[href="/cart"]')).not.toBeNull();
    expect(element.querySelector('checkout-form')).toBeNull();
    expect(orderCalls).toHaveLength(0);
  });

  it('blocks an expired mid-checkout session with back-to-cart recovery', () => {
    const { element, fixture, orderCalls, cartApi } = setup();
    expect(element.querySelector('checkout-form')).not.toBeNull();

    // Expiry drops into the guest bootstrap, which issues a guest cart
    // the checkout snapshot must never adopt (checkout is `[Authorize]`).
    // `clearSession` is the expiry transition (`authenticated →
    // anonymous`); `markInitializedAnonymous` only settles startup.
    cartApi.createGuestCart.mockReturnValueOnce(
      of(
        cartEnvelope(
          authCart({ cartId: GUEST_CART_ID, userId: null, isGuest: true, isAuthenticated: false }),
        ),
      ),
    );
    TestBed.inject(AuthService).clearSession();
    fixture.detectChanges();

    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    expect(element.querySelector('a[href="/cart"]')).not.toBeNull();
    expect(element.querySelector('checkout-form')).toBeNull();
    expect(orderCalls).toHaveLength(0);
  });

  it('localizes the title and loading shell in Arabic', () => {
    const { element } = setup({ cart: () => new Observable<never>(() => {}) }, 'ar');

    expect(TestBed.inject(Title).getTitle()).toBe('إتمام الطلب | FluxCommerce');
    expect(element.querySelector('#checkout-page-title')?.textContent).toBe('إتمام الطلب');
  });

  it('renders the cart error shell and retries through the session lifecycle', () => {
    const failure = new ApiError({ status: 404, message: 'Cart gone.' });
    const { element, fixture, cartApi, orderCalls } = setup({
      cart: () => throwError(() => failure),
    });

    const banner = element.querySelector('flux-error-state');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Checkout unavailable');
    expect(element.querySelector('checkout-form')).toBeNull();
    expect(orderCalls).toHaveLength(0);

    const callsBefore = cartApi.getCart.mock.calls.length;
    (banner?.querySelector('button.retry') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(cartApi.getCart.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

describe('CheckoutPage ready rendering', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the composed form and the live order summary', () => {
    const { element } = setup();

    expect(element.querySelector('checkout-form')).not.toBeNull();
    expect(element.querySelector('checkout-order-summary')).not.toBeNull();
    const text = element.textContent ?? '';
    expect(text).toContain('Shipping address');
    expect(text).toContain('Billing address');
    expect(text).toContain('Tee');
    expect(text).toContain('TEE-BLK-M');
  });
});

describe('CheckoutPage submit flow', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('creates the order with the snapshot cart id and verbatim addresses', () => {
    const { element, fixture, orderCalls, checkout } = setup();
    fillSection(element, fixture, 'shipping');
    fillSection(element, fixture, 'billing');
    submitForm(element, fixture);

    expect(orderCalls).toHaveLength(1);
    // Blank `line2` reaches the wire as `null` via the §8.1 mapper
    // (`toCheckoutAddress` normalizes the absent-value shape) — every
    // other field travels verbatim.
    const wireAddress = { ...ADDRESS, line2: null };
    expect(orderCalls[0]?.body).toEqual({
      cartId: CART_ID,
      shippingAddress: wireAddress,
      billingAddress: wireAddress,
    });
    expect(typeof orderCalls[0]?.key).toBe('string');
    expect(checkout.workflow()).toBe('success');
    expect(element.querySelector('.checkout-page-success')?.textContent).toContain(
      'ORD-ABC123DEF456',
    );
  });

  it('exposes the created order id for the Phase 9 handoff with a payment link', () => {
    const { element, fixture, checkout } = setup();
    fillSection(element, fixture, 'shipping');
    fillSection(element, fixture, 'billing');
    submitForm(element, fixture);

    expect(checkout.result()?.orderId).toBe(ORDER_ID);
    expect(element.querySelector('.checkout-page-success')?.textContent).toContain('Pending');
    const link = element.querySelector('.checkout-page-continue a');
    expect(link?.textContent).toContain('Continue to payment');
    expect(link?.getAttribute('href')).toBe(`/payment/${ORDER_ID}`);
  });

  it('prevents invalid submits with flagged fields and no API call', () => {
    const { element, fixture, orderCalls } = setup();

    submitForm(element, fixture);

    expect(orderCalls).toHaveLength(0);
    expect(element.querySelector('.checkout-field-errors')).not.toBeNull();
  });

  it('locks duplicate submits while a submission is in flight', () => {
    const { element, fixture, orderCalls } = setup({
      order: () => new Observable<never>(() => {}),
    });
    fillSection(element, fixture, 'shipping');
    fillSection(element, fixture, 'billing');
    submitForm(element, fixture);
    submitForm(element, fixture);

    expect(orderCalls).toHaveLength(1);
    expect((element.querySelector('.checkout-submit') as HTMLButtonElement).disabled).toBe(true);
  });

  it('re-initializes on cart change and submits against the live cart', () => {
    const { element, fixture, orderCalls, carts, cartApi, checkout } = setup();
    cartApi.getCart.mockReturnValueOnce(of(cartEnvelope(authCart({ version: 4 }))));
    carts.loadCart();
    fixture.detectChanges();

    // The page tracks the live cart (the review never goes stale: the
    // summary re-projects and the snapshot follows the new version).
    expect(checkout.cartSnapshot()).toEqual({ cartId: CART_ID, version: 4, itemCount: 1 });

    fillSection(element, fixture, 'shipping');
    fillSection(element, fixture, 'billing');
    submitForm(element, fixture);

    expect(orderCalls).toHaveLength(1);
    expect(checkout.workflow()).toBe('success');
  });
});

describe('CheckoutPage failure handling', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the failure above the preserved form and recovers on retry', () => {
    const { element, fixture, orderCalls } = setup({
      order: () => throwError(() => new ApiError({ status: 409, message: 'Conflict.' })),
    });
    fillSection(element, fixture, 'shipping');
    fillSection(element, fixture, 'billing');
    submitForm(element, fixture);

    expect(orderCalls).toHaveLength(1);
    const banner = element.querySelector('flux-error-state');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Order creation failed');
    expect((element.querySelector('#shipping-city') as HTMLInputElement).value).toBe('Berlin');

    (banner?.querySelector('button.retry') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(element.querySelector('flux-error-state')).toBeNull();
    expect(element.querySelector('checkout-form')).not.toBeNull();
  });

  it('locks resubmits after a failure until the recovery action clears it', () => {
    const { element, fixture, orderCalls } = setup({
      order: () => throwError(() => new ApiError({ status: 409, message: 'Conflict.' })),
    });
    fillSection(element, fixture, 'shipping');
    fillSection(element, fixture, 'billing');
    submitForm(element, fixture);
    submitForm(element, fixture);

    expect(orderCalls).toHaveLength(1);
  });

  it('retries transport failures with the same idempotency key', () => {
    let attempts = 0;
    const { element, fixture, orderCalls } = setup({
      order: () => {
        attempts += 1;
        return attempts === 1
          ? throwError(() => new ApiError({ status: 0, message: 'Transport failed.' }))
          : of(orderEnvelope());
      },
    });
    fillSection(element, fixture, 'shipping');
    fillSection(element, fixture, 'billing');
    submitForm(element, fixture);
    expect(orderCalls).toHaveLength(1);
    const failedKey = orderCalls[0]?.key;

    (element.querySelector('flux-error-state button.retry') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(orderCalls).toHaveLength(2);
    expect(orderCalls[1]?.key).toBe(failedKey);
    expect(orderCalls[1]?.body).toEqual(orderCalls[0]?.body);
    expect(element.querySelector('.checkout-page-success')).not.toBeNull();
  });

  it('guides back to Cart when re-validation proves the cart is gone', () => {
    const { element, fixture, orderCalls, cartApi } = setup({
      order: () => throwError(() => new ApiError({ status: 404, message: 'Cart gone.' })),
    });
    fillSection(element, fixture, 'shipping');
    fillSection(element, fixture, 'billing');
    submitForm(element, fixture);
    expect(orderCalls).toHaveLength(1);
    expect(element.querySelector('flux-error-state')).not.toBeNull();

    // Background re-validation finds nothing left to order.
    cartApi.getCart.mockReturnValue(of(cartEnvelope(authCart({ items: [] }))));
    (element.querySelector('flux-error-state button.retry') as HTMLButtonElement).click();
    fixture.detectChanges();

    // Automatic re-validation runs; the stale snapshot is abandoned so
    // no resubmit can target the dead cart — the empty shell guides
    // back to Cart instead.
    expect(cartApi.getCart).toHaveBeenCalled();
    expect(orderCalls).toHaveLength(1);
    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    expect(element.querySelector('a[href="/cart"]')).not.toBeNull();
    expect(element.querySelector('checkout-form')).toBeNull();
  });

  it('returns to the failure banner when re-validation proves the cart intact', () => {
    const { element, fixture, orderCalls, cartApi } = setup({
      order: () => throwError(() => new ApiError({ status: 404, message: 'Cart gone.' })),
    });
    fillSection(element, fixture, 'shipping');
    fillSection(element, fixture, 'billing');
    submitForm(element, fixture);
    expect(orderCalls).toHaveLength(1);

    // Re-validation returns the same settled cart: the review is fresh
    // again, so the failure banner persists for explicit dismissal
    // instead of stranding the user.
    cartApi.getCart.mockClear();
    (element.querySelector('flux-error-state button.retry') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(cartApi.getCart).toHaveBeenCalled();
    expect(orderCalls).toHaveLength(1);
    expect(element.querySelector('flux-error-state')).not.toBeNull();
    expect(element.querySelector('checkout-form')).not.toBeNull();
  });

  it('never exposes raw backend error details to the user', () => {
    const leak = 'TECHNICAL-LEAK-XYZ-987';
    const { element, fixture } = setup({
      order: () => throwError(() => new ApiError({ status: 409, message: leak })),
    });
    fillSection(element, fixture, 'shipping');
    fillSection(element, fixture, 'billing');
    submitForm(element, fixture);

    const banner = element.querySelector('flux-error-state');
    expect(banner).not.toBeNull();
    expect(element.textContent).not.toContain(leak);
  });

  it('moves focus to the submission error banner once per failure', () => {
    const { element, fixture } = setup({
      order: () => throwError(() => new ApiError({ status: 409, message: 'Conflict.' })),
    });
    fillSection(element, fixture, 'shipping');
    fillSection(element, fixture, 'billing');
    submitForm(element, fixture);
    // Flush the failure-focus effect scheduled by the settle.
    fixture.detectChanges();

    const banner = element.querySelector('#checkout-submit-error') as HTMLElement;
    expect(banner).not.toBeNull();
    expect(document.activeElement).toBe(banner);

    // Re-renders must not steal focus back while the failure stands.
    banner.blur();
    fixture.detectChanges();
    expect(document.activeElement).not.toBe(banner);
  });
});
