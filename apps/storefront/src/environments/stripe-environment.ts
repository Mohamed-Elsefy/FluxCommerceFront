/**
 * Storefront development Stripe configuration (Phase 9 — Payments).
 * Public values only: the Stripe.js CDN script URL and the environment
 * publishable key (the ONLY Stripe key the SPA may hold — never the
 * secret key, never a client secret; see `docs/adr/021` and the §9.1
 * `SPA_STRIPE_KEY_SLOT` pin). Publishable keys are public by design;
 * the value below is the shared Stripe test key — replace it with the
 * environment key per deployment.
 * Consumed through the payments route providers (never imported by
 * shared libraries).
 *
 * Split from `environment.ts` (11.7): only the lazy payments boundary
 * imports this module, so the Stripe constants travel in the payments
 * chunk instead of the initial bundle.
 */
export const stripeEnvironment = {
  scriptUrl: 'https://js.stripe.com/v3/',
  publishableKey:
    'pk_test_51TkOLj05d5HmC2JPeXjUoGecsh3nv5vqPOqbCK5cDPcyM5VEzuoOxHfjAenQ7iKJiBhQsXH3RrwouMnfJ9wkWK4700ia1UKSfl',
} as const;
