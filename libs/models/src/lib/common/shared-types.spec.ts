import { describe, expect, it } from 'vitest';
import { isValidPageQuery } from './shared-types';

describe('shared paging pre-check (PAGINATION_CONVENTION.md)', () => {
  it('accepts omitted bounds (server defaults 1/20)', () => {
    expect(isValidPageQuery(null)).toBe(true);
    expect(isValidPageQuery(undefined)).toBe(true);
    expect(isValidPageQuery({})).toBe(true);
    expect(isValidPageQuery({ pageNumber: 1, pageSize: 20 })).toBe(true);
  });

  it('rejects out-of-range bounds', () => {
    expect(isValidPageQuery({ pageNumber: 0 })).toBe(false);
    expect(isValidPageQuery({ pageSize: 0 })).toBe(false);
    expect(isValidPageQuery({ pageSize: 101 })).toBe(false);
    expect(isValidPageQuery({ pageNumber: 1.5 })).toBe(false);
  });
});
