import { describe, expect, it } from 'vitest';
import {
  PAYMENT_STATUS_FILTER_VALUES,
  isPaymentStatusFilter,
  isValidAdminPaymentListQuery,
  isValidPaymentsMineQuery,
  netRevenueByCurrency,
} from './payments';

describe('netRevenueByCurrency (contract-sanctioned display math)', () => {
  it('joins succeeded and refunded rollups per currency', () => {
    expect(
      netRevenueByCurrency(
        [{ currency: 'USD', succeededCount: 3, succeededTotalAmount: 179.94 }],
        [{ currency: 'USD', succeededCount: 1, succeededTotalAmount: 59.98 }],
      ),
    ).toEqual([
      {
        currency: 'USD',
        succeededCount: 3,
        succeededAmount: 179.94,
        refundedCount: 1,
        refundedAmount: 59.98,
        netAmount: 179.94 - 59.98,
      },
    ]);
  });

  it('zero-fills a missing side and unions both currency sets', () => {
    expect(
      netRevenueByCurrency(
        [{ currency: 'USD', succeededCount: 1, succeededTotalAmount: 10 }],
        [{ currency: 'EUR', succeededCount: 2, succeededTotalAmount: 20 }],
      ),
    ).toEqual([
      {
        currency: 'USD',
        succeededCount: 1,
        succeededAmount: 10,
        refundedCount: 0,
        refundedAmount: 0,
        netAmount: 10,
      },
      {
        currency: 'EUR',
        succeededCount: 0,
        succeededAmount: 0,
        refundedCount: 2,
        refundedAmount: 20,
        netAmount: -20,
      },
    ]);
    expect(netRevenueByCurrency(null, undefined)).toEqual([]);
  });
});

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
