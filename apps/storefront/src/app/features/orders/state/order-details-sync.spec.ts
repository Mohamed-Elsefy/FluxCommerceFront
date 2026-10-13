/**
 * Synchronization tests for the Sub-Phase 10.6 `OrderDetailsState`
 * polling loop (`startSync`/`stopSync`).
 *
 * Covers the bounded-loop contract only (no-op guards, duplicate-loop
 * prevention, early terminal stop, budget exhaustion, transient-skip
 * vs stopping-error classification, teardown, id-change resets): the
 * `OrdersApiService` transport is stubbed at its typed seam and time
 * is virtual (`vi.useFakeTimers`), so these tests own the feature
 * logic without HTTP or wall-clock waits.
 *
 * Backend-authority pins: every settled tick echoes the stubbed backend
 * payload verbatim; exhaustion never fabricates a terminal state.
 */

import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ApiError, type ApiResponseWithData } from '@flux/api';
import { OrdersApiService } from '../data-access/orders-api.service';
import { ORDER_SYNC_MAX_ATTEMPTS, ORDER_SYNC_POLL_INTERVAL_MS } from '../models/order-sync.models';
import type { Order } from '../models/orders.models';
import { OrderDetailsState } from './order-details-state';

const ORDER_A = '11111111-1111-4111-8111-111111111111';
const ORDER_B = '22222222-2222-4222-8222-222222222222';

function address() {
  return {
    recipientName: 'Ada Lovelace',
    line1: '1 Flux St',
    line2: null,
    city: 'Berlin',
    region: 'BE',
    postalCode: '10115',
    countryCode: 'DE',
  };
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    orderId: ORDER_A,
    orderNumber: 'ORD-ABC123DEF456',
    status: 'Pending',
    subtotal: { amount: 59.98, currency: 'USD' },
    shippingCost: { amount: 0, currency: 'USD' },
    discount: { amount: 0, currency: 'USD' },
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
    shippingAddress: address(),
    billingAddress: address(),
    lineItems: [],
    ...overrides,
  };
}

function envelope(data: Order | null): ApiResponseWithData<Order> {
  return { isSuccess: true, data };
}

interface Setup {
  state: OrderDetailsState;
  api: { getOrderById: ReturnType<typeof vi.fn> };
}

function setup(initial: Order = order()): Setup {
  const api = { getOrderById: vi.fn(() => of(envelope(initial))) };

  TestBed.configureTestingModule({
    providers: [OrderDetailsState, { provide: OrdersApiService, useValue: api }],
  });
  const state = TestBed.inject(OrderDetailsState);
  state.loadOrder(initial.orderId);
  vi.mocked(api.getOrderById).mockClear();
  return { state, api };
}

describe('OrderDetailsState startSync guards', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('starts idle with no sync loop and no exhaustion', () => {
    const { state, api } = setup();

    expect(state.isSyncing()).toBe(false);
    expect(state.syncExhausted()).toBe(false);
    expect(api.getOrderById).not.toHaveBeenCalled();
  });

  it('does nothing without a settled order', () => {
    TestBed.resetTestingModule();
    const api = { getOrderById: vi.fn(() => of(envelope(order()))) };
    TestBed.configureTestingModule({
      providers: [OrderDetailsState, { provide: OrdersApiService, useValue: api }],
    });
    const state = TestBed.inject(OrderDetailsState);

    state.startSync();
    vi.advanceTimersByTime(ORDER_SYNC_POLL_INTERVAL_MS * 3);

    expect(state.isSyncing()).toBe(false);
    expect(api.getOrderById).not.toHaveBeenCalled();
  });

  it('does nothing for already terminal orders (already stable)', () => {
    const { state, api } = setup(order({ status: 'Confirmed' }));

    state.startSync();
    vi.advanceTimersByTime(ORDER_SYNC_POLL_INTERVAL_MS * 3);

    expect(state.isSyncing()).toBe(false);
    expect(state.syncExhausted()).toBe(false);
    expect(api.getOrderById).not.toHaveBeenCalled();
  });

  it('reads immediately on start, then once per interval', () => {
    const { state, api } = setup();

    state.startSync();
    expect(state.isSyncing()).toBe(true);
    vi.advanceTimersByTime(0);
    expect(api.getOrderById).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(ORDER_SYNC_POLL_INTERVAL_MS);
    expect(api.getOrderById).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(ORDER_SYNC_POLL_INTERVAL_MS);
    expect(api.getOrderById).toHaveBeenCalledTimes(3);

    state.stopSync();
  });
});

