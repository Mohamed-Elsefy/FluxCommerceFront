import { describe, expect, it } from 'vitest';
import { InventoryAdminApiService } from './data-access/inventory-admin-api.service';
import { StockState } from './state/stock-state';
import { inventoryRoutes } from './inventory.routes';

describe('inventoryRoutes', () => {
  it('provides the feature transport seam and states once at the feature root', () => {
    expect(inventoryRoutes).toHaveLength(1);
    expect(inventoryRoutes[0]?.path).toBe('');
    expect(inventoryRoutes[0]?.providers).toEqual([InventoryAdminApiService, StockState]);
  });

  it('serves the landing page and the stock lookup (nothing else yet)', () => {
    const children = inventoryRoutes[0]?.children ?? [];

    expect(children.map((route) => route.path)).toEqual(['', 'stock']);
    for (const child of children) {
      expect(typeof child.loadComponent).toBe('function');
    }
  });
});
