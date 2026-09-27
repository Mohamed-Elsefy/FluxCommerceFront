import { Routes } from '@angular/router';
import { CatalogAdminApiService } from './data-access/catalog-admin-api.service';
import { CatalogOverviewState } from './state/catalog-overview-state';
import { CategoryLookupState } from './state/category-lookup-state';
import { ProductDetailsState } from './state/product-details-state';
import { ProductListState } from './state/product-list-state';
import { VariantDetailsState } from './state/variant-details-state';
import { VariantListState } from './state/variant-list-state';

/**
 * Admin Catalog feature routes for Sub-Phases 13.2–13.4 — Catalog
 * Foundation + Product + Variant Management.
 *
 * Lazy feature boundary under the guarded portal shell (`path: 'catalog'`
 * in `app.routes.ts` — the shell's `authGuard` + `roleGuard` chain already
 * admits `Admin`/`SuperAdmin` only, so no per-route guards duplicate it;
 * backend authorization stays authoritative).
 *
 * The API service and every feature state are provided once at the
 * feature root, so all catalog pages share one transport seam and one
 * state family without root singletons or a global store. Route order
 * matters: static segments (`products/new`, `.../variants/new`) precede
 * their `:id` siblings (top-down matching — `new` must not parse as an
 * id).
 *
 * Category, image, and specification management routes arrive with the
 * slices that own their pages (Sub-Phases 13.5–13.6) — no placeholder
 * routes ship in the meantime.
 */
export const catalogRoutes: Routes = [
  {
    path: '',
    providers: [
      CatalogAdminApiService,
      CatalogOverviewState,
      CategoryLookupState,
      ProductDetailsState,
      ProductListState,
      VariantDetailsState,
      VariantListState,
    ],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/catalog-home/catalog-home-page').then((m) => m.CatalogHomePage),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./pages/products-list/products-list-page').then((m) => m.ProductsListPage),
      },
      {
        path: 'products/new',
        loadComponent: () =>
          import('./pages/product-create/product-create-page').then((m) => m.ProductCreatePage),
      },
      {
        path: 'products/:id',
        loadComponent: () =>
          import('./pages/product-details/product-details-page').then((m) => m.ProductDetailsPage),
      },
      {
        path: 'products/:id/edit',
        loadComponent: () =>
          import('./pages/product-edit/product-edit-page').then((m) => m.ProductEditPage),
      },
      {
        path: 'products/:productId/variants',
        loadComponent: () =>
          import('./pages/variants-list/variants-list-page').then((m) => m.VariantsListPage),
      },
      {
        path: 'products/:productId/variants/new',
        loadComponent: () =>
          import('./pages/variant-create/variant-create-page').then((m) => m.VariantCreatePage),
      },
      {
        path: 'products/:productId/variants/:variantId',
        loadComponent: () =>
          import('./pages/variant-details/variant-details-page').then((m) => m.VariantDetailsPage),
      },
      {
        path: 'products/:productId/variants/:variantId/edit',
        loadComponent: () =>
          import('./pages/variant-edit/variant-edit-page').then((m) => m.VariantEditPage),
      },
    ],
  },
];
