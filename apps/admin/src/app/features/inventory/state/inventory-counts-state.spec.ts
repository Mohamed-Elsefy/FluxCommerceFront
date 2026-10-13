/**
 * Behavior tests for the Supplement S1 `InventoryCountsState`.
 *
 * `InventoryAdminApiService` is stubbed at its typed seam so these
 * tests own the state logic: verbatim counts projection, reload,
 * in-flight supersession, and contract-violation handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import { InventoryAdminApiService } from '../data-access/inventory-admin-api.service';
import { InventoryCountsState } from './inventory-counts-state';

function counts() {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      totalItems: 12,
      totalOnHand: 100,
      totalReserved: 8,
      lowStockItems: 2,
      pendingReservations: 1,
      committedReservations: 3,
      releasedReservations: 0,
      expiredReservations: 1,
    },
  };
}

function setup(stub: Partial<{ counts: () => Observable<unknown> }> = {}): {
  state: InventoryCountsState;
  api: { itemCounts: ReturnType<typeof vi.fn> };
} {
  const api = {
    itemCounts: vi.fn(() => stub.counts?.() ?? of(counts())),
  };
  TestBed.configureTestingModule({
    providers: [InventoryCountsState, { provide: InventoryAdminApiService, useValue: api }],
  });
  return { state: TestBed.inject(InventoryCountsState), api };
}

describe('InventoryCountsState lifecycle', () => {
  it('loads the counts snapshot verbatim', () => {
    const { state, api } = setup();
    state.load();

    expect(api.itemCounts).toHaveBeenCalledTimes(1);
    expect(state.counts().status).toBe('success');
    expect(state.counts().data?.totalItems).toBe(12);
    expect(state.counts().data?.lowStockItems).toBe(2);
  });

  it('reloads on demand', () => {
    const { state, api } = setup();
    state.load();
    state.reload();

    expect(api.itemCounts).toHaveBeenCalledTimes(2);
  });

  it('supersedes in-flight loads', () => {
    const { state, api } = setup();
    const first = new Subject<unknown>();
    const second = new Subject<unknown>();
    vi.mocked(api.itemCounts)
      .mockReturnValueOnce(first.asObservable())
      .mockReturnValueOnce(second.asObservable());
    state.load();
    state.load();

    expect(api.itemCounts).toHaveBeenCalledTimes(2);
    first.next(counts());
    expect(state.counts().status).toBe('loading');
    second.next(counts());
    expect(state.counts().status).toBe('success');
  });

  it('treats dataless envelopes as contract violations', () => {
    const { state } = setup({ counts: () => of({ isSuccess: true, message: 'ok' }) });
    state.load();

    expect(state.counts().status).toBe('error');
    expect(state.counts().data).toBeNull();
  });

  it('lands backend failures in the error slot untouched', () => {
    const failure = new ApiError({ status: 400, message: 'Invalid.' });
    const { state } = setup({ counts: () => throwError(() => failure) });
    state.load();

    expect(state.counts().status).toBe('error');
    expect(state.counts().error).toBe(failure);
  });
});
