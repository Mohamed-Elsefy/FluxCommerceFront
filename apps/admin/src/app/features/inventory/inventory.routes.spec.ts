import { describe, expect, it } from 'vitest';
import { InventoryAdminApiService } from './data-access/inventory-admin-api.service';
import { inventoryRoutes } from './inventory.routes';

describe('inventoryRoutes', () => {
  it('provides the feature transport seam once at the feature root', () => {
    expect(inventoryRoutes).toHaveLength(1);
    expect(inventoryRoutes[0]?.path).toBe('');
    expect(inventoryRoutes[0]?.providers).toEqual([InventoryAdminApiService]);
  });

  it('serves the landing page at the feature root and nothing else yet', () => {
    const children = inventoryRoutes[0]?.children ?? [];

    expect(children.map((route) => route.path)).toEqual(['']);
    for (const child of children) {
      expect(typeof child.loadComponent).toBe('function');
    }
  });
});
