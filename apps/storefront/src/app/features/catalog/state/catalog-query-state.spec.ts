/**
 * Unit tests for the Sub-Phase 5.4 `CatalogQueryState`.
 *
 * Covers the coherent query contract with pure functions only (no Angular,
 * no HTTP, no router): defaults, typed transitions, automatic page resets,
 * page preservation across pagination, backend-request synchronization,
 * route round-trips with garbage tolerance, and snapshot immutability.
 */

import { describe, expect, it } from 'vitest';
import {
  CatalogProductSortBy,
  CatalogProductSortDirection,
  ProductStatus,
  ProductVisibility,
} from '@flux/models';
import {
  defaultCatalogQueryState,
  hasListingQuery,
  queryStateFromRouteParams,
  setQueryCategory,
  setQueryFilters,
  setQueryPage,
  setQueryPageSize,
  setQuerySearch,
  setQuerySort,
  toBackendQuery,
  toRouteQueryParams,
  type CatalogQueryState,
  type RouteParamReader,
} from './catalog-query-state';

const CATEGORY = '22222222-2222-2222-2222-222222222222';

/** Minimal `ParamMap`-shaped reader over a plain object. */
function routeParams(values: Record<string, string> = {}): RouteParamReader {
  return {
    get: (name: string): string | null =>
      Object.prototype.hasOwnProperty.call(values, name) ? (values[name] as string) : null,
  };
}

function selected(): CatalogQueryState {
  return setQueryCategory(
    setQueryPage(
      setQuerySort(
        setQueryFilters(setQuerySearch(defaultCatalogQueryState(), 'tee'), {
          status: ProductStatus.Active,
        }),
        { by: CatalogProductSortBy.Name, direction: CatalogProductSortDirection.Descending },
      ),
      3,
    ),
    CATEGORY,
  );
}

describe('defaultCatalogQueryState', () => {
  it('starts unfiltered on the first backend-sized page', () => {
    expect(defaultCatalogQueryState()).toEqual({
      search: '',
      category: null,
      filters: { status: null, visibility: null },
      sort: { by: null, direction: CatalogProductSortDirection.Ascending },
      page: 1,
      pageSize: 20,
    });
  });

  it('returns fresh snapshots (no shared mutable default)', () => {
    const first = defaultCatalogQueryState();
    const second = defaultCatalogQueryState();

    expect(first).not.toBe(second);
    expect(first.filters).not.toBe(second.filters);
    expect(first.sort).not.toBe(second.sort);
  });
});

describe('query transitions and page resets', () => {
  it('resets to page 1 when search changes', () => {
    const next = setQuerySearch({ ...defaultCatalogQueryState(), page: 4 }, 'tee');

    expect(next.search).toBe('tee');
    expect(next.page).toBe(1);
  });

  it('resets to page 1 when the category changes or clears', () => {
    expect(setQueryCategory({ ...selected(), page: 5 }, 'other').page).toBe(1);
    expect(setQueryCategory({ ...selected(), page: 5 }, null)).toEqual({
      ...selected(),
      category: null,
      page: 1,
    });
  });

  it('normalizes blank categories to cleared selection', () => {
    expect(setQueryCategory(defaultCatalogQueryState(), '   ').category).toBeNull();
    expect(setQueryCategory(defaultCatalogQueryState(), `  ${CATEGORY}  `).category).toBe(CATEGORY);
  });

  it('merges filter patches and resets to page 1', () => {
    const next = setQueryFilters(
      { ...selected(), page: 6 },
      { visibility: ProductVisibility.Visible },
    );

    expect(next.filters).toEqual({
      status: ProductStatus.Active,
      visibility: ProductVisibility.Visible,
    });
    expect(next.page).toBe(1);
  });

  it('clears single filters with null patches', () => {
    const next = setQueryFilters(selected(), { status: null });

    expect(next.filters).toEqual({ status: null, visibility: null });
  });

  it('replaces sorting and resets to page 1', () => {
    const next = setQuerySort(
      { ...selected(), page: 2 },
      { by: CatalogProductSortBy.CreatedAtUtc, direction: CatalogProductSortDirection.Ascending },
    );

    expect(next.sort).toEqual({
      by: CatalogProductSortBy.CreatedAtUtc,
      direction: CatalogProductSortDirection.Ascending,
    });
    expect(next.page).toBe(1);
  });

  it('keeps the current direction when a sort patch omits it', () => {
    const next = setQuerySort(selected(), { by: CatalogProductSortBy.CreatedAtUtc });

    expect(next.sort.direction).toBe(CatalogProductSortDirection.Descending);
  });

  it('preserves search, category, filters, and sort across page changes', () => {
    const next = setQueryPage(selected(), 4);

    expect(next).toEqual({ ...selected(), page: 4 });
  });

  it('clamps invalid pages instead of sending backend 400s', () => {
    expect(setQueryPage(defaultCatalogQueryState(), 0).page).toBe(1);
    expect(setQueryPage(defaultCatalogQueryState(), 2.7).page).toBe(2);
    expect(setQueryPage(defaultCatalogQueryState(), Number.NaN).page).toBe(1);
  });

  it('clamps page sizes and resets to page 1', () => {
    expect(setQueryPageSize({ ...selected(), page: 3 }, 500)).toEqual({
      ...selected(),
      pageSize: 100,
      page: 1,
    });
    expect(setQueryPageSize(defaultCatalogQueryState(), 0).pageSize).toBe(20);
  });
});

