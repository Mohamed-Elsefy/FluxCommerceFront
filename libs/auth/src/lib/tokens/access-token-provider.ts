/**
 * Access-token provider wiring for Sub-Phase 2.5 — Access Token Integration.
 *
 * Scope: `docs/phases/PHASE_2_IDENTITY_AUTHENTICATION_IMPLEMENTATION_PLAN.md`
 * §4.5. Activates the Phase 1 `ACCESS_TOKEN_PROVIDER` seam
 * (`libs/api/.../interceptors/auth-token.ts`) with the session-backed reader
 * it was designed for:
 *
 * ```text
 * AuthService (in-memory access token, Sub-Phase 2.2)
 *     ↓ readAccessToken()
 * ACCESS_TOKEN_PROVIDER (Phase 1 seam, overridden here)
 *     ↓ authInterceptor (Phase 1, untouched)
 * Authorization: Bearer <access-token>
 * ```
 *
 * Behavior (all inherited from the seam + service, restated for the
 * acceptance criteria):
 * - Authenticated: every API request carries the current in-memory token —
 *   no feature code attaches headers.
 * - Anonymous (or cleared session): the reader returns `null`, the
 *   interceptor passes the request through untouched — never `Bearer null`,
 *   never an empty header, anonymous traffic (catalog reads, guest carts,
 *   login/register/refresh themselves) stays valid.
 * - Explicit per-request `Authorization` headers are never clobbered (the
 *   interceptor checks first).
 * - Token safety: the value travels from private signal → header only. This
 *   file logs nothing, stores nothing, and exposes no debug surface; the
 *   value never appears in application logs.
 *
 * Registration: applications call `provideAccessToken()` once next to
 * `provideApi()` (storefront `app.config.ts`, admin `app.config.ts`; the
 * SSR server config inherits it via `mergeApplicationConfig`). Tests
 * override `ACCESS_TOKEN_PROVIDER` (or drive `AuthService`) the same way
 * Phase 1 specs do.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 2.6 — no refresh calls, no rotation, no single-flight coordination.
 * - 2.7 — no 401 interception, no retries, no recovery.
 */

import { EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { ACCESS_TOKEN_PROVIDER } from '@flux/api';
import { AuthService } from '../state/auth.service';

/**
 * Overrides the Phase 1 anonymous default (`() => null`) with a reader
 * bound to the central `AuthService`. Call once per application bootstrap.
 */
export function provideAccessToken(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ACCESS_TOKEN_PROVIDER,
      useFactory: (auth: AuthService) => () => auth.readAccessToken(),
      deps: [AuthService],
    },
  ]);
}
