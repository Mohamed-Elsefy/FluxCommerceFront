/**
 * `libs/api` application-environment foundation.
 *
 * Typed, public-only configuration every application provides once at
 * bootstrap. Features and services inject {@link APP_ENVIRONMENT} instead
 * of hard-coding URLs. Only public values belong here (environment name,
 * API base URL, feature flags) — never secrets or credentials.
 */
import { EnvironmentProviders, InjectionToken, makeEnvironmentProviders } from '@angular/core';

/** Deployment environments distinguished by the frontend. */
export type EnvironmentName = 'development' | 'production';

/**
 * Public application configuration. One value per application, provided
 * at bootstrap from that application's `environments/environment.*` file.
 */
export interface AppEnvironment {
  /** Which deployment environment this build targets. */
  readonly name: EnvironmentName;
  /** True for production builds (enables prod-only behavior). */
  readonly production: boolean;
  /** Owning application identity (e.g. storefront/admin metadata). */
  readonly appName: string;
  /** Backend API base URL (no version prefix, no trailing slash). */
  readonly apiBaseUrl: string;
}

/**
 * Single typed access point for the active application configuration.
 * Inject with `inject(APP_ENVIRONMENT)` — never hard-code URLs.
 */
export const APP_ENVIRONMENT = new InjectionToken<AppEnvironment>('APP_ENVIRONMENT');

/**
 * Provides an application's environment value at bootstrap
 * (used once per application inside `app.config.ts`).
 */
export function provideAppEnvironment(environment: AppEnvironment): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: APP_ENVIRONMENT, useValue: environment }]);
}
