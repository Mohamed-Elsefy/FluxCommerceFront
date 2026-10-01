import { describe, expect, it } from 'vitest';
import { PERMISSION_CATALOG, isPermission } from './enums';

describe('permission catalog (API_CONTRACT.md §0.5, Supplement S1)', () => {
  it('pins the nine catalog permissions in contract order', () => {
    expect([...PERMISSION_CATALOG]).toEqual([
      'orders.read',
      'orders.cancel',
      'orders.refund',
      'payments.read',
      'payments.stats',
      'inventory.read',
      'inventory.manage',
      'catalog.manage',
      'dashboard.read',
    ]);
  });

  it('covers one value per governed area', () => {
    const areas = PERMISSION_CATALOG.map((permission) => permission.split('.')[0]);
    expect(new Set(areas)).toEqual(
      new Set(['orders', 'payments', 'inventory', 'catalog', 'dashboard']),
    );
  });

  it('holds no duplicates', () => {
    expect(new Set(PERMISSION_CATALOG).size).toBe(PERMISSION_CATALOG.length);
  });

  it('classifies permission values (unknown rejected)', () => {
    expect(isPermission('orders.read')).toBe(true);
    expect(isPermission('dashboard.read')).toBe(true);
    expect(isPermission('orders.delete')).toBe(false);
    expect(isPermission('Admin')).toBe(false);
    expect(isPermission(null)).toBe(false);
    expect(isPermission(undefined)).toBe(false);
  });
});
