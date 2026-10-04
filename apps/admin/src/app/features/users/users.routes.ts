import { Routes } from '@angular/router';
import { UserDetailsState } from './state/user-details-state';
import { UsersCountsState } from './state/users-counts-state';
import { UsersListState } from './state/users-list-state';

/**
 * Admin Users feature routes for Supplement S1, Step S1.5 — Admin Users
 * & Permissions (SuperAdmin-only management surface).
 *
 * Lazy feature boundary under the guarded portal shell (`path: 'users'`
 * in `app.routes.ts` — the mount carries `roleGuard` over
 * `['SuperAdmin']`, so only SuperAdmins arrive here; backend
 * authorization stays authoritative, and every users endpoint is
 * `SuperAdmin`-only server-side too).
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
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/user-details/user-details-page').then((m) => m.UserDetailsPage),
      },
    ],
  },
];
