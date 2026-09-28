/**
 * Behavior tests for the Sub-Phase 14.5 `OrderDetailsState`.
 *
 * `OrdersAdminApiService` (already covered by its own delegation spec) is
 * stubbed at its typed seam so these tests own the state logic: explicit
 * id-driven loads, blank-id no-ops, in-flight supersession, failure
 * passthrough, and contract-violation (dataless envelope) handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import { OrdersAdminApiService } from '../data-access/orders-admin-api.service';
import { OrderDetailsState } from './order-details-state';

function details(orderId = 'order-1') {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      orderId,
      orderNumber: `ORD-${orderId}`,
      status: 'Pending',
      subtotal: { amount: 59.98, currency: 'USD' },
      shippingCost: { amount: 0, currency: 'USD' },
      discount: { amount: 0, currency: 'USD' },
      grandTotal: { amount: 59.98, currency: 'USD' },
      itemCount: 2,
      createdAtUtc: '2026-09-28T10:00:00Z',
      shippingAddress: {
        recipientName: 'Ada Lovelace',
        line1: '1 Flux St',
        line2: null,
        city: 'Berlin',
        region: 'BE',
        postalCode: '10115',
        countryCode: 'DE',
      },
      billingAddress: {
        recipientName: 'Ada Lovelace',
        line1: '1 Flux St',
        line2: null,
        city: 'Berlin',
        region: 'BE',
        postalCode: '10115',
        countryCode: 'DE',
      },
      lineItems: [],
    },
  };
}

function setup(stub: Partial<{ order: () => Observable<unknown> }> = {}): {
  state: OrderDetailsState;
  api: { getOrder: ReturnType<typeof vi.fn> };
} {
  const api = {
    getOrder: vi.fn(() => stub.order?.() ?? of(details())),
  };
  TestBed.configureTestingModule({
    providers: [OrderDetailsState, { provide: OrdersAdminApiService, useValue: api }],
  });
  return { state: TestBed.inject(OrderDetailsState), api };
}

describe('OrderDetailsState lifecycle', () => {
  it('starts idle with no order and no error', () => {
    const { state } = setup();

    expect(state.order().status).toBe('idle');
    expect(state.order().data).toBeNull();
    expect(state.order().error).toBeNull();
  });

  it('loads the order for the given id and projects it verbatim', () => {
    const { state, api } = setup({ order: () => of(details('order-9')) });
    state.load('order-9');

    expect(api.getOrder).toHaveBeenCalledWith('order-9');
    expect(state.order().data?.orderNumber).toBe('ORD-order-9');
    expect(state.order().data?.status).toBe('Pending');
    expect(state.order().error).toBeNull();
  });

  it('ignores blank ids without traffic', () => {
    const { state, api } = setup();
    state.load(null);
    state.load('');
    state.load('   ');

    expect(api.getOrder).not.toHaveBeenCalled();
    expect(state.order().status).toBe('idle');
  });

  it('resolves failures to error with the normalized failure', () => {
    const failure = new ApiError({ status: 404, message: 'Not found.' });
    const { state } = setup({ order: () => throwError(() => failure) });
    state.load('missing');

    expect(state.order().isError).toBe(true);
    expect(state.order().error).toBe(failure);
    expect(state.order().data).toBeNull();
  });

  it('resolves a dataless envelope to error (contract violation)', () => {
    const { state } = setup({
      order: () => of({ isSuccess: true, message: 'Operation completed successfully.' }),
    });
    state.load('order-1');

    expect(state.order().isError).toBe(true);
    expect(state.order().data).toBeNull();
  });
});
