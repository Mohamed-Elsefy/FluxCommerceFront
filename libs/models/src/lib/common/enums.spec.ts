import { describe, expect, it } from 'vitest';
import { PERMISSION_CATALOG, isPermission } from './enums';

describe('permission catalog v2 (API_CONTRACT.md §0.5, Supplement S2)', () => {
  it('pins the eleven catalog permissions in contract order', () => {
    expect([...PERMISSION_CATALOG]).toEqual([
      'orders.read',
      'orders.cancel',
      'orders.refund',
      'payments.read',
      'payments.stats',
      'inventory.read',
      'inventory.manage',
      'catalog.manage',
      'users.read',
      'users.manage',
      'admins.create',
    ]);
  });

  it('drops dashboard.read (removed in v2)', () => {
    expect([...PERMISSION_CATALOG]).not.toContain('dashboard.read');
    expect(isPermission('dashboard.read')).toBe(false);
  });

  it('covers one value per governed area', () => {
    const areas = PERMISSION_CATALOG.map((permission) => permission.split('.')[0]);
    expect(new Set(areas)).toEqual(
      new Set(['orders', 'payments', 'inventory', 'catalog', 'users', 'admins']),
    );
  });

  it('holds no duplicates', () => {
    expect(new Set(PERMISSION_CATALOG).size).toBe(PERMISSION_CATALOG.length);
  });

  it('classifies permission values (unknown rejected)', () => {
    expect(isPermission('orders.read')).toBe(true);
    expect(isPermission('users.read')).toBe(true);
    expect(isPermission('users.manage')).toBe(true);
    expect(isPermission('admins.create')).toBe(true);
    expect(isPermission('orders.delete')).toBe(false);
    expect(isPermission('Admin')).toBe(false);
    expect(isPermission(null)).toBe(false);
    expect(isPermission(undefined)).toBe(false);
  });
});
