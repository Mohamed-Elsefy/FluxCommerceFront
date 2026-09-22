/**
 * State tests for the Sub-Phase 10.3 `OrdersListState`.
 *
 * Covers the paged resource lifecycle only (idle → loading → success |
 * empty | error, page commits, dedupe, forced retry): the
 * `OrdersApiService` transport is stubbed at its typed seam, so these
 * tests own the feature logic — envelope unwrapping, contract-breach
 * handling, page clamping, and selector behavior — without HTTP.
 *
 * Backend-authority pins: no test performs totals math or status
 * derivation — pages echo the stubbed backend payloads verbatim.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { ApiError, type PagedApiResponse, type PagedResult } from '@flux/api';
import { OrdersApiService } from '../data-access/orders-api.service';
import type { OrderSummary } from '../models/orders.models';
import { ORDERS_DEFAULT_PAGE_SIZE } from '../models/orders.models';
import { OrdersListState } from './orders-list-state';

const ORDER_A = '11111111-1111-4111-8111-111111111111';

function summary(overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    orderId: ORDER_A,
    orderNumber: 'ORD-ABC123DEF456',
    status: 'Pending',
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
    ...overrides,
  };
}

function page(overrides: Partial<PagedResult<OrderSummary>> = {}): PagedResult<OrderSummary> {
  return {
    items: [summary()],
    totalCount: 1,
    pageNumber: 1,
    pageSize: ORDERS_DEFAULT_PAGE_SIZE,
    ...overrides,
  };
}

function envelope(data: PagedResult<OrderSummary> | null): PagedApiResponse<OrderSummary> {
  return { isSuccess: true, data };
}

interface Setup {
  state: OrdersListState;
  api: { getOrders: ReturnType<typeof vi.fn> };
}

function setup(): Setup {
  const api = { getOrders: vi.fn(() => of(envelope(page()))) };

  TestBed.configureTestingModule({
    providers: [OrdersListState, { provide: OrdersApiService, useValue: api }],
  });
  return { state: TestBed.inject(OrdersListState), api };
}

describe('OrdersListState initial resource', () => {
  it('starts idle on page 1 with no data and no error', () => {
    const { state, api } = setup();

    expect(state.status()).toBe('idle');
    expect(state.page()).toBeNull();
    expect(state.error()).toBeNull();
    expect(state.currentPage()).toBe(1);
    expect(state.isLoading()).toBe(false);
    expect(state.isSuccess()).toBe(false);
    expect(state.isEmpty()).toBe(false);
    expect(state.isError()).toBe(false);
    expect(api.getOrders).not.toHaveBeenCalled();
  });
});

describe('OrdersListState loadPage', () => {
  it('loads the first page with the default page size', () => {
    const { state, api } = setup();
    state.loadPage();

    expect(api.getOrders).toHaveBeenCalledTimes(1);
    expect(api.getOrders).toHaveBeenCalledWith(
      { pageNumber: 1, pageSize: ORDERS_DEFAULT_PAGE_SIZE },
      {},
    );
    expect(state.status()).toBe('success');
    expect(state.page()).toEqual(page());
    expect(state.currentPage()).toBe(1);
    expect(state.error()).toBeNull();
  });

  it('commits page moves with the backend page size', () => {
    const { state, api } = setup();
    state.loadPage(3);

    expect(api.getOrders).toHaveBeenCalledWith(
      { pageNumber: 3, pageSize: ORDERS_DEFAULT_PAGE_SIZE },
      {},
    );
    expect(state.currentPage()).toBe(3);
  });

  it('clamps invalid pages to valid ones instead of throwing', () => {
    const { state, api } = setup();
    state.loadPage(0);
    expect(api.getOrders).toHaveBeenCalledWith(
      { pageNumber: 1, pageSize: ORDERS_DEFAULT_PAGE_SIZE },
      {},
    );
    state.loadPage(2.7, { force: true });
    expect(api.getOrders).toHaveBeenLastCalledWith(
      { pageNumber: 2, pageSize: ORDERS_DEFAULT_PAGE_SIZE },
      expect.objectContaining({}),
    );
  });

  it('resolves zero-item pages to empty (never an error)', () => {
    const { state, api } = setup();
    vi.mocked(api.getOrders).mockReturnValueOnce(of(envelope(page({ items: [], totalCount: 0 }))));
    state.loadPage();

    expect(state.status()).toBe('empty');
    expect(state.isEmpty()).toBe(true);
    expect(state.page()?.items).toEqual([]);
  });

  it('treats a 200 without data as failure (never a rendered list)', () => {
    const { state, api } = setup();
    vi.mocked(api.getOrders).mockReturnValueOnce(of(envelope(null)));
    state.loadPage();

    expect(state.status()).toBe('error');
    expect(state.page()).toBeNull();
    expect(state.error()).not.toBeNull();
    expect(state.isError()).toBe(true);
  });

  it('lands backend failures in the error slot untouched', () => {
    const { state, api } = setup();
    const failure = new ApiError({ status: 401, message: 'Anonymous.' });
    vi.mocked(api.getOrders).mockReturnValueOnce(throwError(() => failure));
    state.loadPage();

    expect(state.status()).toBe('error');
    expect(state.page()).toBeNull();
    expect(state.error()).toBe(failure);
  });

  it('dedupes concurrent same-page loads to a single request', () => {
    const { state, api } = setup();
    const pending = new Subject<PagedApiResponse<OrderSummary>>();
    vi.mocked(api.getOrders).mockReturnValue(pending.asObservable());

    state.loadPage(2);
    expect(state.status()).toBe('loading');
    state.loadPage(2);
    state.loadPage(2);

    expect(api.getOrders).toHaveBeenCalledTimes(1);

    pending.next(envelope(page({ pageNumber: 2, totalCount: 25 })));
    pending.complete();
    expect(state.status()).toBe('success');
    expect(state.currentPage()).toBe(2);
  });

  it('does not reload a settled page without force', () => {
    const { state, api } = setup();
    state.loadPage();
    state.loadPage();

    expect(api.getOrders).toHaveBeenCalledTimes(1);
  });

  it('forwards the AbortSignal for cancellation without touching it', () => {
    const { state, api } = setup();
    const controller = new AbortController();
    state.loadPage(1, { signal: controller.signal });

    expect(api.getOrders).toHaveBeenCalledWith(
      { pageNumber: 1, pageSize: ORDERS_DEFAULT_PAGE_SIZE },
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('retries after errors with a fresh request for the same page', () => {
    const { state, api } = setup();
    vi.mocked(api.getOrders).mockReturnValueOnce(
      throwError(() => new ApiError({ status: 0, message: 'Unreachable.' })),
    );
    state.loadPage(2);
    expect(state.status()).toBe('error');

    state.retry();
    expect(api.getOrders).toHaveBeenCalledTimes(2);
    expect(api.getOrders).toHaveBeenLastCalledWith(
      { pageNumber: 2, pageSize: ORDERS_DEFAULT_PAGE_SIZE },
      expect.objectContaining({}),
    );
    expect(state.status()).toBe('success');
  });
});
