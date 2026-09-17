/**
 * Route tests for the Sub-Phase 8.2 `checkoutRoutes` (plus the Sub-Phase
 * 8.3 feature-scoped `CheckoutState`).
 *
 * Covers the lazy feature boundary: a single pathless parent carrying
 * the feature-scoped `CheckoutState` (never a global store) and the
 * shared Phase 2 `authGuard` (`POST /orders/checkout` is `[Authorize]`
 * — anonymous entry redirects to `/login?returnUrl=`), with an
 * (initially empty) children table where the §8.4 page registers as the
 * default child, inheriting the guard and the state. No page, no form,
 * and no payment wiring is asserted here — those arrive in Sub-Phase
 * 8.4 and Phase 9.
 */

import { describe, expect, it } from 'vitest';
import { authGuard } from '@flux/auth';
import { checkoutRoutes } from './checkout.routes';
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

  it('reserves the children table for the Sub-Phase 8.4 page (no page yet)', () => {
    expect(Array.isArray(checkoutRoutes[0]?.children)).toBe(true);
    expect(checkoutRoutes[0]?.children).toHaveLength(0);
  });
});
