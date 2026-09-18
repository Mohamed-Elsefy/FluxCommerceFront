import { Routes } from '@angular/router';
import { authGuard } from '@flux/auth';
import { PaymentState } from './state/payment-state';

/**
 * Storefront Payments feature routes (Sub-Phase 9.2 — Payment Feature
 * Foundation).
 *
 * Mounted at `payment` in `app.routes.ts`, so the entries below serve
 * `/payment/:orderId` (payment page) and `/payment/:orderId/result`
 * (payment result page), per `docs/phases/PHASE_9_PAYMENTS.md` §9.10.
 *
 * The lazy boundary, the authentication guard, and the feature-scoped
 * state live on the state-providing parent: payment reads are `[Authorize]`
 * (plus ownership — foreign ids mask as `404`), so anonymous entry is
 * blocked here by the shared Phase 2 `authGuard` (redirect to
 * `/login?returnUrl=`). The payment pages get their own `PaymentState`
 * instance (never a global store — `PaymentState` has no `providedIn`
 * and registers here only); page orchestration driving it arrives in
 * Sub-Phase 9.6, while data access (9.3) and the provider boundary (9.5)
 * plug in underneath the state.
 *
 * Architectural flow (target — `ARCHITECTURE.md` §10; data-access and
 * state land in 9.3/9.4, the provider boundary in 9.5):
 *
 * ```text
 * PaymentPage / PaymentResultPage (pages/ — orchestration skeletons)
 *     ↓ PaymentState (9.4 — feature-owned local Signals, provided here)
 *     ↓ PaymentApiService (9.3 — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Payments API
 * ```
 */
export const paymentsRoutes: Routes = [
  {
    path: '',
    providers: [PaymentState],
    canActivate: [authGuard],
    children: [
      {
        path: ':orderId',
        loadComponent: () => import('./pages/payment-page/payment-page').then((m) => m.PaymentPage),
      },
      {
        path: ':orderId/result',
        loadComponent: () =>
          import('./pages/payment-result-page/payment-result-page').then(
            (m) => m.PaymentResultPage,
          ),
      },
    ],
  },
];
