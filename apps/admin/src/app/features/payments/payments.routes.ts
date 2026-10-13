import { Routes } from '@angular/router';
import { PaymentsAdminApiService } from './data-access/payments-admin-api.service';
import { PaymentDetailsState } from './state/payment-details-state';
import { PaymentsListState } from './state/payments-list-state';
import { PaymentsStatsState } from './state/payments-stats-state';

/**
 * Admin Payments feature routes for Supplement S1, Step S1.9 —
 * Payments: Mine + Admin + Stats.
 *
 * Lazy feature boundary under the guarded portal shell (`path:
 * 'payments'` in `app.routes.ts` — the mount carries `permissionGuard`
 * over `['payments.read', 'payments.stats']` (OR semantics, SuperAdmin
 * bypass), so the list/details (`payments.read`) and the stats landing
 * (`payments.stats`) each resolve their own authorization; backend
 * authorization stays authoritative).
 *
 * The API service and every feature state are provided once at the
 * feature root, so all payments pages share one transport seam and one
 * state family without root singletons or a global store. Route order
 * matters: the static `list` segment precedes the `:id` sibling
 * (top-down matching — `list` must not parse as an id).
 *
 * No history route ships (no such endpoint — see
 * `ADMIN_PAYMENT_HISTORY_SUPPORTED`); no mutation route ships (none
 * exist — the admin surface is read-only).
 */
export const paymentsRoutes: Routes = [
  {
    path: '',
    providers: [
      PaymentsAdminApiService,
      PaymentsStatsState,
      PaymentsListState,
      PaymentDetailsState,
    ],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/payments-home/payments-home-page').then((m) => m.PaymentsHomePage),
      },
      {
        path: 'list',
        loadComponent: () =>
          import('./pages/payments-list/payments-list-page').then((m) => m.PaymentsListPage),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/payment-details/payment-details-page').then((m) => m.PaymentDetailsPage),
      },
    ],
  },
];
