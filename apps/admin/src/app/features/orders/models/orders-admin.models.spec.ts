import { describe, expect, it } from 'vitest';
import {
  emptyOrdersOverview,
  isOrdersOverviewEmpty,
  orderStatusDisplay,
  toOrdersOverview,
  type AdminOrderPage,
} from './orders-admin.models';

function page(totalCount: number, itemCount = 1): AdminOrderPage {
  return {
    items: Array.from({ length: itemCount }, (_, index) => ({
      orderId: `order-${index}`,
      orderNumber: `ORD-${index}`,
      status: 'Pending',
      grandTotal: { amount: 10, currency: 'USD' },
      itemCount: 1,
      createdAtUtc: '2026-09-28T10:00:00Z',
    })),
    totalCount,
    pageNumber: 1,
    pageSize: 1,
  };
}

describe('orders-admin models', () => {
  it('projects the overview out of a settled page verbatim', () => {
    expect(toOrdersOverview(page(42))).toEqual({ orderTotal: 42 });
  });

  it('provides the zero overview for empty results', () => {
    expect(emptyOrdersOverview()).toEqual({ orderTotal: 0 });
    expect(toOrdersOverview(page(0, 0))).toEqual(emptyOrdersOverview());
  });

  it('detects empty overviews (null counts as empty)', () => {
    expect(isOrdersOverviewEmpty(null)).toBe(true);
    expect(isOrdersOverviewEmpty({ orderTotal: 0 })).toBe(true);
    expect(isOrdersOverviewEmpty({ orderTotal: 3 })).toBe(false);
  });

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
});
