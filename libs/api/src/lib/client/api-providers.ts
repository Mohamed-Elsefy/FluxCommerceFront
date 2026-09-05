/**
 * Centralized HttpClient provisioning for Sub-Phases 1.2 + 1.4 — HttpClient &
 * API Configuration and HTTP Interceptor Pipeline.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §§1.2, 1.4.
 *
 * Each application calls `provideApi()` exactly once in its `app.config.ts`
 * (alongside the existing `provideAppEnvironment(environment)`). This keeps
 * one consistent HTTP foundation across Storefront (SSR) and Admin (CSR):
 *
 * - `provideHttpClient(withInterceptors(API_INTERCEPTORS))` — Fetch-based
 *   transport by default (`FetchBackend` is the default `HttpBackend`; the
 *   deprecated `withFetch()` is not required), which is SSR-compatible (the
 *   server bundle has no `XMLHttpRequest`; the Fetch API exists in both
 *   runtimes).
 * - `API_BASE_URL` — derived from `APP_ENVIRONMENT` via the pure
 *   `resolveApiBaseUrl`, so dev (`https://localhost:7119`) and prod
 *   same-origin (`/api`) resolve without feature-level branching.
 *
 * Interceptor execution order (outbound; responses/errors traverse reverse):
 *
 * ```text
 * 1. correlationInterceptor      — ensure X-Correlation-ID (flow id or generated)
 * 2. requestConfigInterceptor    — Accept-Language, Idempotency-Key
 * 3. authInterceptor             — Authorization Bearer hook (Phase 2 seam)
 * 4. httpErrorHookInterceptor    — transport-error hook (1.5 maps here)
 *              ↓
 *         HttpBackend
 * ```
 *
 * Explicitly out of scope here (later work): typed feature API clients
 * (1.3 — done, consumes this pipeline), error normalization (1.5), and any
 * authentication workflow (Phase 2).
 */

import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { HttpInterceptorFn, provideHttpClient, withInterceptors } from '@angular/common/http';
import { APP_ENVIRONMENT, type AppEnvironment } from './app-environment';
import { API_BASE_URL, resolveApiBaseUrl } from './api-base-url';
import { correlationInterceptor } from './correlation-interceptor';
import { requestConfigInterceptor } from './request-config-interceptor';
import { authInterceptor } from './auth-interceptor';
import { httpErrorHookInterceptor } from './http-error-hook-interceptor';

/**
 * Canonical interceptor pipeline in execution order. Exported so the order
 * is inspectable/testable; wired by `provideApi()` — applications and
 * features must not re-register interceptors individually.
 */
export const API_INTERCEPTORS: readonly HttpInterceptorFn[] = [
  correlationInterceptor,
  requestConfigInterceptor,
  authInterceptor,
  httpErrorHookInterceptor,
];

/**
 * Provides the shared HTTP foundation for an application. Call once per
 * application bootstrap, next to `provideAppEnvironment(environment)`.
 */
export function provideApi(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(withInterceptors([...API_INTERCEPTORS])),
    {
      provide: API_BASE_URL,
      useFactory: (environment: AppEnvironment) => resolveApiBaseUrl(environment),
      deps: [APP_ENVIRONMENT],
    },
  ]);
}
