import { describe, expect, it } from 'vitest';
import { isValidDashboardQuery, type AdminDashboardResponse } from './dashboard';

describe('dashboard transport pre-check (analytics evolution)', () => {
  it('validates dashboard queries (negative threshold rejected)', () => {
    expect(isValidDashboardQuery(null)).toBe(true);
    expect(isValidDashboardQuery({})).toBe(true);
    expect(isValidDashboardQuery({ lowStockThreshold: 5 })).toBe(true);
    expect(isValidDashboardQuery({ lowStockThreshold: -1 })).toBe(false);
  });

  it('validates the days window (default 30, range 1..90)', () => {
    expect(isValidDashboardQuery({ days: 30 })).toBe(true);
    expect(isValidDashboardQuery({ days: 1 })).toBe(true);
    expect(isValidDashboardQuery({ days: 90 })).toBe(true);
    expect(isValidDashboardQuery({ days: 0 })).toBe(false);
    expect(isValidDashboardQuery({ days: 91 })).toBe(false);
    expect(isValidDashboardQuery({ days: 7.5 })).toBe(false);
    expect(isValidDashboardQuery({ lowStockThreshold: 5, days: 30 })).toBe(true);
    expect(isValidDashboardQuery({ lowStockThreshold: -1, days: 30 })).toBe(false);
  });

  it('models nullable sections (absent when unauthorized) plus the catalog card', () => {
    const partial: AdminDashboardResponse = {
      orders: null,
      payments: null,
      inventory: null,
      catalog: {
        totalProducts: 10,
        activeProducts: 7,
        totalCategories: 3,
        totalVariants: 20,
      },
      users: null,
      recentOrders: [],
      recentPayments: [],
      recentUsers: [],
      dailySeries: [],
    };
    expect(partial.catalog?.totalProducts).toBe(10);
    expect(partial.recentOrders).toEqual([]);
    const empty: AdminDashboardResponse = {
      recentOrders: [],
      recentPayments: [],
      recentUsers: [],
      dailySeries: [],
    };
    expect(empty.orders ?? null).toBe(null);
  });
});
