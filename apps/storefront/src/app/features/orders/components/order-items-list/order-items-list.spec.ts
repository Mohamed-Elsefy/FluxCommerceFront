/**
 * Component tests for the Sub-Phase 10.4 `OrderItemsList`.
 *
 * Covers the presentational contract only (column headers, verbatim
 * row rendering, empty note): the component holds no state, performs
 * no HTTP, and computes no money — row projection stays in
 * `order-details.models.spec.ts`.
 *
 * Backend-authority pin: an inconsistent backend `lineTotalText`
 * renders verbatim (the component never multiplies).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OrderItemsList, type OrderItemsLabels } from './order-items-list';
import type { OrderDetailsItemView } from '../../models/order-details.models';

const LABELS: OrderItemsLabels = {
  product: 'Product',
  sku: 'SKU',
  quantity: 'Qty',
  unitPrice: 'Unit price',
  lineTotal: 'Line total',
};

const ROWS: readonly OrderDetailsItemView[] = [
  {
    productName: 'Tee',
    sku: 'TEE-BLK-M',
    quantity: 2,
    unitPriceText: '$29.99',
    lineTotalText: '$59.98',
  },
  {
    productName: 'Hoodie',
    sku: 'HOD-GRY-L',
    quantity: 3,
    unitPriceText: '$10.00',
    // Deliberately inconsistent with quantity × unit price: display
    // follows the backend, never local math.
    lineTotalText: '$999.99',
  },
];

function setup(items: readonly OrderDetailsItemView[] = ROWS): {
  fixture: ComponentFixture<OrderItemsList>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(OrderItemsList);
  fixture.componentRef.setInput('items', items);
  fixture.componentRef.setInput('labels', LABELS);
  fixture.componentRef.setInput('emptyMessage', 'No items on this order.');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('OrderItemsList', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders localized column headers with column scope', () => {
    const { element } = setup();
    const headers = [...element.querySelectorAll('thead th')];

    expect(headers.map((header) => header.textContent?.trim())).toEqual([
      'Product',
      'SKU',
      'Qty',
      'Unit price',
      'Line total',
    ]);
    expect(headers.every((header) => header.getAttribute('scope') === 'col')).toBe(true);
  });

  it('renders one row per backend line with verbatim money', () => {
    const { element } = setup();
    const rows = [...element.querySelectorAll('tbody tr')];

    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain('TEE-BLK-M');
    expect(rows[0]?.textContent).toContain('$59.98');
    expect(rows[1]?.textContent).toContain('$999.99');
    expect(element.querySelector('table')).not.toBeNull();
  });

  it('renders the empty note instead of a table without items', () => {
    const { element } = setup([]);

    expect(element.querySelector('table')).toBeNull();
    expect(element.textContent?.trim()).toBe('No items on this order.');
  });

  it('wraps the table in a scroll container on narrow viewports', () => {
    const { element } = setup();
    const wrapper = element.querySelector('.items-scroll');

    expect(wrapper).not.toBeNull();
    expect(wrapper?.querySelector('table.items-table')).not.toBeNull();
  });

  it('renders identical rows under RTL direction', () => {
    document.documentElement.dir = 'rtl';
    try {
      const { element } = setup();
      const rows = [...element.querySelectorAll('tbody tr')];

      expect(rows).toHaveLength(2);
      expect(rows[0]?.textContent).toContain('TEE-BLK-M');
    } finally {
      document.documentElement.dir = 'ltr';
    }
  });
});
