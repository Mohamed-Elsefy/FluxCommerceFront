import { Routes } from '@angular/router';
import { ProductDetailsState } from './state/product-details-state';

/**
 * Storefront Product Details feature routes (Sub-Phase 6.1 — Product
 * Details Foundation).
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
 * Architectural flow (ARCHITECTURE.md §10):
 *
 * ```text
 * Component (pages/)
 *     ↓ ProductDetailsState (feature-owned local Signals, provided here)
 *     ↓ ProductDetailsApiService (feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Catalog API
 * ```
 */
export const productDetailsRoutes: Routes = [
  {
    path: '',
    providers: [ProductDetailsState],
    children: [
      {
        path: ':id',
        loadComponent: () =>
          import('./pages/product-details/product-details-page').then((m) => m.ProductDetailsPage),
      },
    ],
  },
];
