import { describe, expect, it } from 'vitest';
import {
  ADMIN_PAYMENT_HISTORY_SUPPORTED,
  adminPaymentStatusDisplay,
  isAdminPaymentHistorySupported,
} from './payments-admin.models';

describe('payments-admin models (S1.9 admin slice)', () => {
  it('maps every backend payment status to its label key and tone', () => {
    expect(adminPaymentStatusDisplay('Pending')).toEqual({
      labelKey: 'payments.status.pending',
      variant: 'info',
    });
    expect(adminPaymentStatusDisplay('Processing')).toEqual({
      labelKey: 'payments.status.processing',
      variant: 'info',
    });
    expect(adminPaymentStatusDisplay('Succeeded')).toEqual({
      labelKey: 'payments.status.succeeded',
      variant: 'success',
    });
    expect(adminPaymentStatusDisplay('Failed')).toEqual({
      labelKey: 'payments.status.failed',
      variant: 'danger',
    });
    expect(adminPaymentStatusDisplay('Cancelled')).toEqual({
      labelKey: 'payments.status.cancelled',
      variant: 'neutral',
    });
    expect(adminPaymentStatusDisplay('Refunded')).toEqual({
      labelKey: 'payments.status.refunded',
      variant: 'warning',
    });
  });

  it('falls back to neutral verbatim for unknown and order-only values', () => {
    expect(adminPaymentStatusDisplay('Refunding')).toEqual({
      labelKey: 'payments.status.unknown',
      variant: 'neutral',
    });
    expect(adminPaymentStatusDisplay('Confirmed')).toEqual({
      labelKey: 'payments.status.unknown',
      variant: 'neutral',
    });
    expect(adminPaymentStatusDisplay('')).toEqual({
      labelKey: 'payments.status.unknown',
      variant: 'neutral',
    });
  });

  it('pins the history gap (no timeline endpoint exists)', () => {
    expect(ADMIN_PAYMENT_HISTORY_SUPPORTED).toBe(false);
    expect(isAdminPaymentHistorySupported()).toBe(false);
  });
});
