/**
 * Behavior tests for the Sub-Phase 14.2 `OrdersOverviewState`.
 *
 * `OrdersAdminApiService` (already covered by its own delegation spec) is
 * stubbed at its typed seam so these tests own the state logic: the idle
 * → loading → success | empty | error lifecycle, verbatim `totalCount`
 * projection, duplicate-refresh prevention, retry after failure, and
 * contract-violation (dataless envelope) handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import { OrdersAdminApiService } from '../data-access/orders-admin-api.service';
import { ORDERS_OVERVIEW_PAGE_SIZE, OrdersOverviewState } from './orders-overview-state';

function page(totalCount: number, itemCount = 1) {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      items: Array.from({ length: itemCount }, (_, index) => ({ orderId: `order-${index}` })),
      totalCount,
      pageNumber: 1,
      pageSize: ORDERS_OVERVIEW_PAGE_SIZE,
    },
  };
}

function setup(stub: Partial<{ orders: () => Observable<unknown> }> = {}): {
  state: OrdersOverviewState;
  api: { listOrders: ReturnType<typeof vi.fn> };
} {
  const api = {
    listOrders: vi.fn(() => stub.orders?.() ?? of(page(0, 0))),
  };
  TestBed.configureTestingModule({
    providers: [OrdersOverviewState, { provide: OrdersAdminApiService, useValue: api }],
  });
  return { state: TestBed.inject(OrdersOverviewState), api };
}

describe('OrdersOverviewState lifecycle', () => {
  it('starts idle with no overview and no error', () => {
    const { state } = setup();

    expect(state.status()).toBe('idle');
    expect(state.overview()).toBeNull();
    expect(state.error()).toBeNull();
  });

  it('projects the backend-issued total verbatim on success', () => {
    const { state, api } = setup({ orders: () => of(page(42)) });
    state.refresh();

    expect(api.listOrders).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: ORDERS_OVERVIEW_PAGE_SIZE,
    });
    expect(state.status()).toBe('success');
    expect(state.overview()).toEqual({ orderTotal: 42 });
    expect(state.error()).toBeNull();
  });

  it('resolves to empty when the slot settles with no rows', () => {
    const { state } = setup({ orders: () => of(page(0, 0)) });
    state.refresh();

    expect(state.status()).toBe('empty');
    expect(state.overview()).toEqual({ orderTotal: 0 });
  });

  it('resolves to error and records the normalized failure', () => {
    const failure = new ApiError({ status: 403, message: 'Forbidden.' });
    const { state } = setup({ orders: () => throwError(() => failure) });
    state.refresh();

    expect(state.status()).toBe('error');
    expect(state.overview()).toBeNull();
    expect(state.error()).toBe(failure);
  });

  it('ignores a refresh issued while a load is in flight', () => {
    let resolveOrders!: (value: ReturnType<typeof page>) => void;
    const pending = new Promise<ReturnType<typeof page>>((resolve) => {
      resolveOrders = resolve;
    });
    const { state, api } = setup({ orders: () => defer(() => pending) });
    state.refresh();
    state.refresh();

    expect(api.listOrders).toHaveBeenCalledTimes(1);
    resolveOrders(page(5));
    return pending.then(() => {
      expect(state.status()).toBe('success');
      expect(state.overview()).toEqual({ orderTotal: 5 });
    });
  });

  it('retries after failure with a fresh request', () => {
    const failure = new ApiError({ status: 500, message: 'Server error.' });
    let attempts = 0;
    const { state, api } = setup({
      orders: () => (attempts++ === 0 ? throwError(() => failure) : of(page(2))),
    });
    state.refresh();
    expect(state.status()).toBe('error');

    state.refresh();
    expect(api.listOrders).toHaveBeenCalledTimes(2);
    expect(state.status()).toBe('success');
    expect(state.overview()).toEqual({ orderTotal: 2 });
  });

  it('resolves a dataless envelope to error (contract violation)', () => {
    const { state } = setup({
      orders: () => of({ isSuccess: true, message: 'Operation completed successfully.' }),
    });
    state.refresh();

    expect(state.status()).toBe('error');
    expect(state.overview()).toBeNull();
    expect(state.error()).not.toBeNull();
  });
});
