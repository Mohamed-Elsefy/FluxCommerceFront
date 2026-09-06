/**
 * Startup session restoration for Sub-Phase 2.8 — Session Restoration &
 * Current User.
 *
 * Scope: `docs/phases/PHASE_2_IDENTITY_AUTHENTICATION_IMPLEMENTATION_PLAN.md`
 * §4.8. Runs once per application bootstrap (via `provideSessionRestore()`)
 * and settles the central `AuthService` exactly once:
 *
 * ```text
 * Application Startup ──▶ start()
 *                             │
 *                    read stored session
 *                      ┌───────┴───────┐
 *                      │               │
 *                   missing      present ──▶ shared refresh (2.6)
 *                      │               │         │
 *                  Anonymous     ┌─────┴─────┐   │
 *                             success     failure
 *                                │           │
 *                         GET /auth/me   Anonymous
 *                        (central Bearer)    │
 *                      ┌─────┴─────┐         ▼
 *                   profile     401/404 → teardown → Anonymous
 *                      │         (user deleted or token rejected)
 *                 hydrate user
 *                      │
 *                 Authenticated
 * ```
 *
 * Non-blocking by design: `start()` returns void and settles state
 * asynchronously. Bootstrap, first paint, and hydration never wait on the
 * network; guards and components observe `AuthService.initialized` /
 * `isInitializing` and must not treat `initializing` as anonymous (the
 * 2.11 guard contract). The storageless path settles synchronously, so
 * anonymous startup stays fast and SSR-identical.
 *
 * Resilience rule for profile hydration: token validity (proven by a
 * successful rotation) is not profile availability. A `401`/`404` from
 * `GET /auth/me` — or a dataless envelope — proves the session is invalid
 * (deleted user, rejected token) and tears everything down to anonymous;
 * any other failure keeps the refreshed session with its stored snapshot — backend authorization
 * stays per-request authoritative, so a stale role snapshot cannot
 * escalate, and a transient outage does not log out a valid session.
 *
 * SSR safety: every browser-only access funnels through
 * `TokenStorageService` (platform-guarded: server reads are always null),
 * so the server path is unconditionally the fast anonymous branch — no
 * `localStorage` touches, no HTTP, no hydration mismatch beyond the
 * inherent post-hydration reconciliation that 2.13 shell work must render
 * neutrally until `initialized`.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 2.9 — no logout calls, no post-logout redirects.
 * - 2.10 — no verification or password-recovery flows.
 * - 2.11 — no guards (only the `initialized` primitive they will await).
 */

import { APP_INITIALIZER, EnvironmentProviders, inject, Injectable } from '@angular/core';
import { makeEnvironmentProviders } from '@angular/core';
import { catchError, map, of, switchMap, type Observable } from 'rxjs';
import { IdentityApiService } from '@flux/api';
import { AuthService } from './auth.service';
import { mapUserResponseToCurrentUser } from './auth-session';
import { TokenRefreshService } from './token-refresh.service';
import { TokenStorageService } from './token-storage';

/**
 * One-shot startup restoration. Inject this — never replicate the
 * read-refresh-hydrate sequence — wherever bootstrap sequencing is needed.
 */
@Injectable({ providedIn: 'root' })
export class SessionRestoreService {
  private readonly identity = inject(IdentityApiService);
  private readonly auth = inject(AuthService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly refresher = inject(TokenRefreshService);

  /** Guards re-entrant startup (initializer runs once; tests may not). */
  private started = false;

  /**
   * Kicks off restoration exactly once; safe to call again (no-op).
   * Never throws and never blocks the caller — completion lands in
   * `AuthService` state (`initialized` flips when settled).
   */
  start(): void {
    if (this.started || this.auth.status() !== 'initializing') {
      return;
    }
    this.started = true;
    this.restoreSession().subscribe({
      error: () => this.auth.markInitializedAnonymous(),
    });
  }

  /**
   * Restoration workflow. Emits `true` when the session is authenticated
   * (hydrated, or provisional after a non-invalid profile failure) and
   * `false` after settling to anonymous. Completes without error in every
   * designed path.
   */
  restoreSession(): Observable<boolean> {
    const stored = this.tokenStorage.loadSession();
    if (stored === null) {
      this.auth.markInitializedAnonymous();
      return of(false);
    }
    return this.refresher.refreshSession().pipe(
      switchMap((refreshed) => {
        if (!refreshed) {
          this.auth.markInitializedAnonymous();
          return of(false);
        }
        return this.identity.getCurrentUser().pipe(
          map((envelope): boolean => {
            if (envelope.data === null || envelope.data === undefined) {
              this.teardown();
              return false;
            }
            const user = mapUserResponseToCurrentUser(envelope.data);
            const latest = this.tokenStorage.loadSession();
            if (latest !== null) {
              this.tokenStorage.replaceSession({ ...latest, user });
            }
            this.auth.updateCurrentUser(user);
            return true;
          }),
          catchError((error: unknown): Observable<boolean> => {
            if (!isSessionInvalid(error)) {
              return of(true);
            }
            this.teardown();
            return of(false);
          }),
        );
      }),
    );
  }

  /** Invalid session: drop persistence and state, settle to anonymous. */
  private teardown(): void {
    this.tokenStorage.clearSession();
    this.auth.clearSession();
    this.auth.markInitializedAnonymous();
  }
}

/** Registration: runs restoration at startup without delaying bootstrap. */
export function provideSessionRestore(): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: (restorer: SessionRestoreService) => () => restorer.start(),
      deps: [SessionRestoreService],
    },
  ]);
}

/**
 * Session-invalid signals: the profile endpoint rejects the rotated
 * session (`401`) or the user is gone (`404`) — or the envelope is
 * dataless (handled inline). Anything else (network outage, 5xx) is
 * transient: the refreshed session stands on its stored snapshot.
 */
function isSessionInvalid(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const status = (error as { status?: unknown }).status;
  return status === 401 || status === 404;
}
