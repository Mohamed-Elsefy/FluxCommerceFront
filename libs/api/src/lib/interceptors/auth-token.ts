/**
 * Authentication integration seam for Sub-Phase 1.4 — HTTP Interceptor Pipeline.
 *
 * Scope: `docs/phases/PHASE_1_CORE_INFRASTRUCTURE.md` §1.4 ("Authentication
 * integration hooks") with the Phase 1 boundary that NO authentication
 * workflow lives here.
 *
 * This file exposes a single seam — a synchronous token reader — so the
 * `authInterceptor` (./auth-interceptor) can attach a Bearer token WITHOUT
 * owning any auth state. Token acquisition, storage, refresh, session
 * lifecycle, guards, and role checks belong exclusively to Phase 2, which
 * overrides this provider with its session-backed implementation:
 *
 * ```text
 * Phase 2: { provide: ACCESS_TOKEN_PROVIDER, useFactory: (session) => () => session.accessToken(), ... }
 * ```
 *
 * Until then the root default returns `null` and the interceptor stays inert
 * (requests pass through with no `Authorization` header).
 */

import { InjectionToken } from '@angular/core';

/** Synchronous reader for the current access token, or `null` when absent. */
export type AccessTokenProvider = () => string | null;

/**
 * Integration hook for the auth interceptor. Overridden by Phase 2 with a
 * session-backed reader; defaults to `() => null` (anonymous).
 */
export const ACCESS_TOKEN_PROVIDER = new InjectionToken<AccessTokenProvider>(
  'ACCESS_TOKEN_PROVIDER',
  { providedIn: 'root', factory: () => () => null },
);
