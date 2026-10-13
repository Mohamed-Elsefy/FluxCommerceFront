/**
 * Behavior tests for the Supplement S1 `ReservationListState`.
 *
 * `InventoryAdminApiService` is stubbed at its typed seam so these
 * tests own the state logic: default paging, verbatim page projection,
 * filter commits with page reset, blank-filter omission, committed page
 * moves, effective-page reload, in-flight supersession, and
 * contract-violation handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import { InventoryAdminApiService } from '../data-access/inventory-admin-api.service';
import { RESERVATION_LIST_PAGE_SIZE, ReservationListState } from './reservation-list-state';

function row(id: string) {
  return {
    reservationId: id,
    orderId: '4fa85f64-5717-4562-b3fc-2c963f66afa6',
    sku: 'TEE-BLK-M',
    quantity: 2,
    status: 0,
    expiresAt: '2026-09-04T10:30:00Z',
    createdAtUtc: '2026-09-04T10:00:00Z',
    updatedAtUtc: '2026-09-04T10:00:00Z',
  };
}

function page(totalCount: number, itemCount = 1, pageNumber = 1) {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      items: Array.from({ length: itemCount }, (_, index) => row(`res-${index}`)),
      totalCount,
      pageNumber,
      pageSize: RESERVATION_LIST_PAGE_SIZE,
    },
  };
}

function setup(stub: Partial<{ reservations: () => Observable<unknown> }> = {}): {
  state: ReservationListState;
  api: { listReservations: ReturnType<typeof vi.fn> };
} {
  const api = {
    listReservations: vi.fn(() => stub.reservations?.() ?? of(page(0, 0))),
  };
  TestBed.configureTestingModule({
    providers: [ReservationListState, { provide: InventoryAdminApiService, useValue: api }],
  });
  return { state: TestBed.inject(ReservationListState), api };
}

describe('ReservationListState lifecycle', () => {
  it('loads the first page by default and projects rows verbatim', () => {
    const { state, api } = setup({ reservations: () => of(page(2, 2)) });
    state.load();

    expect(api.listReservations).toHaveBeenCalledWith({
      pageNumber: 1,
      pageSize: RESERVATION_LIST_PAGE_SIZE,
    });
    expect(state.page().data?.items.map((item) => item.reservationId)).toEqual(['res-0', 'res-1']);
  });

  it('commits filters with a page reset', () => {
    const { state, api } = setup({ reservations: () => of(page(1, 1)) });
    state.load({ pageNumber: 4 });
    state.setFilters({ status: 'Pending', sku: 'TEE-BLK-M', orderId: 'order-1' });

    expect(api.listReservations).toHaveBeenLastCalledWith({
      pageNumber: 1,
      pageSize: RESERVATION_LIST_PAGE_SIZE,
      status: 'Pending',
      sku: 'TEE-BLK-M',
      orderId: 'order-1',
    });
  });

  it('omits blank filter values (the backend 400s on empty strings)', () => {
    const { state, api } = setup({ reservations: () => of(page(0, 0)) });
    state.setFilters({ status: '', sku: '  ', orderId: '' });

    expect(api.listReservations).toHaveBeenLastCalledWith({
      pageNumber: 1,
      pageSize: RESERVATION_LIST_PAGE_SIZE,
    });
  });

  it('clears stale filters on setFilters({}) so clear reloads unfiltered', () => {
    const { state, api } = setup({ reservations: () => of(page(1, 1)) });
    state.setFilters({ status: 'Pending', sku: 'TEE-BLK-M', orderId: 'order-1' });
    state.setFilters({});

    expect(api.listReservations).toHaveBeenLastCalledWith({
      pageNumber: 1,
      pageSize: RESERVATION_LIST_PAGE_SIZE,
    });
  });

  it('commits pager moves through setPage while preserving filters', () => {
    const { state, api } = setup({ reservations: () => of(page(25, 1, 3)) });
    state.setFilters({ status: 'Committed' });
    state.setPage(3);

    expect(api.listReservations).toHaveBeenLastCalledWith({
      pageNumber: 3,
      pageSize: RESERVATION_LIST_PAGE_SIZE,
      status: 'Committed',
    });
  });

  it('reloads the current effective page', () => {
    const { state, api } = setup({ reservations: () => of(page(25, 1, 2)) });
    state.load({ pageNumber: 2 });
    state.reload();

    expect(api.listReservations).toHaveBeenCalledTimes(2);
  });

  it('supersedes in-flight loads', () => {
    const { state, api } = setup();
    const first = new Subject<unknown>();
    const second = new Subject<unknown>();
    vi.mocked(api.listReservations)
      .mockReturnValueOnce(first.asObservable())
      .mockReturnValueOnce(second.asObservable());

    state.load({ pageNumber: 1 });
    state.load({ pageNumber: 2 });
    second.next(page(25, 1, 2));
    second.complete();

    expect(state.page().data?.pageNumber).toBe(2);
    first.next(page(25, 1, 1));
    expect(state.page().data?.pageNumber).toBe(2);
  });

  it('treats dataless envelopes as contract violations', () => {
    const { state } = setup({ reservations: () => of({ isSuccess: true, message: 'ok' }) });
    state.load();

    expect(state.page().status).toBe('error');
    expect(state.page().data).toBeNull();
  });

  it('lands backend failures in the error slot untouched', () => {
    const failure = new ApiError({ status: 400, message: 'Invalid.' });
    const { state } = setup({ reservations: () => throwError(() => failure) });
    state.load();

    expect(state.page().status).toBe('error');
    expect(state.page().error).toBe(failure);
  });
});
