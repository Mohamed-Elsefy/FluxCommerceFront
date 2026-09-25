/**
 * Storefront production Stripe configuration (Phase 9 — Payments).
 * Same contract as development: public script URL plus the environment
 * publishable key only (never the secret key — see `environment.ts`;
 * publishable keys are public by design). Replace the test key with
 * the production environment key per deployment.
 *
 * Split from `environment.prod.ts` (11.7): only the lazy payments
 * boundary imports this module, so the Stripe constants travel in the
 * payments chunk instead of the initial bundle.
 */
export const stripeEnvironment = {
  scriptUrl: 'https://js.stripe.com/v3/',
  publishableKey:
    'pk_test_51TkOLj05d5HmC2JPeXjUoGecsh3nv5vqPOqbCK5cDPcyM5VEzuoOxHfjAenQ7iKJiBhQsXH3RrwouMnfJ9wkWK4700ia1UKSfl',
} as const;
