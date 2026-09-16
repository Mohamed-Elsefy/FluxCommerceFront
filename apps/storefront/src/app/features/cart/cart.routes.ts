import { Routes } from '@angular/router';
import { AuthenticatedCartService } from './state/authenticated-cart.service';
import { CartState } from './state/cart-state';
import { GuestCartService } from './state/guest-cart.service';

/**
 * Storefront Cart feature routes (Sub-Phase 7.4 — Cart Page & UI —
 * plus the Sub-Phase 7.5 guest lifecycle and the Sub-Phase 7.6
 * auth-driven lifecycle).
 *
 * Mounted at `cart` in `app.routes.ts`, so the page below serves
 * `/cart`.
 *
 * The lazy boundary plus the feature-scoped providers live on the
 * state-providing parent: the cart page gets its own `CartState`
 * instance (never a global store), its own `GuestCartService` driving
 * the anonymous branch, and its own `AuthenticatedCartService`
 * synchronizing identity with the session (login/logout/restoration)
 * and establishing the authenticated cart. Merge wiring registers here
 * in Sub-Phase 7.7 as state transitions and page orchestration — not
 * as new global state.
 *
 * Architectural flow (ARCHITECTURE.md §10):
 *
 * ```text
 * Component (pages/ + components/)
 *     ↓ AuthenticatedCartService (session lifecycle, 7.6) → GuestCartService (guest branch, 7.5) + CartState (feature-owned local Signals, all provided here)
 *     ↓ CartApiService (feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Cart API
 * ```
 */
export const cartRoutes: Routes = [
  {
    path: '',
    providers: [CartState, GuestCartService, AuthenticatedCartService],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/cart-page/cart-page').then((m) => m.CartPage),
      },
    ],
  },
];
