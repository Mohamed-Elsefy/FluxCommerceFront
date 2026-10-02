/**
 * Admin login data-access for Sub-Phase 12.1 — Admin Route & Authorization
 * Integration.
 *
 * Scope: `docs/phases/PHASE_12_ADMIN_PORTAL_FOUNDATION.md` §12.1. Owns the
 * admin login workflow and nothing else:
 *
 * ```text
 * login: Login API → store session → load current user → authenticated
 * ```
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * Admin login page
 *     ↓ AdminAuthDataAccess (this file — feature-owned orchestration)
 *     ↓ IdentityApiService + TokenStorageService + AuthService (shared libs)
 *     ↓ ApiClient → HttpClient → ASP.NET Core API
 * ```
 *
 * Rules:
 * - Reuses the existing session infrastructure (`TokenStorageService`,
 *   `AuthService`); no separate Admin authentication system.
 * - Attaches no headers: `GET /auth/me` travels through the centralized
 *   interceptor pipeline like every other authenticated request.
 * - Establishes the provisional session first so Bearer injection exists
 *   before profile hydration; hydration failure rolls back (storage + state
 *   cleared) so no half-logged-in state remains.
 * - Authorization stays backend-authoritative: this workflow authenticates
 *   only. Whether the user may enter the portal (`Admin`/`SuperAdmin`) is
 *   decided by the route guards (`authGuard` + `roleGuard`), never here.
 * - Failures propagate as normalized `ApiError`s untouched.
 */

import { inject, Injectable } from '@angular/core';
import { catchError, map, switchMap, throwError, type Observable } from 'rxjs';
import {
  ApiError,
  UNKNOWN_ERROR_CODE,
  IdentityApiService,
  type ApiResponseWithData,
} from '@flux/api';
import {
  AuthService,
  TokenStorageService,
  mapUserResponseToCurrentUser,
  type CurrentUser,
} from '@flux/auth';
import type { LoginRequest, LoginResponse } from '@flux/models';

/**
 * Builds the provisional session user from a `LoginResponse` so the
 * in-memory session (and therefore centralized Bearer injection) exists
 * before `GET /auth/me` hydrates the full profile. `LoginResponse` carries
 * no permissions, so the provisional user holds none — permission-gated UI
 * stays hidden (fail-closed) until hydration fills them in.
 */
export function mapLoginResponseToProvisionalUser(response: LoginResponse): CurrentUser {
  return {
    id: response.userId,
    email: response.email,
    displayName: null,
    roles: [...response.roles],
    permissions: [],
    isEmailVerified: true,
  };
}

/**
 * Feature-owned admin login orchestration. Stateless — UI state (loading,
 * errors) lives in the login page component as signals.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthDataAccess {
  private readonly identity = inject(IdentityApiService);
  private readonly auth = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);

  /**
   * Full login workflow: token pair → provisional session → hydrated
   * current user → authenticated state. Emits the hydrated user; errors as
   * `ApiError`. No headers are attached here.
   */
  login(credentials: LoginRequest): Observable<CurrentUser> {
    return this.identity.login(credentials).pipe(
      map((loginEnvelope) => {
        const tokens = requireEnvelopeData(loginEnvelope);
        const authenticatedAtUtc = new Date().toISOString();
        const provisional = mapLoginResponseToProvisionalUser(tokens);
        this.tokenStorage.saveSession({
          refreshToken: tokens.refreshToken,
          user: provisional,
          authenticatedAtUtc,
        });
        this.auth.setAuthenticated({
          user: provisional,
          accessToken: tokens.accessToken,
          authenticatedAtUtc,
        });
        return tokens;
      }),
      switchMap(() =>
        this.identity.getCurrentUser().pipe(
          map((meEnvelope) => mapUserResponseToCurrentUser(requireEnvelopeData(meEnvelope))),
          catchError((error: unknown) => {
            this.tokenStorage.clearSession();
            this.auth.clearSession();
            return throwError(() => error);
          }),
        ),
      ),
      map((user) => {
        const stored = this.tokenStorage.loadSession();
        if (stored !== null) {
          this.tokenStorage.replaceSession({ ...stored, user });
        }
        this.auth.updateCurrentUser(user);
        return user;
      }),
    );
  }
}

/** Unwraps a success envelope; a dataless `200` is a contract violation. */
function requireEnvelopeData<T>(envelope: ApiResponseWithData<T>): T {
  const data = envelope.data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}
