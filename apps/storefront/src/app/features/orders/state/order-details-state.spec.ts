/**
 * State tests for the Sub-Phase 10.4 `OrderDetailsState`.
 *
 * Covers the single-order resource lifecycle only (idle → loading →
 * success | error, id commits, same-id dedupe, id-change reloads,
 * forced retry): the `OrdersApiService` transport is stubbed at its
 * typed seam, so these tests own the feature logic — envelope
 * unwrapping, contract-breach handling, and selector behavior —
 * without HTTP.
 *
 * Backend-authority pins: no test performs totals math or status
 * derivation — the settled order echoes the stubbed backend payload
 * verbatim.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import { ApiError, type ApiResponseWithData } from '@flux/api';
import { OrdersApiService } from '../data-access/orders-api.service';
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
    status: 'Confirmed',
    subtotal: { amount: 59.98, currency: 'USD' },
    shippingCost: { amount: 0, currency: 'USD' },
    discount: { amount: 0, currency: 'USD' },
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
    shippingAddress: address(),
    billingAddress: address(),
    lineItems: [
      {
        productName: 'Tee',
        sku: 'TEE-BLK-M',
        quantity: 2,
        unitPrice: 29.99,
        unitPriceCurrency: 'USD',
        lineTotal: 59.98,
        lineTotalCurrency: 'USD',
      },
    ],
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

function setup(): Setup {
  const api = { getOrderById: vi.fn(() => of(envelope(order()))) };

  TestBed.configureTestingModule({
    providers: [OrderDetailsState, { provide: OrdersApiService, useValue: api }],
  });
  return { state: TestBed.inject(OrderDetailsState), api };
}

describe('OrderDetailsState initial resource', () => {
  it('starts idle with no id, no order, and no error', () => {
    const { state, api } = setup();

    expect(state.status()).toBe('idle');
    expect(state.orderId()).toBeNull();
    expect(state.order()).toBeNull();
    expect(state.error()).toBeNull();
    expect(state.isLoading()).toBe(false);
    expect(state.isSuccess()).toBe(false);
    expect(state.isError()).toBe(false);
    expect(api.getOrderById).not.toHaveBeenCalled();
  });
});

describe('OrderDetailsState loadOrder', () => {
  it('loads the backend order into the success slot', () => {
    const { state, api } = setup();
    state.loadOrder(ORDER_A);

    expect(api.getOrderById).toHaveBeenCalledTimes(1);
    expect(api.getOrderById).toHaveBeenCalledWith(ORDER_A, {});
    expect(state.status()).toBe('success');
    expect(state.orderId()).toBe(ORDER_A);
    expect(state.order()).toEqual(order());
    expect(state.error()).toBeNull();
  });

  it('fails locally on blank ids without an HTTP call', () => {
    const { state, api } = setup();
    state.loadOrder('   ');

    expect(api.getOrderById).not.toHaveBeenCalled();
    expect(state.status()).toBe('error');
    expect(state.orderId()).toBeNull();
    expect(state.order()).toBeNull();
    expect(state.error()).not.toBeNull();
  });

  it('treats a 200 without data as failure (never a rendered order)', () => {
    const { state, api } = setup();
    vi.mocked(api.getOrderById).mockReturnValueOnce(of(envelope(null)));
    state.loadOrder(ORDER_A);

    expect(state.status()).toBe('error');
    expect(state.order()).toBeNull();
    expect(state.error()).not.toBeNull();
  });

  it('lands backend failures in the error slot untouched', () => {
    const { state, api } = setup();
    for (const failure of [
      new ApiError({ status: 401, message: 'Anonymous.' }),
      new ApiError({ status: 404, message: 'Unknown or foreign order.' }),
    ]) {
      vi.mocked(api.getOrderById).mockReturnValueOnce(throwError(() => failure));
      state.loadOrder(ORDER_A, { force: true });

      expect(state.status()).toBe('error');
      expect(state.order()).toBeNull();
      expect(state.error()).toBe(failure);
    }
  });

  it('dedupes concurrent same-id loads to a single request', () => {
    const { state, api } = setup();
    const pending = new Subject<ApiResponseWithData<Order>>();
    vi.mocked(api.getOrderById).mockReturnValue(pending.asObservable());

    state.loadOrder(ORDER_A);
    expect(state.status()).toBe('loading');
    state.loadOrder(ORDER_A);
    state.loadOrder(ORDER_A);

    expect(api.getOrderById).toHaveBeenCalledTimes(1);

    pending.next(envelope(order()));
    pending.complete();
    expect(state.status()).toBe('success');
  });

  it('does not reload a settled order without force', () => {
    const { state, api } = setup();
    state.loadOrder(ORDER_A);
    state.loadOrder(ORDER_A);

    expect(api.getOrderById).toHaveBeenCalledTimes(1);
  });

  it('reloads when the requested id changes', () => {
    const { state, api } = setup();
    state.loadOrder(ORDER_A);
    state.loadOrder(ORDER_B);

    expect(api.getOrderById).toHaveBeenCalledTimes(2);
    expect(api.getOrderById).toHaveBeenLastCalledWith(ORDER_B, {});
    expect(state.orderId()).toBe(ORDER_B);
  });

  it('forwards the AbortSignal for cancellation without touching it', () => {
    const { state, api } = setup();
    const controller = new AbortController();
    state.loadOrder(ORDER_A, { signal: controller.signal });

    expect(api.getOrderById).toHaveBeenCalledWith(
      ORDER_A,
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('retries after errors with a fresh request for the same id', () => {
    const { state, api } = setup();
    vi.mocked(api.getOrderById).mockReturnValueOnce(
      throwError(() => new ApiError({ status: 0, message: 'Unreachable.' })),
    );
    state.loadOrder(ORDER_A);
    expect(state.status()).toBe('error');

    state.retry();
    expect(api.getOrderById).toHaveBeenCalledTimes(2);
    expect(state.status()).toBe('success');
    expect(state.order()).toEqual(order());
  });

  it('does nothing on retry without a requested id', () => {
    const { state, api } = setup();
    state.retry();

    expect(api.getOrderById).not.toHaveBeenCalled();
    expect(state.status()).toBe('idle');
  });
});
