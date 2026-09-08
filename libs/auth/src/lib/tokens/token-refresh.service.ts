/**
 * Refresh-token lifecycle for Sub-Phase 2.6 — Refresh Token Lifecycle.
 *
 * Scope: `docs/phases/PHASE_2_IDENTITY_AUTHENTICATION_IMPLEMENTATION_PLAN.md`
 * §4.6. Owns access-token renewal via `POST /auth/refresh`, single-flight
 * coordination across concurrent callers, rotated-pair propagation, and
 * cleanup on failure.
 *
 * Placement note: this service lives in `libs/auth` (not `libs/api`) on
 * purpose. It composes `IdentityApiService` (`libs/api`) with `AuthService`
 * / `TokenStorageService` (here); the reverse placement would add an
 * `api → auth` barrel edge next to the existing `auth → api` edge and trip
 * the no-circular-libraries architecture check. No `HttpClient` is touched
 * directly — transport stays `libs/api`-owned.
 *
 * How it works:
 *
 * ```text
 * 401 (×N concurrent) ──▶ refreshSession() ──▶ ONE POST /auth/refresh
 *        │                         │                    │
 *        │                         │              ┌─────┴─────┐
 *        │                         │              │           │
 *        │                         │           success      failure
 *        │                         │              │           │
 *        └──── shared ─────────────┘              │           │
 *         Observable<boolean>                replace pair   clear all
 *         (single-flight)                    return true    return false
 * ```
 *
 * - Single-flight: concurrent callers share one in-flight execution
 *   (`shareReplay`); the backend sees exactly one refresh per burst, and
 *   every joiner observes the same outcome. Late callers after termination
 *   start a fresh execution (rotation hazard beyond a burst is inherent to
 *   rotating tokens and is why 2.7 funnels concurrent 401s here).
 * - Success: the rotated pair is published to memory and storage. When a
 *   session is already authenticated, the access token is replaced;
 *   otherwise the stored snapshot establishes the in-memory session (the
 *   startup restore path, 2.8) — either way the stored snapshot keeps its
 *   user/timestamp with the new refresh token. Memory-only callers (no
 *   stored snapshot) fall back to the current user; a missing user is
 *   treated as failure.
 * - Failure (invalid/expired/reused refresh token, network error, dataless
 *   envelope, or no stored token at all): storage and `AuthService` state
 *   are cleared and `false` is emitted — the service never throws, so the
 *   2.7 pipeline can fall back to each caller's original error. Clearing
 *   from `initializing` is a safe no-op by `AuthService` rules (session
 *   restoration in 2.8 owns that decision).
 *
 * Loop prevention (2.6 guarantees, 2.7 composition contract):
 * - This service never calls itself: one execution issues exactly one
 *   refresh POST (no internal retries) — a failed refresh cannot recurse.
 * - `isRefreshRequest()` identifies the refresh endpoint so the 2.7
 *   pipeline excludes it from recovery (a refresh 401 must surface, never
 *   re-enter).
 * - Original-request retry belongs to 2.7: on `true`, retry the original
 *   request exactly once with centrally injected tokens; on `false`,
 *   propagate the original error.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 2.7 — no 401 interception, no pipeline hook, no request cloning/retry.
 * - 2.8 — no startup orchestration and no profile hydration here (this
 *   service only opens the session; restoration sequencing lives in
 *   `./session-restore.service`).
 * - 2.11 — no guards, no login redirects.
 */

import { inject, Injectable } from '@angular/core';
import { catchError, finalize, map, of, shareReplay, type Observable } from 'rxjs';
import { IDENTITY_ENDPOINTS, IdentityApiService } from '@flux/api';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage';

/**
 * Matches request URLs targeting the refresh endpoint (base URL agnostic)
 * so the 2.7 recovery pipeline can exclude them from refresh recursion.
 */
export function isRefreshRequest(url: string): boolean {
  return url.endsWith(IDENTITY_ENDPOINTS.refresh.path);
}

/**
 * Single-flight refresh lifecycle. Inject this — never call
 * `IdentityApiService.refresh` directly — wherever a fresh token pair is
 * needed (2.7 recovery; 2.8 restoration).
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshService {
  private readonly identity = inject(IdentityApiService);
  private readonly auth = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);

  /** Shared in-flight execution, or `null` when idle. */
  private inflight: Observable<boolean> | null = null;

  /**
   * Renews the token pair, joining the in-flight execution when one exists.
   * Emits `true` after the rotated pair is applied, `false` after cleanup
   * on any failure. Never errors.
   */
  refreshSession(): Observable<boolean> {
    const ongoing = this.inflight;
    if (ongoing !== null) {
      return ongoing;
    }
    const execution = this.executeRefresh().pipe(
      finalize(() => {
        if (this.inflight === execution) {
          this.inflight = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.inflight = execution;
    return execution;
  }

  /** One renewal attempt: exactly one refresh POST, no internal retries. */
  private executeRefresh(): Observable<boolean> {
    const stored = this.tokenStorage.loadSession();
    if (stored === null) {
      this.clearSessionState();
      return of(false);
    }
    return this.identity.refresh({ refreshToken: stored.refreshToken }).pipe(
      map((envelope) => {
        const rotated = envelope.data;
        // Re-read: a logout may have cleared storage while the POST was in
        // flight — never resurrect a torn-down session.
        const latest = this.tokenStorage.loadSession();
        const user = latest?.user ?? this.auth.currentUser();
        if (rotated === null || rotated === undefined || user === null || user === undefined) {
          this.clearSessionState();
          return false;
        }
        const authenticatedAtUtc = latest?.authenticatedAtUtc ?? new Date().toISOString();
        if (this.auth.isAuthenticated()) {
          this.auth.replaceAccessToken(rotated.accessToken);
        } else {
          // Establishment (startup restore path, 2.8): a stored snapshot
          // proves prior authentication, so the rotated pair opens the
          // in-memory session with it. Never fires without storage — the
          // user lookup above guarantees a snapshot existed.
          this.auth.setAuthenticated({
            user,
            accessToken: rotated.accessToken,
            authenticatedAtUtc,
          });
        }
        this.tokenStorage.replaceSession({
          refreshToken: rotated.refreshToken,
          user,
          authenticatedAtUtc,
        });
        return true;
      }),
      catchError(() => {
        this.clearSessionState();
        return of(false);
      }),
    );
  }

  /** Unrecoverable session: drop persistence and central state together. */
  private clearSessionState(): void {
    this.tokenStorage.clearSession();
    this.auth.clearSession();
  }
}
