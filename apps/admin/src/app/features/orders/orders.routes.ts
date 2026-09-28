import { Routes } from '@angular/router';
import { OrdersAdminApiService } from './data-access/orders-admin-api.service';
import { OrdersOverviewState } from './state/orders-overview-state';

/**
 * Admin Orders feature routes for Sub-Phase 14.2 — Admin Orders Feature
 * Foundation.
 *
 * Lazy feature boundary under the guarded portal shell (`path: 'orders'`
 * in `app.routes.ts` — the shell's `authGuard` + `roleGuard` chain already
 * admits `Admin`/`SuperAdmin` only, so no per-route guards duplicate it;
 * backend authorization stays authoritative. Note the orders endpoints
 * themselves are `[Authorize]` (any authenticated JWT, caller-owned) —
 * not `Admin`-only — so the portal shell is UX protection only).
 *
 * The API service and the overview state are provided once at the
 * feature root, so all orders pages share one transport seam and one
 * state family without root singletons or a global store.
 *
 * List, details, and payment routes arrive with the slices that own
 * their pages (Sub-Phases 14.3–14.8) — no placeholder routes ship in the
 * meantime.
 */
export const ordersRoutes: Routes = [
  {
    path: '',
    providers: [OrdersAdminApiService, OrdersOverviewState],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/orders-home/orders-home-page').then((m) => m.OrdersHomePage),
      },
    ],
  },
];
