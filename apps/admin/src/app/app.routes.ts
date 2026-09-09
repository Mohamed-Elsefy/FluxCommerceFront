import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '@flux/auth';
import { AppLayout } from './layout/app-layout/app-layout';

/**
 * Admin root routes (standalone).
 *
 * Convention: the application shell stays eager while pages lazy-load
 * through `loadComponent`. Feature areas arriving in later phases follow
 * the same pattern (lazy `loadChildren` feature shells or `loadComponent`
 * pages) and live under `./features/<feature>/`.
 *
 * Protected foundation (Sub-Phase 2.12): `/dashboard` demands an
 * authenticated `Admin`/`SuperAdmin` session via the composed
 * `authGuard` + `roleGuard` chain; denials land on `/forbidden`. The
 * public root stays untouched so anonymous availability checks keep
 * passing — full portal protection arrives with later phases.
 */
export const routes: Routes = [
  {
    path: '',
    component: AppLayout,
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
        canActivate: [authGuard, roleGuard],
        data: { roles: ['Admin', 'SuperAdmin'] },
      },
      {
        path: 'forbidden',
        loadComponent: () => import('./layout/forbidden-page').then((m) => m.ForbiddenPage),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./layout/not-found-page').then((m) => m.NotFoundPage),
  },
];
