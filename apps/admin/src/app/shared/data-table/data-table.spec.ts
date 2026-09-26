/**
 * Component tests for the Sub-Phase 12.5 `AdminDataTable`.
 *
 * Covers the presentational contract only: typed column headers, cell
 * rendering through value accessors, loading and empty states, and table
 * accessibility semantics. Paging math stays in the shared `totalPagesOf`
 * helper (already unit-covered in `libs/api`) — these tests pin the UI
 * mapping, not the math.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminDataTable, type AdminDataColumn } from './data-table';

interface ProductRow {
  readonly sku: string;
  readonly name: string;
}

const COLUMNS: readonly AdminDataColumn<ProductRow>[] = [
  { key: 'sku', header: 'SKU', value: (row) => row.sku },
  { key: 'name', header: 'Name', value: (row) => row.name },
];

const ROWS: readonly ProductRow[] = [
  { sku: 'SKU-1', name: 'First' },
  { sku: 'SKU-2', name: 'Second' },
];

function setup(input: {
  columns?: readonly AdminDataColumn<ProductRow>[];
  rows?: readonly ProductRow[];
  loading?: boolean;
}): { fixture: ComponentFixture<AdminDataTable<ProductRow>>; element: HTMLElement } {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(AdminDataTable<ProductRow>);
  fixture.componentRef.setInput('columns', input.columns ?? COLUMNS);
  fixture.componentRef.setInput('rows', input.rows ?? []);
  fixture.componentRef.setInput('loading', input.loading ?? false);
  fixture.componentRef.setInput('emptyTitle', 'No products');
  fixture.componentRef.setInput('emptyMessage', 'Try a different filter.');
  fixture.componentRef.setInput('loadingLabel', 'Loading products');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AdminDataTable', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders typed headers and accessor cells in order', () => {
    const { element } = setup({ rows: ROWS });

    expect(
      [...element.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim()),
    ).toEqual(['SKU', 'Name']);
    expect(
      [...element.querySelectorAll('thead th')].every(
        (cell) => cell.getAttribute('scope') === 'col',
      ),
    ).toBe(true);
    const body = [...element.querySelectorAll('tbody tr')].map((row) =>
      [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim()),
    );
    expect(body).toEqual([
      ['SKU-1', 'First'],
      ['SKU-2', 'Second'],
    ]);
  });

  it('replaces the body with the loading indicator while loading', () => {
    const { element } = setup({ rows: ROWS, loading: true });

    expect(element.querySelector('table')?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('flux-loading-indicator')).not.toBeNull();
    expect(element.querySelector('tbody td')?.textContent).toContain('Loading products');
    expect(element.querySelectorAll('tbody tr')).toHaveLength(1);
  });

  it('renders the empty state when settled without rows', () => {
    const { element } = setup({});

    expect(element.querySelector('flux-empty-state')).not.toBeNull();
    const empty = element.querySelector('flux-empty-state')?.textContent ?? '';
    expect(empty).toContain('No products');
    expect(empty).toContain('Try a different filter.');
  });

  it('keeps table semantics inside a scrollable region', () => {
    const { element } = setup({ rows: ROWS });

    expect(element.querySelector('.data-table-scroll')).not.toBeNull();
    expect(element.querySelector('.data-table-scroll table.data-table')).not.toBeNull();
  });
});
