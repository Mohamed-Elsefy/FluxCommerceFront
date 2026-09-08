/**
 * Token storage abstraction and SSR-safe implementation for Sub-Phase 2.3 —
 * Token Storage & Session Model.
 *
 * Scope: `docs/phases/PHASE_2_IDENTITY_AUTHENTICATION_IMPLEMENTATION_PLAN.md`
 * §4.3. Source of truth for lifetimes and token shapes:
 * `docs/frontend-contract/AUTH_FLOW.md` (§3: access JWT 15m, opaque refresh
 * token 7d rotating, verify 24h, reset 1h) and `API_CONTRACT.md` §1.
 *
 * What is persisted vs what stays in memory:
 * - Persisted (`StoredSession`): the opaque REFRESH token + the `CurrentUser`
 *   snapshot + `authenticatedAtUtc`. The refresh token is the long-lived
 *   (7d) credential that makes session restoration (2.8) and rotation (2.6)
 *   possible across page reloads.
 * - Memory-only (`AuthService` signal, never written here): the short-lived
 *   access JWT (15m). It is re-minted via `POST /auth/refresh` whenever the
 *   app boots with a stored refresh token, so persisting it would add XSS
 *   surface for no benefit.
 * - Never stored anywhere: passwords, email-verification tokens,
 *   password-reset tokens.
 *
 * Storage decision: `localStorage` under a versioned key. Rationale:
 * - Survives tab/browser restarts, matching the 7d refresh-token lifetime
 *   (a `sessionStorage` choice would silently drop week-long sessions on tab
 *   close and force re-login).
 * - Synchronous API fits the startup-restoration path (2.8), which must read
 *   before the first guarded navigation resolves.
 * - `httpOnly` cookies would be strictly safer against XSS but require a
 *   backend cookie contract the API does not offer (auth is Bearer-JWT,
 *   `AUTH_FLOW.md` §2: "No cookies"); introducing one here would be contract
 *   drift. Revisit via ADR if a cookie contract ever lands.
 *
 * Security tradeoffs (explicit):
 * - XSS: any JS-readable store (localStorage/sessionStorage/memory) is
 *   readable by injected scripts — there is no XSS-proof browser store
 *   without backend cookies. Mitigations, in order: never render untrusted
 *   HTML (no `innerHTML` bypasses), strict backend token lifetimes (15m
 *   access / 7d rotating refresh — a stolen refresh token is revoked on
 *   first legitimate rotation and reuse yields `401 InvalidToken`), logout
 *   revokes server-side (2.9), and no passwords or raw credentials are ever
 *   persisted.
 * - SSR/hydration: server rendering must never touch `localStorage`
 *   (ReferenceError) and must never leak one user's session into another
 *   user's HTML. Every method below is platform-guarded: on the server all
 *   reads return `null` and all writes are no-ops, so SSR always renders the
 *   anonymous/initializing shell and the browser reconciles after hydration.
 * - Token lifetimes: the store keeps no expiry bookkeeping — expiry is the
 *   backend's verdict (`401` → refresh in 2.6/2.7, invalid → login). A stale
 *   entry costs one failed refresh, then cleanup.
 *
 * Lifecycle workflows (defined here, invoked by later sub-phases):
 * - Creation (2.4 login): `saveSession({ refreshToken, user,
 *   authenticatedAtUtc })` + `AuthService.setAuthenticated(...)`.
 * - Replacement (2.6 refresh rotation): `replaceSession(...)` overwrites the
 *   stored refresh token (and user snapshot when `GET /auth/me` re-syncs).
 * - Cleanup (2.9 logout, failed refresh in 2.6/2.7): `clearSession()` +
 *   `AuthService.clearSession()`.
 * - Restoration (2.8 startup): `loadSession()` on the browser only; null or
 *   corrupt → anonymous, no throw.
 *
 * Hard rules enforced below: every browser-API access is platform-guarded
 * and exception-safe (private-mode `SecurityError`, quota errors, corrupt
 * JSON all degrade to no-op/null — startup must never crash); nothing in
 * this file logs, interpolates, or otherwise exposes token values.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 2.4 — no login/registration flows or UI.
 * - 2.5 — no `ACCESS_TOKEN_PROVIDER` wiring; the interceptor pipeline is
 *   untouched.
 * - 2.6/2.7 — no refresh HTTP calls, no 401 handling, no retry loops.
 */

