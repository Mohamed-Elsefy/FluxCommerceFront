/**
 * Centralized HttpClient provisioning for Sub-Phase 1.2 — HttpClient & API Configuration.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.2.
 *
 * Each application calls `provideApi()` exactly once in its `app.config.ts`
 * (alongside the existing `provideAppEnvironment(environment)`). This keeps
 * one consistent HTTP foundation across Storefront (SSR) and Admin (CSR):
 *
 * - `provideHttpClient()` — Fetch-based transport by default (`FetchBackend`
 *   is the default `HttpBackend`; the deprecated `withFetch()` is not
 *   required), which is SSR-compatible (the server bundle has no
 *   `XMLHttpRequest`; the Fetch API exists in both runtimes). No interceptors
 *   are registered here; the interceptor pipeline arrives in Sub-Phase 1.4
 *   and authentication integration in Phase 2.
 * - `API_BASE_URL` — derived from `APP_ENVIRONMENT` via the pure
 *   `resolveApiBaseUrl`, so dev (`https://localhost:7119`) and prod
 *   same-origin (`/api`) resolve without feature-level branching.
 *
 * Explicitly out of scope here (later sub-phases): typed feature API clients
 * (1.3), the interceptor pipeline (1.4), and any authentication workflow.
 */

import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { APP_ENVIRONMENT, type AppEnvironment } from './app-environment';
import { API_BASE_URL, resolveApiBaseUrl } from './api-base-url';

/**
 * Provides the shared HTTP foundation for an application. Call once per
 * application bootstrap, next to `provideAppEnvironment(environment)`.
 */
export function provideApi(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(),
    {
      provide: API_BASE_URL,
      useFactory: (environment: AppEnvironment) => resolveApiBaseUrl(environment),
      deps: [APP_ENVIRONMENT],
    },
  ]);
}
