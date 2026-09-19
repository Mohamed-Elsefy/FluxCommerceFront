import { AppEnvironment } from '@flux/api';

/**
 * Storefront production configuration.
 * Public values only — never secrets or credentials.
 * The same-origin `/api` default avoids baking a deployment-specific
 * host into the bundle; later phases may source it from deployment.
 */
export const environment: AppEnvironment = {
  name: 'production',
  production: true,
  appName: 'storefront',
  apiBaseUrl: '/api',
};

/**
 * Storefront production Stripe configuration (Phase 9 — Payments).
 * Same contract as development: public script URL plus the environment
 * publishable key only (never the secret key — see `environment.ts`).
 * Replace the placeholder with the production environment key per
 * deployment.
 */
export const stripeEnvironment = {
  scriptUrl: 'https://js.stripe.com/v3/',
  publishableKey:
    'pk_test_51TkOLj05d5HmC2JPeXjUoGecsh3nv5vqPOqbCK5cDPcyM5VEzuoOxHfjAenQ7iKJiBhQsXH3RrwouMnfJ9wkWK4700ia1UKSfl',
} as const;
