/**
 * Centralized 401 recovery interceptor for Sub-Phase 2.7 — Centralized
 * 401 Recovery.
 *
 * Scope: `docs/phases/PHASE_2_IDENTITY_AUTHENTICATION_IMPLEMENTATION_PLAN.md`
 * §4.7. Completes the HTTP authentication pipeline by funneling
 * refresh-eligible `401 Unauthorized` responses through the single-flight
 * refresh mechanism (Sub-Phase 2.6) and retrying each original request at
 * most once.
 *
 * Pipeline position (see `API_INTERCEPTORS` in `../client/api-providers`):
 * recovery sits UPSTREAM of `authInterceptor` on purpose. Outbound requests
 * pass through untouched; on the way back this interceptor observes the
 * normalized `ApiError` produced by the innermost
 * `httpErrorHookInterceptor`. A retry re-enters downstream interceptors, so
 * `authInterceptor` re-executes and attaches the freshly rotated token —
 * recovery itself never reads, writes, or forwards token values.
 *
 * Rule set (all enforced below, all covered by `./auth-recovery.spec`):
 * - Only normalized `ApiError`s with `status === 401` enter recovery;
 *   every other failure (400/403/404/409/500, network, cancellation)
 *   propagates untouched.
 * - Eligibility is URL-based: `/auth/login`, `/auth/register`, and
 *   `/auth/refresh` never trigger recovery (a refresh 401 must surface,
 *   never re-enter — the loop-prevention half owned here; single-flight
 *   de-duplication is the 2.6 half).
 * - At most one retry per request: retried clones are tracked in a
 *   `WeakSet`, so a second 401 propagates instead of looping. Retries keep
 *   the original correlation headers (same logical flow).
 * - Refresh outcome comes from `AUTH_RECOVERY_PROVIDER` (same seam pattern
 *   as `ACCESS_TOKEN_PROVIDER`): `true` → retry once; `false`, or a
 *   faulting provider, → the ORIGINAL error propagates (never the
 *   refresh error — callers see the request that actually failed them).
 *   The default provider declines (`of(false)`), keeping anonymous traffic
 *   exactly as before until Phase 2 overrides it.
 * - Cancellation: teardown propagates through `recover()` into the shared
 *   refresh execution — an aborted caller dispatches no retry and observes
 *   no error. (The shared single-flight POST itself survives while other
 *   joiners remain; each caller still tears down cleanly.)
 *
 * Session clearing on unrecoverable failure lives in the 2.6 refresh
 * service, not here — this interceptor only routes outcomes.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 2.8 — no startup restoration, no initialization handling.
 * - 2.9 — no logout calls, no post-logout redirects.
 * - 2.11 — no guards, no login navigation.
 */

import { HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { InjectionToken, inject } from '@angular/core';
import { catchError, of, switchMap, throwError, type Observable } from 'rxjs';
import { IDENTITY_ENDPOINTS } from '../contracts/api-endpoints';
import { isApiError } from '../runtime/error-normalizer';

/**
 * Recovery attempt hook: renews the token pair and reports the outcome.
 * `true` = rotated (safe to retry once); `false` = unrecoverable.
 * Implementations must never throw — a faulting provider is treated as
 * `false` — and must never dispatch application retries themselves.
 */
export type UnauthorizedRecovery = () => Observable<boolean>;

/**
 * Integration seam for 401 recovery. Defaults to declining (anonymous
 * behavior preserved); overridden by Phase 2 with the single-flight
 * refresh implementation (`provideAuthRecovery` in `@flux/auth`).
 */
export const AUTH_RECOVERY_PROVIDER = new InjectionToken<UnauthorizedRecovery>(
  'AUTH_RECOVERY_PROVIDER',
  { providedIn: 'root', factory: () => () => of(false) },
);

/** Endpoints whose 401s must surface directly, never enter recovery. */
const RECOVERY_EXCLUDED_PATHS: readonly string[] = [
  IDENTITY_ENDPOINTS.login.path,
  IDENTITY_ENDPOINTS.register.path,
  IDENTITY_ENDPOINTS.refresh.path,
];

/**
 * Refresh-eligibility predicate (base-URL agnostic suffix match).
 * Everything not explicitly excluded is eligible — including
 * `GET /auth/me`, whose expiry-driven 401 is the primary recovery case.
 */
export function isRecoveryEligible(url: string): boolean {
  return !RECOVERY_EXCLUDED_PATHS.some((path) => url.endsWith(path));
}

/**
 * Requests already retried once. Retries are clones (fresh object
 * identities), so marking them bounds every logical request to a single
 * retry with no header or context pollution.
 */
const retriedRequests = new WeakSet<HttpRequest<unknown>>();

/** Recovers eligible 401s via the seam provider and retries once. */
export const authRecoveryInterceptor: HttpInterceptorFn = (req, next) => {
  const recover = inject(AUTH_RECOVERY_PROVIDER);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (!isApiError(error) || error.status !== 401) {
        return throwError(() => error);
      }
      if (!isRecoveryEligible(req.url) || retriedRequests.has(req)) {
        return throwError(() => error);
      }
      return recover().pipe(
        catchError(() => of(false)),
        switchMap((refreshed) => {
          if (!refreshed) {
            return throwError(() => error);
          }
          const retry = req.clone();
          retriedRequests.add(retry);
          return next(retry);
        }),
      );
    }),
  );
};
