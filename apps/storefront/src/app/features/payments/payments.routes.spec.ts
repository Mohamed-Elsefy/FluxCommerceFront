/**
 * Route tests for the Sub-Phase 9.2 `paymentsRoutes` (Payment Feature
 * Foundation).
 *
 * Covers the lazy feature boundary: a single pathless parent carrying
 * the shared Phase 2 `authGuard` (payment reads are `[Authorize]` —
 * anonymous entry redirects to `/login?returnUrl=`), with `:orderId`
 * and `:orderId/result` children lazy-loading the skeleton pages and
 * inheriting the guard. No providers are asserted — the feature-scoped
 * state registers here in Sub-Phase 9.4. No API, Stripe, or payment
 * behavior is asserted here — those arrive in Sub-Phases 9.3+.
 */

import { describe, expect, it } from 'vitest';
import { authGuard } from '@flux/auth';
import { PaymentPage } from './pages/payment-page/payment-page';
import { PaymentResultPage } from './pages/payment-result-page/payment-result-page';
import { paymentsRoutes } from './payments.routes';

describe('paymentsRoutes', () => {
  it('exposes a single pathless guarded parent entry', () => {
    expect(paymentsRoutes).toHaveLength(1);
    expect(paymentsRoutes[0]?.path).toBe('');
    expect(paymentsRoutes[0]?.canActivate).toContain(authGuard);
  });

  it('registers no feature providers yet (state arrives in 9.4)', () => {
    expect(paymentsRoutes[0]?.providers).toBeUndefined();
  });

  it('lazy-loads the payment page on :orderId', async () => {
    const child = paymentsRoutes[0]?.children?.[0];

    expect(child?.path).toBe(':orderId');
    expect(typeof child?.loadComponent).toBe('function');

    const page = await child?.loadComponent?.();
    // Identity against the statically imported page proves the route wires
    // the right component; laziness itself follows from the `loadComponent`
    // shape (asserted above) and is enforced by the architecture audit.
    expect(page).toBe(PaymentPage);
  });

  it('lazy-loads the payment result page on :orderId/result', async () => {
    const child = paymentsRoutes[0]?.children?.[1];

    expect(child?.path).toBe(':orderId/result');
    expect(typeof child?.loadComponent).toBe('function');

    const page = await child?.loadComponent?.();
    expect(page).toBe(PaymentResultPage);
  });
});
