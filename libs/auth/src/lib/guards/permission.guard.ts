/**
 * Permission-based route guard for Supplement S1, Step S1.3 — Permission
 * Authorization Infrastructure.
 *
 * Scope: `docs/phases/SUPPLEMENT_S1_BACKEND_CONTRACT_EVOLUTION.md` §S1.3.
 * A functional `canActivate` guard that enforces the backend action-level
 * permission model (`Permission` catalog in `@flux/models`) on route
 * tables:
 *
 * ```ts
 * { path: 'catalog', canActivate: [authGuard, permissionGuard],
 *   data: { permissions: ['catalog.manage'] }, ... }
 * ```
 *
 * Decision flow (prescribed composition first):
 *
 * ```text
 * Route ──▶ authGuard ──▶ Permission Guard ──▶ Configured? ──No──▶ /forbidden
 *                                                  │
 *                                                 Yes
 *                                                  │
 *                                        SuperAdmin? ──Yes──▶ allow
 *                                            │
 *                                            No
 *                                            │
 *                              Required Permission? ──Yes──▶ allow
 *                                              │
 *                                              No ──▶ /forbidden
 * ```
 *
 * Rules (all covered by `./permission.guard.spec`):
 * - Required permissions come from `route.data['permissions']` (string
 *   array, OR semantics — one match allows). Non-string entries are
 *   ignored; a missing or empty list denies (fail-closed — an unconfigured
 *   protected route must never open by accident).
 * - `SuperAdmin` bypasses every configured permission gate (backend
 *   supremacy) even though it holds no `permission` claims — but the
 *   bypass never rescues an unconfigured route (fail-closed first). No
 *   other implication exists: roles never satisfy permissions and
 *   permissions never satisfy roles.
 * - Permissions mirror the last `GET /auth/me`: grants and revokes take
 *   effect on the next `me` sync (a demoted admin keeps the old value
 *   until then — the UI-layer counterpart of the backend's
 *   next-login/refresh semantics). The guard re-reads the live signal on
 *   every navigation, so no stale verdict survives a re-sync.
 * - Like `authGuard`, initialization is awaited: permissions are unknown
 *   while `initializing`, so the guard defers exactly once instead of
 *   denying a session that is still restoring.
 * - Denials return a `/forbidden` `UrlTree` (router-executed, no imperative
 *   navigate). Anonymous callers reaching this guard directly also land on
 *   `/forbidden` — sending them to login is `authGuard`'s job, which is why
 *   the plan composes the two in order.
 * - Backend authorization stays authoritative; this guard is navigation
 *   protection and UX, never a security boundary. `roleGuard` is kept for
 *   compatibility (role-only areas such as SuperAdmin user management).
 *
 * Explicitly out of scope (later steps, must not appear here):
 * - Feature pages, forms, or in-page action gating (S1.4–S1.10 gate
 *   buttons through `AuthService.hasPermission`, enforced by the backend).
 * - Permission editing UI (Step S1.5).
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
 * Allows navigation when the current user is `SuperAdmin` or holds any
 * permission listed in `route.data['permissions']`; otherwise redirects
 * to `/forbidden`. Waits out startup restoration before deciding.
 */
export const permissionGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  _state: RouterStateSnapshot,
): boolean | UrlTree | Observable<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.initialized()) {
    return evaluatePermissions(auth, router, route);
  }
  return toObservable(auth.initialized).pipe(
    filter((initialized) => initialized),
    take(1),
    map(() => evaluatePermissions(auth, router, route)),
  );
};

/** Settles one evaluation against the current permission snapshot. */
function evaluatePermissions(
  auth: AuthService,
  router: Router,
  route: ActivatedRouteSnapshot,
): boolean | UrlTree {
  const required = readRequiredPermissions(route);
  if (required.length === 0) {
    return forbidden(router);
  }
  if (auth.isSuperAdmin()) {
    return true;
  }
  const permissions = auth.permissions();
  return required.some((permission) => permissions.includes(permission)) ? true : forbidden(router);
}

/** Extracts the permission allow-list; junk-tolerant, fail-closed. */
function readRequiredPermissions(route: ActivatedRouteSnapshot): readonly string[] {
  const raw: unknown = route.data['permissions'];
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
}

/** Defers the denial to the router via `UrlTree` (no imperative navigate). */
function forbidden(router: Router): UrlTree {
  return router.createUrlTree(['/forbidden']);
}
