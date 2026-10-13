import { Routes } from '@angular/router';
import { InventoryAdminApiService } from './data-access/inventory-admin-api.service';
import { InventoryCountsState } from './state/inventory-counts-state';
import { ReservationListState } from './state/reservation-list-state';
import { ReservationState } from './state/reservation-state';
import { StockListState } from './state/stock-list-state';
import { StockState } from './state/stock-state';

/**
 * Admin Inventory feature routes for Sub-Phases 13.8–13.10 — Inventory
 * Foundation + Stock & Inventory Status + Reservations & Adjustments —
 * plus Supplement S1, Step S1.7 (list surfaces).
 *
 * Lazy feature boundary under the guarded portal shell (`path:
 * 'inventory'` in `app.routes.ts` — the shell's `authGuard` + `roleGuard`
 * chain plus the `inventory.read` permission mount admit the portal;
 * backend authorization stays authoritative, and every inventory read
 * is `inventory.read` server-side).
 *
 * List pages own `stock` and `reservations`; the single-lookup pages
 * stay as deep-link targets (`stock/:sku`, `reservations/:id` —
 * reachable from list rows, bookmarks, and post-mutation links). The
 * lookup components serve both entries: a present route param
 * auto-loads, its absence leaves the manual lookup form.
 *
 * The API service and the inventory states are provided once at the
 * feature root, so all pages share one transport seam and one state
 * family without root singletons or a global store. Adjustment
 * submission state stays page-local (the smallest appropriate scope —
 * no shared store justifies a stateless, single-shot form). Route order
 * matters: static segments precede their `:param` siblings (top-down
 * matching — `list`-style words must not parse as ids; here `stock`
 * precedes `stock/:sku` structurally by nesting).
 */
export const inventoryRoutes: Routes = [
  {
    path: '',
    providers: [
      InventoryAdminApiService,
      StockState,
      ReservationState,
      StockListState,
      ReservationListState,
      InventoryCountsState,
    ],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/inventory-home/inventory-home-page').then((m) => m.InventoryHomePage),
      },
      {
        path: 'stock',
        loadComponent: () =>
          import('./pages/stock-list/stock-list-page').then((m) => m.StockListPage),
      },
      {
        path: 'stock/:sku',
        loadComponent: () => import('./pages/stock/stock-page').then((m) => m.StockPage),
      },
      {
        path: 'reservations',
        loadComponent: () =>
          import('./pages/reservation-list/reservation-list-page').then(
            (m) => m.ReservationListPage,
          ),
      },
      {
        path: 'reservations/:id',
        loadComponent: () =>
          import('./pages/reservations/reservations-page').then((m) => m.ReservationsPage),
      },
      {
        path: 'adjustments',
        loadComponent: () =>
          import('./pages/adjustments/adjustments-page').then((m) => m.AdjustmentsPage),
      },
      {
        path: 'new',
        loadComponent: () => import('./pages/new-item/new-item-page').then((m) => m.NewItemPage),
      },
    ],
  },
];
