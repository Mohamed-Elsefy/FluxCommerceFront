import { describe, expect, it } from 'vitest';
import { hasRecentOrders, type DashboardSnapshot } from './dashboard-admin.models';

function snapshot(recentOrders: DashboardSnapshot['recentOrders']): DashboardSnapshot {
  return {
    orders: { total: 1, pending: 1, confirmed: 0, cancelled: 0 },
    payments: {
      total: 1,
      pending: 1,
      processing: 0,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
      refunded: 0,
      totalsByCurrency: [],
    },
    inventory: {
      totalItems: 1,
      totalOnHand: 10,
      totalReserved: 0,
      lowStockItems: 0,
      pendingReservations: 0,
      committedReservations: 0,
      releasedReservations: 0,
      expiredReservations: 0,
    },
    users: {
      total: 1,
      pending: 0,
      active: 1,
      suspended: 0,
      locked: 0,
      deleted: 0,
      customers: 0,
      admins: 1,
      superAdmins: 0,
      unverified: 0,
      lockedOut: 0,
    },
    recentOrders,
  };
}

describe('dashboard-admin models (S1.10)', () => {
  it('detects an empty drill-down widget', () => {
    expect(hasRecentOrders(snapshot([]))).toBe(false);
    expect(hasRecentOrders(null)).toBe(false);
    expect(hasRecentOrders(undefined)).toBe(false);
  });

  it('detects recent orders to drill into', () => {
    expect(
      hasRecentOrders(
        snapshot([
          {
            orderId: 'order-1',
            orderNumber: 'ORD-ABC123',
            status: 'Pending',
            grandTotal: { amount: 59.98, currency: 'USD' },
            itemCount: 2,
            createdAtUtc: '2026-09-28T10:00:00Z',
          },
        ]),
      ),
    ).toBe(true);
  });
});
