/**
 * Behavior tests for the S1.9 `PaymentsListState`.
 *
 * `PaymentsAdminApiService` (already covered by its own delegation spec)
 * is stubbed at its typed seam so these tests own the state logic:
 * default paging, verbatim page projection, committed page moves,
 * filter commits with page reset, blank omission, effective-page
 * reload, and contract-violation (dataless envelope) handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import { PaymentsAdminApiService } from '../data-access/payments-admin-api.service';
import { PAYMENT_LIST_PAGE_SIZE, PaymentsListState } from './payments-list-state';

function row(paymentId: string) {
  return {
    id: paymentId,
    orderId: 'order-1',
    customerId: 'cust-1',
    amount: 59.98,
    currency: 'USD',
    status: 'Succeeded',
    providerPaymentIntentId: 'pi_123',
    provider: 'stripe',
    createdAtUtc: '2026-09-28T10:00:00Z',
    updatedAtUtc: '2026-09-28T10:01:00Z',
    version: 2,
  };
}

function page(totalCount: number, itemCount = 1, pageNumber = 1) {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      items: Array.from({ length: itemCount }, (_, index) => row(`pay-${index}`)),
      totalCount,
      pageNumber,
      pageSize: PAYMENT_LIST_PAGE_SIZE,
    },
  };
}

function setup(stub: Partial<{ payments: () => Observable<unknown> }> = {}): {
  state: PaymentsListState;
  api: { listPayments: ReturnType<typeof vi.fn> };
} {
  const api = {
    listPayments: vi.fn(() => stub.payments?.() ?? of(page(0, 0))),
  };
  TestBed.configureTestingModule({
    providers: [PaymentsListState, { provide: PaymentsAdminApiService, useValue: api }],
  });
  return { state: TestBed.inject(PaymentsListState), api };
}

describe('PaymentsListState lifecycle', () => {
  it('loads the first page by default and projects rows verbatim', () => {
    const { state, api } = setup({ payments: () => of(page(2, 2)) });
    state.load();

    expect(api.listPayments).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: PAYMENT_LIST_PAGE_SIZE,
    });
    expect(state.page().data?.items.map((item) => item.id)).toEqual(['pay-0', 'pay-1']);
    expect(state.page().data?.totalCount).toBe(2);
  });

  it('commits pager moves through setPage', () => {
    const { state, api } = setup({ payments: () => of(page(25, 1, 3)) });
    state.setPage(3);

    expect(api.listPayments).toHaveBeenCalledWith({
      pageNumber: 3,
      pageSize: PAYMENT_LIST_PAGE_SIZE,
    });
    expect(state.page().data?.pageNumber).toBe(3);
  });

  it('commits filters with a page reset', () => {
    const { state, api } = setup({ payments: () => of(page(1, 1)) });
    state.load({ pageNumber: 4 });
    state.setFilters({ status: 'Failed', orderId: 'order-1', customerId: 'cust-1' });

    expect(api.listPayments).toHaveBeenLastCalledWith({
      pageNumber: 1,
      pageSize: PAYMENT_LIST_PAGE_SIZE,
      status: 'Failed',
      orderId: 'order-1',
      customerId: 'cust-1',
    });
  });

  it('omits blank filter values (the backend 400s on empty strings)', () => {
    const { state, api } = setup({ payments: () => of(page(0, 0)) });
    state.setFilters({ status: '', orderId: '   ' });

    expect(api.listPayments).toHaveBeenLastCalledWith({
      pageNumber: 1,
      pageSize: PAYMENT_LIST_PAGE_SIZE,
    });
  });

  it('preserves committed filters across pager moves', () => {
    const { state, api } = setup({ payments: () => of(page(25, 1, 3)) });
    state.setFilters({ status: 'Succeeded' });
    state.setPage(3);

    expect(api.listPayments).toHaveBeenLastCalledWith({
      pageNumber: 3,
      pageSize: PAYMENT_LIST_PAGE_SIZE,
      status: 'Succeeded',
    });
  });

  it('reloads the current effective page', () => {
    const { state, api } = setup({ payments: () => of(page(25, 1, 2)) });
    state.load({ pageNumber: 2 });
    state.reload();

    expect(api.listPayments).toHaveBeenLastCalledWith({
      pageNumber: 2,
      pageSize: PAYMENT_LIST_PAGE_SIZE,
    });
  });

  it('resolves an empty page to empty (out-of-range is not an error)', () => {
    const { state } = setup({ payments: () => of(page(25, 0, 99)) });
    state.load({ pageNumber: 99 });

    expect(state.page().isEmpty).toBe(true);
    expect(state.page().error).toBeNull();
  });

  it('resolves failures to error with the normalized failure', () => {
    const failure = new ApiError({ status: 403, message: 'Missing payments.read.' });
    const { state } = setup({ payments: () => throwError(() => failure) });
    state.load();

    expect(state.page().isError).toBe(true);
    expect(state.page().error).toBe(failure);
  });

  it('resolves a dataless envelope to error (contract violation)', () => {
    const { state } = setup({
      payments: () => of({ isSuccess: true, message: 'Operation completed successfully.' }),
    });
    state.load();

    expect(state.page().isError).toBe(true);
    expect(state.page().data).toBeNull();
  });
});
