/**
 * Delegation tests for the Sub-Phases 14.2/14.6 `OrdersAdminApiService`.
 *
 * `ApiClient` (the shared-lib HTTP boundary, already covered by `libs/api`
 * specs) is stubbed at its typed seam so these tests own the feature logic:
 * correct route templates from `ORDERS_ENDPOINTS`/`PAYMENTS_ENDPOINTS`,
 * correct `pathParams` interpolation keys, query funneling through
 * `toQueryParams`, envelope passthrough without unwrapping, and
 * request-options forwarding. Errors propagate untouched — the service
 * never catches.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiClient, ApiError, ORDERS_ENDPOINTS, PAYMENTS_ENDPOINTS } from '@flux/api';
import { OrdersAdminApiService } from './orders-admin-api.service';

function setup(): {
  service: OrdersAdminApiService;
  api: ApiClient;
  calls: { paths: string[]; options: unknown[] };
} {
  const calls = { paths: [] as string[], options: [] as unknown[] };
  const apiStub = {
    get: vi.fn((path: string, options: unknown = {}) => {
      calls.paths.push(path);
      calls.options.push(options);
      return of({ isSuccess: true, data: null });
    }),
  } as unknown as ApiClient;

  TestBed.configureTestingModule({
    providers: [OrdersAdminApiService, { provide: ApiClient, useValue: apiStub }],
  });
  return { service: TestBed.inject(OrdersAdminApiService), api: apiStub, calls };
}

describe('OrdersAdminApiService routes', () => {
  it('lists orders with paging funneled through query params', () => {
    const { service, calls } = setup();
    service.listOrders({ pageNumber: 1, pageSize: 1 }).subscribe();

    expect(calls.paths).toEqual([ORDERS_ENDPOINTS.listOrders.path]);
    expect(calls.options).toEqual([{ params: { pageNumber: 1, pageSize: 1 } }]);
  });

  it('reads a single order through the canonical route template', () => {
    const { service, calls } = setup();
    service.getOrder('order-1').subscribe();

    expect(calls.paths).toEqual([ORDERS_ENDPOINTS.getOrder.path]);
    expect(calls.options).toEqual([{ pathParams: { orderId: 'order-1' } }]);
  });

  it('reads the payment initialization through the by-order route template', () => {
    const { service, calls } = setup();
    service.paymentByOrder('order-1').subscribe();

    expect(calls.paths).toEqual([PAYMENTS_ENDPOINTS.byOrder.path]);
    expect(calls.options).toEqual([{ pathParams: { orderId: 'order-1' } }]);
  });

  it('reads a single payment through the canonical route template', () => {
    const { service, calls } = setup();
    service.getPayment('pay-1').subscribe();

    expect(calls.paths).toEqual([PAYMENTS_ENDPOINTS.getPayment.path]);
    expect(calls.options).toEqual([{ pathParams: { paymentId: 'pay-1' } }]);
  });

  it('never calls the Stripe webhook from the SPA', () => {
    const { service, calls } = setup();
    service.paymentByOrder('order-1').subscribe();
    service.getPayment('pay-1').subscribe();

    expect(calls.paths).not.toContain(PAYMENTS_ENDPOINTS.stripeWebhook.path);
  });

  it('exposes no payment-history surface (no such endpoint — see 14.8)', () => {
    const { service } = setup();

    for (const member of [
      'listPayments',
      'paymentHistory',
      'getPaymentHistory',
      'listPaymentHistory',
      'orderPayments',
      'getOrderPayments',
    ]) {
      expect(service[member as keyof OrdersAdminApiService], member).toBeUndefined();
    }
  });
});

describe('OrdersAdminApiService passthrough', () => {
  it('passes envelopes through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: { items: [], totalCount: 0, pageNumber: 1, pageSize: 1 },
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));
    let observed: unknown;
    service.listOrders({ pageNumber: 1, pageSize: 1 }).subscribe((result) => {
      observed = result;
    });

    expect(observed).toBe(envelope);
  });

  it('propagates failures untouched for feature state to normalize', () => {
    const { service, api } = setup();
    const rejection = new ApiError({ status: 403, message: 'Forbidden.' });
    vi.mocked(api.get).mockReturnValueOnce(throwError(() => rejection));
    let observed: unknown;
    service.getOrder('order-1').subscribe({
      error: (error: unknown) => {
        observed = error;
      },
    });

    expect(observed).toBe(rejection);
  });
});
