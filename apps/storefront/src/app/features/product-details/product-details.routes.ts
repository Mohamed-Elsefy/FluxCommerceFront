import { Routes } from '@angular/router';
import { CartState } from '../cart/state/cart-state';
import { GuestCartService } from '../cart/state/guest-cart.service';
import { ProductDetailsState } from './state/product-details-state';

/**
 * Storefront Product Details feature routes (Sub-Phase 6.1 — Product
 * Details Foundation — plus the priced-variant guest submission, ADR 018).
 *
 * Mounted at `catalog/products` in `app.routes.ts` (before the broader
 * `catalog` boundary, which would otherwise swallow the prefix), so the
 * page below serves `/catalog/products/:id`.
 *
 * The lazy boundary plus the feature-scoped `ProductDetailsState` provider
 * live on the state-providing parent: the details page gets its own state
 * instance without any global store. Variant selection, quantity, and
 * add-to-cart register here in Sub-Phases 6.4–6.7 as state transitions and
 * page sections — not as new global state.
 *
 * Guest submission (ADR 018) additionally provides the cart feature's
 * `CartState` + `GuestCartService` here: the page establishes the guest
 * identity through the lifecycle and reads its readiness through the
 * service seam, then submits lines through its OWN state machine and
 * data-access façade. No cart contents, persistence logic, or merge
 * wiring is duplicated or owned here — the cart feature stays the single
 * owner; this route only borrows its lifecycle seam (one-way, no cycle).
 *
 * Architectural flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * Component (pages/)
 *     ↓ ProductDetailsState (feature-owned local Signals, provided here)
 *     ↓ GuestCartService (cart lifecycle seam, provided here)
 *     ↓ ProductDetailsApiService (feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Catalog API
 * ```
 */
export const productDetailsRoutes: Routes = [
  {
    path: '',
    providers: [ProductDetailsState, CartState, GuestCartService],
    children: [
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/product-details/product-details-page').then((m) => m.ProductDetailsPage),
      },
    ],
  },
];
