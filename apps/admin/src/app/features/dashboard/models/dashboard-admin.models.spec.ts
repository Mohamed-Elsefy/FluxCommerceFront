import { describe, expect, it } from 'vitest';
import {
  hasDailySeries,
  hasEntitledSections,
  hasRecentOrders,
  hasRecentPayments,
  hasRecentUsers,
  type DashboardSnapshot,
} from './dashboard-admin.models';

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
      refundedTotalsByCurrency: [],
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
    recentPayments: [],
    recentUsers: [],
    dailySeries: [],
  };
}

describe('dashboard-admin models (S2.3, adaptive)', () => {
  it('gates the honest empty state on entitled sections', () => {
    expect(hasEntitledSections(snapshot([]))).toBe(true);
    expect(
      hasEntitledSections({
        orders: null,
        payments: null,
        inventory: null,
        catalog: {
          totalProducts: 4,
          activeProducts: 2,
          totalCategories: 1,
          totalVariants: 6,
        },
        users: null,
        recentOrders: [],
        recentPayments: [],
        recentUsers: [],
        dailySeries: [],
      }),
    ).toBe(true);
    expect(
      hasEntitledSections({
        orders: null,
        payments: null,
        inventory: null,
        catalog: null,
        users: null,
        recentOrders: [],
        recentPayments: [],
        recentUsers: [],
        dailySeries: [],
      }),
    ).toBe(false);
    expect(
      hasEntitledSections({
        recentOrders: [],
        recentPayments: [],
        recentUsers: [],
        dailySeries: [],
      }),
    ).toBe(false);
    expect(hasEntitledSections(null)).toBe(false);
    expect(hasEntitledSections(undefined)).toBe(false);
  });

  it('detects an empty drill-down widget', () => {
    expect(hasRecentOrders(snapshot([]))).toBe(false);
    expect(hasRecentOrders(null)).toBe(false);
    expect(hasRecentOrders(undefined)).toBe(false);
  });

  it('detects recent payments, users, and series points', () => {
    expect(hasRecentPayments(snapshot([]))).toBe(false);
    expect(hasRecentUsers(snapshot([]))).toBe(false);
    expect(hasDailySeries(snapshot([]))).toBe(false);
    expect(hasRecentPayments(null)).toBe(false);
    expect(hasRecentUsers(undefined)).toBe(false);
    expect(hasDailySeries(null)).toBe(false);
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
