/**
 * Centralized API base URL resolution for Sub-Phase 1.2 — HttpClient & API Configuration.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.2.
 *
 * Resolution chain (single source of truth, no hard-coded URLs in features):
 *
 * ```text
 * environments/environment.ts (.prod.ts in production builds)
 *     ↓ AppEnvironment.apiBaseUrl
 * APP_ENVIRONMENT (provided once per app via provideAppEnvironment)
 *     ↓ resolveApiBaseUrl (pure, tested)
 * API_BASE_URL (injectable string, no trailing slash)
 *     ↓
 * Feature data access / typed API client (Sub-Phase 1.3)
 * ```
 *
 * Environments:
 * - development → absolute backend origin (`https://localhost:7119`).
 * - production → same-origin `/api` (reverse-proxy/gateway path; no
 *   deployment host is baked into the bundle).
 *
 * Both shapes flow through the same token, so features never branch on
 * environments. Relative (`/api`) and absolute base URLs are both supported:
 * joining with a request path is `buildApiUrl({ baseUrl }, path)` in
 * `./api-config` (or `HttpClient` relative requests in later phases).
 */

import { InjectionToken } from '@angular/core';
import type { AppEnvironment } from './app-environment';

/**
 * Resolved backend base URL (no trailing slash). Inject with
 * `inject(API_BASE_URL)` — never read `window.location`, never hard-code a
 * host or path prefix inside features. Provided by `provideApi()` in
 * `./api-providers`.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL');

/**
 * Normalizes a configured base URL: trims whitespace and strips trailing
 * slashes (`https://localhost:7119/` → `https://localhost:7119`).
 * `/api/` → `/api`. Empty input stays empty (fails fast downstream).
 */
export function normalizeApiBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '');
}

/**
 * Pure base URL resolver: normalizes `environment.apiBaseUrl` from the
 * active `AppEnvironment`. Kept pure (no DI) so it is trivially unit-tested;
 * the DI factory in `./api-providers` delegates to it.
 */
export function resolveApiBaseUrl(environment: AppEnvironment): string {
  return normalizeApiBaseUrl(environment.apiBaseUrl);
}
