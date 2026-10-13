/**
 * Component tests for the Sub-Phase 12.5 `AdminPagination`.
 *
 * Covers the presentational contract only: single-page hiding, boundary
 * disabled states, the sliding number window, current-page marking,
 * emission (never for the current page), and localized copy. Paging math
 * itself stays in the shared `totalPagesOf` helper (already unit-covered
 * in `libs/api`) — these tests pin the UI mapping, not the math.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminPagination, type AdminPaginationCopy } from './pagination';

const COPY: AdminPaginationCopy = {
  label: 'Result pages',
  first: 'First',
  previous: 'Previous',
  next: 'Next',
  last: 'Last',
};

function setup(input: { page?: number; pageSize?: number; totalCount?: number }): {
  fixture: ComponentFixture<AdminPagination>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(AdminPagination);
  fixture.componentRef.setInput('page', input.page ?? 1);
  fixture.componentRef.setInput('pageSize', input.pageSize ?? 20);
  fixture.componentRef.setInput('totalCount', input.totalCount ?? 0);
  fixture.componentRef.setInput('copy', COPY);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function buttons(element: HTMLElement): HTMLButtonElement[] {
  return [...element.querySelectorAll('nav.admin-pagination button')].map(
    (button) => button as HTMLButtonElement,
  );
}

describe('AdminPagination', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('hides the navigation for single-page results', () => {
    expect(setup({ totalCount: 20 }).element.querySelector('nav.admin-pagination')).toBeNull();

    TestBed.resetTestingModule();
    expect(setup({ totalCount: 0 }).element.querySelector('nav.admin-pagination')).toBeNull();
  });

  it('disables backward navigation on the first page', () => {
    const { element } = setup({ page: 1, totalCount: 45 });
    const labels = buttons(element);

    expect(element.querySelector('nav.admin-pagination')?.getAttribute('aria-label')).toBe(
      'Result pages',
    );
    expect(labels.map((button) => button.textContent?.trim())).toEqual([
      'First',
      'Previous',
      '1',
      '2',
      '3',
      'Next',
      'Last',
    ]);
    expect(labels[0]?.disabled).toBe(true);
    expect(labels[1]?.disabled).toBe(true);
    expect(labels[5]?.disabled).toBe(false);
    expect(labels[6]?.disabled).toBe(false);
  });

  it('disables forward navigation on the last page', () => {
    const { element } = setup({ page: 3, totalCount: 45 });
    const labels = buttons(element);

    expect(labels[0]?.disabled).toBe(false);
    expect(labels[1]?.disabled).toBe(false);
    expect(labels[5]?.disabled).toBe(true);
    expect(labels[6]?.disabled).toBe(true);
  });

  it('marks the current page without emitting for it', () => {
    const { fixture, element } = setup({ page: 2, totalCount: 45 });
    const emitted: number[] = [];
    fixture.componentInstance.pageChange.subscribe((page: number) => emitted.push(page));

    const current = buttons(element).find((button) => button.textContent?.trim() === '2');
    expect(current?.getAttribute('aria-current')).toBe('page');
    expect(current?.disabled).toBe(true);
    current?.click();

    expect(emitted).toEqual([]);
  });

  it('emits committed page changes', () => {
    const { fixture, element } = setup({ page: 2, totalCount: 45 });
    const emitted: number[] = [];
    fixture.componentInstance.pageChange.subscribe((page: number) => emitted.push(page));

    buttons(element)
      .find((button) => button.textContent?.trim() === 'Next')
      ?.click();
    buttons(element)
      .find((button) => button.textContent?.trim() === '1')
      ?.click();

    expect(emitted).toEqual([3, 1]);
  });
});
