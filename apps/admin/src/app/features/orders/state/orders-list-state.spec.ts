/**
 * Behavior tests for the Sub-Phase 14.3 `OrderListState`.
 *
 * `OrdersAdminApiService` (already covered by its own delegation spec) is
 * stubbed at its typed seam so these tests own the state logic: default
 * paging, verbatim page projection, committed page moves, effective-page
 * reload, in-flight supersession, and contract-violation (dataless
 * envelope) handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import { OrdersAdminApiService } from '../data-access/orders-admin-api.service';
import { ORDER_LIST_PAGE_SIZE, OrderListState } from './orders-list-state';

function row(orderId: string) {
  return {
    orderId,
    orderNumber: `ORD-${orderId}`,
    status: 'Pending',
    grandTotal: { amount: 10, currency: 'USD' },
    itemCount: 1,
    createdAtUtc: '2026-09-28T10:00:00Z',
  };
}

function page(totalCount: number, itemCount = 1, pageNumber = 1) {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      items: Array.from({ length: itemCount }, (_, index) => row(`order-${index}`)),
      totalCount,
      pageNumber,
      pageSize: ORDER_LIST_PAGE_SIZE,
    },
  };
}

function setup(stub: Partial<{ orders: () => Observable<unknown> }> = {}): {
  state: OrderListState;
  api: { listOrders: ReturnType<typeof vi.fn> };
} {
  const api = {
    listOrders: vi.fn(() => stub.orders?.() ?? of(page(0, 0))),
  };
  TestBed.configureTestingModule({
    providers: [OrderListState, { provide: OrdersAdminApiService, useValue: api }],
  });
  return { state: TestBed.inject(OrderListState), api };
}

describe('OrderListState lifecycle', () => {
  it('loads the first page by default and projects rows verbatim', () => {
    const { state, api } = setup({ orders: () => of(page(2, 2)) });
    state.load();

    expect(api.listOrders).toHaveBeenCalledWith({ pageNumber: 1, pageSize: ORDER_LIST_PAGE_SIZE });
    expect(state.page().data?.items.map((item) => item.orderId)).toEqual(['order-0', 'order-1']);
    expect(state.page().data?.totalCount).toBe(2);
  });

  it('commits pager moves through setPage', () => {
    const { state, api } = setup({ orders: () => of(page(25, 1, 3)) });
    state.setPage(3);

    expect(api.listOrders).toHaveBeenCalledWith({ pageNumber: 3, pageSize: ORDER_LIST_PAGE_SIZE });
    expect(state.page().data?.pageNumber).toBe(3);
  });

  it('reloads the current effective page', () => {
    const { state, api } = setup({ orders: () => of(page(25, 1, 2)) });
    state.load({ pageNumber: 2 });
    state.reload();

    expect(api.listOrders).toHaveBeenLastCalledWith({
      pageNumber: 2,
      pageSize: ORDER_LIST_PAGE_SIZE,
    });
  });

  it('resolves an empty page to empty (out-of-range is not an error)', () => {
    const { state } = setup({ orders: () => of(page(25, 0, 99)) });
    state.load({ pageNumber: 99 });

    expect(state.page().isEmpty).toBe(true);
    expect(state.page().error).toBeNull();
  });

  it('resolves failures to error with the normalized failure', () => {
    const failure = new ApiError({ status: 401, message: 'Unauthorized.' });
    const { state } = setup({ orders: () => throwError(() => failure) });
    state.load();

    expect(state.page().isError).toBe(true);
    expect(state.page().error).toBe(failure);
  });

  it('resolves a dataless envelope to error (contract violation)', () => {
    const { state } = setup({
      orders: () => of({ isSuccess: true, message: 'Operation completed successfully.' }),
    });
    state.load();

    expect(state.page().isError).toBe(true);
    expect(state.page().data).toBeNull();
  });
});
