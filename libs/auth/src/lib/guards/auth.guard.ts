/**
 * Authentication route guard for Sub-Phase 2.11 — Authentication Guards.
 *
 * Scope: `docs/phases/PHASE_2_IDENTITY_AUTHENTICATION_IMPLEMENTATION_PLAN.md`
 * §4.11. A functional `canActivate` guard shared by the Storefront and
 * Admin applications. Route tables opt in per route (`canActivate:
 * [authGuard]`); the guard itself stays decoupled from every feature.
 *
 * Decision flow (the critical rule: `initializing` is unknown, never
 * anonymous — no premature login redirects on application load):
 *
 * ```text
 * Route ──▶ authGuard ──▶ Authenticated? ──Yes──▶ allow
 *                              │
 *                              No
 *                              │
 *                    Initializing? ──Yes──▶ wait for `initialized`,
 *                              │           then re-evaluate once
 *                              No
 *                              │
 *                    redirect to /login?returnUrl=<attempted URL>
 * ```
 *
 * - Authenticated evaluations are synchronous (`true`).
 * - Anonymous evaluations return a `UrlTree` (never an imperative
 *   `navigate` call — the router performs the redirect itself, keeping the
 *   navigation cancellable and testable). The attempted URL, query string
 *   included, travels as `returnUrl` so the login page (2.4) can send the
 *   user back after signing in. Its same-origin validation already lives
 *   there.
 * - Initializing evaluations return an observable that resolves exactly
 *   once restoration settles. A restore that lands authenticated allows;
 *   one that lands anonymous redirects. The guard never times out on its
 *   own: pending longer than restoration is safer than redirecting wrongly.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 2.12 — no role checks (`Admin`/`Customer`/`SuperAdmin`), no protected
 *   Admin route configuration, no forbidden handling.
 * - 2.13 — no shell UI, no user display, no header integration.
 */

import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { filter, map, take, type Observable } from 'rxjs';
import { AuthService } from '../state/auth.service';

/**
 * Allows authenticated navigation; redirects anonymous navigation to
 * `/login` with the attempted URL preserved as `returnUrl`; waits out
 * startup restoration before deciding either way.
 */
export const authGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): boolean | UrlTree | Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    return true;
  }
  if (!auth.isInitializing()) {
    return loginRedirect(router, state.url);
  }
  return toObservable(auth.initialized).pipe(
    filter((initialized) => initialized),
    take(1),
    map(() => (auth.isAuthenticated() ? true : loginRedirect(router, state.url))),
  );
};

/** Defers the redirect to the router via `UrlTree` (no imperative navigate). */
function loginRedirect(router: Router, returnUrl: string): UrlTree {
  return router.createUrlTree(['/login'], { queryParams: { returnUrl } });
}
