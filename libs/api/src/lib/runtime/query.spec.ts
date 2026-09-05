import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAGE_NUMBER,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildQueryString,
  normalizePagination,
  toHttpParams,
  toPaginationParams,
  toQueryParams,
  type PaginationRequest,
  type QueryParams,
  type SortQuery,
} from './query';
import type { PagedResult, PagingQuery } from '../contracts/api-response';

describe('normalizePagination', () => {
  it('applies backend defaults when omitted', () => {
    expect(normalizePagination({})).toEqual({ pageNumber: 1, pageSize: 20 });
    expect(normalizePagination()).toEqual({
      pageNumber: DEFAULT_PAGE_NUMBER,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it('passes valid paging through untouched', () => {
    expect(normalizePagination({ pageNumber: 3, pageSize: 50 })).toEqual({
      pageNumber: 3,
      pageSize: 50,
    });
  });

  it('clamps out-of-range values instead of producing backend 400s', () => {
    expect(normalizePagination({ pageNumber: 0, pageSize: 0 })).toEqual({
      pageNumber: 1,
      pageSize: 20,
    });
    expect(normalizePagination({ pageNumber: -2, pageSize: 101 })).toEqual({
      pageNumber: 1,
      pageSize: MAX_PAGE_SIZE,
    });
  });

  it('floors fractions and falls back on non-finite input', () => {
    expect(normalizePagination({ pageNumber: 2.7, pageSize: 10.2 })).toEqual({
      pageNumber: 2,
      pageSize: 10,
    });
    expect(
      normalizePagination({ pageNumber: Number.NaN, pageSize: Number.POSITIVE_INFINITY }),
    ).toEqual({ pageNumber: 1, pageSize: 20 });
  });
});

describe('toPaginationParams', () => {
  it('emits a normalized, always-complete paging pair for spreading', () => {
    expect(toPaginationParams({ pageNumber: 2 })).toEqual({ pageNumber: 2, pageSize: 20 });
    expect({ ...toPaginationParams({}), searchTerm: 'tee' }).toEqual({
      pageNumber: 1,
      pageSize: 20,
      searchTerm: 'tee',
    });
  });
});

describe('buildQueryString', () => {
  it('serializes scalars, repeats arrays, and omits nullish values', () => {
    expect(
      buildQueryString({
        searchTerm: 'tee',
        pageNumber: 2,
        pageSize: 20,
        exact: true,
        missing: undefined,
        cleared: null,
      }),
    ).toBe('searchTerm=tee&pageNumber=2&pageSize=20&exact=true');
  });

  it('repeats array keys and drops empty arrays', () => {
    expect(buildQueryString({ sku: ['A', 'B'], empty: [] })).toBe('sku=A&sku=B');
    expect(buildQueryString({})).toBe('');
  });

  it('encodes keys and values', () => {
    expect(buildQueryString({ q: 'a b&c' })).toBe('q=a%20b%26c');
  });

  it('skips nested objects, which have no backend query convention', () => {
    const nested = { filter: { status: 'Active' } } as unknown as QueryParams;
    expect(buildQueryString({ ...nested, pageNumber: 1 })).toBe('pageNumber=1');
  });
});

describe('toHttpParams', () => {
  it('mirrors buildQueryString semantics as HttpParams', () => {
    const params = { searchTerm: 'tee', pageNumber: 2, exact: true, missing: undefined };
    expect(toHttpParams(params).toString()).toBe(buildQueryString(params));
  });

  it('repeats array keys and omits nullish values', () => {
    const httpParams = toHttpParams({ sku: ['A', 'B'], cleared: null, empty: [] });
    expect(httpParams.getAll('sku')).toEqual(['A', 'B']);
    expect(httpParams.has('cleared')).toBe(false);
    expect(httpParams.has('empty')).toBe(false);
  });

  it('stringifies numbers and booleans', () => {
    const httpParams = toHttpParams({ pageNumber: 2, exact: false });
    expect(httpParams.get('pageNumber')).toBe('2');
    expect(httpParams.get('exact')).toBe('false');
  });
});

describe('query model composition', () => {
  it('keeps PagingQuery assignable to PaginationRequest (1.1 alias)', () => {
    const legacy: PagingQuery = { pageNumber: 2 };
    const canonical: PaginationRequest = legacy;
    expect(normalizePagination(canonical)).toEqual({ pageNumber: 2, pageSize: 20 });
  });

  it('composes paging, sort, and filter criteria into one query object', () => {
    interface CatalogQuery extends PaginationRequest, SortQuery<'Name' | 'CreatedAtUtc'> {
      readonly searchTerm?: string;
      readonly categoryId?: string;
    }
    const query: CatalogQuery = {
      ...toPaginationParams({ pageNumber: 1 }),
      sortBy: 'Name',
      sortDirection: 'Ascending',
      searchTerm: 'tee',
    };
    const params = toQueryParams(query);

    expect(buildQueryString(params)).toBe(
      'pageNumber=1&pageSize=20&sortBy=Name&sortDirection=Ascending&searchTerm=tee',
    );
    expect(toHttpParams(params).toString()).toBe(buildQueryString(params));
  });

  it('converts typed query objects without hand-built strings', () => {
    const params = toQueryParams({ pageNumber: 1, searchTerm: 'tee', missing: undefined });

    expect(params).toEqual({ pageNumber: 1, searchTerm: 'tee' });
    expect(buildQueryString(params)).toBe('pageNumber=1&searchTerm=tee');
  });

  it('types paged responses against PagedResult', () => {
    const page: PagedResult<string> = { items: ['a'], totalCount: 1, pageNumber: 1, pageSize: 20 };
    expect(page.items).toEqual(['a']);
  });
});
