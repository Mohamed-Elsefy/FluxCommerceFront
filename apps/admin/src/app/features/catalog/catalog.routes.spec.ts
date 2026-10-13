import { describe, expect, it } from 'vitest';
import { CatalogAdminApiService } from './data-access/catalog-admin-api.service';
import { CatalogOverviewState } from './state/catalog-overview-state';
import { CategoryLookupState } from './state/category-lookup-state';
import { ProductDetailsState } from './state/product-details-state';
import { ProductListState } from './state/product-list-state';
import { CategoryDetailsState } from './state/category-details-state';
import { CategoryListState } from './state/category-list-state';
import { VariantDetailsState } from './state/variant-details-state';
import { VariantListState } from './state/variant-list-state';
import { catalogRoutes } from './catalog.routes';

describe('catalogRoutes', () => {
  it('provides the feature transport seam and states once at the feature root', () => {
    expect(catalogRoutes).toHaveLength(1);
    expect(catalogRoutes[0]?.path).toBe('');
    expect(catalogRoutes[0]?.providers).toEqual([
      CatalogAdminApiService,
      CatalogOverviewState,
      CategoryDetailsState,
      CategoryListState,
      CategoryLookupState,
      ProductDetailsState,
      ProductListState,
      VariantDetailsState,
      VariantListState,
    ]);
  });

  it('serves the landing page at the feature root', () => {
    const home = catalogRoutes[0]?.children?.find((route) => route.path === '');

    expect(typeof home?.loadComponent).toBe('function');
  });

  it('declares the product slice in matching order (new before id)', () => {
    const paths = catalogRoutes[0]?.children?.map((route) => route.path);

    expect(paths).toEqual([
      '',
      'products',
      'products/new',
      'products/:id',
      'products/:id/edit',
      'products/:productId/variants',
      'products/:productId/variants/new',
      'products/:productId/variants/:variantId',
      'products/:productId/variants/:variantId/edit',
      'categories',
      'categories/new',
      'categories/:id',
      'categories/:id/edit',
    ]);
    for (const child of catalogRoutes[0]?.children ?? []) {
      expect(typeof child.loadComponent).toBe('function');
    }
  });
});
