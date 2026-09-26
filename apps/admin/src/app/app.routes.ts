import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '@flux/auth';
import { AppLayout } from './layout/app-layout/app-layout';

/**
 * Admin root routes (standalone) for Sub-Phase 12.1 — Admin Route &
 * Authorization Integration.
 *
 * Convention: the application shell stays eager while pages lazy-load
 * through `loadComponent` (or `loadChildren` feature boundaries) and live
 * under `./features/<feature>/`.
 *
 * Access model (existing `authGuard` + `roleGuard` chain, existing
 * `Admin`/`SuperAdmin` role model — no separate Admin authentication
 * system; backend authorization stays authoritative):
 *
 * ```text
 * /login      → anonymous entry point (public, outside the shell)
 * /forbidden  → denial destination (public, outside the shell)
 * / (+ children) → protected portal shell (Admin/SuperAdmin only)
 *     ├── ''         → shell home (protected)
 *     ├── dashboard  → protected entry point
 *     ├── catalog    → future (Phase 13)
 *     ├── inventory  → future (Phase 13)
 *     ├── orders     → future (Phase 14)
 *     └── payments   → future (Phase 14)
 * ```
 *
 * - Anonymous navigation to the shell redirects to
 *   `/login?returnUrl=<attempted URL>` (`authGuard`); post-login the page
 *   returns there (default `/dashboard`).
 * - Authenticated non-admin navigation lands on `/forbidden` (`roleGuard`).
 * - Guards wait out startup session restoration, so direct navigation and
 *   browser refresh resolve against the restored session, never against a
 *   premature anonymous verdict.
 */
export const routes: Routes = [
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.adminAuthRoutes),
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./layout/forbidden-page').then((m) => m.ForbiddenPage),
  },
  {
    path: '',
    component: AppLayout,
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Admin', 'SuperAdmin'] },
    children: [
      {
        path: '',
        loadComponent: () => import('./features/home/home-page').then((m) => m.HomePage),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./layout/not-found-page').then((m) => m.NotFoundPage),
  },
];
