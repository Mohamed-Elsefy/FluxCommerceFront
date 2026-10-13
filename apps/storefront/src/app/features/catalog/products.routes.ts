import { Routes } from '@angular/router';
import { CatalogState } from './state/catalog-state';

/**
 * Products shelf routes — catalog-owned listing mounted at `/products`.
 *
 * The listing UI (state, query, grid, filters) stays catalog-owned; only
 * the URL is independent (`/products` for the shelf vs `/catalog` for
 * category discovery). Same `CatalogState` scoping pattern as
 * `catalogRoutes`, separate provider instance per mount.
 */
export const productsRoutes: Routes = [
  {
    path: '',
    providers: [CatalogState],
    children: [
      {
        path: '',
        loadComponent: () => import('./pages/products/products-page').then((m) => m.ProductsPage),
      },
    ],
  },
];
