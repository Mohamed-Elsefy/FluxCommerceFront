import { Routes } from '@angular/router';
import { InventoryAdminApiService } from './data-access/inventory-admin-api.service';

/**
 * Admin Inventory feature routes for Sub-Phase 13.8 — Inventory Feature
 * Foundation.
 *
 * Lazy feature boundary under the guarded portal shell (`path:
 * 'inventory'` in `app.routes.ts` — the shell's `authGuard` + `roleGuard`
 * chain already admits `Admin`/`SuperAdmin` only, so no per-route guards
 * duplicate it; backend authorization stays authoritative, and every
 * inventory endpoint is `Admin`-only server-side too).
 *
 * The API service is provided once at the feature root, so the
 * 13.9–13.10 slices share one transport seam without root singletons
 * or a global store. Today's surface is the landing page only
 * (`/inventory`): stock, reservation, and adjustment routes arrive with
 * the slices that own their pages — no placeholder routes ship in the
 * meantime.
 */
export const inventoryRoutes: Routes = [
  {
    path: '',
    providers: [InventoryAdminApiService],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/inventory-home/inventory-home-page').then((m) => m.InventoryHomePage),
      },
    ],
  },
];
