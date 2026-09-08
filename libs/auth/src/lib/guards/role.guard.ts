/**
 * Role-based route guard for Sub-Phase 2.12 — Role Guards & Admin
 * Foundation.
 *
 * Scope: `docs/phases/PHASE_2_IDENTITY_AUTHENTICATION_IMPLEMENTATION_PLAN.md`
 * §4.12. A functional `canActivate` guard that enforces the backend role
 * model (`Customer` / `Admin` / `SuperAdmin`) on route tables:
 *
 * ```ts
 * { path: 'dashboard', canActivate: [authGuard, roleGuard],
 *   data: { roles: ['Admin', 'SuperAdmin'] }, ... }
 * ```
 *
 * Decision flow (prescribed composition first):
 *
 * ```text
 * Route ──▶ authGuard ──▶ Role Guard ──▶ Required Role? ──Yes──▶ allow
 *                                                │
 *                                                No ──▶ /forbidden
 * ```
 *
 * Rules (all covered by `./role.guard.spec`):
 * - Required roles come from `route.data['roles']` (string array, OR
 *   semantics — one match allows). Non-string entries are ignored; a
 *   missing or empty list denies (fail-closed — an unconfigured protected
 *   route must never open by accident).
 * - Claims mirror the backend verbatim: `SuperAdmin` does NOT imply
 *   `Admin` (backend policies are per-role `RequireRole(...)`). List every
 *   role a route admits.
 * - Like `authGuard`, initialization is awaited: roles are unknown while
 *   `initializing`, so the guard defers exactly once instead of denying a
 *   session that is still restoring.
 * - Denials return a `/forbidden` `UrlTree` (router-executed, no imperative
 *   navigate). Anonymous callers reaching this guard directly also land on
 *   `/forbidden` — sending them to login is `authGuard`'s job, which is why
 *   the plan composes the two in order.
 * - Backend authorization stays authoritative; this guard is navigation
 *   protection and UX, never a security boundary.
 *
 * Explicitly out of scope (later phases, must not appear here):
 * - Admin Portal modules (catalog/inventory/orders/payments UI).
 * - Shell UI (headers, menus, user display) — Sub-Phase 2.13.
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
 * Allows navigation when the current user holds any role listed in
 * `route.data['roles']`; otherwise redirects to `/forbidden`. Waits out
 * startup restoration before deciding.
 */
export const roleGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot,
): boolean | UrlTree | Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.initialized()) {
    return evaluateRole(auth, router, route);
  }
  return toObservable(auth.initialized).pipe(
    filter((initialized) => initialized),
    take(1),
    map(() => evaluateRole(auth, router, route)),
  );
};

/** Settles one evaluation against the current role snapshot. */
function evaluateRole(
  auth: AuthService,
  router: Router,
  route: ActivatedRouteSnapshot,
): boolean | UrlTree {
  const required = readRequiredRoles(route);
  if (required.length === 0) {
    return forbidden(router);
  }
  const roles = auth.roles();
  return required.some((role) => roles.includes(role)) ? true : forbidden(router);
}

/** Extracts the role allow-list; junk-tolerant, fail-closed. */
function readRequiredRoles(route: ActivatedRouteSnapshot): readonly string[] {
  const raw: unknown = route.data['roles'];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

/** Defers the denial to the router via `UrlTree` (no imperative navigate). */
function forbidden(router: Router): UrlTree {
  return router.createUrlTree(['/forbidden']);
}
