import { Routes } from '@angular/router';
import { roleGuard } from '@flux/auth';
import { UserDetailsState } from './state/user-details-state';
import { UsersCountsState } from './state/users-counts-state';
import { UsersListState } from './state/users-list-state';

/**
 * Admin Users feature routes for Supplement S3, Step S3.3 — Users
 * Write Re-centralization (delegated reads, SuperAdmin writes).
 *
 * Lazy feature boundary under the guarded portal shell (`path: 'users'`
 * in `app.routes.ts` — the mount carries `permissionGuard` over
 * `['users.read']` (fail-closed, SuperAdmin bypass), so readers arrive
 * here; backend authorization stays authoritative, and every users
 * endpoint is gated server-side too (reads by `users.read`, writes by
 * `SuperAdmin`).
 *
 * The `new` child route requires the `SuperAdmin` role (creation is
 * not delegable — the list page links there only for SuperAdmins, but
 * the route guard enforces it).
 *
 * No feature data-access service: list/counts/details/permission reads
 * and submissions (including admin creation via `registerAdmin`) go
 * through the shared `IdentityApiService` (`@flux/api`, S1.2) directly —
 * no façade duplicates a thin typed transport that already exists
 * (rules 12.11/Phase-12: no parallel admin transport). The three feature
 * states are provided once at the feature root, so all users pages share
 * one state family without root singletons or a global store. Route order
 * matters: the static `list` and `new` segments precede the `:id`
 * sibling (top-down matching — neither must parse as an id).
 */
export const usersRoutes: Routes = [
  {
    path: '',
    providers: [UsersListState, UsersCountsState, UserDetailsState],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/users-home/users-home-page').then((m) => m.UsersHomePage),
      },
      {
        path: 'list',
        loadComponent: () =>
          import('./pages/users-list/users-list-page').then((m) => m.UsersListPage),
      },
      {
        path: 'new',
        loadComponent: () =>
          import('./pages/user-create/user-create-page').then((m) => m.UserCreatePage),
        canActivate: [roleGuard],
        data: { roles: ['SuperAdmin'] },
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/user-details/user-details-page').then((m) => m.UserDetailsPage),
      },
    ],
  },
];
