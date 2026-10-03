import { describe, expect, it } from 'vitest';
import {
  isPaymentsHistorySupported,
  isPaymentsMineStatus,
  isValidPaymentsMineListQuery,
  PAYMENTS_HISTORY_SUPPORTED,
  PAYMENTS_MINE_STATUSES,
} from './payments-mine.models';

describe('payments-mine models (S1.9 storefront slice)', () => {
  it('pins the six filterable payment statuses (strings on the wire)', () => {
    expect([...PAYMENTS_MINE_STATUSES]).toEqual([
      'Pending',
      'Processing',
      'Succeeded',
      'Failed',
      'Cancelled',
      'Refunded',
    ]);
  });

  it('classifies status names (unknown future strings rejected)', () => {
    expect(isPaymentsMineStatus('Succeeded')).toBe(true);
    expect(isPaymentsMineStatus('Refunded')).toBe(true);
    expect(isPaymentsMineStatus('Refunding')).toBe(false);
    expect(isPaymentsMineStatus(0)).toBe(false);
    expect(isPaymentsMineStatus(null)).toBe(false);
  });

  it('pre-checks mine queries (paging bounds plus known statuses only)', () => {
    expect(isValidPaymentsMineListQuery(null)).toBe(true);
    expect(isValidPaymentsMineListQuery({})).toBe(true);
    expect(isValidPaymentsMineListQuery({ pageNumber: 1, pageSize: 20 })).toBe(true);
    expect(isValidPaymentsMineListQuery({ status: 'Succeeded' })).toBe(true);
    expect(isValidPaymentsMineListQuery({ status: 'succeeded' })).toBe(true);
    expect(isValidPaymentsMineListQuery({ pageNumber: 0 })).toBe(false);
    expect(isValidPaymentsMineListQuery({ pageSize: 101 })).toBe(false);
    expect(isValidPaymentsMineListQuery({ status: 'Nope' })).toBe(false);
  });

  it('pins the history gap (no timeline endpoint exists)', () => {
    expect(PAYMENTS_HISTORY_SUPPORTED).toBe(false);
    expect(isPaymentsHistorySupported()).toBe(false);
  });
});
