import { AppEnvironment } from '@flux/api';

/**
 * Admin production configuration.
 * Public values only — never secrets or credentials.
 * The same-origin `/api` default avoids baking a deployment-specific
 * host into the bundle; later phases may source it from deployment.
 */
export const environment: AppEnvironment = {
  name: 'production',
  production: true,
  appName: 'admin',
  apiBaseUrl: '/api',
};
