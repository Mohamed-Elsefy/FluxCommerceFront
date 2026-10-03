/**
 * Delegation tests for the `PaymentApiService`.
 *
 * `ApiClient` (the shared-lib HTTP boundary, already covered by `libs/api`
 * specs) is stubbed at its typed seam so these tests own the feature
 * logic: the canonical `PAYMENTS_ENDPOINTS` route templates with ids as
 * `pathParams`, caller-context preservation, `AbortSignal`
 * forwarding for cancellation, envelope passthrough without unwrapping,
 * and error propagation untouched — the service never validates, catches,
 * remaps, logs, or throws.
 *
 * Initialization reads the live secret through
 * `GET /api/payments/by-order/{orderId}` (owner JWT, single intent per
 * order). Card confirmation has no backend endpoint by design
 * (provider-side via Stripe.js) — this service exposes no
 * `confirmPayment` method.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiClient, ApiError, isApiError, PAYMENTS_ENDPOINTS } from '@flux/api';
import type { Payment, PaymentInitializationResult } from '@flux/models';
import { PaymentApiService } from './payment-api.service';

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

const INIT_BODY: PaymentInitializationResult = {
  paymentId: PAYMENT_ID,
  orderId: ORDER_ID,
  clientSecret: 'pi_123_secret_abc',
  paymentReference: 'pi_123',
  status: 'Pending',
};

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

describe('PaymentApiService initializePayment (by-order read)', () => {
  it('reads the canonical by-order route with the order id as pathParams', () => {
    const { service, calls } = setup();
    service.initializePayment({ orderId: ORDER_ID }).subscribe();

    expect(calls.getPaths).toEqual([PAYMENTS_ENDPOINTS.byOrder.path]);
    expect(calls.getPaths).toEqual(['/api/payments/by-order/{orderId}']);
    expect(calls.getOptions).toEqual([{ pathParams: { orderId: ORDER_ID } }]);
  });

  it('issues a bodyless GET (no confirmation payload on the init read)', () => {
    const { service, api } = setup();
    service.initializePayment({ orderId: ORDER_ID }).subscribe();

    expect(vi.mocked(api.get).mock.calls[0]).toHaveLength(2);
  });

  it('preserves caller context (correlation, culture) alongside the id', () => {
    const { service, calls } = setup();
    service
      .initializePayment(
        { orderId: ORDER_ID },
        { context: { correlationId: 'corr-1', culture: 'ar' } },
      )
      .subscribe();

    expect(calls.getOptions).toEqual([
      {
        context: { correlationId: 'corr-1', culture: 'ar' },
        pathParams: { orderId: ORDER_ID },
      },
    ]);
  });

  it('forwards the AbortSignal for cancellation without touching it', () => {
    const { service, calls } = setup();
    const controller = new AbortController();
    service.initializePayment({ orderId: ORDER_ID }, { signal: controller.signal }).subscribe();

    expect(calls.getOptions).toEqual([
      { signal: controller.signal, pathParams: { orderId: ORDER_ID } },
    ]);
  });

  it('passes the envelope through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: INIT_BODY,
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));

    let observed: unknown;
    service.initializePayment({ orderId: ORDER_ID }).subscribe((value) => (observed = value));
    expect(observed).toEqual(envelope);
  });

  it('propagates saga-lag 409s (NotReady) untouched for manual retry', () => {
    const { service, api } = setup();
    const failure = new ApiError({
      status: 409,
      code: 'Payment.NotReady',
      message: 'Intent not created yet.',
    });
    vi.mocked(api.get).mockReturnValueOnce(throwError(() => failure));

    let observed: unknown;
    service.initializePayment({ orderId: ORDER_ID }).subscribe({
      error: (error: unknown) => (observed = error),
    });
    expect(observed).toBe(failure);
    expect(isApiError(observed)).toBe(true);
  });

  it('propagates terminal 409s (NotPayable) and 500s untouched', () => {
    const { service, api } = setup();
    for (const failure of [
      new ApiError({ status: 409, code: 'Payment.NotPayable', message: 'Terminal.' }),
      new ApiError({ status: 500, code: 'Payment.ProviderUnavailable', message: 'Down.' }),
      new ApiError({ status: 404, code: 'Payment.NotFound', message: 'Not found.' }),
      new ApiError({ status: 401, code: 'Payment.Unauthorized', message: 'Denied.' }),
    ]) {
      vi.mocked(api.get).mockReturnValueOnce(throwError(() => failure));

      let observed: unknown;
      service.initializePayment({ orderId: ORDER_ID }).subscribe({
        error: (error: unknown) => (observed = error),
      });
      expect(observed).toBe(failure);
    }
  });
});

describe('PaymentApiService listMine (Supplement S1.9 caller-owned list)', () => {
  it('reads the canonical mine route with paging plus status as query params', () => {
    const { service, calls } = setup();
    service.listMine({ pageNumber: 1, pageSize: 20, status: 'Succeeded' }).subscribe();

    expect(calls.getPaths).toEqual([PAYMENTS_ENDPOINTS.listMine.path]);
    expect(calls.getPaths).toEqual(['/api/payments/mine']);
    expect(calls.getOptions).toEqual([
      { params: { pageNumber: 1, pageSize: 20, status: 'Succeeded' } },
    ]);
  });

  it('omits the status key when unfiltered (paging only)', () => {
    const { service, calls } = setup();
    service.listMine({ pageNumber: 2, pageSize: 20 }).subscribe();

    expect(calls.getOptions).toEqual([{ params: { pageNumber: 2, pageSize: 20 } }]);
  });

  it('forwards the AbortSignal for cancellation without touching it', () => {
    const { service, calls } = setup();
    const controller = new AbortController();
    service.listMine({ pageNumber: 1 }, { signal: controller.signal }).subscribe();

    expect(calls.getOptions).toEqual([{ signal: controller.signal, params: { pageNumber: 1 } }]);
  });

  it('passes the paged envelope through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: { items: [STATUS_BODY], totalCount: 1, pageNumber: 1, pageSize: 20 },
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));

    let observed: unknown;
    service.listMine().subscribe((value) => (observed = value));
    expect(observed).toEqual(envelope);
  });

  it('propagates validation 400s (unknown status) and 401s untouched', () => {
    const { service, api } = setup();
    for (const failure of [
      new ApiError({ status: 400, code: 'Payment.ValidationFailed', message: 'Bad query.' }),
      new ApiError({ status: 401, code: 'Payment.Unauthorized', message: 'Denied.' }),
    ]) {
      vi.mocked(api.get).mockReturnValueOnce(throwError(() => failure));

      let observed: unknown;
      service.listMine({ status: 'Nope' }).subscribe({
        error: (error: unknown) => (observed = error),
      });
      expect(observed).toBe(failure);
      expect(isApiError(observed)).toBe(true);
    }
  });
});
