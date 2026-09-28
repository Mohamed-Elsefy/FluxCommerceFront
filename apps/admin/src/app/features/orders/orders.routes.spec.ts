import { describe, expect, it } from 'vitest';
import { OrdersAdminApiService } from './data-access/orders-admin-api.service';
import { ordersRoutes } from './orders.routes';
import { OrderDetailsState } from './state/order-details-state';
import { OrderListState } from './state/orders-list-state';
import { OrdersOverviewState } from './state/orders-overview-state';

describe('ordersRoutes', () => {
  it('provides the feature transport seam and states once at the feature root', () => {
    expect(ordersRoutes).toHaveLength(1);
    expect(ordersRoutes[0]?.path).toBe('');
    expect(ordersRoutes[0]?.providers).toEqual([
      OrdersAdminApiService,
      OrdersOverviewState,
      OrderListState,
      OrderDetailsState,
    ]);
  });

  it('serves the landing page plus the orders list and details slices', () => {
    const children = ordersRoutes[0]?.children ?? [];

    expect(children.map((route) => route.path)).toEqual(['', 'list', ':id']);
    for (const child of children) {
      expect(typeof child.loadComponent).toBe('function');
    }
  });
});
