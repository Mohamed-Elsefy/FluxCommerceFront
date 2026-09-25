/**
 * Route tests for the Sub-Phase 9.2 `paymentsRoutes` (Payment Feature
 * Foundation).
 *
 * Covers the lazy feature boundary: a single pathless parent carrying
 * the feature-scoped `PaymentState` (never a global store) and the
 * shared Phase 2 `authGuard` (payment reads are `[Authorize]` —
 * anonymous entry redirects to `/login?returnUrl=`), with `:orderId`
 * and `:orderId/result` children lazy-loading the skeleton pages and
 * inheriting the guard and the providers. Page orchestration driving
 * the state arrives in Sub-Phase 9.6. No API execution, Stripe, or
 * payment behavior is asserted here — those arrive in Sub-Phases 9.3+.
 */

import { describe, expect, it } from 'vitest';
import { authGuard } from '@flux/auth';
import { stripeEnvironment } from '../../../environments/stripe-environment';
import { PAYMENT_PROVIDER } from './integrations/payment-provider';
import {
  STRIPE_JS_SCRIPT_URL,
  STRIPE_PUBLISHABLE_KEY,
  StripePaymentProvider,
} from './integrations/stripe-payment-provider';
import { PaymentPage } from './pages/payment-page/payment-page';
import { PaymentResultPage } from './pages/payment-result-page/payment-result-page';
import { paymentsRoutes } from './payments.routes';
import { PaymentState } from './state/payment-state';

describe('paymentsRoutes', () => {
  it('exposes a single pathless guarded parent entry', () => {
    expect(paymentsRoutes).toHaveLength(1);
    expect(paymentsRoutes[0]?.path).toBe('');
    expect(paymentsRoutes[0]?.canActivate).toContain(authGuard);
  });

  it('provides the feature-scoped PaymentState on the parent entry', () => {
    expect(paymentsRoutes[0]?.providers).toContain(PaymentState);
  });

  it('binds the provider abstraction with environment-sourced tokens', () => {
    const providers = paymentsRoutes[0]?.providers ?? [];
    expect(providers).toContainEqual({
      provide: PAYMENT_PROVIDER,
      useClass: StripePaymentProvider,
    });
    expect(providers).toContainEqual({
      provide: STRIPE_JS_SCRIPT_URL,
      useValue: stripeEnvironment.scriptUrl,
    });
    expect(providers).toContainEqual({
      provide: STRIPE_PUBLISHABLE_KEY,
      useValue: stripeEnvironment.publishableKey,
    });
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