import { Injectable, InjectionToken, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { CurrentUser } from './auth-session';

/** Versioned key isolating the auth entry from every other local entry. */
export const AUTH_SESSION_STORAGE_KEY = 'fluxcommerce.auth.session.v1';

/**
 * Persisted session snapshot. Contains exactly what restoration (2.8) and
 * rotation (2.6) need — and nothing more.
 */
export interface StoredSession {
  /** Opaque refresh token (7d, rotating). Never logged, never rendered. */
  readonly refreshToken: string;
  /** Identity snapshot (mapped from `UserResponse` at login). */
  readonly user: CurrentUser;
  /** ISO-8601 timestamp of when the session became authenticated. */
  readonly authenticatedAtUtc: string;
}

/**
 * Token storage abstraction. Platform behavior is an implementation detail:
 * callers use these four lifecycle operations and stay SSR-agnostic.
 */
export interface TokenStorage {
  /**
   * Reads the persisted snapshot, or `null` when absent (server platform,
   * first visit, post-logout) or corrupt (cleared as a side effect).
   * Never throws.
   */
  loadSession(): StoredSession | null;
  /**
   * Persists a session snapshot (creation path). Overwrites any existing
   * entry. No-op on the server. Never throws.
   */
  saveSession(session: StoredSession): void;
  /**
   * Overwrites the persisted snapshot after token refresh rotation (2.6).
   * Semantically identical to `saveSession`; the distinct name keeps the
   * rotation call site explicit. Never throws.
   */
  replaceSession(session: StoredSession): void;
  /**
   * Removes any persisted snapshot (logout in 2.9, unrecoverable refresh
   * failure in 2.6/2.7). Idempotent. Never throws.
   */
  clearSession(): void;
}

/**
 * SSR-safe `localStorage` implementation. Every method guards on
 * `isPlatformBrowser` first (server: reads → `null`, writes → no-op) and
 * then on `try/catch` (private-mode denials, quota exhaustion, corrupt
 * payloads degrade silently — startup and logout must never crash).
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService implements TokenStorage {
  private readonly isBrowser: boolean;

  constructor() {
    this.isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  }

  loadSession(): StoredSession | null {
    if (!this.isBrowser) {
      return null;
    }
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    } catch {
      return null;
    }
    if (raw === null) {
      return null;
    }
    const session = parseStoredSession(raw);
    if (session === null) {
      this.clearSession();
    }
    return session;
  }

  saveSession(session: StoredSession): void {
    if (!this.isBrowser || !isStorableSession(session)) {
      return;
    }
    try {
      window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage unavailable or full: session simply does not survive reloads.
    }
  }

  replaceSession(session: StoredSession): void {
    this.saveSession(session);
  }

  clearSession(): void {
    if (!this.isBrowser) {
      return;
    }
    try {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    } catch {
      // Removal failure leaves at most a stale entry, which loadSession
      // treats as absent-or-corrupt; logout still clears in-memory state.
    }
  }
}

/**
 * DI seam for the storage abstraction. Defaults to the platform-guarded
 * `TokenStorageService`; tests override with fakes without touching
 * `localStorage`.
 */
export const TOKEN_STORAGE = new InjectionToken<TokenStorage>('TOKEN_STORAGE', {
  providedIn: 'root',
  factory: () => inject(TokenStorageService),
});

/**
 * Structural guard for untrusted persisted payloads. Rejects nulls,
 * wrong types, and empty secrets — the shape restoration (2.8) may trust.
 */
function isStorableSession(value: unknown): value is StoredSession {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate['refreshToken'] !== 'string' || candidate['refreshToken'].length === 0) {
    return false;
  }
  if (typeof candidate['authenticatedAtUtc'] !== 'string') {
    return false;
  }
  const user = candidate['user'];
  if (typeof user !== 'object' || user === null) {
    return false;
  }
  const userRecord = user as Record<string, unknown>;
  return (
    typeof userRecord['id'] === 'string' &&
    typeof userRecord['email'] === 'string' &&
    Array.isArray(userRecord['roles'])
  );
}

/** Parses a raw storage entry; `null` for anything unparseable or misshapen. */
function parseStoredSession(raw: string): StoredSession | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return isStorableSession(parsed) ? parsed : null;
}
