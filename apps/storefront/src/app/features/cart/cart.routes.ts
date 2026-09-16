import { Routes } from '@angular/router';
import { CartState } from './state/cart-state';
import { GuestCartService } from './state/guest-cart.service';

/**
 * Storefront Cart feature routes (Sub-Phase 7.4 — Cart Page & UI —
 * plus the Sub-Phase 7.5 guest lifecycle).
 *
 * Mounted at `cart` in `app.routes.ts`, so the page below serves
 * `/cart`.
 *
 * The lazy boundary plus the feature-scoped providers live on the
 * state-providing parent: the cart page gets its own `CartState`
 * instance (never a global store) and its own `GuestCartService`
 * driving the guest identity lifecycle (create/load/recover) against
 * that state. Authenticated identity and merge wiring register here in
 * Sub-Phases 7.6–7.7 as state transitions and page orchestration — not
 * as new global state.
 *
 * Architectural flow (ARCHITECTURE.md §10):
 *
 * ```text
 * Component (pages/ + components/)
 *     ↓ GuestCartService (guest lifecycle, 7.5) + CartState (feature-owned local Signals, both provided here)
 *     ↓ CartApiService (feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Cart API
 * ```
 */
export const cartRoutes: Routes = [
  {
    path: '',
    providers: [CartState, GuestCartService],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/cart-page/cart-page').then((m) => m.CartPage),
      },
    ],
  },
];
