import { describe, expect, it } from 'vitest';
import { OrdersAdminApiService } from './data-access/orders-admin-api.service';
import { ordersRoutes } from './orders.routes';
import { OrdersOverviewState } from './state/orders-overview-state';

describe('ordersRoutes', () => {
  it('provides the feature transport seam and overview state once at the feature root', () => {
    expect(ordersRoutes).toHaveLength(1);
    expect(ordersRoutes[0]?.path).toBe('');
    expect(ordersRoutes[0]?.providers).toEqual([OrdersAdminApiService, OrdersOverviewState]);
  });

  it('serves the landing page with no placeholder slices yet', () => {
    const children = ordersRoutes[0]?.children ?? [];

    expect(children.map((route) => route.path)).toEqual(['']);
    for (const child of children) {
      expect(typeof child.loadComponent).toBe('function');
    }
  });
});
