import { describe, expect, it } from 'vitest';
import { isValidDashboardQuery, type AdminDashboardResponse } from './dashboard';

describe('dashboard transport pre-check (Supplement S2, adaptive)', () => {
  it('validates dashboard queries (negative threshold rejected)', () => {
    expect(isValidDashboardQuery(null)).toBe(true);
    expect(isValidDashboardQuery({})).toBe(true);
    expect(isValidDashboardQuery({ lowStockThreshold: 5 })).toBe(true);
    expect(isValidDashboardQuery({ lowStockThreshold: -1 })).toBe(false);
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
    };
    expect(partial.catalog?.totalProducts).toBe(10);
    expect(partial.recentOrders).toEqual([]);
    const empty: AdminDashboardResponse = { recentOrders: [] };
    expect(empty.orders ?? null).toBe(null);
  });
});
