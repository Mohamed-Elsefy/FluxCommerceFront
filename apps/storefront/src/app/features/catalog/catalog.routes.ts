import { Routes } from '@angular/router';
import { CatalogState } from './state/catalog-state';

/**
 * Storefront Catalog feature routes (Sub-Phases 5.1–5.2 — Catalog Feature
 * Foundation + Home & Category Discovery).
 *
 * The lazy boundary plus the feature-scoped `CatalogState` provider live on
 * the state-providing parent: every catalog child shares one `CatalogState`
 * instance without any global store. Discovery (`''`) arrives in 5.2;
 * product listing, search, and product-details pages register as siblings
 * in Sub-Phases 5.3+ and consume the same `categoryId` query state.
 *
 * Architectural flow (ARCHITECTURE.md §10):
 *
 * ```text
 * Component (pages/ + components/)
 *     ↓ CatalogState (feature-owned local Signals, provided here)
 *     ↓ CatalogApiService (feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Catalog API
 * ```
 */
export const catalogRoutes: Routes = [
  {
    path: '',
    providers: [CatalogState],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/categories/categories-page').then((m) => m.CategoriesPage),
      },
      {
        // Alias: `/catalog/categories` serves the same discovery page as
        // `/catalog` (single component, two addresses — the canonical
        // stays `/catalog`, see `canonicalForQuery`).
        path: 'categories',
        loadComponent: () =>
          import('./pages/categories/categories-page').then((m) => m.CategoriesPage),
      },
      {
        // Alias: `/catalog/products` serves the same shelf as `/products`
        // (single component, two addresses — the canonical stays
        // `/products`, see `PRODUCTS_BASE_PATH`).
        path: 'products',
        loadComponent: () => import('./pages/products/products-page').then((m) => m.ProductsPage),
      },
      // Sub-Phase 5.3 — Product Listing pages.
    ],
  },
];
