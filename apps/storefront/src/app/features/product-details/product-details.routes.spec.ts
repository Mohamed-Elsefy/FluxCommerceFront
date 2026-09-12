/**
 * Route tests for the Sub-Phase 6.1 `productDetailsRoutes`.
 *
 * Covers the lazy feature boundary: the parent provides the feature-scoped
 * `ProductDetailsState` (never a global store) and the `:id` child
 * lazy-loads the foundation page serving `/catalog/products/:id`.
 */

import { describe, expect, it } from 'vitest';
import { ProductDetailsPage } from './pages/product-details/product-details-page';
import { ProductDetailsState } from './state/product-details-state';
import { productDetailsRoutes } from './product-details.routes';

describe('productDetailsRoutes', () => {
  it('provides the feature-scoped state on the parent entry', () => {
    expect(productDetailsRoutes).toHaveLength(1);
    expect(productDetailsRoutes[0]?.providers).toContain(ProductDetailsState);
  });

  it('lazy-loads the details page on the :id child', async () => {
    const child = productDetailsRoutes[0]?.children?.[0];

    expect(child?.path).toBe(':id');
    expect(typeof child?.loadComponent).toBe('function');

    const page = await child?.loadComponent?.();
    // Identity against the statically imported page proves the route wires
    // the right component; laziness itself follows from the `loadComponent`
    // shape (asserted above) and is enforced by the architecture audit.
    expect(page).toBe(ProductDetailsPage);
  });
});
