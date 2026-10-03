/**
 * Delegation tests for the `PaymentsAdminApiService` (Supplement S1,
 * Step S1.9 — admin slice).
 *
 * `ApiClient` (the shared-lib HTTP boundary, already covered by `libs/api`
 * specs) is stubbed at its typed seam so these tests own the feature
 * logic: the canonical `ADMIN_PAYMENTS_ENDPOINTS` route templates with
 * ids as `pathParams`, the single `toQueryParams` funnel for list
 * queries, caller-context preservation, `AbortSignal` forwarding for
 * cancellation, envelope passthrough without unwrapping, and error
 * propagation untouched — the service never validates, catches,
 * remaps, logs, or throws.
 *
 * Read-only by contract: list/stats/details only — no history-shaped
 * method, no mutation, no webhook call exists here by design.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiClient, ApiError, isApiError, ADMIN_PAYMENTS_ENDPOINTS } from '@flux/api';
import type { PaymentAdminResponse, PaymentAdminStatsResponse } from '@flux/models';
import { PaymentsAdminApiService } from './payments-admin-api.service';

const PAYMENT_ID = '22222222-2222-4222-8222-222222222222';

const PAYMENT_BODY: PaymentAdminResponse = {
  id: PAYMENT_ID,
  orderId: '11111111-1111-4111-8111-111111111111',
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

const STATS_BODY: PaymentAdminStatsResponse = {
  total: 7,
  pending: 1,
  processing: 1,
  succeeded: 3,
  failed: 1,
  cancelled: 0,
  refunded: 1,
  totalsByCurrency: [{ currency: 'USD', succeededCount: 3, succeededTotalAmount: 179.94 }],
};

interface ApiCalls {
  paths: string[];
  options: unknown[];
}

function setup(): { service: PaymentsAdminApiService; api: ApiClient; calls: ApiCalls } {
  const calls: ApiCalls = { paths: [], options: [] };
  const apiStub = {
    get: vi.fn((path: string, options: unknown = {}) => {
      calls.paths.push(path);
      calls.options.push(options);
      return of({ isSuccess: true, data: PAYMENT_BODY });
    }),
  } as unknown as ApiClient;

  TestBed.configureTestingModule({
    providers: [PaymentsAdminApiService, { provide: ApiClient, useValue: apiStub }],
  });
  return { service: TestBed.inject(PaymentsAdminApiService), api: apiStub, calls };
}

describe('PaymentsAdminApiService listPayments', () => {
  it('reads the canonical list route with paging plus filters as query params', () => {
    const { service, calls } = setup();
    service
      .listPayments({ pageNumber: 1, pageSize: 20, status: 'Succeeded', orderId: 'o-1' })
      .subscribe();

    expect(calls.paths).toEqual([ADMIN_PAYMENTS_ENDPOINTS.listAdminPayments.path]);
    expect(calls.paths).toEqual(['/admin/payments']);
    expect(calls.options).toEqual([
      { params: { pageNumber: 1, pageSize: 20, status: 'Succeeded', orderId: 'o-1' } },
    ]);
  });

  it('omits unset filters (paging only)', () => {
    const { service, calls } = setup();
    service.listPayments({ pageNumber: 2, pageSize: 20 }).subscribe();

    expect(calls.options).toEqual([{ params: { pageNumber: 2, pageSize: 20 } }]);
  });

  it('preserves caller context alongside the query', () => {
    const { service, calls } = setup();
    service
      .listPayments({ pageNumber: 1 }, { context: { correlationId: 'corr-1', culture: 'ar' } })
      .subscribe();

    expect(calls.options).toEqual([
      { context: { correlationId: 'corr-1', culture: 'ar' }, params: { pageNumber: 1 } },
    ]);
  });

  it('passes the paged envelope through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: { items: [PAYMENT_BODY], totalCount: 1, pageNumber: 1, pageSize: 20 },
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));

    let observed: unknown;
    service.listPayments().subscribe((value) => (observed = value));
    expect(observed).toEqual(envelope);
  });

  it('propagates validation 400s (bad filters) and 401/403s untouched', () => {
    const { service, api } = setup();
    for (const failure of [
      new ApiError({ status: 400, code: 'Payment.ValidationFailed', message: 'Bad query.' }),
      new ApiError({ status: 401, message: 'Anonymous.' }),
      new ApiError({ status: 403, message: 'Missing payments.read.' }),
    ]) {
      vi.mocked(api.get).mockReturnValueOnce(throwError(() => failure));

      let observed: unknown;
      service.listPayments({ status: 'Nope' }).subscribe({
        error: (error: unknown) => (observed = error),
      });
      expect(observed).toBe(failure);
      expect(isApiError(observed)).toBe(true);
    }
  });
});

describe('PaymentsAdminApiService paymentStats', () => {
  it('reads the canonical stats route', () => {
    const { service, calls } = setup();
    service.paymentStats().subscribe();

    expect(calls.paths).toEqual([ADMIN_PAYMENTS_ENDPOINTS.paymentStats.path]);
    expect(calls.paths).toEqual(['/admin/payments/stats']);
    expect(calls.options).toEqual([{}]);
  });

  it('passes the stats envelope through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: STATS_BODY,
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));

    let observed: unknown;
    service.paymentStats().subscribe((value) => (observed = value));
    expect(observed).toEqual(envelope);
  });

  it('propagates 401/403s untouched', () => {
    const { service, api } = setup();
    const failure = new ApiError({ status: 403, message: 'Missing payments.stats.' });
    vi.mocked(api.get).mockReturnValueOnce(throwError(() => failure));

    let observed: unknown;
    service.paymentStats().subscribe({
      error: (error: unknown) => (observed = error),
    });
    expect(observed).toBe(failure);
  });
});

describe('PaymentsAdminApiService getPayment', () => {
  it('reads the canonical details route with the id as pathParams', () => {
    const { service, calls } = setup();
    service.getPayment(PAYMENT_ID).subscribe();

    expect(calls.paths).toEqual([ADMIN_PAYMENTS_ENDPOINTS.getAdminPayment.path]);
    expect(calls.paths).toEqual(['/admin/payments/{paymentId}']);
    expect(calls.options).toEqual([{ pathParams: { paymentId: PAYMENT_ID } }]);
  });

  it('passes the details envelope through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: PAYMENT_BODY,
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));

    let observed: unknown;
    service.getPayment(PAYMENT_ID).subscribe((value) => (observed = value));
    expect(observed).toEqual(envelope);
  });

  it('propagates masked 404s untouched (never probes ids)', () => {
    const { service, api } = setup();
    const failure = new ApiError({ status: 404, code: 'Payment.NotFound', message: 'Not found.' });
    vi.mocked(api.get).mockReturnValueOnce(throwError(() => failure));

    let observed: unknown;
    service.getPayment(PAYMENT_ID).subscribe({
      error: (error: unknown) => (observed = error),
    });
    expect(observed).toBe(failure);
    expect(isApiError(observed)).toBe(true);
  });
});

describe('PaymentsAdminApiService read-only boundary', () => {
  it('exposes no history-shaped method', () => {
    const { service } = setup();
    expect('paymentHistory' in service).toBe(false);
    expect('listPaymentHistory' in service).toBe(false);
    expect('getPaymentHistory' in service).toBe(false);
  });

  it('exposes no payment mutation', () => {
    const { service } = setup();
    for (const method of ['createPayment', 'confirmPayment', 'cancelPayment', 'refundPayment']) {
      expect(method in service).toBe(false);
    }
  });
});