describe('OrderDetailsState sync lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('stops early on the first terminal status with the backend order on screen', () => {
    const { state, api } = setup();
    vi.mocked(api.getOrderById).mockReturnValue(of(envelope(order({ status: 'Confirmed' }))));

    state.startSync();
    vi.advanceTimersByTime(0);
    expect(state.isSyncing()).toBe(false);
    expect(state.syncExhausted()).toBe(false);
    expect(state.order()?.status).toBe('Confirmed');

    const calls = vi.mocked(api.getOrderById).mock.calls.length;
    vi.advanceTimersByTime(ORDER_SYNC_POLL_INTERVAL_MS * ORDER_SYNC_MAX_ATTEMPTS);
    expect(vi.mocked(api.getOrderById).mock.calls.length).toBe(calls);
  });

  it('prevents duplicate loops (second start is a safe no-op)', () => {
    const { state, api } = setup();

    state.startSync();
    state.startSync();
    state.startSync();
    vi.advanceTimersByTime(0);
    expect(api.getOrderById).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(ORDER_SYNC_POLL_INTERVAL_MS * 3);

    // One immediate read plus one per interval — a single loop.
    expect(api.getOrderById).toHaveBeenCalledTimes(4);

    state.stopSync();
  });

  it('exhausts the budget on still-pending orders without fabricating terminality', () => {
    const { state, api } = setup();

    state.startSync();
    vi.advanceTimersByTime(ORDER_SYNC_POLL_INTERVAL_MS * ORDER_SYNC_MAX_ATTEMPTS);

    expect(api.getOrderById).toHaveBeenCalledTimes(ORDER_SYNC_MAX_ATTEMPTS);
    expect(state.isSyncing()).toBe(false);
    expect(state.syncExhausted()).toBe(true);
    expect(state.order()?.status).toBe('Pending');
    expect(state.status()).toBe('success');
  });

  it('restarts cleanly after exhaustion (manual recheck path)', () => {
    const { state, api } = setup();

    state.startSync();
    vi.advanceTimersByTime(ORDER_SYNC_POLL_INTERVAL_MS * ORDER_SYNC_MAX_ATTEMPTS);
    expect(state.syncExhausted()).toBe(true);

    vi.mocked(api.getOrderById).mockReturnValue(of(envelope(order({ status: 'Confirmed' }))));
    state.startSync();
    vi.advanceTimersByTime(0);

    expect(state.isSyncing()).toBe(false);
    expect(state.syncExhausted()).toBe(false);
    expect(state.order()?.status).toBe('Confirmed');
  });

  it('skips transient failures with the last settled order untouched', () => {
    const { state, api } = setup();
    vi.mocked(api.getOrderById).mockReturnValue(
      throwError(() => new ApiError({ status: 503, message: 'Overloaded.' })),
    );

    state.startSync();
    vi.advanceTimersByTime(ORDER_SYNC_POLL_INTERVAL_MS * 4);

    expect(state.isSyncing()).toBe(true);
    expect(state.syncExhausted()).toBe(false);
    expect(state.status()).toBe('success');
    expect(state.order()?.status).toBe('Pending');

    state.stopSync();
  });

  it('surfaces stopping failures into the error slot at once', () => {
    for (const status of [401, 403, 404]) {
      TestBed.resetTestingModule();
      const { state, api } = setup();
      const failure = new ApiError({ status, message: 'Stopped.' });
      vi.mocked(api.getOrderById).mockReturnValue(throwError(() => failure));

      state.startSync();
      vi.advanceTimersByTime(0);

      expect(state.isSyncing()).toBe(false);
      expect(state.status()).toBe('error');
      expect(state.error()).toBe(failure);
      expect(state.syncExhausted()).toBe(false);
    }
  });

  it('stops the loop on teardown without touching settled state', () => {
    const { state, api } = setup();

    state.startSync();
    vi.advanceTimersByTime(0);
    expect(api.getOrderById).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(ORDER_SYNC_POLL_INTERVAL_MS);
    expect(api.getOrderById).toHaveBeenCalledTimes(2);

    state.stopSync();
    expect(state.isSyncing()).toBe(false);
    vi.advanceTimersByTime(ORDER_SYNC_POLL_INTERVAL_MS * 5);
    expect(api.getOrderById).toHaveBeenCalledTimes(2);
    expect(state.status()).toBe('success');
    expect(state.order()?.status).toBe('Pending');
  });

  it('resets the loop and exhaustion on order change', () => {
    const { state, api } = setup();

    state.startSync();
    vi.advanceTimersByTime(ORDER_SYNC_POLL_INTERVAL_MS * ORDER_SYNC_MAX_ATTEMPTS);
    expect(state.syncExhausted()).toBe(true);

    vi.mocked(api.getOrderById).mockReturnValue(of(envelope(order({ orderId: ORDER_B }))));
    state.loadOrder(ORDER_B);

    expect(state.isSyncing()).toBe(false);
    expect(state.syncExhausted()).toBe(false);
    expect(state.orderId()).toBe(ORDER_B);
  });
});
