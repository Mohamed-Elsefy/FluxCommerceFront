/**
 * Delegation tests for the Sub-Phase 10.1 `OrdersApiService`.
 *
 * `ApiClient` (the shared-lib HTTP boundary, already covered by `libs/api`
 * specs) is stubbed at its typed seam so these tests own the feature
 * logic: the canonical `ORDERS_ENDPOINTS` route templates, verbatim
 * query/path passthrough without mapping, caller-context preservation,
 * `AbortSignal` forwarding for cancellation, envelope passthrough without
 * unwrapping, and error propagation untouched — the service never
 * validates, catches, remaps, or throws.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiClient, ApiError, ORDERS_ENDPOINTS } from '@flux/api';
import { OrdersApiService } from './orders-api.service';

const ORDER_ID = '11111111-1111-4111-8111-111111111111';

interface ApiCalls {
  paths: string[];
  bodies: unknown[];
  options: unknown[];
}

function setup(): { service: OrdersApiService; api: ApiClient; calls: ApiCalls } {
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
  } as unknown as ApiClient;

  TestBed.configureTestingModule({ providers: [{ provide: ApiClient, useValue: apiStub }] });
  return { service: TestBed.inject(OrdersApiService), api: apiStub, calls };
}

describe('OrdersApiService getOrders', () => {
  it('reads the canonical list route with the query passed through untouched', () => {
    const { service, calls } = setup();
    service.getOrders({ pageNumber: 2, pageSize: 20 }).subscribe();

    expect(calls.paths).toEqual([ORDERS_ENDPOINTS.listOrders.path]);
    expect(calls.paths).toEqual(['/orders']);
    expect(calls.options).toEqual([{ params: { pageNumber: 2, pageSize: 20 } }]);
  });

  it('omits absent paging fields so backend defaults apply', () => {
    const { service, calls } = setup();
    service.getOrders().subscribe();

    expect(calls.options).toEqual([{ params: {} }]);
  });

  it('preserves caller context (correlation, culture) alongside the query', () => {
    const { service, calls } = setup();
    service
      .getOrders({ pageNumber: 1 }, { context: { correlationId: 'corr-1', culture: 'ar' } })
      .subscribe();

    expect(calls.options).toEqual([
      { context: { correlationId: 'corr-1', culture: 'ar' }, params: { pageNumber: 1 } },
    ]);
  });

  it('forwards the AbortSignal for cancellation without touching it', () => {
    const { service, calls } = setup();
    const controller = new AbortController();
    service.getOrders({ pageNumber: 1 }, { signal: controller.signal }).subscribe();

    expect(calls.options).toEqual([{ signal: controller.signal, params: { pageNumber: 1 } }]);
  });

  it('passes the paged envelope through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: {
        items: [
          {
            orderId: ORDER_ID,
            orderNumber: 'ORD-ABC123DEF456',
            status: 'Pending',
            grandTotal: { amount: 59.98, currency: 'USD' },
            itemCount: 2,
            createdAtUtc: '2026-09-04T10:00:00Z',
          },
        ],
        totalCount: 1,
        pageNumber: 1,
        pageSize: 20,
      },
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));

    let observed: unknown;
    service.getOrders().subscribe((value) => (observed = value));
    expect(observed).toBe(envelope);
  });

  it('passes empty pages through as success (never an error)', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: { items: [], totalCount: 0, pageNumber: 1, pageSize: 20 },
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));

    let observed: unknown;
    service.getOrders().subscribe((value) => (observed = value));
    expect(observed).toBe(envelope);
  });

  it('propagates validation, auth, and transport failures untouched', () => {
    const { service, api } = setup();
    for (const failure of [
      new ApiError({ status: 400, message: 'Bad paging.' }),
      new ApiError({ status: 401, message: 'Anonymous.' }),
      new ApiError({ status: 0, code: 'NetworkError', message: 'Unreachable.' }),
    ]) {
      vi.mocked(api.get).mockReturnValueOnce(throwError(() => failure));

      let observed: unknown;
      service.getOrders().subscribe({ error: (error: unknown) => (observed = error) });
      expect(observed).toBe(failure);
    }
  });
});

describe('OrdersApiService getOrderById', () => {
  it('reads the canonical details route with the id as pathParams', () => {
    const { service, calls } = setup();
    service.getOrderById(ORDER_ID).subscribe();

    expect(calls.paths).toEqual([ORDERS_ENDPOINTS.getOrder.path]);
    expect(calls.paths).toEqual(['/orders/{orderId}']);
    expect(calls.options).toEqual([{ pathParams: { orderId: ORDER_ID } }]);
  });

  it('preserves caller context and the AbortSignal alongside the id', () => {
    const { service, calls } = setup();
    const controller = new AbortController();
    service
      .getOrderById(ORDER_ID, {
        context: { correlationId: 'corr-2', culture: 'de' },
        signal: controller.signal,
      })
      .subscribe();

    expect(calls.options).toEqual([
      {
        context: { correlationId: 'corr-2', culture: 'de' },
        signal: controller.signal,
        pathParams: { orderId: ORDER_ID },
      },
    ]);
  });

  it('passes the details envelope through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
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
      },
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));

    let observed: unknown;
    service.getOrderById(ORDER_ID).subscribe((value) => (observed = value));
    expect(observed).toBe(envelope);
  });

  it('propagates anonymous and masked-not-found failures untouched', () => {
    const { service, api } = setup();
    for (const failure of [
      new ApiError({ status: 401, message: 'Anonymous.' }),
      new ApiError({ status: 404, message: 'Unknown or foreign order.' }),
    ]) {
      vi.mocked(api.get).mockReturnValueOnce(throwError(() => failure));

      let observed: unknown;
      service.getOrderById(ORDER_ID).subscribe({ error: (error: unknown) => (observed = error) });
      expect(observed).toBe(failure);
    }
  });
});

describe('OrdersApiService cancelOrder', () => {
  it('posts to the canonical cancel route with no body and the id as pathParams', () => {
    const { service, calls } = setup();
    service.cancelOrder(ORDER_ID).subscribe();

    expect(calls.paths).toEqual([ORDERS_ENDPOINTS.cancelOrder.path]);
    expect(calls.paths).toEqual(['/orders/{orderId}/cancel']);
    expect(calls.bodies).toEqual([undefined]);
    expect(calls.options).toEqual([{ pathParams: { orderId: ORDER_ID } }]);
  });

  it('passes the cancelled-details envelope through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: { orderId: ORDER_ID, orderNumber: 'ORD-ABC123DEF456', status: 'Cancelled' },
    };
    vi.mocked(api.post).mockReturnValueOnce(of(envelope));

    let observed: unknown;
    service.cancelOrder(ORDER_ID).subscribe((value) => (observed = value));
    expect(observed).toBe(envelope);
  });

  it('propagates late-cancel conflicts untouched', () => {
    const { service, api } = setup();
    const failure = new ApiError({ status: 409, message: 'Too late.' });
    vi.mocked(api.post).mockReturnValueOnce(throwError(() => failure));

    let observed: unknown;
    service.cancelOrder(ORDER_ID).subscribe({ error: (error: unknown) => (observed = error) });
    expect(observed).toBe(failure);
  });
});
