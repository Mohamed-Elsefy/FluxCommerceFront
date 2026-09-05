import { AppEnvironment } from '@flux/api';

/**
 * Admin development configuration.
 * Public values only — never secrets or credentials.
 */
export const environment: AppEnvironment = {
  name: 'development',
  production: false,
  appName: 'admin',
  apiBaseUrl: 'https://localhost:7119',
};
