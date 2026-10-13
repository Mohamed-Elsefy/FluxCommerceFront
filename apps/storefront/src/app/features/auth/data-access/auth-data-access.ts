/**
 * Feature data-access for the Sub-Phase 2.4 authentication vertical slice
 * and the Sub-Phase 2.10 identity lifecycle entry points.
 *
 * Owns the authentication workflows and nothing else:
 *
 * ```text
 * login:              Login API → store session → load current user → authenticated
 * register:           Register API → registration result (never auto-login)
 * verifyEmail:        Verify-email API → identity result (never auto-login)
 * resendVerification: Resend-verification API → send result
 * forgotPassword:     Forgot-password API → void (always success UI)
 * resetPassword:      Reset-password API → void (then prompt login)
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
 * Contract rules (Sub-Phase 2.5: token injection is fully central):
 * - Login establishes the in-memory session FIRST (provisional user mapped
 *   from `LoginResponse`), so `GET /auth/me` travels through the centralized
 *   interceptor pipeline like every other authenticated request — this file
 *   attaches no headers. The provisional user is sound: the backend rejects
 *   unverified logins, so a successful login implies a verified email;
 *   `displayName` hydrates from `/auth/me`.
 * - If profile hydration fails, the provisional session rolls back
 *   (storage + state cleared) and the error propagates — a half-logged-in
 *   state is never left behind.
 * - Registration never stores a session and never touches `AuthService`:
 *   the contract issues no tokens on register and new accounts are
 *   `Pending` until email verification, so auto-login would be contract
 *   drift (`PHASE_2` §4.4).
 * - Failures propagate as normalized `ApiError`s untouched; pages render
 *   `message` verbatim (already localized) and map `validationErrors`.
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
import type {
  LoginRequest,
  LoginResponse,
  RegisterCustomerRequest,
  ResendVerificationResponse,
  ResetPasswordRequest,
  UserResponse,
} from '@flux/models';

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
 * Builds the provisional session user from a `LoginResponse` so the
 * in-memory session (and therefore centralized Bearer injection) exists
 * before `GET /auth/me` hydrates the full profile. Sound by contract: the
 * backend rejects unverified logins, so a successful login implies a
 * verified email; `displayName` stays null until hydration fills it in.
 * `LoginResponse` carries no permissions, so the provisional user holds
 * none — permission-gated UI stays hidden (fail-closed) until hydration
 * fills them in.
 */
export function mapLoginResponseToProvisionalUser(response: LoginResponse): CurrentUser {
  return {
    id: response.userId,
    email: response.email,
    displayName: null,
    roles: [...response.roles],
    permissions: [],
    isEmailVerified: true,
    avatarUrl: null,
  };
}

/**
 * Shared contract mapping, re-exported here so feature code keeps a single
 * import site. The implementation lives in `@flux/auth` alongside the
 * `CurrentUser` model it produces.
 */
export { mapUserResponseToCurrentUser };

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
   * Full login workflow: token pair → provisional session → hydrated
   * current user → authenticated state. Emits the hydrated user; errors as
   * `ApiError` (`401` wrong credentials / unverified email / locked account
   * surface as the backend's localized `message`). No headers are attached
   * here — `GET /auth/me` is injected centrally (Sub-Phase 2.5).
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

  /**
   * Registration workflow: account creation → result state. Stores nothing
   * and authenticates nothing — the caller must present the pending /
   * verification UI from the returned result.
   */
  register(input: RegisterCustomerRequest): Observable<RegistrationResult> {
    return this.identity
      .register(input)
      .pipe(map((envelope) => toIdentityResult(requireEnvelopeData(envelope))));
  }

  /**
   * Email verification workflow (`POST /auth/verify-email`, single-use 24h
   * token from the email link). Returns the verified identity for display;
   * stores nothing and authenticates nothing — the caller must prompt a
   * login afterwards. Expired/unknown tokens surface as `ApiError`
   * (`401`/`404`) for the resend entry point.
   */
  verifyEmail(token: string): Observable<RegistrationResult> {
    return this.identity
      .verifyEmail({ token })
      .pipe(map((envelope) => toIdentityResult(requireEnvelopeData(envelope))));
  }

  /**
   * Resend-verification workflow (`POST /auth/resend-verification`,
   * unverified accounts only). Returns the backend send receipt verbatim —
   * the caller decides between "check your inbox" and "already verified,
   * sign in" copy from `emailSent`.
   */
  resendVerification(email: string): Observable<ResendVerificationResponse> {
    return this.identity
      .resendVerification({ email })
      .pipe(map((envelope) => requireEnvelopeData(envelope)));
  }

  /**
   * Forgot-password workflow (`POST /auth/forgot-password`). The backend
   * always answers `200` to block account enumeration, so callers present
   * the success UI unconditionally once the call itself succeeds.
   */
  forgotPassword(email: string): Observable<void> {
    return this.identity.forgotPassword({ email }).pipe(map(() => undefined));
  }

  /**
   * Reset-password workflow (`POST /auth/reset-password`, single-use 1h
   * token). Establishes nothing — the caller must prompt a login
   * afterwards. Unknown/expired tokens surface as `401 Identity.InvalidToken`.
   */
  resetPassword(input: ResetPasswordRequest): Observable<void> {
    return this.identity.resetPassword(input).pipe(map(() => undefined));
  }
}

/**
 * Maps a verified/registered `UserResponse` onto display copy. Shared by
 * registration and email verification — both hand the user an identity
 * without a session.
 */
function toIdentityResult(user: UserResponse): RegistrationResult {
  return {
    email: user.email,
    displayName: (user.displayName ?? `${user.firstName} ${user.lastName}`.trim()) || null,
    isEmailVerified: user.isEmailVerified,
  };
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
