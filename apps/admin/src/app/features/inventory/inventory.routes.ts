import { Routes } from '@angular/router';
import { InventoryAdminApiService } from './data-access/inventory-admin-api.service';
import { ReservationState } from './state/reservation-state';
import { StockState } from './state/stock-state';

/**
 * Admin Inventory feature routes for Sub-Phases 13.8–13.10 — Inventory
 * Foundation + Stock & Inventory Status + Reservations & Adjustments.
 *
 * Lazy feature boundary under the guarded portal shell (`path:
 * 'inventory'` in `app.routes.ts` — the shell's `authGuard` + `roleGuard`
 * chain already admits `Admin`/`SuperAdmin` only, so no per-route guards
 * duplicate it; backend authorization stays authoritative, and every
 * inventory endpoint is `Admin`-only server-side too).
 *
 * The API service and the lookup states are provided once at the feature
 * root, so inventory pages share one transport seam and one state family
 * without root singletons or a global store. Adjustment submission
 * state stays page-local (the smallest appropriate scope — no shared
 * store justifies a stateless, single-shot form).
 */
export const inventoryRoutes: Routes = [
  {
    path: '',
    providers: [InventoryAdminApiService, StockState, ReservationState],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/inventory-home/inventory-home-page').then((m) => m.InventoryHomePage),
      },
      {
        path: 'stock',
        loadComponent: () => import('./pages/stock/stock-page').then((m) => m.StockPage),
      },
      {
        path: 'reservations',
        loadComponent: () =>
          import('./pages/reservations/reservations-page').then((m) => m.ReservationsPage),
      },
      {
        path: 'adjustments',
        loadComponent: () =>
          import('./pages/adjustments/adjustments-page').then((m) => m.AdjustmentsPage),
      },
    ],
  },
];
