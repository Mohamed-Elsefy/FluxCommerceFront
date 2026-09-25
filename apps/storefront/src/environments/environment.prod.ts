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
