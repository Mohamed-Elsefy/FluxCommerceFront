/**
 * Route tests for the Sub-Phase 8.2 `checkoutRoutes` (plus the Sub-Phase
 * 8.3 feature-scoped `CheckoutState`, the Sub-Phase 8.6 checkout page
 * and cart lifecycle seams).
 *
 * Covers the lazy feature boundary: a single pathless parent carrying
 * the feature-scoped `CheckoutState` (never a global store), the cart
 * capabilities seam (read-only consumer — interface-based, never cart
 * internals), and the shared Phase 2 `authGuard` (`POST
 * /orders/checkout` is `[Authorize]` — anonymous entry redirects to
 * `/login?returnUrl=`), with the default child lazy-loading the
 * checkout page, inheriting the guard and the providers. No payment
 * wiring is asserted here — that arrives in Phase 9.
 */

import { describe, expect, it } from 'vitest';
import { authGuard } from '@flux/auth';
import { CART_CAPABILITIES, CartCapabilitiesService } from '../cart/cart-capabilities.service';
import { checkoutRoutes } from './checkout.routes';
import { CheckoutPage } from './pages/checkout-page/checkout-page';
import { CheckoutState } from './state/checkout-state';

describe('checkoutRoutes', () => {
  it('exposes a single pathless guarded parent entry', () => {
    expect(checkoutRoutes).toHaveLength(1);
    expect(checkoutRoutes[0]?.path).toBe('');
    expect(checkoutRoutes[0]?.canActivate).toContain(authGuard);
  });

  it('provides the feature-scoped CheckoutState on the parent entry', () => {
    expect(checkoutRoutes[0]?.providers).toContain(CheckoutState);
  });

  it('provides the cart capabilities seam for read-only cart consumption', () => {
    const providers = checkoutRoutes[0]?.providers ?? [];
    expect(providers).toContain(CartCapabilitiesService);
    expect(
      providers.some(
        (entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          'provide' in entry &&
          (entry as { provide: unknown }).provide === CART_CAPABILITIES,
      ),
    ).toBe(true);
  });

  it('lazy-loads the checkout page on the default child', async () => {
    const child = checkoutRoutes[0]?.children?.[0];

    expect(child?.path).toBe('');
    expect(typeof child?.loadComponent).toBe('function');

    const page = await child?.loadComponent?.();
    // Identity against the statically imported page proves the route wires
    // the right component; laziness itself follows from the `loadComponent`
    // shape (asserted above) and is enforced by the architecture audit.
    expect(page).toBe(CheckoutPage);
  });
});
