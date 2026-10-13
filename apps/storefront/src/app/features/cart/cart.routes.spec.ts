/**
 * Route tests for the Sub-Phase 7.4 `cartRoutes` (plus Sub-Phase 7.5
 * guest lifecycle wiring).
 *
 * Covers the lazy feature boundary: the parent provides the
 * feature-scoped `CartState` (never a global store) and the
 * feature-scoped `GuestCartService` driving the guest identity
 * lifecycle against that state, and the default child lazy-loads the
 * cart page serving `/cart`.
 */

import { describe, expect, it } from 'vitest';
import { CartPage } from './pages/cart-page/cart-page';
import { AuthenticatedCartService } from './state/authenticated-cart.service';
import { CartState } from './state/cart-state';
import { GuestCartService } from './state/guest-cart.service';
import { cartRoutes } from './cart.routes';

describe('cartRoutes', () => {
  it('provides the feature-scoped state and lifecycles on the parent entry', () => {
    expect(cartRoutes).toHaveLength(1);
    expect(cartRoutes[0]?.providers).toContain(CartState);
    expect(cartRoutes[0]?.providers).toContain(GuestCartService);
    expect(cartRoutes[0]?.providers).toContain(AuthenticatedCartService);
  });

  it('lazy-loads the cart page on the default child', async () => {
    const child = cartRoutes[0]?.children?.[0];

    expect(child?.path).toBe('');
    expect(typeof child?.loadComponent).toBe('function');

    const page = await child?.loadComponent?.();
    // Identity against the statically imported page proves the route wires
    // the right component; laziness itself follows from the `loadComponent`
    // shape (asserted above) and is enforced by the architecture audit.
    expect(page).toBe(CartPage);
  });
});
