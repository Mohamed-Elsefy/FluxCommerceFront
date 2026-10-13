/**
 * Behavior tests for the Supplement S1 `StockListState`.
 *
 * `InventoryAdminApiService` (covered by its own delegation spec) is
 * stubbed at its typed seam so these tests own the state logic:
 * default paging, verbatim page projection, filter commits with page
 * reset, blank-filter omission, committed page moves, effective-page
 * reload, in-flight supersession, and contract-violation handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import { InventoryAdminApiService } from '../data-access/inventory-admin-api.service';
import { STOCK_LIST_PAGE_SIZE, StockListState } from './stock-list-state';

function row(sku: string) {
  return {
    sku,
    onHandQuantity: 10,
    reservedQuantity: 2,
    availableQuantity: 8,
    updatedAtUtc: '2026-09-04T10:00:00Z',
  };
}

function page(totalCount: number, itemCount = 1, pageNumber = 1) {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      items: Array.from({ length: itemCount }, (_, index) => row(`SKU-${index}`)),
      totalCount,
      pageNumber,
      pageSize: STOCK_LIST_PAGE_SIZE,
    },
  };
}

function setup(stub: Partial<{ items: () => Observable<unknown> }> = {}): {
  state: StockListState;
  api: { listItems: ReturnType<typeof vi.fn> };
} {
  const api = {
    listItems: vi.fn(() => stub.items?.() ?? of(page(0, 0))),
  };
  TestBed.configureTestingModule({
    providers: [StockListState, { provide: InventoryAdminApiService, useValue: api }],
  });
  return { state: TestBed.inject(StockListState), api };
}

describe('StockListState lifecycle', () => {
  it('loads the first page by default and projects rows verbatim', () => {
    const { state, api } = setup({ items: () => of(page(2, 2)) });
    state.load();

    expect(api.listItems).toHaveBeenCalledWith({ pageNumber: 1, pageSize: STOCK_LIST_PAGE_SIZE });
    expect(state.page().data?.items.map((item) => item.sku)).toEqual(['SKU-0', 'SKU-1']);
    expect(state.page().data?.items[0]?.availableQuantity).toBe(8);
  });

  it('commits filters with a page reset', () => {
    const { state, api } = setup({ items: () => of(page(1, 1)) });
    state.load({ pageNumber: 4 });
    state.setFilters({ search: 'TEE', maxAvailable: 5 });

    expect(api.listItems).toHaveBeenLastCalledWith({
      pageNumber: 1,
      pageSize: STOCK_LIST_PAGE_SIZE,
      search: 'TEE',
      maxAvailable: 5,
    });
  });

  it('omits blank search values (the backend 400s on empty strings)', () => {
    const { state, api } = setup({ items: () => of(page(0, 0)) });
    state.setFilters({ search: '   ' });

    expect(api.listItems).toHaveBeenLastCalledWith({
      pageNumber: 1,
      pageSize: STOCK_LIST_PAGE_SIZE,
    });
  });

  it('clears stale filters on setFilters({}) so clear reloads unfiltered', () => {
    const { state, api } = setup({ items: () => of(page(1, 1)) });
    state.setFilters({ search: 'TEE', maxAvailable: 5 });
    state.setFilters({});

    expect(api.listItems).toHaveBeenLastCalledWith({
      pageNumber: 1,
      pageSize: STOCK_LIST_PAGE_SIZE,
    });
  });

  it('commits pager moves through setPage while preserving filters', () => {
    const { state, api } = setup({ items: () => of(page(25, 1, 3)) });
    state.setFilters({ search: 'TEE' });
    state.setPage(3);

    expect(api.listItems).toHaveBeenLastCalledWith({
      pageNumber: 3,
      pageSize: STOCK_LIST_PAGE_SIZE,
      search: 'TEE',
    });
  });

  it('reloads the current effective page', () => {
    const { state, api } = setup({ items: () => of(page(25, 1, 2)) });
    state.load({ pageNumber: 2 });
    state.reload();

    expect(api.listItems).toHaveBeenCalledTimes(2);
    expect(api.listItems).toHaveBeenLastCalledWith({
      pageNumber: 2,
      pageSize: STOCK_LIST_PAGE_SIZE,
    });
  });

  it('supersedes in-flight loads', () => {
    const { state, api } = setup();
    const first = new Subject<unknown>();
    const second = new Subject<unknown>();
    vi.mocked(api.listItems)
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
    const { state } = setup({ items: () => of({ isSuccess: true, message: 'ok' }) });
    state.load();

    expect(state.page().status).toBe('error');
    expect(state.page().data).toBeNull();
  });

  it('lands backend failures in the error slot untouched', () => {
    const failure = new ApiError({ status: 400, message: 'Invalid.' });
    const { state } = setup({ items: () => throwError(() => failure) });
    state.load();

    expect(state.page().status).toBe('error');
    expect(state.page().error).toBe(failure);
  });
});
