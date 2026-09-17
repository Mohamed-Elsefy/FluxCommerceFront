import { Routes } from '@angular/router';
import { authGuard } from '@flux/auth';
import { CheckoutState } from './state/checkout-state';
import { CartState } from '../cart/state/cart-state';
import { GuestCartService } from '../cart/state/guest-cart.service';
import { AuthenticatedCartService } from '../cart/state/authenticated-cart.service';

/**
 * Storefront Checkout feature routes (Sub-Phase 8.2 — Checkout Feature &
 * Data Access — plus the Sub-Phase 8.3 feature-scoped `CheckoutState`,
 * the Sub-Phase 8.6 checkout page and cart lifecycle seams).
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
 * (never a global store) plus the cart feature's `CartState` and
 * session lifecycle (the product-details pattern — one-way, no cycle:
 * the page consumes the current cart read-only through the §8.1
 * snapshot seam and never writes cart state).
 *
 * Architectural flow (ARCHITECTURE.md §10):
 *
 * ```text
 * CheckoutPage (pages/ — orchestration only)
 *     ↓ CheckoutState (feature-owned local Signals, provided here)
 *     ↓ CartState + session lifecycle (cart read-only consumer, provided here)
 *     ↓ CheckoutApiService (feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 */
export const checkoutRoutes: Routes = [
  {
    path: '',
    providers: [CheckoutState, CartState, GuestCartService, AuthenticatedCartService],
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/checkout-page/checkout-page').then((m) => m.CheckoutPage),
      },
    ],
  },
];
