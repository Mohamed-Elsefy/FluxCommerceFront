/**
 * State tests for the Sub-Phase 8.3 `CheckoutState`.
 *
 * `CheckoutApiService` (the feature HTTP boundary, covered by
 * `checkout-api.service.spec.ts`) is stubbed at its typed seam so these
 * tests own the feature logic: initial shape; initialization outcomes
 * (ready, awaiting-cart loading, empty-cart and anonymous blocking);
 * form/submission separation; submit guards (uninitialized, formless,
 * stale cart, in-flight duplicate lock, post-success lock); the
 * request built from snapshot + stored form with key supply/mint;
 * dataless-envelope violations; error normalization with form
 * preservation; failure recovery; full reset; the derived workflow for
 * every stage; and feature-local scoping (no root singleton).
 *
 * Cart-entry and form-entry orchestration belong to Sub-Phases 8.4/8.6
 * — covering pages, `FormGroup`s, or `CartState` injection here would
 * violate the 8.3 boundary, so these tests pin only the explicit
 * `initialize`/`setFormData` seams and the transport-only `submitOrder`.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { Observable, of, throwError } from 'rxjs';
import { ApiError, type ApiResponseWithData } from '@flux/api';
import type { CartResponse } from '@flux/models';
import { CheckoutApiService } from '../data-access/checkout-api.service';
import type { CreateOrderResponse } from '../models/checkout.models';
import { CheckoutState } from './checkout-state';

const CART_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '44444444-4444-4444-8444-444444444444';
const IDEMPOTENCY_KEY = '22222222-2222-4222-8222-222222222222';

function cart(overrides: Partial<CartResponse> = {}): CartResponse {
  return {
    cartId: CART_ID,
    userId: '33333333-3333-4333-8333-333333333333',
    version: 3,
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:05:00Z',
    items: [
      {
        productId: '22222222-2222-4222-8222-222222222222',
        variantId: 'aaaaaaaa-1111-4111-8111-111111111111',
        sku: 'TEE-BLK-M',
        productName: 'Tee',
        unitPriceAmount: 29.99,
        currency: 'USD',
        quantity: 2,
      },
    ],
    isGuest: false,
    isAuthenticated: true,
    ...overrides,
  };
}

function order(overrides: Partial<CreateOrderResponse> = {}): CreateOrderResponse {
  return {
    orderId: ORDER_ID,
    orderNumber: 'ORD-ABC123DEF456',
    status: 'Pending',
    createdAtUtc: '2026-09-04T10:00:00Z',
    ...overrides,
  };
}

function formData() {
  return {
    shippingAddress: {
      recipientName: 'Ada Lovelace',
      line1: '1 Flux St',
      line2: null,
      city: 'Berlin',
      region: 'BE',
      postalCode: '10115',
      countryCode: 'DE',
    },
    billingAddress: {
      recipientName: 'Ada Lovelace',
      line1: '1 Flux St',
      line2: null,
      city: 'Berlin',
      region: 'BE',
      postalCode: '10115',
      countryCode: 'DE',
    },
    billingSameAsShipping: true,
  };
}

function orderEnvelope(
  result: CreateOrderResponse = order(),
): ApiResponseWithData<CreateOrderResponse> {
  return { isSuccess: true, data: result };
}

interface RecordedCall {
  body: unknown;
  key: unknown;
  options: unknown;
}

function setup(flow?: () => Observable<ApiResponseWithData<CreateOrderResponse>>): {
  state: CheckoutState;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  const apiStub = {
    createOrder: vi.fn((body: unknown, key: unknown, options: unknown = {}) => {
      calls.push({ body, key, options });
      return flow?.() ?? of(orderEnvelope());
    }),
  } as unknown as CheckoutApiService;

  TestBed.configureTestingModule({
    providers: [{ provide: CheckoutApiService, useValue: apiStub }, CheckoutState],
  });
  return { state: TestBed.inject(CheckoutState), calls };
}

function readyState(flow?: () => Observable<ApiResponseWithData<CreateOrderResponse>>): {
  state: CheckoutState;
  calls: RecordedCall[];
} {
  const setupResult = setup(flow);
  setupResult.state.initialize(cart(), true);
  setupResult.state.setFormData(formData());
  setupResult.calls.length = 0;
  return setupResult;
}

describe('CheckoutState initial shape', () => {
  it('starts untouched with the initial workflow', () => {
    const { state } = setup();

    expect(state.workflow()).toBe('initial');
    expect(state.initialization()).toBeNull();
    expect(state.formData()).toBeNull();
    expect(state.cartSnapshot()).toBeNull();
    expect(state.submission().status).toBe('idle');
    expect(state.result()).toBeNull();
    expect(state.submissionError()).toBeNull();
    expect(state.isSubmitting()).toBe(false);
  });

  it('assembles the §8.1 boundary shape from its slots', () => {
    const { state } = setup();

    expect(state.state()).toEqual({
      form: null,
      submission: state.submission(),
      cartSnapshot: null,
    });
  });
});

describe('CheckoutState initialization', () => {
  it('resolves ready for a settled non-empty cart with an authenticated session', () => {
    const { state } = setup();

    expect(state.initialize(cart(), true)).toBe('ready');
    expect(state.initialization()).toBe('ready');
    expect(state.cartSnapshot()).toEqual({ cartId: CART_ID, version: 3, itemCount: 1 });
    expect(state.workflow()).toBe('ready');
  });

  it('records awaiting-cart loading for unsettled cart data without touching slots', () => {
    const { state } = setup();

    expect(state.initialize(undefined, true)).toBeNull();
    expect(state.initialization()).toBeNull();
    expect(state.cartSnapshot()).toBeNull();
    expect(state.workflow()).toBe('loading');
  });

  it('blocks a missing cart without executing the flow', () => {
    const { state } = setup();

    expect(state.initialize(null, true)).toBe('blocked-empty-cart');
    expect(state.initialization()).toBe('blocked-empty-cart');
    expect(state.cartSnapshot()).toBeNull();
    expect(state.workflow()).toBe('initial');
  });

  it('blocks an empty cart without executing the flow', () => {
    const { state } = setup();

    expect(state.initialize(cart({ items: [] }), true)).toBe('blocked-empty-cart');
    expect(state.initialization()).toBe('blocked-empty-cart');
    expect(state.cartSnapshot()).toBeNull();
    expect(state.workflow()).toBe('initial');
  });

  it('blocks anonymous sessions (guest carts merge via Cart first)', () => {
    const { state } = setup();

    expect(state.initialize(cart(), false)).toBe('blocked-anonymous');
    expect(state.initialization()).toBe('blocked-anonymous');
    expect(state.cartSnapshot()).toBeNull();
    expect(state.workflow()).toBe('initial');
  });

  it('clears a stale snapshot when the cart empties after a ready init', () => {
    const { state } = setup();
    state.initialize(cart(), true);
    expect(state.workflow()).toBe('ready');

    expect(state.initialize(cart({ items: [] }), true)).toBe('blocked-empty-cart');
    expect(state.cartSnapshot()).toBeNull();
    expect(state.workflow()).toBe('initial');
  });

  it('preserves entered form data across re-initialization', () => {
    const { state } = setup();
    state.setFormData(formData());
    state.initialize(cart(), true);

    expect(state.formData()).toEqual(formData());
  });
});

describe('CheckoutState form slot (separate from submission)', () => {
  it('stores form data without triggering anything', () => {
    const { state, calls } = setup();

    state.setFormData(formData());

    expect(state.formData()).toEqual(formData());
    expect(calls).toHaveLength(0);
    expect(state.workflow()).toBe('initial');
    expect(state.submission().status).toBe('idle');
  });

  it('clears form data on explicit null without touching other slots', () => {
    const { state } = setup();
    state.initialize(cart(), true);
    state.setFormData(formData());
    state.setFormData(null);

    expect(state.formData()).toBeNull();
    expect(state.cartSnapshot()).not.toBeNull();
    expect(state.workflow()).toBe('ready');
  });
});

describe('CheckoutState submitOrder guards (no HTTP unless submittable)', () => {
  it('ignores submits before initialization', () => {
    const { state, calls } = setup();
    state.setFormData(formData());

    state.submitOrder().unsubscribe();

    expect(calls).toHaveLength(0);
    expect(state.workflow()).toBe('initial');
  });

  it('ignores submits with no form data', () => {
    const { state, calls } = setup();
    state.initialize(cart(), true);

    state.submitOrder().unsubscribe();

    expect(calls).toHaveLength(0);
    expect(state.workflow()).toBe('ready');
  });

  it('ignores submits against a stale cart snapshot', () => {
    const { state, calls } = readyState();

    state.submitOrder({ currentCart: cart({ version: 4 }) }).unsubscribe();

    expect(calls).toHaveLength(0);
    expect(state.workflow()).toBe('ready');
  });

  it('accepts submits when the live cart still matches the snapshot', () => {
    const { state, calls } = readyState();

    state.submitOrder({ currentCart: cart() }).unsubscribe();

    expect(calls).toHaveLength(1);
    expect(state.workflow()).toBe('success');
  });
});

describe('CheckoutState submitOrder transport', () => {
  it('builds the wire body from snapshot cart id plus stored addresses', () => {
    const { state, calls } = readyState();

    state.submitOrder({ idempotencyKey: IDEMPOTENCY_KEY }).unsubscribe();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.key).toBe(IDEMPOTENCY_KEY);
    expect(calls[0]?.body).toEqual({
      cartId: CART_ID,
      shippingAddress: formData().shippingAddress,
      billingAddress: formData().billingAddress,
    });
    expect(state.workflow()).toBe('success');
    expect(state.result()).toEqual(order());
  });

  it('mints a fresh idempotency key per attempt when the caller omits one', () => {
    const { state, calls } = readyState();

    state.submitOrder().unsubscribe();

    expect(calls).toHaveLength(1);
    expect(typeof calls[0]?.key).toBe('string');
    expect((calls[0]?.key as string).trim().length).toBeGreaterThan(0);
  });

  it('forwards the AbortSignal to data access', () => {
    const { state, calls } = readyState();
    const controller = new AbortController();

    state.submitOrder({ idempotencyKey: IDEMPOTENCY_KEY, signal: controller.signal }).unsubscribe();

    expect(calls[0]?.options).toEqual({ signal: controller.signal });
  });

  it('surfaces dataless envelopes as contract-violation errors', () => {
    const { state } = readyState(() => of({ isSuccess: true, data: null }));

    state.submitOrder({ idempotencyKey: IDEMPOTENCY_KEY }).unsubscribe();

    expect(state.workflow()).toBe('failure');
    expect(state.submissionError()).toBeInstanceOf(ApiError);
    expect(state.result()).toBeNull();
  });

  it('exposes backend rejections with the form preserved', () => {
    const failure = new ApiError({ status: 409, message: 'Conflict.' });
    const { state } = readyState(() => throwError(() => failure));

    state.submitOrder({ idempotencyKey: IDEMPOTENCY_KEY }).unsubscribe();

    expect(state.workflow()).toBe('failure');
    expect(state.submissionError()).toBe(failure);
    expect(state.formData()).toEqual(formData());
    expect(state.cartSnapshot()).not.toBeNull();
  });
});

describe('CheckoutState duplicate-submit prevention', () => {
  it('locks submits while a submission is in flight', () => {
    const { state, calls } = readyState(() => new Observable(() => {}));

    const first = state.submitOrder({ idempotencyKey: IDEMPOTENCY_KEY });
    expect(state.workflow()).toBe('submitting');
    expect(state.isSubmitting()).toBe(true);

    const second = state.submitOrder({ idempotencyKey: IDEMPOTENCY_KEY });
    second.unsubscribe();

    expect(calls).toHaveLength(1);
    first.unsubscribe();
  });

  it('locks submits after an order was created (explicit reset for a new order)', () => {
    const { state, calls } = readyState();

    state.submitOrder({ idempotencyKey: IDEMPOTENCY_KEY }).unsubscribe();
    expect(state.workflow()).toBe('success');

    state.submitOrder({ idempotencyKey: 'new-key-for-a-new-attempt' }).unsubscribe();

    expect(calls).toHaveLength(1);
    expect(state.result()).toEqual(order());
  });
});

describe('CheckoutState recovery and reset', () => {
  it('clears submission errors back to ready with form and snapshot intact', () => {
    const failure = new ApiError({ status: 400, message: 'Bad request.' });
    const { state } = readyState(() => throwError(() => failure));
    state.submitOrder({ idempotencyKey: IDEMPOTENCY_KEY }).unsubscribe();
    expect(state.workflow()).toBe('failure');

    state.clearSubmissionError();

    expect(state.submission().status).toBe('idle');
    expect(state.submissionError()).toBeNull();
    expect(state.formData()).toEqual(formData());
    expect(state.cartSnapshot()).not.toBeNull();
    expect(state.workflow()).toBe('ready');
  });

  it('resets to the §8.1 initial shape', () => {
    const { state } = readyState();
    state.submitOrder({ idempotencyKey: IDEMPOTENCY_KEY }).unsubscribe();
    expect(state.workflow()).toBe('success');

    state.reset();

    expect(state.workflow()).toBe('initial');
    expect(state.initialization()).toBeNull();
    expect(state.formData()).toBeNull();
    expect(state.cartSnapshot()).toBeNull();
    expect(state.submission().status).toBe('idle');
    expect(state.result()).toBeNull();
  });
});

describe('CheckoutState locality (no global state)', () => {
  it('is feature-scoped: independent instances per injection site', () => {
    const first = setup();
    first.state.initialize(cart(), true);
    first.state.setFormData(formData());
    expect(first.state.workflow()).toBe('ready');

    TestBed.resetTestingModule();
    const second = setup();
    expect(second.state.workflow()).toBe('initial');
    expect(second.state.initialization()).toBeNull();
    expect(second.state.formData()).toBeNull();
  });

  it('is not a root singleton (no providedIn root)', () => {
    const metadata = (CheckoutState as unknown as { ɵprov?: { providedIn?: unknown } }).ɵprov;
    expect(metadata?.providedIn).not.toBe('root');
  });
});
