import { describe, expect, it } from 'vitest';
import { InventoryAdminApiService } from './data-access/inventory-admin-api.service';
import { ReservationState } from './state/reservation-state';
import { StockState } from './state/stock-state';
import { inventoryRoutes } from './inventory.routes';

describe('inventoryRoutes', () => {
  it('provides the feature transport seam and states once at the feature root', () => {
    expect(inventoryRoutes).toHaveLength(1);
    expect(inventoryRoutes[0]?.path).toBe('');
    expect(inventoryRoutes[0]?.providers).toEqual([
      InventoryAdminApiService,
      StockState,
      ReservationState,
    ]);
  });

  it('serves the landing page plus the stock, reservation, and adjustment slices', () => {
    const children = inventoryRoutes[0]?.children ?? [];

    expect(children.map((route) => route.path)).toEqual([
      '',
      'stock',
      'reservations',
      'adjustments',
    ]);
    for (const child of children) {
      expect(typeof child.loadComponent).toBe('function');
    }
  });
});
