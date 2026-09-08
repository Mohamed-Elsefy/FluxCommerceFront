/**
 * Central authentication state for Sub-Phase 2.2 — Authentication State &
 * Session Foundation.
 *
 * Scope: `docs/phases/PHASE_2_IDENTITY_AUTHENTICATION_IMPLEMENTATION_PLAN.md`
 * §4.2. This service is the SOLE owner and writer of authentication state
 * (`AuthState`, `AuthSession`, `CurrentUser` in `./auth-session`). Feature
 * components and services must consume its readonly signals and must never
 * manage authentication state independently.
 *
 * Transition rules (strict, deterministic — illegal calls are safe no-ops
 * that change nothing):
 *
 * ```text
 * initializing ──markInitializedAnonymous──▶ anonymous
 * initializing ──setAuthenticated──────────▶ authenticated   (restore path, 2.8)
 * anonymous ─────setAuthenticated──────────▶ authenticated   (login path, 2.4)
 * authenticated ─replaceAccessToken────────▶ authenticated   (rotation path, 2.6)
 * authenticated ─updateCurrentUser─────────▶ authenticated   (profile hydration, 2.5)
 * authenticated ─clearSession──────────────▶ anonymous       (logout path, 2.9)
 * any settled ───logout()──────────────────▶ anonymous       (backend revoke + redirect, 2.9)
 * ```
 *
 * Initialization semantics: every instance starts `initializing` with no
 * user, no session, and no token. Exactly one of `markInitializedAnonymous`
 * or `setAuthenticated` settles startup (performed by session restoration in
 * Sub-Phase 2.8 — not here). Guards must wait for `isInitializing() === false`
 * before treating the state as anonymous.
 *
 * Token handling:
 * - The access-token value lives in a private signal. It is never persisted,
 *   never logged, and never exposed as a settable signal.
 * - `readAccessToken()` feeds the Phase 1 `ACCESS_TOKEN_PROVIDER` seam
 *   (wired in Sub-Phase 2.5).
 * - The single backend call this service ever makes is `POST /auth/logout`
 *   inside `logout()` (Sub-Phase 2.9). Refresh, retry, and all other HTTP
 *   stay in their owning services (`TokenRefreshService`, feature
 *   data-access) — this service never imports `ApiClient` directly.
 */

import { Injectable, computed, inject, signal, type Signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, of, type Observable } from 'rxjs';
import { IdentityApiService } from '@flux/api';
import type { AuthSession, AuthState, CurrentUser } from './auth-session';
import { TokenStorageService } from './token-storage';

/** Input for establishing an authenticated session (login in 2.4, restore in 2.8). */
export interface AuthenticatedSessionInput {
  /** Identity the session belongs to (mapped from `UserResponse` by data-access). */
  readonly user: CurrentUser;
  /** Short-lived JWT (15m) — kept in memory only, never persisted or logged. */
  readonly accessToken: string;
  /**
   * Session start timestamp (ISO-8601). Defaults to the current time when
   * omitted; restoration (2.8) may pass the original value through.
   */
  readonly authenticatedAtUtc?: string;
}

/** Options for `AuthService.logout`. */
export interface LogoutOptions {
  /**
   * Post-logout destination. Defaults to `/` (public home). Same-origin
   * paths only — anything else falls back to `/` to block open redirects.
   */
  readonly redirectTo?: string;
}

