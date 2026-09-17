/**
 * Delegation tests for the Sub-Phase 8.2 `CheckoutApiService` (plus the
 * `newIdempotencyKey` mint).
 *
 * `ApiClient` (the shared-lib HTTP boundary, already covered by `libs/api`
 * specs) is stubbed at its typed seam so these tests own the feature
 * logic: the canonical `ORDERS_ENDPOINTS.checkout` route template, body
 * passthrough without mapping, the `Idempotency-Key` travelling as
 * request `context` (never in the body), caller-context preservation,
 * `AbortSignal` forwarding for cancellation, envelope passthrough without
 * unwrapping, and error propagation untouched — the service never
 * validates, catches, remaps, or throws.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiClient, ApiError, ORDERS_ENDPOINTS } from '@flux/api';
import { isValidIdempotencyKey } from '../models/checkout.models';
import type { CreateOrderRequest } from '../models/checkout.models';
import { CheckoutApiService, newIdempotencyKey } from './checkout-api.service';

const CART_ID = '11111111-1111-4111-8111-111111111111';
const IDEMPOTENCY_KEY = '22222222-2222-4222-8222-222222222222';

const ORDER_BODY: CreateOrderRequest = {
  cartId: CART_ID,
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
};

interface ApiCalls {
  paths: string[];
  bodies: unknown[];
  options: unknown[];
}

function setup(): { service: CheckoutApiService; api: ApiClient; calls: ApiCalls } {
  const calls: ApiCalls = { paths: [], bodies: [], options: [] };
  const apiStub = {
    post: vi.fn((path: string, body: unknown, options: unknown = {}) => {
      calls.paths.push(path);
      calls.bodies.push(body);
      calls.options.push(options);
      return of({ isSuccess: true, data: null });
    }),
  } as unknown as ApiClient;

  TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: apiStub }] });
  return { service: TestBed.inject(CheckoutApiService), api: apiStub, calls };
}

describe('CheckoutApiService createOrder', () => {
  it('posts the untouched body to the canonical checkout route with the key as context', () => {
    const { service, calls } = setup();
    service.createOrder(ORDER_BODY, IDEMPOTENCY_KEY).subscribe();

    expect(calls.paths).toEqual([ORDERS_ENDPOINTS.checkout.path]);
    expect(calls.paths).toEqual(['/orders/checkout']);
    expect(calls.bodies).toEqual([ORDER_BODY]);
    expect(calls.options).toEqual([{ context: { idempotencyKey: IDEMPOTENCY_KEY } }]);
  });

  it('never sends the idempotency key in the body', () => {
    const { service, calls } = setup();
    service.createOrder(ORDER_BODY, IDEMPOTENCY_KEY).subscribe();

    expect(calls.bodies?.[0]).not.toHaveProperty('idempotencyKey');
    expect(calls.bodies?.[0]).not.toHaveProperty('Idempotency-Key');
  });

  it('preserves caller context (correlation, culture) alongside the key', () => {
    const { service, calls } = setup();
    service
      .createOrder(ORDER_BODY, IDEMPOTENCY_KEY, {
        context: { correlationId: 'corr-1', culture: 'ar' },
      })
      .subscribe();

    expect(calls.options).toEqual([
      {
        context: { correlationId: 'corr-1', culture: 'ar', idempotencyKey: IDEMPOTENCY_KEY },
      },
    ]);
  });

  it('forwards the AbortSignal for cancellation without touching it', () => {
    const { service, calls } = setup();
    const controller = new AbortController();
    service.createOrder(ORDER_BODY, IDEMPOTENCY_KEY, { signal: controller.signal }).subscribe();

    expect(calls.options).toEqual([
      { signal: controller.signal, context: { idempotencyKey: IDEMPOTENCY_KEY } },
    ]);
  });

  it('passes the envelope through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: {
        orderId: '44444444-4444-4444-8444-444444444444',
        orderNumber: 'ORD-ABC123DEF456',
        status: 'Pending',
        createdAtUtc: '2026-09-04T10:00:00Z',
      },
    };
    vi.mocked(api.post).mockReturnValueOnce(of(envelope));

    let observed: unknown;
    service.createOrder(ORDER_BODY, IDEMPOTENCY_KEY).subscribe((value) => (observed = value));
    expect(observed).toBe(envelope);
  });

  it('propagates validation, business, and transport failures untouched', () => {
    const { service, api } = setup();
    const failure = new ApiError({ status: 409, message: 'Conflict.' });
    vi.mocked(api.post).mockReturnValueOnce(throwError(() => failure));

    let observed: unknown;
    service.createOrder(ORDER_BODY, IDEMPOTENCY_KEY).subscribe({
      error: (error: unknown) => (observed = error),
    });
    expect(observed).toBe(failure);
  });
});

describe('newIdempotencyKey', () => {
  it('mints contract-valid keys', () => {
    expect(isValidIdempotencyKey(newIdempotencyKey())).toBe(true);
  });

  it('mints a fresh key per attempt (never reused across payloads)', () => {
    const seen = new Set([newIdempotencyKey(), newIdempotencyKey(), newIdempotencyKey()]);
    expect(seen.size).toBe(3);
  });
});
