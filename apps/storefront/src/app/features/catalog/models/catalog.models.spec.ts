/**
 * Unit tests for the Sub-Phase 5.1 catalog feature models.
 *
 * Covers the pure helpers only (defaults, normalization, query funnel,
 * envelope mapping). Contract mirrors themselves live in `@flux/models`
 * (already covered by Phase 1 specs) and are aliased here — never
 * re-declared — so these tests assert aliasing compiles and helpers behave,
 * not backend shapes.
 */

import { describe, expect, it } from 'vitest';
import {
  defaultCatalogQuery,
  emptyCategoryList,
  emptyProductList,
  normalizeCatalogQuery,
  toCatalogQueryParams,
  toCategoryList,
  toProductList,
  type ProductList,
} from './catalog.models';

describe('defaultCatalogQuery', () => {
  it('returns the first page with the backend page size and no filters', () => {
    expect(defaultCatalogQuery()).toEqual({ pageNumber: 1, pageSize: 20 });
  });
});

describe('normalizeCatalogQuery', () => {
  it('applies backend paging defaults when paging is omitted', () => {
    expect(normalizeCatalogQuery({ searchTerm: 'tee' })).toEqual({
      searchTerm: 'tee',
      pageNumber: 1,
      pageSize: 20,
    });
  });

  it('clamps out-of-range paging while preserving filters', () => {
    expect(normalizeCatalogQuery({ categoryId: 'cat-1', pageNumber: 0, pageSize: 500 })).toEqual({
      categoryId: 'cat-1',
      pageNumber: 1,
      pageSize: 100,
    });
  });
});

describe('toCatalogQueryParams', () => {
  it('omits nullish filters so backend defaults apply', () => {
    expect(
      toCatalogQueryParams({
        searchTerm: 'tee',
        categoryId: undefined,
        status: null as unknown as undefined,
        pageNumber: 2,
        pageSize: 20,
      }),
    ).toEqual({ searchTerm: 'tee', pageNumber: 2, pageSize: 20 });
  });

  it('never hand-builds strings (returns a params map)', () => {
    const params = toCatalogQueryParams({ searchTerm: 'a&b=c', pageNumber: 1, pageSize: 20 });
    expect(params['searchTerm']).toBe('a&b=c');
  });
});

describe('toProductList / toCategoryList', () => {
  const page: ProductList = {
    items: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Tee',
        slug: 'tee',
        categoryId: '22222222-2222-2222-2222-222222222222',
        primaryImage: null,
      },
    ],
    totalCount: 1,
    pageNumber: 1,
    pageSize: 20,
  };

  it('passes envelope data through untouched', () => {
    expect(toProductList(page)).toBe(page);
  });

  it('falls back to an empty page when the envelope carries no data', () => {
    expect(toProductList(null)).toEqual(emptyProductList());
    expect(toProductList(undefined)).toEqual(emptyProductList());
  });

  it('falls back to an empty category page when the envelope carries no data', () => {
    expect(toCategoryList(null)).toEqual(emptyCategoryList());
    expect(toCategoryList(undefined)).toEqual(emptyCategoryList());
  });
});
