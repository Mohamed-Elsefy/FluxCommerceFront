/**
 * Behavior tests for the Sub-Phase 14.6 `OrderPaymentState`.
 *
 * `OrdersAdminApiService` (already covered by its own delegation spec) is
 * stubbed at its typed seam so these tests own the state logic: the
 * by-order → payment read chain, blank-id no-ops, failure passthrough
 * (including the `404` empty path the page branches on), and
 * contract-violation (dataless envelope) handling on either step.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import { OrdersAdminApiService } from '../data-access/orders-admin-api.service';
import { OrderPaymentState } from './order-payment-state';

function init(overrides: Record<string, unknown> = {}) {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      paymentId: 'pay-1',
      orderId: 'order-1',
      clientSecret: 'secret-live',
      paymentReference: 'pi_init',
      status: 'Pending',
      ...overrides,
    },
  };
}

function payment(overrides: Record<string, unknown> = {}) {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      id: 'pay-1',
      orderId: 'order-1',
      customerId: 'cust-1',
      amount: 59.98,
      currency: 'USD',
      status: 'Processing',
      providerPaymentIntentId: 'pi_live',
      provider: 'stripe',
      createdAtUtc: '2026-09-28T10:00:00Z',
      updatedAtUtc: null,
      version: 2,
      ...overrides,
    },
  };
}

function setup(
  stub: Partial<{ byOrder: () => Observable<unknown>; getPayment: () => Observable<unknown> }> = {},
): {
  state: OrderPaymentState;
  api: { paymentByOrder: ReturnType<typeof vi.fn>; getPayment: ReturnType<typeof vi.fn> };
} {
  const api = {
    paymentByOrder: vi.fn(() => stub.byOrder?.() ?? of(init())),
    getPayment: vi.fn(() => stub.getPayment?.() ?? of(payment())),
  };
  TestBed.configureTestingModule({
    providers: [OrderPaymentState, { provide: OrdersAdminApiService, useValue: api }],
  });
  return { state: TestBed.inject(OrderPaymentState), api };
}

describe('OrderPaymentState lifecycle', () => {
  it('starts idle with no payment and no error', () => {
    const { state } = setup();

    expect(state.payment().status).toBe('idle');
    expect(state.payment().data).toBeNull();
    expect(state.payment().error).toBeNull();
  });

  it('chains the by-order read into the payment read and projects the view', () => {
    const { state, api } = setup();
    state.load('order-1');

    expect(api.paymentByOrder).toHaveBeenCalledWith('order-1');
    expect(api.getPayment).toHaveBeenCalledWith('pay-1');
    expect(state.payment().data).toEqual({
      status: 'Processing',
      reference: 'pi_live',
      provider: 'stripe',
      amount: 59.98,
      currency: 'USD',
    });
    expect(state.payment().error).toBeNull();
  });

  it('ignores blank ids without traffic', () => {
    const { state, api } = setup();
    state.load(null);
    state.load('');

    expect(api.paymentByOrder).not.toHaveBeenCalled();
    expect(api.getPayment).not.toHaveBeenCalled();
    expect(state.payment().status).toBe('idle');
  });

  it('resolves a missing payment to error for the empty notice', () => {
    const failure = new ApiError({ status: 404, message: 'Not found.' });
    const { state } = setup({ byOrder: () => throwError(() => failure) });
    state.load('order-1');

    expect(state.payment().isError).toBe(true);
    expect(state.payment().error?.status).toBe(404);
    expect(state.payment().data).toBeNull();
  });

  it('resolves an unavailable payment to error for the retryable notice', () => {
    const failure = new ApiError({ status: 409, message: 'Conflict.' });
    const { state } = setup({ byOrder: () => throwError(() => failure) });
    state.load('order-1');

    expect(state.payment().isError).toBe(true);
    expect(state.payment().error?.status).toBe(409);
  });

  it('resolves a dataless initialization envelope to error', () => {
    const { state, api } = setup({
      byOrder: () => of({ isSuccess: true, message: 'Operation completed successfully.' }),
    });
    state.load('order-1');

    expect(state.payment().isError).toBe(true);
    expect(api.getPayment).not.toHaveBeenCalled();
  });

  it('resolves a dataless payment envelope to error', () => {
    const { state } = setup({
      getPayment: () => of({ isSuccess: true, message: 'Operation completed successfully.' }),
    });
    state.load('order-1');

    expect(state.payment().isError).toBe(true);
    expect(state.payment().data).toBeNull();
  });
});
