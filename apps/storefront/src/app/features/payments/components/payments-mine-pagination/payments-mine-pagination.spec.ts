import { describe, expect, it, vi } from 'vitest';
import { PaymentsMinePagination } from './payments-mine-pagination';

describe('PaymentsMinePagination', () => {
  it('hides the nav for single-page results (nothing to navigate)', () => {
    const pager = new PaymentsMinePagination();
    pager.page = 1;
    pager.pageSize = 20;
    pager.totalCount = 5;
    pager.copy = { label: 'Pages', first: 'First', previous: 'Prev', next: 'Next', last: 'Last' };

    expect(pager['totalPages']()).toBe(1);
    expect(pager['visiblePages']()).toEqual([]);
  });

  it('emits page moves but never the current page', () => {
    const pager = new PaymentsMinePagination();
    pager.page = 2;
    pager.pageSize = 20;
    pager.totalCount = 100;
    pager.copy = { label: 'Pages', first: 'First', previous: 'Prev', next: 'Next', last: 'Last' };
    const emitted: number[] = [];
    pager.pageChange.subscribe((page: number) => emitted.push(page));

    pager['go'](2);
    expect(emitted).toEqual([]);

    pager['go'](3);
    expect(emitted).toEqual([3]);
  });

  it('windows numbered pages around the current page', () => {
    const pager = new PaymentsMinePagination();
    pager.page = 5;
    pager.pageSize = 20;
    pager.totalCount = 200;
    pager.copy = { label: 'Pages', first: 'First', previous: 'Prev', next: 'Next', last: 'Last' };

    expect(pager['totalPages']()).toBe(10);
    expect(pager['visiblePages']()).toEqual([3, 4, 5, 6, 7]);
    expect(vi.isMockFunction(pager.pageChange.emit)).toBe(false);
  });
});