/**
 * The single typed gateway to authentication state. Inject this — never
 * replicate auth signals — in guards, shells, and feature selectors.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly identity = inject(IdentityApiService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);
  private readonly _status = signal<AuthState>('initializing');
  private readonly _currentUser = signal<CurrentUser | null>(null);
  private readonly _session = signal<AuthSession | null>(null);
  private readonly _accessToken = signal<string | null>(null);

  /** Current lifecycle state (`initializing` until restoration settles it). */
  readonly status: Signal<AuthState> = this._status.asReadonly();

  /** True while startup restoration has not settled (guards must wait). */
  readonly isInitializing: Signal<boolean> = computed(() => this._status() === 'initializing');

  /**
   * True once startup restoration has settled (anonymous or authenticated).
   * The documented guard-wait primitive for Sub-Phase 2.11: guards derive
   * readiness from this (e.g. waiting for the first `true`) and must never
   * treat `initializing` as anonymous.
   */
  readonly initialized: Signal<boolean> = computed(() => this._status() !== 'initializing');

  /** True only when a live session exists. */
  readonly isAuthenticated: Signal<boolean> = computed(() => this._status() === 'authenticated');

  /** True only when settled without a session. Never true while initializing. */
  readonly isAnonymous: Signal<boolean> = computed(() => this._status() === 'anonymous');

  /** Current user, or `null` unless authenticated. */
  readonly currentUser: Signal<CurrentUser | null> = this._currentUser.asReadonly();

  /** Session metadata snapshot, or `null` unless authenticated. */
  readonly session: Signal<AuthSession | null> = this._session.asReadonly();

  /** Role names of the current user; empty when not authenticated. */
  readonly roles: Signal<readonly string[]> = computed(() => this._currentUser()?.roles ?? []);

  /** Whether the current user holds the backend `Admin` role (strict claim mirror — see `hasRole`). */
  readonly isAdmin: Signal<boolean> = computed(() => this.roles().includes('Admin'));

  /** Whether an access token is currently held in memory. */
  readonly hasAccessToken: Signal<boolean> = computed(() => this._accessToken() !== null);

  /**
   * Reactive role selector. Mirrors the backend role claim verbatim:
   * `SuperAdmin` does NOT imply `Admin` here because the backend
   * `Admin` policy is `RequireRole("Admin")` — the backend stays
   * authoritative and exact required-role semantics ship with the role
   * guards in Sub-Phase 2.12.
   */
  hasRole(role: string): Signal<boolean> {
    return computed(() => this.roles().includes(role));
  }

  /**
   * Reserved synchronous reader for the Phase 1 `ACCESS_TOKEN_PROVIDER`
   * seam. Returns the in-memory JWT, or `null` when absent. Wiring the
   * provider to this reader is Sub-Phase 2.5 — this method performs no
   * injection and touches no interceptor. Never log its return value.
   */
  readAccessToken(): string | null {
    return this._accessToken();
  }

  /**
   * Settles startup without a session: `initializing → anonymous`.
   * No-op from any other state. Called once by session restoration (2.8).
   */
  markInitializedAnonymous(): void {
    if (this._status() !== 'initializing') {
      return;
    }
    this._status.set('anonymous');
  }

  /**
   * Establishes a session: `initializing|anonymous → authenticated`.
   * No-op when already authenticated (rotation uses `replaceAccessToken`).
   * Called by login (2.4) and session restoration (2.8).
   */
  setAuthenticated(input: AuthenticatedSessionInput): void {
    const status = this._status();
    if (status !== 'initializing' && status !== 'anonymous') {
      return;
    }
    const authenticatedAtUtc = input.authenticatedAtUtc ?? new Date().toISOString();
    this._accessToken.set(input.accessToken);
    this._currentUser.set(input.user);
    this._session.set({
      userId: input.user.id,
      hasAccessToken: true,
      authenticatedAtUtc,
    });
    this._status.set('authenticated');
  }

  /**
   * Replaces the in-memory access token without disturbing user or status:
   * allowed only while `authenticated`. No-op otherwise. Reserved for token
   * rotation in Sub-Phase 2.6.
   */
  replaceAccessToken(accessToken: string): void {
    if (this._status() !== 'authenticated') {
      return;
    }
    this._accessToken.set(accessToken);
    const session = this._session();
    if (session !== null) {
      this._session.set({ ...session, hasAccessToken: true });
    }
  }

  /**
   * Replaces the current-user snapshot without disturbing token, session
   * metadata (except the owning user id), or status: allowed only while
   * `authenticated`. No-op otherwise. Supports post-login profile hydration
   * (`GET /auth/me` in Sub-Phase 2.5) and future `me` re-syncs.
   */
  updateCurrentUser(user: CurrentUser): void {
    if (this._status() !== 'authenticated') {
      return;
    }
    this._currentUser.set(user);
    const session = this._session();
    if (session !== null) {
      this._session.set({ ...session, userId: user.id });
    }
  }

  /**
   * Tears down the session: `authenticated → anonymous`, clearing user,
   * session metadata, and the in-memory token. Idempotent no-op when
   * already anonymous; never settles `initializing` (restoration in 2.8
   * owns that decision). Backend revocation happens in `logout()`, below.
   */
  clearSession(): void {
    if (this._status() === 'initializing') {
      return;
    }
    this._accessToken.set(null);
    this._currentUser.set(null);
    this._session.set(null);
    this._status.set('anonymous');
  }

  /**
   * Complete logout workflow for Sub-Phase 2.9 (plan §4.9):
   * backend revocation → local cleanup → anonymous → redirect.
   *
   * - When a refresh token is stored, `POST /auth/logout` revokes it
   *   server-side (idempotent by contract). Any backend failure — network
   *   error, 5xx, or no stored token at all — is swallowed: local cleanup
   *   ALWAYS runs, so a failed revoke can never orphan an authenticated
   *   client state. Callers observe exactly one outcome: completion.
   * - Cleanup is total: persisted snapshot (`TokenStorageService`), the
   *   in-memory token, current user, session metadata, and every derived
   *   signal (`roles`, `isAdmin`, `hasAccessToken`, ...). An in-flight
   *   shared refresh (2.6) needs no reset — it re-reads storage on apply
   *   and declines instead of resurrecting.
   * - Completing navigates to `options.redirectTo` (default `/`). The
   *   observable is cold: subscribe to execute.
   * - Never settles `initializing` (same rule as `clearSession`): a logout
   *   raced with startup restoration still steers restoration to anonymous
   *   because storage is cleared first.
   */
  logout(options: LogoutOptions = {}): Observable<void> {
    const refreshToken = this.tokenStorage.loadSession()?.refreshToken;
    const revoke =
      refreshToken === undefined
        ? of(null)
        : this.identity.logout({ refreshToken }).pipe(catchError(() => of(null)));
    return revoke.pipe(
      map(() => {
        this.tokenStorage.clearSession();
        this.clearSession();
        void this.router.navigateByUrl(this.safeRedirect(options.redirectTo));
      }),
    );
  }

  /** Same-origin redirect guard (mirrors the 2.4 login return-URL rule). */
  private safeRedirect(candidate: string | undefined): string {
    if (candidate !== undefined && candidate.startsWith('/') && !candidate.startsWith('//')) {
      return candidate;
    }
    return '/';
  }
}
