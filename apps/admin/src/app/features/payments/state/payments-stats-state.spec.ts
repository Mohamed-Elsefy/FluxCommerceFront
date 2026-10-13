/**
 * Behavior tests for the S1.9 `PaymentsStatsState`.
 *
 * `PaymentsAdminApiService` (already covered by its own delegation spec)
 * is stubbed at its typed seam so these tests own the state logic: the
 * idle → loading → success | error lifecycle, verbatim stats
 * projection, duplicate-refresh prevention, retry after failure, and
 * contract-violation (dataless envelope) handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import { PaymentsAdminApiService } from '../data-access/payments-admin-api.service';
import { PaymentsStatsState } from './payments-stats-state';

function stats(total = 7) {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      total,
      pending: 1,
      processing: 1,
      succeeded: 3,
      failed: 1,
      cancelled: 0,
      refunded: 1,
      totalsByCurrency: [{ currency: 'USD', succeededCount: 3, succeededTotalAmount: 179.94 }],
    },
  };
}

function setup(stub: Partial<{ stats: () => Observable<unknown> }> = {}): {
  state: PaymentsStatsState;
  api: { paymentStats: ReturnType<typeof vi.fn> };
} {
  const api = {
    paymentStats: vi.fn(() => stub.stats?.() ?? of(stats(0))),
  };
  TestBed.configureTestingModule({
    providers: [PaymentsStatsState, { provide: PaymentsAdminApiService, useValue: api }],
  });
  return { state: TestBed.inject(PaymentsStatsState), api };
}

describe('PaymentsStatsState lifecycle', () => {
  it('starts idle with no stats and no error', () => {
    const { state } = setup();

    expect(state.stats().status).toBe('idle');
    expect(state.stats().data).toBeNull();
    expect(state.stats().error).toBeNull();
  });

  it('projects the backend-issued buckets verbatim on success', () => {
    const { state, api } = setup({ stats: () => of(stats(7)) });
    state.refresh();

    expect(api.paymentStats).toHaveBeenCalledTimes(1);
    expect(state.stats().status).toBe('success');
    expect(state.stats().data?.total).toBe(7);
    expect(state.stats().data?.succeeded).toBe(3);
    expect(state.stats().data?.totalsByCurrency).toEqual([
      { currency: 'USD', succeededCount: 3, succeededTotalAmount: 179.94 },
    ]);
    expect(state.stats().error).toBeNull();
  });

  it('resolves to error and records the normalized failure', () => {
    const failure = new ApiError({ status: 403, message: 'Missing payments.stats.' });
    const { state } = setup({ stats: () => throwError(() => failure) });
    state.refresh();

    expect(state.stats().status).toBe('error');
    expect(state.stats().data).toBeNull();
    expect(state.stats().error).toBe(failure);
  });

  it('ignores a refresh issued while a load is in flight', () => {
    let resolveStats!: (value: ReturnType<typeof stats>) => void;
    const pending = new Promise<ReturnType<typeof stats>>((resolve) => {
      resolveStats = resolve;
    });
    const { state, api } = setup({ stats: () => defer(() => pending) });
    state.refresh();
    state.refresh();

    expect(api.paymentStats).toHaveBeenCalledTimes(1);
    resolveStats(stats(5));
    return pending.then(() => {
      expect(state.stats().status).toBe('success');
      expect(state.stats().data?.total).toBe(5);
    });
  });

  it('retries after failure with a fresh request', () => {
    const failure = new ApiError({ status: 500, message: 'Server error.' });
    let attempts = 0;
    const { state, api } = setup({
      stats: () => (attempts++ === 0 ? throwError(() => failure) : of(stats(2))),
    });
    state.refresh();
    expect(state.stats().status).toBe('error');

    state.refresh();
    expect(api.paymentStats).toHaveBeenCalledTimes(2);
    expect(state.stats().status).toBe('success');
    expect(state.stats().data?.total).toBe(2);
  });

  it('resolves a dataless envelope to error (contract violation)', () => {
    const { state } = setup({
      stats: () => of({ isSuccess: true, message: 'Operation completed successfully.' }),
    });
    state.refresh();

    expect(state.stats().status).toBe('error');
    expect(state.stats().data).toBeNull();
    expect(state.stats().error).not.toBeNull();
  });
});
