import { describe, expect, it } from 'vitest';
import { isValidDashboardQuery } from './dashboard';

describe('dashboard transport pre-check (Supplement S1)', () => {
  it('validates dashboard queries (negative threshold rejected)', () => {
    expect(isValidDashboardQuery(null)).toBe(true);
    expect(isValidDashboardQuery({})).toBe(true);
    expect(isValidDashboardQuery({ lowStockThreshold: 5 })).toBe(true);
    expect(isValidDashboardQuery({ lowStockThreshold: -1 })).toBe(false);
  });
});
