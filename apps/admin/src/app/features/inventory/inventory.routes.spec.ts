import { describe, expect, it } from 'vitest';
import { InventoryAdminApiService } from './data-access/inventory-admin-api.service';
import { InventoryCountsState } from './state/inventory-counts-state';
import { ReservationListState } from './state/reservation-list-state';
import { ReservationState } from './state/reservation-state';
import { StockListState } from './state/stock-list-state';
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
      StockListState,
      ReservationListState,
      InventoryCountsState,
    ]);
  });

  it('serves the landing, list, lookup, adjustment, and creation slices', () => {
    const children = inventoryRoutes[0]?.children ?? [];

    expect(children.map((route) => route.path)).toEqual([
      '',
      'stock',
      'stock/:sku',
      'reservations',
      'reservations/:id',
      'adjustments',
      'new',
    ]);
    for (const child of children) {
      expect(typeof child.loadComponent).toBe('function');
    }
  });
});
