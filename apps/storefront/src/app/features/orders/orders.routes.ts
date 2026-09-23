import { Routes } from '@angular/router';
import { OrderDetailsState } from './state/order-details-state';
import { OrdersListState } from './state/orders-list-state';

/**
 * Storefront Orders feature routes (Sub-Phases 10.1–10.4 — Orders
 * Contract Audit & Feature Foundation, Customer Account & Profile,
 * Orders List, Order Details).
 *
 * Mounted under `account/orders` via `./account.routes` (the §10.2
 * account shell — guarded, with the feature-scoped `AccountState`).
 * This table serves the §10.3 list page and the §10.4 details page.
 *
 * The lazy boundary and the feature-scoped states live on their
 * providers: the list page gets its own `OrdersListState` instance and
 * each details entry its own `OrderDetailsState` instance (never global
 * stores — neither has `providedIn`, both register here only). Entry
 * protection stays on the account parent (`authGuard` — UX protection
 * only, never the security boundary); ownership of every order read
 * stays backend-enforced (foreign ids mask as `404`).
 *
 * Architectural flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * OrdersListPage / OrderDetailsPage (pages/ — orchestration only)
 *     ↓ OrdersListState / OrderDetailsState (state/ — feature-owned local
 *       Signals, provided here)
 *     ↓ OrdersApiService (data-access/ — §10.1 thin typed façade)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 */
export const ordersRoutes: Routes = [
  {
    path: '',
    providers: [OrdersListState],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/orders-list-page/orders-list-page').then((m) => m.OrdersListPage),
      },
      {
        path: ':orderId',
        providers: [OrderDetailsState],
        loadComponent: () =>
          import('./pages/order-details-page/order-details-page').then((m) => m.OrderDetailsPage),
      },
    ],
  },
];
