/**
 * Behavior tests for the Supplement S1 `OrdersOverviewState`.
 *
 * `OrdersAdminApiService` (already covered by its own delegation spec)
 * is stubbed at its typed seam so these tests own the state logic: the
 * idle → loading → success | error lifecycle, verbatim counts
 * projection, duplicate-refresh prevention, retry after failure, and
 * contract-violation (dataless envelope) handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import { OrdersAdminApiService } from '../data-access/orders-admin-api.service';
import { OrdersOverviewState } from './orders-overview-state';

function counts(total = 42) {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: { total, pending: 30, confirmed: 10, cancelled: 2 },
  };
}

function setup(stub: Partial<{ counts: () => Observable<unknown> }> = {}): {
  state: OrdersOverviewState;
  api: { orderCounts: ReturnType<typeof vi.fn> };
} {
  const api = {
    orderCounts: vi.fn(() => stub.counts?.() ?? of(counts(0))),
  };
  TestBed.configureTestingModule({
    providers: [OrdersOverviewState, { provide: OrdersAdminApiService, useValue: api }],
  });
  return { state: TestBed.inject(OrdersOverviewState), api };
}

describe('OrdersOverviewState lifecycle', () => {
  it('starts idle with no counts and no error', () => {
    const { state } = setup();

    expect(state.counts().status).toBe('idle');
    expect(state.counts().data).toBeNull();
    expect(state.counts().error).toBeNull();
  });

  it('projects the backend-issued buckets verbatim on success', () => {
    const { state, api } = setup({ counts: () => of(counts(42)) });
    state.refresh();

    expect(api.orderCounts).toHaveBeenCalledTimes(1);
    expect(state.counts().status).toBe('success');
    expect(state.counts().data).toEqual({ total: 42, pending: 30, confirmed: 10, cancelled: 2 });
    expect(state.counts().error).toBeNull();
  });

  it('resolves to error and records the normalized failure', () => {
    const failure = new ApiError({ status: 403, message: 'Forbidden.' });
    const { state } = setup({ counts: () => throwError(() => failure) });
    state.refresh();

    expect(state.counts().status).toBe('error');
    expect(state.counts().data).toBeNull();
    expect(state.counts().error).toBe(failure);
  });

  it('ignores a refresh issued while a load is in flight', () => {
    let resolveCounts!: (value: ReturnType<typeof counts>) => void;
    const pending = new Promise<ReturnType<typeof counts>>((resolve) => {
      resolveCounts = resolve;
    });
    const { state, api } = setup({ counts: () => defer(() => pending) });
    state.refresh();
    state.refresh();

    expect(api.orderCounts).toHaveBeenCalledTimes(1);
    resolveCounts(counts(5));
    return pending.then(() => {
      expect(state.counts().status).toBe('success');
      expect(state.counts().data?.total).toBe(5);
    });
  });

  it('retries after failure with a fresh request', () => {
    const failure = new ApiError({ status: 500, message: 'Server error.' });
    let attempts = 0;
    const { state, api } = setup({
      counts: () => (attempts++ === 0 ? throwError(() => failure) : of(counts(2))),
    });
    state.refresh();
    expect(state.counts().status).toBe('error');

    state.refresh();
    expect(api.orderCounts).toHaveBeenCalledTimes(2);
    expect(state.counts().status).toBe('success');
    expect(state.counts().data?.total).toBe(2);
  });

  it('resolves a dataless envelope to error (contract violation)', () => {
    const { state } = setup({
      counts: () => of({ isSuccess: true, message: 'Operation completed successfully.' }),
    });
    state.refresh();

    expect(state.counts().status).toBe('error');
    expect(state.counts().data).toBeNull();
    expect(state.counts().error).not.toBeNull();
  });
});
