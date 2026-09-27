import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '@flux/auth';
import { ADMIN_PORTAL_ROLES } from './admin-navigation';
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
 *     ├── catalog    → Phase 13 Catalog foundation (13.2+ lazy boundary)
 *     ├── inventory  → future (Phase 13, 13.8+)
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
 * Ordering rule (Angular matches top-down): the guarded shell comes before
 * the bare `''` auth boundary. A leading `''` + `loadChildren` entry would
 * swallow the empty URL (`/` matches the prefix while no child does, and
 * the router settles on an empty outlet instead of backtracking), so `/`
 * would render nothing and the guards would never redirect. The concrete
 * shell children fail cleanly for non-shell URLs (`login`, `forbidden`),
 * letting those fall through to their public entries below.
 */
export const routes: Routes = [
  {
    path: '',
    component: AppLayout,
    canActivate: [authGuard, roleGuard],
    data: { roles: [...ADMIN_PORTAL_ROLES] },
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
      {
        path: 'catalog',
        loadChildren: () =>
          import('./features/catalog/catalog.routes').then((m) => m.catalogRoutes),
      },
    ],
  },
  {
    path: 'forbidden',
    loadComponent: () => import('./layout/forbidden/forbidden-page').then((m) => m.ForbiddenPage),
  },
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.adminAuthRoutes),
  },
  {
    path: '**',
    loadComponent: () => import('./layout/not-found/not-found-page').then((m) => m.NotFoundPage),
  },
];
