/**
 * Component tests for the Sub-Phase 12.5 `AdminDataTable`.
 *
 * Covers the presentational contract only: typed column headers, cell
 * rendering through value accessors, loading and empty states, and table
 * accessibility semantics. Paging math stays in the shared `totalPagesOf`
 * helper (already unit-covered in `libs/api`) — these tests pin the UI
 * mapping, not the math.
 */

import { Component, computed, TemplateRef, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AdminDataTable, type AdminDataColumn, type AdminDataRowContext } from './data-table';

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
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
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

  it('renders row links as anchors and plain cells as text', () => {
    const { element } = setup({
      columns: [
        { key: 'sku', header: 'SKU', value: (row) => row.sku },
        { key: 'name', header: 'Name', value: (row) => row.name, link: () => '/details' },
        {
          key: 'missing',
          header: 'Missing',
          value: (row) => row.name,
          link: () => null,
        },
      ],
      rows: ROWS,
    });

    const links = [...element.querySelectorAll('tbody td a')];
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/details', '/details']);
    expect(links.map((link) => link.textContent?.trim())).toEqual(['First', 'Second']);
  });

  it('projects row actions with row and index context when templated', () => {
    @Component({
      selector: 'action-table-host',
      imports: [AdminDataTable],
      template: `
        <admin-data-table
          [columns]="columns"
          [rows]="rows"
          [actionsTemplate]="actionsTpl()"
          actionsHeader="Actions"
          emptyTitle="No products"
        />
        <ng-template #actions let-row let-index="index">
          <button type="button" [attr.data-sku]="row.sku" [attr.data-index]="index">Remove</button>
        </ng-template>
      `,
    })
    class ActionHost {
      readonly columns: readonly AdminDataColumn<ProductRow>[] = COLUMNS;
      readonly rows: readonly ProductRow[] = ROWS;
      readonly actionsTpl =
        viewChild.required<TemplateRef<AdminDataRowContext<ProductRow>>>('actions');
    }

    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ActionHost);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('thead th:last-child')?.textContent?.trim()).toBe('Actions');
    const buttons = [...element.querySelectorAll('tbody td.data-table-actions button')];
    expect(buttons).toHaveLength(2);
    expect(buttons.map((button) => button.getAttribute('data-sku'))).toEqual(['SKU-1', 'SKU-2']);
    expect(buttons.map((button) => button.getAttribute('data-index'))).toEqual(['0', '1']);
  });

  it('renders no actions column without a template', () => {
    const { element } = setup({ rows: ROWS });

    expect(element.querySelector('td.data-table-actions')).toBeNull();
    expect(element.querySelectorAll('thead th')).toHaveLength(2);
  });

  it('projects per-column cell templates with row and index context', () => {
    @Component({
      selector: 'cell-table-host',
      imports: [AdminDataTable],
      template: `
        <admin-data-table [columns]="columns()" [rows]="rows" emptyTitle="No products" />
        <ng-template #nameCell let-row let-index="index">
          <strong [attr.data-sku]="row.sku" [attr.data-index]="index">{{ row.name }}</strong>
        </ng-template>
      `,
    })
    class CellHost {
      readonly rows: readonly ProductRow[] = ROWS;
      readonly nameTpl = viewChild<TemplateRef<AdminDataRowContext<ProductRow>>>('nameCell');
      readonly columns = computed((): readonly AdminDataColumn<ProductRow>[] => [
        { key: 'sku', header: 'SKU', value: (row) => row.sku },
        { key: 'name', header: 'Name', value: (row) => row.name, template: this.nameTpl() ?? null },
      ]);
    }

    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(CellHost);
    fixture.detectChanges();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    const cells = [...element.querySelectorAll('tbody tr td:last-child strong')];
    expect(cells).toHaveLength(2);
    expect(cells.map((cell) => cell.getAttribute('data-sku'))).toEqual(['SKU-1', 'SKU-2']);
    expect(cells.map((cell) => cell.getAttribute('data-index'))).toEqual(['0', '1']);
    expect(cells.map((cell) => cell.textContent?.trim())).toEqual(['First', 'Second']);
  });

  it('renders text cells for columns without a template', () => {
    const { element } = setup({
      columns: [
        { key: 'sku', header: 'SKU', value: (row) => row.sku },
        { key: 'name', header: 'Name', value: (row) => row.name, template: null },
      ],
      rows: ROWS,
    });

    expect(element.querySelector('tbody strong')).toBeNull();
    expect(
      [...element.querySelectorAll('tbody tr')].map((row) =>
        [...row.querySelectorAll('td')].map((cell) => cell.textContent?.trim()),
      ),
    ).toEqual([
      ['SKU-1', 'First'],
      ['SKU-2', 'Second'],
    ]);
  });

  it('keeps table semantics inside a scrollable region', () => {
    const { element } = setup({ rows: ROWS });

    expect(element.querySelector('.data-table-scroll')).not.toBeNull();
    expect(element.querySelector('.data-table-scroll table.data-table')).not.toBeNull();
  });
});
