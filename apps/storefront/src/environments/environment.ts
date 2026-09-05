import { AppEnvironment } from '@flux/api';

/**
 * Storefront development configuration.
 * Public values only — never secrets or credentials.
 */
export const environment: AppEnvironment = {
  name: 'development',
  production: false,
  appName: 'storefront',
  apiBaseUrl: 'https://localhost:7119',
};
