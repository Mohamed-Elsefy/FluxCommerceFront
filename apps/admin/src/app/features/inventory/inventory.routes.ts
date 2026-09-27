import { Routes } from '@angular/router';
import { InventoryAdminApiService } from './data-access/inventory-admin-api.service';
import { StockState } from './state/stock-state';

/**
 * Admin Inventory feature routes for Sub-Phases 13.8–13.9 — Inventory
 * Foundation + Stock & Inventory Status.
 *
 * Lazy feature boundary under the guarded portal shell (`path:
 * 'inventory'` in `app.routes.ts` — the shell's `authGuard` + `roleGuard`
 * chain already admits `Admin`/`SuperAdmin` only, so no per-route guards
 * duplicate it; backend authorization stays authoritative, and every
 * inventory endpoint is `Admin`-only server-side too).
 *
 * The API service and the stock state are provided once at the feature
 * root, so inventory pages share one transport seam and one state
 * family without root singletons or a global store. Today's surface is
 * the landing page plus the stock lookup (`/inventory/stock`):
 * reservation and adjustment routes arrive with Sub-Phase 13.10 — no
 * placeholder routes ship in the meantime.
 */
export const inventoryRoutes: Routes = [
  {
    path: '',
    providers: [InventoryAdminApiService, StockState],
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
    ],
  },
];
