import { describe, expect, it } from 'vitest';
import {
  PAYMENT_STATUS_FILTER_VALUES,
  isPaymentStatusFilter,
  isValidAdminPaymentListQuery,
  isValidPaymentsMineQuery,
} from './payments';

describe('payments transport pre-checks (Supplement S1)', () => {
  it('pins the six payment status filter values', () => {
    expect([...PAYMENT_STATUS_FILTER_VALUES]).toEqual([
      'Pending',
      'Processing',
      'Succeeded',
      'Failed',
      'Cancelled',
      'Refunded',
    ]);
  });

  it('accepts payment statuses case-insensitively', () => {
    expect(isPaymentStatusFilter('Succeeded')).toBe(true);
    expect(isPaymentStatusFilter('refunded')).toBe(true);
    expect(isPaymentStatusFilter('Paid')).toBe(false);
    expect(isPaymentStatusFilter(undefined)).toBe(false);
  });

  it('validates admin payment-list queries (unknown status + empty ids rejected)', () => {
    expect(isValidAdminPaymentListQuery({ status: 'Succeeded' })).toBe(true);
    expect(isValidAdminPaymentListQuery({ status: 'Paid' })).toBe(false);
    expect(isValidAdminPaymentListQuery({ orderId: '' })).toBe(false);
    expect(isValidAdminPaymentListQuery({ from: '2026-03-01', to: '2026-01-01' })).toBe(false);
  });

  it('validates payments-mine queries (status only)', () => {
    expect(isValidPaymentsMineQuery({})).toBe(true);
    expect(isValidPaymentsMineQuery({ status: 'Failed' })).toBe(true);
    expect(isValidPaymentsMineQuery({ status: 'Bogus' })).toBe(false);
  });
});
