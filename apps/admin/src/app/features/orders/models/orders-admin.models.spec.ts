import { describe, expect, it } from 'vitest';
import {
  isPaymentHistorySupported,
  orderStatusDisplay,
  paymentStatusDisplay,
  PAYMENT_HISTORY_SUPPORTED,
  toOrderPaymentView,
} from './orders-admin.models';

describe('orders-admin models', () => {
  it('maps backend order statuses to display (single mapping site)', () => {
    expect(orderStatusDisplay('Pending')).toEqual({
      labelKey: 'orders.status.pending',
      variant: 'info',
    });
    expect(orderStatusDisplay('Confirmed')).toEqual({
      labelKey: 'orders.status.confirmed',
      variant: 'success',
    });
    expect(orderStatusDisplay('Cancelled')).toEqual({
      labelKey: 'orders.status.cancelled',
      variant: 'danger',
    });
  });

  it('falls back to neutral for unknown and payment-only values', () => {
    expect(orderStatusDisplay('Shipped')).toEqual({
      labelKey: 'orders.status.unknown',
      variant: 'neutral',
    });
    expect(orderStatusDisplay('Succeeded')).toEqual({
      labelKey: 'orders.status.unknown',
      variant: 'neutral',
    });
    expect(orderStatusDisplay('')).toEqual({
      labelKey: 'orders.status.unknown',
      variant: 'neutral',
    });
  });

  it('projects the payment view from the two-step read', () => {
    const view = toOrderPaymentView(
      {
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
      },
      {
        paymentId: 'pay-1',
        orderId: 'order-1',
        clientSecret: 'secret-live',
        paymentReference: 'pi_init',
        status: 'Pending',
      },
    );

    expect(view).toEqual({
      status: 'Processing',
      reference: 'pi_live',
      provider: 'stripe',
      amount: 59.98,
      currency: 'USD',
    });
  });

  it('falls back to the initialization reference when the payment carries none', () => {
    const view = toOrderPaymentView(
      {
        id: 'pay-1',
        orderId: 'order-1',
        customerId: 'cust-1',
        amount: 10,
        currency: 'USD',
        status: 'Pending',
        providerPaymentIntentId: null,
        provider: null,
        createdAtUtc: '2026-09-28T10:00:00Z',
        updatedAtUtc: null,
        version: 1,
      },
      {
        paymentId: 'pay-1',
        orderId: 'order-1',
        clientSecret: 'secret-live',
        paymentReference: 'pi_init',
        status: 'Pending',
      },
    );

    expect(view.reference).toBe('pi_init');
    expect(view.provider).toBeNull();
  });

  it('never carries the client secret (no such field by construction)', () => {
    const view = toOrderPaymentView(
      {
        id: 'pay-1',
        orderId: 'order-1',
        customerId: 'cust-1',
        amount: 10,
        currency: 'USD',
        status: 'Pending',
        providerPaymentIntentId: null,
        provider: null,
        createdAtUtc: '2026-09-28T10:00:00Z',
        updatedAtUtc: null,
        version: 1,
      },
      {
        paymentId: 'pay-1',
        orderId: 'order-1',
        clientSecret: 'secret-live',
        paymentReference: null,
        status: 'Pending',
      },
    );

    expect('clientSecret' in view).toBe(false);
    expect(Object.keys(view).sort()).toEqual(
      ['amount', 'currency', 'provider', 'reference', 'status'].sort(),
    );
  });

  it('maps every backend payment status to display (single mapping site)', () => {
    expect(paymentStatusDisplay('Pending')).toEqual({
      labelKey: 'orders.paymentStatus.pending',
      variant: 'info',
    });
    expect(paymentStatusDisplay('Processing')).toEqual({
      labelKey: 'orders.paymentStatus.processing',
      variant: 'info',
    });
    expect(paymentStatusDisplay('Succeeded')).toEqual({
      labelKey: 'orders.paymentStatus.succeeded',
      variant: 'success',
    });
    expect(paymentStatusDisplay('Failed')).toEqual({
      labelKey: 'orders.paymentStatus.failed',
      variant: 'danger',
    });
    expect(paymentStatusDisplay('Cancelled')).toEqual({
      labelKey: 'orders.paymentStatus.cancelled',
      variant: 'neutral',
    });
    expect(paymentStatusDisplay('Refunded')).toEqual({
      labelKey: 'orders.paymentStatus.refunded',
      variant: 'warning',
    });
  });

  it('falls back to neutral for unknown and order-only values', () => {
    expect(paymentStatusDisplay('Chargeback')).toEqual({
      labelKey: 'orders.paymentStatus.unknown',
      variant: 'neutral',
    });
    expect(paymentStatusDisplay('Confirmed')).toEqual({
      labelKey: 'orders.paymentStatus.unknown',
      variant: 'neutral',
    });
    expect(paymentStatusDisplay('')).toEqual({
      labelKey: 'orders.paymentStatus.unknown',
      variant: 'neutral',
    });
  });

  it('pins payment history as unsupported (no backend contract)', () => {
    expect(PAYMENT_HISTORY_SUPPORTED).toBe(false);
    expect(isPaymentHistorySupported()).toBe(false);
  });
});
