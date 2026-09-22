/**
 * Route tests for the Sub-Phase 10.4 `ordersRoutes`.
 *
 * Covers the lazy orders boundary: a single pathless parent carrying
 * the feature-scoped `OrdersListState` (never a global store), with the
 * default child lazy-loading the orders list page and the `:orderId`
 * child carrying the feature-scoped `OrderDetailsState` while
 * lazy-loading the order details page. Entry protection stays on the
 * account parent (`authGuard` in `account.routes.ts` — asserted there).
 */

import { describe, expect, it } from 'vitest';
import { ordersRoutes } from './orders.routes';
import { OrderDetailsPage } from './pages/order-details-page/order-details-page';
import { OrdersListPage } from './pages/orders-list-page/orders-list-page';
import { OrderDetailsState } from './state/order-details-state';
import { OrdersListState } from './state/orders-list-state';

describe('ordersRoutes', () => {
  it('exposes a single pathless state-providing parent entry', () => {
    expect(ordersRoutes).toHaveLength(1);
    expect(ordersRoutes[0]?.path).toBe('');
  });

  it('provides the feature-scoped OrdersListState on the parent entry', () => {
    expect(ordersRoutes[0]?.providers).toContain(OrdersListState);
  });

  it('lazy-loads the orders list page on the default child', async () => {
    const child = ordersRoutes[0]?.children?.[0];

    expect(child?.path).toBe('');
    expect(typeof child?.loadComponent).toBe('function');

    const page = await child?.loadComponent?.();
    // Identity against the statically imported page proves the route wires
    // the right component; laziness itself follows from the `loadComponent`
    // shape (asserted above) and is enforced by the architecture audit.
    expect(page).toBe(OrdersListPage);
  });

  it('routes :orderId through the details state to the lazy details page', async () => {
    const child = ordersRoutes[0]?.children?.[1];

    expect(child?.path).toBe(':orderId');
    expect(child?.providers).toContain(OrderDetailsState);
    expect(typeof child?.loadComponent).toBe('function');

    const page = await child?.loadComponent?.();
    // Identity against the statically imported page proves the route wires
    // the right component; laziness itself follows from the `loadComponent`
    // shape (asserted above) and is enforced by the architecture audit.
    expect(page).toBe(OrderDetailsPage);
  });
});
