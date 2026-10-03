/**
 * Behavior tests for the S1.9 `PaymentDetailsState`.
 *
 * `PaymentsAdminApiService` (already covered by its own delegation spec)
 * is stubbed at its typed seam so these tests own the state logic:
 * explicit id-driven loads, blank-id no-ops, failure passthrough, and
 * contract-violation (dataless envelope) handling.
 */

import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError, type Observable } from 'rxjs';
import { ApiError } from '@flux/api';
import { PaymentsAdminApiService } from '../data-access/payments-admin-api.service';
import { PaymentDetailsState } from './payment-details-state';

function details(paymentId = 'pay-1') {
  return {
    isSuccess: true,
    message: 'Operation completed successfully.',
    data: {
      id: paymentId,
      orderId: 'order-1',
      customerId: 'cust-1',
      amount: 59.98,
      currency: 'USD',
      status: 'Succeeded',
      providerPaymentIntentId: 'pi_123',
      provider: 'stripe',
      createdAtUtc: '2026-09-28T10:00:00Z',
      updatedAtUtc: '2026-09-28T10:01:00Z',
      version: 2,
    },
  };
}

function setup(stub: Partial<{ payment: () => Observable<unknown> }> = {}): {
  state: PaymentDetailsState;
  api: { getPayment: ReturnType<typeof vi.fn> };
} {
  const api = {
    getPayment: vi.fn(() => stub.payment?.() ?? of(details())),
  };
  TestBed.configureTestingModule({
    providers: [PaymentDetailsState, { provide: PaymentsAdminApiService, useValue: api }],
  });
  return { state: TestBed.inject(PaymentDetailsState), api };
}

describe('PaymentDetailsState lifecycle', () => {
  it('starts idle with no payment and no error', () => {
    const { state } = setup();

    expect(state.payment().status).toBe('idle');
    expect(state.payment().data).toBeNull();
    expect(state.payment().error).toBeNull();
  });

  it('loads the payment for the given id and projects it verbatim', () => {
    const { state, api } = setup({ payment: () => of(details('pay-9')) });
    state.load('pay-9');

    expect(api.getPayment).toHaveBeenCalledWith('pay-9');
    expect(state.payment().data?.id).toBe('pay-9');
    expect(state.payment().data?.status).toBe('Succeeded');
    expect(state.payment().error).toBeNull();
  });

  it('ignores blank ids without traffic', () => {
    const { state, api } = setup();
    state.load(null);
    state.load('');
    state.load('   ');

    expect(api.getPayment).not.toHaveBeenCalled();
    expect(state.payment().status).toBe('idle');
  });

  it('resolves failures to error with the normalized failure', () => {
    const failure = new ApiError({ status: 404, message: 'Not found.' });
    const { state } = setup({ payment: () => throwError(() => failure) });
    state.load('missing');

    expect(state.payment().isError).toBe(true);
    expect(state.payment().error).toBe(failure);
    expect(state.payment().data).toBeNull();
  });

  it('resolves a dataless envelope to error (contract violation)', () => {
    const { state } = setup({
      payment: () => of({ isSuccess: true, message: 'Operation completed successfully.' }),
    });
    state.load('pay-1');

    expect(state.payment().isError).toBe(true);
    expect(state.payment().data).toBeNull();
  });
});
