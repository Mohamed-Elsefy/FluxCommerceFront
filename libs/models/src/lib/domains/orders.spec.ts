import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUS_FILTER_VALUES,
  isOrderStatusFilter,
  isValidAdminOrdersQuery,
  isValidRefundSubmission,
} from './orders';

describe('orders transport pre-checks (Supplement S1)', () => {
  it('pins the order status filter vocabulary', () => {
    expect([...ORDER_STATUS_FILTER_VALUES]).toEqual(['Pending', 'Cancelled', 'Confirmed']);
  });

  it('accepts order statuses case-insensitively', () => {
    expect(isOrderStatusFilter('Pending')).toBe(true);
    expect(isOrderStatusFilter('confirmed')).toBe(true);
    expect(isOrderStatusFilter('CANCELLED')).toBe(true);
    expect(isOrderStatusFilter('Shipped')).toBe(false);
    expect(isOrderStatusFilter(null)).toBe(false);
  });

  it('validates admin order-list queries (unknown status + from>to rejected)', () => {
    expect(isValidAdminOrdersQuery(null)).toBe(true);
    expect(isValidAdminOrdersQuery({ status: 'Pending' })).toBe(true);
    expect(isValidAdminOrdersQuery({ status: 'Shipped' })).toBe(false);
    expect(isValidAdminOrdersQuery({ from: '2026-02-01', to: '2026-01-01' })).toBe(false);
    expect(isValidAdminOrdersQuery({ from: '2026-01-01', to: '2026-02-01' })).toBe(true);
    expect(isValidAdminOrdersQuery({ customerId: '  ' })).toBe(false);
    expect(isValidAdminOrdersQuery({ pageSize: 101 })).toBe(false);
  });

  it('validates refund submissions (reason 1..500)', () => {
    expect(isValidRefundSubmission({ orderId: 'o', reason: 'Duplicate charge' })).toBe(true);
    expect(isValidRefundSubmission({ orderId: 'o', reason: '' })).toBe(false);
    expect(isValidRefundSubmission({ orderId: '  ', reason: 'x' })).toBe(false);
    expect(isValidRefundSubmission({ orderId: 'o', reason: 'x'.repeat(501) })).toBe(false);
    expect(isValidRefundSubmission({ orderId: 'o', reason: 'x'.repeat(500) })).toBe(true);
    expect(isValidRefundSubmission(null)).toBe(false);
  });
});
