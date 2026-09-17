import { Routes } from '@angular/router';
import { authGuard } from '@flux/auth';

/**
 * Storefront Checkout feature routes (Sub-Phase 8.2 — Checkout Feature &
 * Data Access).
 *
 * Mounted at `checkout` in `app.routes.ts`, so the entries below serve
 * `/checkout/*`.
 *
 * The lazy boundary plus the authentication guard live on the
 * state-providing parent: `POST /orders/checkout` is `[Authorize]`, so
 * anonymous entry is blocked here by the shared Phase 2 `authGuard`
 * (redirect to `/login?returnUrl=`) — matching the §8.1
 * `blocked-anonymous` initialization outcome. Guest carts merge through
 * the Cart feature first; checkout never accepts a guest cart id
 * directly.
 *
 * No page is registered yet: the checkout page, the feature-scoped
 * `CheckoutState` provider (8.3), and the form (8.4) arrive in later
 * sub-phases as children of this guarded parent — not as new global
 * state and not as a second guard.
 *
 * Architectural flow (ARCHITECTURE.md §10):
 *
 * ```text
 * Component (pages/ — 8.4, not this sub-phase)
 *     ↓ CheckoutState (feature-owned local Signals, provided here in 8.3)
 *     ↓ CheckoutApiService (feature data access, this sub-phase)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 */
export const checkoutRoutes: Routes = [
  {
    path: '',
    canActivate: [authGuard],
    children: [
      // Sub-Phase 8.4 registers the checkout page here (default child),
      // inheriting this parent's authentication guard.
    ],
  },
];
