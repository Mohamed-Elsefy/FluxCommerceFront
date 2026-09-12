/**
 * Component tests for the Sub-Phase 5.7 `ProductPagination`.
 *
 * Covers the presentational contract only: single-page hiding, boundary
 * disabled states, the sliding number window, current-page marking,
 * emission (never for the current page), and localized copy. Paging math
 * itself stays in the shared `totalPagesOf` helper (already unit-covered
 * in `libs/api`) — these tests pin the UI mapping, not the math.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProductPagination, type PaginationCopy } from './product-pagination';

const COPY: PaginationCopy = {
  label: 'Product pages',
  first: 'First',
  previous: 'Previous',
  next: 'Next',
  last: 'Last',
};

function setup(input: { page?: number; pageSize?: number; totalCount?: number }): {
  fixture: ComponentFixture<ProductPagination>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(ProductPagination);
  fixture.componentRef.setInput('page', input.page ?? 1);
  fixture.componentRef.setInput('pageSize', input.pageSize ?? 20);
  fixture.componentRef.setInput('totalCount', input.totalCount ?? 0);
  fixture.componentRef.setInput('copy', COPY);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function buttons(element: HTMLElement): HTMLButtonElement[] {
  return [...element.querySelectorAll('nav.pagination button')].map(
    (button) => button as HTMLButtonElement,
  );
}

describe('ProductPagination', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('hides the navigation for single-page results', () => {
    expect(setup({ totalCount: 20 }).element.querySelector('nav.pagination')).toBeNull();

    TestBed.resetTestingModule();
    expect(setup({ totalCount: 0 }).element.querySelector('nav.pagination')).toBeNull();
  });

  it('disables backward navigation on the first page', () => {
    const { element } = setup({ page: 1, totalCount: 45 });
    const labels = buttons(element);

    expect(element.querySelector('nav.pagination')?.getAttribute('aria-label')).toBe(
      'Product pages',
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

  it('marks the current page without re-emitting it', () => {
    const { fixture, element } = setup({ page: 2, totalCount: 45 });
    const emitted: number[] = [];
    fixture.componentInstance.pageChange.subscribe((page) => {
      emitted.push(page);
    });
    const current = buttons(element)[3];

    expect(current?.textContent?.trim()).toBe('2');
    expect(current?.getAttribute('aria-current')).toBe('page');
    expect(current?.disabled).toBe(true);

    current?.click();
    expect(emitted).toEqual([]);
  });

  it('slides the number window on deep pages', () => {
    const { element } = setup({ page: 8, pageSize: 10, totalCount: 100 });
    const numbers = buttons(element)
      .map((button) => button.textContent?.trim())
      .filter((text) => /^\d+$/.test(text ?? ''));

    expect(numbers).toEqual(['6', '7', '8', '9', '10']);
  });

  it('emits chosen pages for First, Previous, numbers, Next, and Last', () => {
    const { fixture, element } = setup({ page: 2, totalCount: 45 });
    const emitted: number[] = [];
    fixture.componentInstance.pageChange.subscribe((page) => {
      emitted.push(page);
    });
    const labels = buttons(element);

    labels[0]?.click();
    labels[1]?.click();
    labels[4]?.click();
    labels[5]?.click();
    labels[6]?.click();

    expect(emitted).toEqual([1, 1, 3, 3, 3]);
  });
});
