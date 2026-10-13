import { Routes } from '@angular/router';
import { authGuard, permissionGuard, roleGuard } from '@flux/auth';
import { ADMIN_PORTAL_ROLES } from './admin-navigation';
import { DashboardApiService } from './features/dashboard/data-access/dashboard-api.service';
import { DashboardState } from './features/dashboard/state/dashboard-state';
import { AppLayout } from './layout/app-layout/app-layout';

/**
 * Admin root routes (standalone) for Sub-Phase 12.1 — Admin Route &
 * Authorization Integration.
 *
 * Convention: the application shell stays eager while pages lazy-load
 * through `loadComponent` (or `loadChildren` feature boundaries) and live
 * under `./features/<feature>/`.
 *
 * Access model (two layers; backend authorization stays authoritative):
 *
 * ```text
 * /login      → anonymous entry point (public, outside the shell)
 * /forbidden  → denial destination (public, outside the shell)
 * / (+ children) → protected portal shell (Admin/SuperAdmin only)
 *     ├── ''         → redirect to `dashboard` (no shell home page)
 *     ├── dashboard  → open to every portal user (adaptive
 *     │                  per-permission sections; backend stays
 *     │                  authoritative, always `200`)
 *     ├── catalog    → `catalog.manage` (+ SuperAdmin bypass)
 *     ├── inventory  → `inventory.read` (+ SuperAdmin bypass; in-page
 *     │                  writes additionally need `inventory.manage`)
 *     └── orders     → `orders.read` (+ SuperAdmin bypass; in-page
 *                        cancel/refund additionally need `orders.cancel` /
 *                        `orders.refund`)
 *     ├── payments   → `payments.read` + `payments.stats` (OR semantics
 *     │                  + SuperAdmin bypass; list/details read through
 *     │                  `payments.read`, the stats landing through
 *     │                  `payments.stats`)
 *     └── users      → `users.read` (+ SuperAdmin bypass; reads through
 *                        `users.read`, writes and creation are
 *                        `SuperAdmin`-only, enforced on the child route
 *                        and server-side)
 * ```
 *
 * The shell chain (`authGuard` + `roleGuard` over `ADMIN_PORTAL_ROLES`)
 * stays the coarse gate — no separate Admin authentication system. Each
 * feature mount adds `permissionGuard` over its `data['permissions']`
 * (OR semantics, fail-closed, `SuperAdmin` bypass). Guards are navigation
 * protection and UX only, never a security boundary.
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
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        // Single-page entry: no child boundary, so its transport seam +
        // state live here (not in a `dashboard.routes.ts` — that file
        // would only re-wrap this one child). Every multi-page feature
        // above owns its `*.routes.ts` instead.
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
        providers: [DashboardApiService, DashboardState],
      },
      {
        path: 'catalog',
        loadChildren: () =>
          import('./features/catalog/catalog.routes').then((m) => m.catalogRoutes),
        canActivate: [permissionGuard],
        data: { permissions: ['catalog.manage'] },
      },
      {
        path: 'inventory',
        loadChildren: () =>
          import('./features/inventory/inventory.routes').then((m) => m.inventoryRoutes),
        canActivate: [permissionGuard],
        data: { permissions: ['inventory.read'] },
      },
      {
        path: 'orders',
        loadChildren: () => import('./features/orders/orders.routes').then((m) => m.ordersRoutes),
        canActivate: [permissionGuard],
        data: { permissions: ['orders.read'] },
      },
      {
        path: 'payments',
        loadChildren: () =>
          import('./features/payments/payments.routes').then((m) => m.paymentsRoutes),
        canActivate: [permissionGuard],
        data: { permissions: ['payments.read', 'payments.stats'] },
      },
      {
        path: 'users',
        loadChildren: () => import('./features/users/users.routes').then((m) => m.usersRoutes),
        canActivate: [permissionGuard],
        data: { permissions: ['users.read'] },
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
