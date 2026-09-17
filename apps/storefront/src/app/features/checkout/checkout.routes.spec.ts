/**
 * Route tests for the Sub-Phase 8.2 `checkoutRoutes`.
 *
 * Covers the lazy feature boundary: a single pathless parent carrying
 * the shared Phase 2 `authGuard` (`POST /orders/checkout` is
 * `[Authorize]` — anonymous entry redirects to `/login?returnUrl=`),
 * with an (initially empty) children table where the §8.4 page registers
 * as the default child, inheriting the guard. No page, no state, and no
 * data-access wiring is asserted here — those arrive in Sub-Phases
 * 8.3/8.4.
 */

import { describe, expect, it } from 'vitest';
import { authGuard } from '@flux/auth';
import { checkoutRoutes } from './checkout.routes';

describe('checkoutRoutes', () => {
  it('exposes a single pathless guarded parent entry', () => {
    expect(checkoutRoutes).toHaveLength(1);
    expect(checkoutRoutes[0]?.path).toBe('');
    expect(checkoutRoutes[0]?.canActivate).toContain(authGuard);
  });

  it('reserves the children table for the Sub-Phase 8.4 page (no page yet)', () => {
    expect(Array.isArray(checkoutRoutes[0]?.children)).toBe(true);
    expect(checkoutRoutes[0]?.children).toHaveLength(0);
  });
});
