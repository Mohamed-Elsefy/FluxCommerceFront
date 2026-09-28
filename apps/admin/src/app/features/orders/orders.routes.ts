import { Routes } from '@angular/router';
import { OrdersAdminApiService } from './data-access/orders-admin-api.service';
import { OrderDetailsState } from './state/order-details-state';
import { OrderListState } from './state/orders-list-state';
import { OrderPaymentState } from './state/order-payment-state';
import { OrdersOverviewState } from './state/orders-overview-state';

/**
 * Admin Orders feature routes for Sub-Phases 14.2–14.6 — Admin Orders
 * Feature Foundation + Orders List & Pagination + Orders Filtering &
 * Status Presentation + Order Details & Customer Information + Payment
 * Integration & Order-Payment Presentation.
 *
 * Lazy feature boundary under the guarded portal shell (`path: 'orders'`
 * in `app.routes.ts` — the shell's `authGuard` + `roleGuard` chain already
 * admits `Admin`/`SuperAdmin` only, so no per-route guards duplicate it;
 * backend authorization stays authoritative. Note the orders endpoints
 * themselves are `[Authorize]` (any authenticated JWT, caller-owned) —
 * not `Admin`-only — so the portal shell is UX protection only).
 *
 * The API service and every feature state are provided once at the
 * feature root, so all orders pages share one transport seam and one
 * state family without root singletons or a global store. Route order
 * matters: the static `list` segment precedes the `:id` sibling
 * (top-down matching — `list` must not parse as an id).
 *
 * Payment routes arrive with the slices that own their pages
 * (Sub-Phases 14.7–14.8) — no placeholder routes ship in the meantime.
 */
export const ordersRoutes: Routes = [
  {
    path: '',
    providers: [
      OrdersAdminApiService,
      OrdersOverviewState,
      OrderListState,
      OrderDetailsState,
      OrderPaymentState,
    ],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/orders-home/orders-home-page').then((m) => m.OrdersHomePage),
      },
      {
        path: 'list',
        loadComponent: () =>
          import('./pages/orders-list/orders-list-page').then((m) => m.OrdersListPage),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/order-details/order-details-page').then((m) => m.OrderDetailsPage),
      },
    ],
  },
];
