import { Routes } from '@angular/router';
import { authGuard } from '@flux/auth';
import { CheckoutState } from './state/checkout-state';

/**
 * Storefront Checkout feature routes (Sub-Phase 8.2 — Checkout Feature &
 * Data Access — plus the Sub-Phase 8.3 feature-scoped `CheckoutState`).
 *
 * Mounted at `checkout` in `app.routes.ts`, so the entries below serve
 * `/checkout/*`.
 *
 * The lazy boundary, the authentication guard, and the feature-scoped
 * state live on the state-providing parent: `POST /orders/checkout` is
 * `[Authorize]`, so anonymous entry is blocked here by the shared Phase
 * 2 `authGuard` (redirect to `/login?returnUrl=`) — matching the §8.1
 * `blocked-anonymous` initialization outcome. Guest carts merge through
 * the Cart feature first; checkout never accepts a guest cart id
 * directly. The checkout page gets its own `CheckoutState` instance
 * (never a global store); form entry registers here in Sub-Phase 8.4 as
 * page orchestration driving `setFormData` — not as new global state.
 *
 * Architectural flow (ARCHITECTURE.md §10):
 *
 * ```text
 * Component (pages/ — 8.4, not this sub-phase)
 *     ↓ CheckoutState (feature-owned local Signals, provided here)
 *     ↓ CheckoutApiService (feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 */
export const checkoutRoutes: Routes = [
  {
    path: '',
    providers: [CheckoutState],
    canActivate: [authGuard],
    children: [
      // Sub-Phase 8.4 registers the checkout page here (default child),
      // inheriting this parent's guard and feature-scoped state.
    ],
  },
];
