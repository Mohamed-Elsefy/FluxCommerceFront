/**
 * Feature data-access for the Sub-Phase 2.4 authentication vertical slice.
 *
 * Owns the two authentication workflows and nothing else:
 *
 * ```text
 * login:    Login API → store session → load current user → authenticated
 * register: Register API → registration result (never auto-login)
 * ```
 *
 * Layering (`ARCHITECTURE.md` §10):
 *
 * ```text
 * Auth pages (./pages)
 *     ↓ AuthDataAccess (this file — feature-owned orchestration)
 *     ↓ IdentityApiService + TokenStorageService + AuthService (shared libs)
 *     ↓ ApiClient → HttpClient → ASP.NET Core API
 * ```
 *
 * Contract rules:
 * - Login calls `GET /auth/me` with an explicitly attached Bearer header
 *   because centralized token injection is Sub-Phase 2.5 (the Phase 1
 *   `ACCESS_TOKEN_PROVIDER` still returns `null`). The interceptor never
 *   clobbers explicit `Authorization` headers, so this is a safe, temporary,
 *   flow-local measure — 2.5 removes it.
 * - Registration never stores a session and never touches `AuthService`:
 *   the contract issues no tokens on register and new accounts are
 *   `Pending` until email verification, so auto-login would be contract
 *   drift (`PHASE_2` §4.4).
 * - Failures propagate as normalized `ApiError`s untouched; pages render
 *   `message` verbatim (already localized) and map `validationErrors`.
 */

import { inject, Injectable } from '@angular/core';
import { map, switchMap, type Observable } from 'rxjs';
import {
  ApiError,
  UNKNOWN_ERROR_CODE,
  IdentityApiService,
  type ApiResponseWithData,
} from '@flux/api';
import { AuthService, TokenStorageService, type CurrentUser } from '@flux/auth';
import type { LoginRequest, RegisterCustomerRequest, UserResponse } from '@flux/models';

/**
 * Registration outcome: what to tell the user after `POST /auth/register`
 * succeeds. Carries no session — the account is `Pending` until the
 * verification email (24h token) is consumed via `POST /auth/verify-email`.
 */
export interface RegistrationResult {
  /** Account email the verification message was sent to. */
  readonly email: string;
  /** Display name for personalized copy. */
  readonly displayName: string | null;
  /** True only when the backend already considers the email verified. */
  readonly isEmailVerified: boolean;
}

/**
 * Maps a contract `UserResponse` onto the shared `CurrentUser` model.
 * `displayName` falls back to `"<firstName> <lastName>"` when the backend
 * sends null; roles are copied (never reinterpreted — authorization stays
 * backend-authoritative).
 */
export function mapUserResponseToCurrentUser(response: UserResponse): CurrentUser {
  const fallbackName = `${response.firstName} ${response.lastName}`.trim();
  return {
    id: response.id,
    email: response.email,
    displayName: response.displayName ?? (fallbackName.length > 0 ? fallbackName : null),
    roles: [...response.roles],
    isEmailVerified: response.isEmailVerified,
  };
}

/**
 * Feature-owned authentication orchestration. Stateless — UI state
 * (loading, errors, results) lives in page components as signals.
 */
@Injectable({ providedIn: 'root' })
export class AuthDataAccess {
  private readonly identity = inject(IdentityApiService);
  private readonly auth = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);

  /**
   * Full login workflow: token pair → persisted refresh session → current
   * user → authenticated state. Emits the current user; errors as `ApiError`
   * (`401` wrong credentials / unverified email / locked account surface as
   * the backend's localized `message`).
   */
  login(credentials: LoginRequest): Observable<CurrentUser> {
    return this.identity.login(credentials).pipe(
      switchMap((loginEnvelope) => {
        const tokens = requireEnvelopeData(loginEnvelope);
        return this.identity
          .getCurrentUser({ headers: { Authorization: `Bearer ${tokens.accessToken}` } })
          .pipe(map((meEnvelope) => ({ tokens, me: requireEnvelopeData(meEnvelope) })));
      }),
      map(({ tokens, me }) => {
        const user = mapUserResponseToCurrentUser(me);
        const authenticatedAtUtc = new Date().toISOString();
        this.tokenStorage.saveSession({
          refreshToken: tokens.refreshToken,
          user,
          authenticatedAtUtc,
        });
        this.auth.setAuthenticated({
          user,
          accessToken: tokens.accessToken,
          authenticatedAtUtc,
        });
        return user;
      }),
    );
  }

  /**
   * Registration workflow: account creation → result state. Stores nothing
   * and authenticates nothing — the caller must present the pending /
   * verification UI from the returned result.
   */
  register(input: RegisterCustomerRequest): Observable<RegistrationResult> {
    return this.identity.register(input).pipe(
      map((envelope) => {
        const user = requireEnvelopeData(envelope);
        return {
          email: user.email,
          displayName: (user.displayName ?? `${user.firstName} ${user.lastName}`.trim()) || null,
          isEmailVerified: user.isEmailVerified,
        } satisfies RegistrationResult;
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
