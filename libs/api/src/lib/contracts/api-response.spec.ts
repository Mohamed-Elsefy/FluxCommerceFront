import { describe, expect, it } from 'vitest';
import {
  hasNextPage,
  hasPreviousPage,
  nextPageQuery,
  previousPageQuery,
  totalPagesOf,
  type PagedResult,
  type PagingQuery,
} from './api-response';

function page(overrides: Partial<PagedResult<unknown>> = {}): PagedResult<unknown> {
  return { items: [], totalCount: 95, pageNumber: 2, pageSize: 20, ...overrides };
}

describe('totalPagesOf', () => {
  it('computes 1-based page counts the backend never sends', () => {
    expect(totalPagesOf(page())).toBe(5);
    expect(totalPagesOf(page({ totalCount: 40, pageSize: 20 }))).toBe(2);
  });

  it('returns 0 for empty results or degenerate page sizes', () => {
    expect(totalPagesOf(page({ totalCount: 0 }))).toBe(0);
    expect(totalPagesOf(page({ pageSize: 0 }))).toBe(0);
  });
});

describe('hasNextPage / hasPreviousPage', () => {
  it('derives navigation flags from echoed pager state', () => {
    expect(hasNextPage(page())).toBe(true);
    expect(hasNextPage(page({ pageNumber: 5 }))).toBe(false);
    expect(hasPreviousPage(page())).toBe(true);
    expect(hasPreviousPage(page({ pageNumber: 1 }))).toBe(false);
  });
});

describe('nextPageQuery', () => {
  it('advances while pages remain, preserving the page size', () => {
    expect(nextPageQuery(page())).toEqual({ pageNumber: 3, pageSize: 20 });
  });

  it('returns null on the last page instead of an out-of-range query', () => {
    expect(nextPageQuery(page({ pageNumber: 5 }))).toBeNull();
  });

  it('produces queries assignable to PagingQuery', () => {
    const next: PagingQuery | null = nextPageQuery(page());
    expect(next?.pageNumber).toBe(3);
  });
});

describe('previousPageQuery', () => {
  it('retreats while pages remain, preserving the page size', () => {
    expect(previousPageQuery(page())).toEqual({ pageNumber: 1, pageSize: 20 });
  });

  it('returns null on the first page instead of an out-of-range query', () => {
    expect(previousPageQuery(page({ pageNumber: 1 }))).toBeNull();
  });

  it('produces queries assignable to PagingQuery', () => {
    const previous: PagingQuery | null = previousPageQuery(page());
    expect(previous?.pageNumber).toBe(1);
  });
});