describe('query immutability', () => {
  it('never mutates the input snapshot', () => {
    const before = selected();
    const frozen = JSON.stringify(before);

    setQuerySearch(before, 'other');
    setQueryCategory(before, 'changed');
    setQueryFilters(before, { status: null });
    setQuerySort(before, { by: null });
    setQueryPage(before, 9);
    setQueryPageSize(before, 50);

    expect(JSON.stringify(before)).toBe(frozen);
  });

  it('returns new snapshots with new nested objects on nested updates', () => {
    const before = defaultCatalogQueryState();
    const next = setQueryFilters(before, { status: ProductStatus.Active });

    expect(next).not.toBe(before);
    expect(next.filters).not.toBe(before.filters);
  });
});

describe('hasListingQuery', () => {
  it('selects no listing for the default query', () => {
    expect(hasListingQuery(defaultCatalogQueryState())).toBe(false);
  });

  it('selects a listing for category and/or search text', () => {
    expect(hasListingQuery(setQueryCategory(defaultCatalogQueryState(), CATEGORY))).toBe(true);
    expect(hasListingQuery(setQuerySearch(defaultCatalogQueryState(), 'tee'))).toBe(true);
    expect(
      hasListingQuery(
        setQuerySearch(setQueryCategory(defaultCatalogQueryState(), CATEGORY), 'tee'),
      ),
    ).toBe(true);
  });
});

describe('toBackendQuery synchronization', () => {
  it('maps the full state to backend field names', () => {
    expect(toBackendQuery(selected())).toEqual({
      searchTerm: 'tee',
      categoryId: CATEGORY,
      status: ProductStatus.Active,
      visibility: undefined,
      sortBy: CatalogProductSortBy.Name,
      sortDirection: CatalogProductSortDirection.Descending,
      pageNumber: 1,
      pageSize: 20,
    });
  });

  it('omits empty search, cleared filters, and fieldless sort', () => {
    expect(toBackendQuery(defaultCatalogQueryState())).toEqual({
      searchTerm: undefined,
      categoryId: undefined,
      status: undefined,
      visibility: undefined,
      sortBy: undefined,
      sortDirection: undefined,
      pageNumber: 1,
      pageSize: 20,
    });
  });

  it('omits the direction when no sort field is set', () => {
    const state: CatalogQueryState = {
      ...defaultCatalogQueryState(),
      sort: { by: null, direction: CatalogProductSortDirection.Descending },
    };

    expect(toBackendQuery(state).sortDirection).toBeUndefined();
  });
});

describe('route synchronization', () => {
  it('serializes state with backend field names and explicit paging', () => {
    expect(toRouteQueryParams(selected())).toEqual({
      searchTerm: 'tee',
      categoryId: CATEGORY,
      status: ProductStatus.Active,
      sortBy: CatalogProductSortBy.Name,
      sortDirection: CatalogProductSortDirection.Descending,
      pageNumber: 1,
      pageSize: 20,
    });
  });

  it('omits cleared fields from route parameters', () => {
    expect(toRouteQueryParams(defaultCatalogQueryState())).toEqual({
      pageNumber: 1,
      pageSize: 20,
    });
  });

  it('parses names and numbers back into typed state', () => {
    expect(
      queryStateFromRouteParams(
        routeParams({
          searchTerm: 'tee',
          categoryId: CATEGORY,
          status: 'Active',
          visibility: '1',
          sortBy: 'Name',
          sortDirection: '1',
          pageNumber: '3',
          pageSize: '50',
        }),
      ),
    ).toEqual({
      search: 'tee',
      category: CATEGORY,
      filters: { status: ProductStatus.Active, visibility: ProductVisibility.Hidden },
      sort: { by: CatalogProductSortBy.Name, direction: CatalogProductSortDirection.Descending },
      page: 3,
      pageSize: 50,
    });
  });

  it('falls back to defaults on missing or garbage route values', () => {
    expect(queryStateFromRouteParams(routeParams())).toEqual(defaultCatalogQueryState());
    expect(
      queryStateFromRouteParams(
        routeParams({
          searchTerm: '',
          categoryId: '   ',
          status: 'Bogus',
          visibility: '9',
          sortBy: 'Price',
          sortDirection: 'Sideways',
          pageNumber: 'zero',
          pageSize: '-5',
        }),
      ),
    ).toEqual(defaultCatalogQueryState());
  });

  it('round-trips state through route parameters', () => {
    const state = selected();
    const wire = toRouteQueryParams(state);
    const back = queryStateFromRouteParams({
      get: (name: string): string | null => {
        const value: unknown = (wire as Record<string, unknown>)[name];
        return typeof value === 'string' || typeof value === 'number' ? String(value) : null;
      },
    });

    expect(back).toEqual(state);
    expect(toRouteQueryParams(back)).toEqual(wire);
  });
});
