/**
 * Delegation tests for the Sub-Phase 9.3 `PaymentApiService` (plus the
 * `paymentContractBlockedError` factory).
 *
 * `ApiClient` (the shared-lib HTTP boundary, already covered by `libs/api`
 * specs) is stubbed at its typed seam so these tests own the feature
 * logic: the canonical `PAYMENTS_ENDPOINTS.getPayment` route template
 * with the id as `pathParams`, caller-context preservation, `AbortSignal`
 * forwarding for cancellation, envelope passthrough without unwrapping,
 * and error propagation untouched — the service never validates, catches,
 * remaps, logs, or throws.
 *
 * Contract-honest blocking: `initializePayment`/`confirmPayment` have no
 * backend HTTP path (the §9.1 blocker), so the tests pin that both
 * short-circuit with the normalized blocked `ApiError` while issuing
 * ZERO HTTP calls and leaking ZERO identifiers or secrets.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiClient, ApiError, isApiError, PAYMENTS_ENDPOINTS } from '@flux/api';
import type { Payment } from '@flux/models';
import type { ConfirmPaymentRequest } from '../models/payment.models';
import {
  BlockedPaymentOperation,
  PAYMENT_CONTRACT_BLOCKED_CODE,
  PaymentApiService,
  paymentContractBlockedError,
} from './payment-api.service';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';
const PAYMENT_ID = '22222222-2222-4222-8222-222222222222';

const STATUS_BODY: Payment = {
  id: PAYMENT_ID,
  orderId: ORDER_ID,
  customerId: '33333333-3333-4333-8333-333333333333',
  amount: 59.98,
  currency: 'USD',
  status: 'Succeeded',
  providerPaymentIntentId: 'pi_123',
  provider: 'stripe',
  createdAtUtc: '2026-09-04T10:00:00Z',
  updatedAtUtc: '2026-09-04T10:01:00Z',
  version: 3,
};

const CONFIRM_BODY: ConfirmPaymentRequest = { orderId: ORDER_ID };

interface ApiCalls {
  getPaths: string[];
  getOptions: unknown[];
  postPaths: string[];
  postBodies: unknown[];
  postOptions: unknown[];
}

function setup(): { service: PaymentApiService; api: ApiClient; calls: ApiCalls } {
  const calls: ApiCalls = {
    getPaths: [],
    getOptions: [],
    postPaths: [],
    postBodies: [],
    postOptions: [],
  };
  const apiStub = {
    get: vi.fn((path: string, options: unknown = {}) => {
      calls.getPaths.push(path);
      calls.getOptions.push(options);
      return of({ isSuccess: true, data: STATUS_BODY });
    }),
    post: vi.fn((path: string, body: unknown, options: unknown = {}) => {
      calls.postPaths.push(path);
      calls.postBodies.push(body);
      calls.postOptions.push(options);
      return of({ isSuccess: true, data: null });
    }),
  } as unknown as ApiClient;

  TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: apiStub }] });
  return { service: TestBed.inject(PaymentApiService), api: apiStub, calls };
}

describe('PaymentApiService getPaymentStatus', () => {
  it('reads the canonical status route with the id as pathParams', () => {
    const { service, calls } = setup();
    service.getPaymentStatus(PAYMENT_ID).subscribe();

    expect(calls.getPaths).toEqual([PAYMENTS_ENDPOINTS.getPayment.path]);
    expect(calls.getPaths).toEqual(['/api/payments/{paymentId}']);
    expect(calls.getOptions).toEqual([{ pathParams: { paymentId: PAYMENT_ID } }]);
  });

  it('issues a bodyless GET (no confirmation payload on the status read)', () => {
    const { service, api } = setup();
    service.getPaymentStatus(PAYMENT_ID).subscribe();

    expect(vi.mocked(api.get).mock.calls[0]).toHaveLength(2);
  });

  it('preserves caller context (correlation, culture) alongside the id', () => {
    const { service, calls } = setup();
    service
      .getPaymentStatus(PAYMENT_ID, { context: { correlationId: 'corr-1', culture: 'ar' } })
      .subscribe();

    expect(calls.getOptions).toEqual([
      {
        context: { correlationId: 'corr-1', culture: 'ar' },
        pathParams: { paymentId: PAYMENT_ID },
      },
    ]);
  });

  it('forwards the AbortSignal for cancellation without touching it', () => {
    const { service, calls } = setup();
    const controller = new AbortController();
    service.getPaymentStatus(PAYMENT_ID, { signal: controller.signal }).subscribe();

    expect(calls.getOptions).toEqual([
      { signal: controller.signal, pathParams: { paymentId: PAYMENT_ID } },
    ]);
  });

  it('passes the envelope through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: STATUS_BODY,
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));

    let observed: unknown;
    service.getPaymentStatus(PAYMENT_ID).subscribe((value) => (observed = value));
    expect(observed).toEqual(envelope);
  });

  it('propagates masked 404s (unknown or foreign id) untouched', () => {
    const { service, api } = setup();
    const failure = new ApiError({ status: 404, code: 'Payment.NotFound', message: 'Not found.' });
    vi.mocked(api.get).mockReturnValueOnce(throwError(() => failure));

    let observed: unknown;
    service.getPaymentStatus(PAYMENT_ID).subscribe({
      error: (error: unknown) => (observed = error),
    });
    expect(observed).toBe(failure);
    expect(isApiError(observed)).toBe(true);
  });

  it('propagates anonymous 401s without remapping', () => {
    const { service, api } = setup();
    const failure = new ApiError({ status: 401, code: 'Payment.Unauthorized', message: 'Denied.' });
    vi.mocked(api.get).mockReturnValueOnce(throwError(() => failure));

    let observed: unknown;
    service.getPaymentStatus(PAYMENT_ID).subscribe({
      error: (error: unknown) => (observed = error),
    });
    expect(observed).toBe(failure);
  });

  it('propagates transport failures without remapping', () => {
    const { service, api } = setup();
    const failure = new ApiError({ status: 0, code: 'NetworkError', message: 'Unreachable.' });
    vi.mocked(api.get).mockReturnValueOnce(throwError(() => failure));

    let observed: unknown;
    service.getPaymentStatus(PAYMENT_ID).subscribe({
      error: (error: unknown) => (observed = error),
    });
    expect(observed).toBe(failure);
  });
});

describe('PaymentApiService getOrderDetails', () => {
  const ORDER_BODY = {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      orderId: ORDER_ID,
      orderNumber: 'ORD-ABC123DEF456',
      status: 'Pending',
      subtotal: { amount: 59.98, currency: 'USD' },
      shippingCost: { amount: 0, currency: 'USD' },
      discount: { amount: 0, currency: 'USD' },
      grandTotal: { amount: 59.98, currency: 'USD' },
      itemCount: 2,
      createdAtUtc: '2026-09-04T10:00:00Z',
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
      lineItems: [],
    },
  };

  it('reads the canonical order route with the id as pathParams', () => {
    const { service, calls } = setup();
    service.getOrderDetails(ORDER_ID).subscribe();

    expect(calls.getPaths).toEqual(['/orders/{orderId}']);
    expect(calls.getOptions).toEqual([{ pathParams: { orderId: ORDER_ID } }]);
  });

  it('forwards the AbortSignal for cancellation without touching it', () => {
    const { service, calls } = setup();
    const controller = new AbortController();
    service.getOrderDetails(ORDER_ID, { signal: controller.signal }).subscribe();

    expect(calls.getOptions).toEqual([
      { signal: controller.signal, pathParams: { orderId: ORDER_ID } },
    ]);
  });

  it('passes the order envelope through without unwrapping data', () => {
    const { service, api } = setup();
    vi.mocked(api.get).mockReturnValueOnce(of(ORDER_BODY));

    let observed: unknown;
    service.getOrderDetails(ORDER_ID).subscribe((value) => (observed = value));
    expect(observed).toEqual(ORDER_BODY);
  });

  it('propagates masked 404s and anonymous 401s untouched', () => {
    const { service, api } = setup();
    const notFound = new ApiError({ status: 404, code: 'Order.NotFound', message: 'Not found.' });
    vi.mocked(api.get).mockReturnValueOnce(throwError(() => notFound));

    let observed: unknown;
    service.getOrderDetails(ORDER_ID).subscribe({
      error: (error: unknown) => (observed = error),
    });
    expect(observed).toBe(notFound);
  });
});

describe('PaymentApiService initializePayment (contract-blocked)', () => {
  it('short-circuits with the normalized blocked ApiError', () => {
    const { service } = setup();

    let observed: unknown;
    service.initializePayment({ orderId: ORDER_ID }).subscribe({
      error: (error: unknown) => (observed = error),
    });

    expect(isApiError(observed)).toBe(true);
    expect(observed).toBeInstanceOf(ApiError);
    expect((observed as ApiError).status).toBe(0);
    expect((observed as ApiError).code).toBe(PAYMENT_CONTRACT_BLOCKED_CODE);
  });

  it('issues zero HTTP calls', () => {
    const { service, api } = setup();
    service.initializePayment({ orderId: ORDER_ID }).subscribe({ error: () => undefined });

    expect(vi.mocked(api.get)).not.toHaveBeenCalled();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('leaks no identifiers or secrets in the blocked failure', () => {
    const { service } = setup();

    let observed: unknown;
    service.initializePayment({ orderId: ORDER_ID }).subscribe({
      error: (error: unknown) => (observed = error),
    });

    const failure = observed as ApiError;
    expect(failure.validationErrors).toBeUndefined();
    expect(failure.correlationId).toBeUndefined();
    expect(failure.traceId).toBeUndefined();
    expect(JSON.stringify(failure)).not.toContain(ORDER_ID);
    expect(JSON.stringify(failure)).not.toMatch(/secret|pi_/i);
  });
});

describe('PaymentApiService confirmPayment (contract-blocked)', () => {
  it('short-circuits with the normalized blocked ApiError', () => {
    const { service } = setup();

    let observed: unknown;
    service.confirmPayment(PAYMENT_ID, CONFIRM_BODY).subscribe({
      error: (error: unknown) => (observed = error),
    });

    expect(isApiError(observed)).toBe(true);
    expect((observed as ApiError).status).toBe(0);
    expect((observed as ApiError).code).toBe(PAYMENT_CONTRACT_BLOCKED_CODE);
  });

  it('issues zero HTTP calls', () => {
    const { service, api } = setup();
    service.confirmPayment(PAYMENT_ID, CONFIRM_BODY).subscribe({ error: () => undefined });

    expect(vi.mocked(api.get)).not.toHaveBeenCalled();
    expect(vi.mocked(api.post)).not.toHaveBeenCalled();
  });

  it('leaks no identifiers or secrets in the blocked failure', () => {
    const { service } = setup();

    let observed: unknown;
    service.confirmPayment(PAYMENT_ID, CONFIRM_BODY).subscribe({
      error: (error: unknown) => (observed = error),
    });

    const failure = observed as ApiError;
    expect(failure.validationErrors).toBeUndefined();
    expect(JSON.stringify(failure)).not.toContain(PAYMENT_ID);
    expect(JSON.stringify(failure)).not.toContain(ORDER_ID);
    expect(JSON.stringify(failure)).not.toMatch(/secret|card|stripe/i);
  });
});

describe('paymentContractBlockedError', () => {
  it('names the blocked operation in a technical diagnostic', () => {
    const operations: BlockedPaymentOperation[] = ['initializePayment', 'confirmPayment'];
    for (const operation of operations) {
      const error = paymentContractBlockedError(operation);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.status).toBe(0);
      expect(error.code).toBe(PAYMENT_CONTRACT_BLOCKED_CODE);
      expect(error.message).toContain(operation);
    }
  });

  it('keeps the blocked code distinct from transport codes', () => {
    expect(PAYMENT_CONTRACT_BLOCKED_CODE).toBe('PaymentContractBlocked');
    expect(PAYMENT_CONTRACT_BLOCKED_CODE).not.toBe('NetworkError');
    expect(PAYMENT_CONTRACT_BLOCKED_CODE).not.toBe('RequestCancelled');
  });
});
