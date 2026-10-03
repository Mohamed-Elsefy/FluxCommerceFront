/**
 * Delegation tests for the S1.10 `DashboardApiService`.
 *
 * `ApiClient` (the shared-lib HTTP boundary, already covered by `libs/api`
 * specs) is stubbed at its typed seam so these tests own the feature
 * logic: the canonical `DASHBOARD_ENDPOINTS` route template, the single
 * `toQueryParams` funnel for the threshold query, caller-context
 * preservation, envelope passthrough without unwrapping, and error
 * propagation untouched — the service never validates, catches,
 * remaps, logs, or throws.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiClient, ApiError, isApiError, DASHBOARD_ENDPOINTS } from '@flux/api';
import type { AdminDashboardResponse } from '@flux/models';
import { DashboardApiService } from './dashboard-api.service';

const SNAPSHOT_BODY: AdminDashboardResponse = {
  orders: { total: 1, pending: 1, confirmed: 0, cancelled: 0 },
  payments: {
    total: 1,
    pending: 1,
    processing: 0,
    succeeded: 0,
    failed: 0,
    cancelled: 0,
    refunded: 0,
    totalsByCurrency: [],
  },
  inventory: {
    totalItems: 1,
    totalOnHand: 10,
    totalReserved: 0,
    lowStockItems: 0,
    pendingReservations: 0,
    committedReservations: 0,
    releasedReservations: 0,
    expiredReservations: 0,
  },
  users: {
    total: 1,
    pending: 0,
    active: 1,
    suspended: 0,
    locked: 0,
    deleted: 0,
    customers: 0,
    admins: 1,
    superAdmins: 0,
    unverified: 0,
    lockedOut: 0,
  },
  recentOrders: [],
};

interface ApiCalls {
  paths: string[];
  options: unknown[];
}

function setup(): { service: DashboardApiService; api: ApiClient; calls: ApiCalls } {
  const calls: ApiCalls = { paths: [], options: [] };
  const apiStub = {
    get: vi.fn((path: string, options: unknown = {}) => {
      calls.paths.push(path);
      calls.options.push(options);
      return of({ isSuccess: true, data: SNAPSHOT_BODY });
    }),
  } as unknown as ApiClient;

  TestBed.configureTestingModule({
    providers: [DashboardApiService, { provide: ApiClient, useValue: apiStub }],
  });
  return { service: TestBed.inject(DashboardApiService), api: apiStub, calls };
}

describe('DashboardApiService getDashboard', () => {
  it('reads the canonical dashboard route with the threshold as query params', () => {
    const { service, calls } = setup();
    service.getDashboard({ lowStockThreshold: 5 }).subscribe();

    expect(calls.paths).toEqual([DASHBOARD_ENDPOINTS.getDashboard.path]);
    expect(calls.paths).toEqual(['/admin/dashboard']);
    expect(calls.options).toEqual([{ params: { lowStockThreshold: 5 } }]);
  });

  it('omits the threshold when unset (backend default 5 applies)', () => {
    const { service, calls } = setup();
    service.getDashboard().subscribe();

    expect(calls.options).toEqual([{ params: {} }]);
  });

  it('preserves caller context alongside the query', () => {
    const { service, calls } = setup();
    service
      .getDashboard({ lowStockThreshold: 5 }, { context: { correlationId: 'corr-1' } })
      .subscribe();

    expect(calls.options).toEqual([
      { context: { correlationId: 'corr-1' }, params: { lowStockThreshold: 5 } },
    ]);
  });

  it('passes the snapshot envelope through without unwrapping data', () => {
    const { service, api } = setup();
    const envelope = {
      isSuccess: true,
      message: 'Operation completed successfully.',
      data: SNAPSHOT_BODY,
    };
    vi.mocked(api.get).mockReturnValueOnce(of(envelope));

    let observed: unknown;
    service.getDashboard().subscribe((value) => (observed = value));
    expect(observed).toEqual(envelope);
  });

  it('propagates validation 400s (negative threshold) and 401/403s untouched', () => {
    const { service, api } = setup();
    for (const failure of [
      new ApiError({ status: 400, message: 'Negative threshold.' }),
      new ApiError({ status: 401, message: 'Anonymous.' }),
      new ApiError({ status: 403, message: 'Missing dashboard.read.' }),
    ]) {
      vi.mocked(api.get).mockReturnValueOnce(throwError(() => failure));

      let observed: unknown;
      service.getDashboard({ lowStockThreshold: -1 }).subscribe({
        error: (error: unknown) => (observed = error),
      });
      expect(observed).toBe(failure);
      expect(isApiError(observed)).toBe(true);
    }
  });
});
