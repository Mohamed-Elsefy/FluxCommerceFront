import { describe, expect, it } from 'vitest';
import { CATALOG_ENDPOINTS, buildEndpointPath } from './api-endpoints';

describe('buildEndpointPath', () => {
  it('fills route placeholders with encoded values', () => {
    expect(buildEndpointPath('/catalog/products/{id}', { id: 'p1' })).toBe('/catalog/products/p1');
    expect(
      buildEndpointPath('/catalog/products/{productId}/variants/{variantId}', {
        productId: 'p 1',
        variantId: 42,
      }),
    ).toBe('/catalog/products/p%201/variants/42');
  });

  it('leaves templates untouched without params', () => {
    expect(buildEndpointPath('/catalog/products')).toBe('/catalog/products');
  });

  it('fills catalog endpoint templates end to end', () => {
    expect(
      buildEndpointPath(CATALOG_ENDPOINTS.updateVariant.path, {
        productId: 'p1',
        variantId: 'v2',
      }),
    ).toBe('/catalog/products/p1/variants/v2');
  });
});
