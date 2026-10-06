/**
 * Behavior tests for the S2.3 adaptive `DashboardState`.
 *
 * `DashboardApiService` (already covered by its own delegation spec) is
 * stubbed at its typed seam so these tests own the state logic: the
 * idle → loading → success | error lifecycle, verbatim snapshot
 * projection (including partial per-entitlement snapshots),
 * duplicate-refresh prevention, retry after failure, and
 * contract-violation (dataless envelope) handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { defer, of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import { DashboardApiService } from '../data-access/dashboard-api.service';
import { DashboardState } from './dashboard-state';

function snapshot(totalOrders = 7) {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      orders: { total: totalOrders, pending: 4, confirmed: 2, cancelled: 1 },
      payments: {
        total: 7,
        pending: 1,
        processing: 1,
        succeeded: 3,
        failed: 1,
        cancelled: 0,
        refunded: 1,
        totalsByCurrency: [{ currency: 'USD', succeededCount: 3, succeededTotalAmount: 179.94 }],
      },
      inventory: {
        totalItems: 12,
        totalOnHand: 100,
        totalReserved: 5,
        lowStockItems: 2,
        pendingReservations: 1,
        committedReservations: 0,
        releasedReservations: 0,
        expiredReservations: 0,
      },
      catalog: {
        totalProducts: 4,
        activeProducts: 2,
        totalCategories: 1,
        totalVariants: 6,
      },
      users: {
        total: 3,
        pending: 0,
        active: 3,
        suspended: 0,
        locked: 0,
        deleted: 0,
        customers: 1,
        admins: 1,
        superAdmins: 1,
        unverified: 0,
        lockedOut: 0,
      },
      recentOrders: [],
    },
  };
}

function setup(stub: Partial<{ snapshot: () => Observable<unknown> }> = {}): {
  state: DashboardState;
  api: { getDashboard: ReturnType<typeof vi.fn> };
} {
  const api = {
    getDashboard: vi.fn(() => stub.snapshot?.() ?? of(snapshot(0))),
  };
  TestBed.configureTestingModule({
    providers: [DashboardState, { provide: DashboardApiService, useValue: api }],
  });
  return { state: TestBed.inject(DashboardState), api };
}

describe('DashboardState lifecycle', () => {
  it('starts idle with no snapshot and no error', () => {
    const { state } = setup();

    expect(state.snapshot().status).toBe('idle');
    expect(state.snapshot().data).toBeNull();
    expect(state.snapshot().error).toBeNull();
  });

  it('projects the backend-issued snapshot verbatim on success', () => {
    const { state, api } = setup({ snapshot: () => of(snapshot(7)) });
    state.refresh();

    expect(api.getDashboard).toHaveBeenCalledTimes(1);
    expect(api.getDashboard).toHaveBeenCalledWith({ lowStockThreshold: 5, days: 30 }, {});
    expect(state.snapshot().status).toBe('success');
    expect(state.snapshot().data?.orders?.total).toBe(7);
    expect(state.snapshot().data?.payments?.succeeded).toBe(3);
    expect(state.snapshot().data?.inventory?.totalItems).toBe(12);
    expect(state.snapshot().data?.catalog?.totalProducts).toBe(4);
    expect(state.snapshot().data?.users?.total).toBe(3);
    expect(state.snapshot().error).toBeNull();
  });

  it('projects a partial per-entitlement snapshot verbatim (null sections preserved)', () => {
    const { state } = setup({
      snapshot: () =>
        of({
          isSuccess: true,
          message: 'Operation completed successfully.',
          data: {
            orders: null,
            payments: null,
            inventory: null,
            catalog: {
              totalProducts: 4,
              activeProducts: 2,
              totalCategories: 1,
              totalVariants: 6,
            },
            users: null,
            recentOrders: [],
          },
        }),
    });
    state.refresh();

    expect(state.snapshot().status).toBe('success');
    expect(state.snapshot().data?.orders ?? null).toBeNull();
    expect(state.snapshot().data?.catalog?.totalProducts).toBe(4);
    expect(state.snapshot().data?.recentOrders).toEqual([]);
  });

  it('resolves to error and records the normalized failure', () => {
    const failure = new ApiError({ status: 500, message: 'Server error.' });
    const { state } = setup({ snapshot: () => throwError(() => failure) });
    state.refresh();

    expect(state.snapshot().status).toBe('error');
    expect(state.snapshot().data).toBeNull();
    expect(state.snapshot().error).toBe(failure);
  });

  it('ignores a refresh issued while a load is in flight', () => {
    let resolveSnapshot!: (value: ReturnType<typeof snapshot>) => void;
    const pending = new Promise<ReturnType<typeof snapshot>>((resolve) => {
      resolveSnapshot = resolve;
    });
    const { state, api } = setup({ snapshot: () => defer(() => pending) });
    state.refresh();
    state.refresh();

    expect(api.getDashboard).toHaveBeenCalledTimes(1);
    resolveSnapshot(snapshot(5));
    return pending.then(() => {
      expect(state.snapshot().status).toBe('success');
      expect(state.snapshot().data?.orders?.total).toBe(5);
    });
  });

  it('retries after failure with a fresh request', () => {
    const failure = new ApiError({ status: 500, message: 'Server error.' });
    let attempts = 0;
    const { state, api } = setup({
      snapshot: () => (attempts++ === 0 ? throwError(() => failure) : of(snapshot(2))),
    });
    state.refresh();
    expect(state.snapshot().status).toBe('error');

    state.refresh();
    expect(api.getDashboard).toHaveBeenCalledTimes(2);
    expect(state.snapshot().status).toBe('success');
    expect(state.snapshot().data?.orders?.total).toBe(2);
  });

  it('resolves a dataless envelope to error (contract violation)', () => {
    const { state } = setup({
      snapshot: () => of({ isSuccess: true, message: 'Operation completed successfully.' }),
    });
    state.refresh();

    expect(state.snapshot().status).toBe('error');
    expect(state.snapshot().data).toBeNull();
    expect(state.snapshot().error).not.toBeNull();
  });
});
