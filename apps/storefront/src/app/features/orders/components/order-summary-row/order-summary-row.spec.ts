/**
 * Component tests for the Sub-Phase 10.3 `OrderSummaryRow`.
 *
 * Covers the presentational contract only (verbatim backend rendering,
 * details-link destination, localized labels, pure view projection):
 * the component holds no state and performs no HTTP — data loading
 * stays in `OrdersListState`, transport in `OrdersApiService`.
 *
 * Backend-authority pins: the projector echoes backend values (no
 * totals math — the suite asserts display text, never recomputation);
 * status renders verbatim (no badge, no mapping); no payment status
 * exists anywhere in the view (no such contract field).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CultureService } from '@flux/i18n';
import {
  OrderSummaryRow,
  toOrderRowView,
  type OrderRowLabels,
  type OrderRowView,
} from './order-summary-row';
import type { OrderSummary } from '../../models/orders.models';

const LABELS: OrderRowLabels = {
  date: 'Date',
  status: 'Status',
  items: 'Items',
  total: 'Total',
};

function summary(overrides: Partial<OrderSummary> = {}): OrderSummary {
  return {
    orderId: '11111111-1111-4111-8111-111111111111',
    orderNumber: 'ORD-ABC123DEF456',
    status: 'Confirmed',
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
    ...overrides,
  };
}

function setup(view: OrderRowView): {
  fixture: ComponentFixture<OrderSummaryRow>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(OrderSummaryRow);
  fixture.componentRef.setInput('view', view);
  fixture.componentRef.setInput('labels', LABELS);
  TestBed.inject(CultureService).setCulture('en');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('OrderSummaryRow', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders backend facts verbatim with localized labels', () => {
    const { element } = setup(toOrderRowView(summary(), 'en'));
    const text = element.textContent ?? '';

    expect(text).toContain('ORD-ABC123DEF456');
    expect(text).toContain('Confirmed');
    expect(text).toContain('2');
    expect(text).toContain('Date');
    expect(text).toContain('Status');
    expect(text).toContain('Items');
    expect(text).toContain('Total');
  });

  it('links the order number to its details route', () => {
    const { element } = setup(toOrderRowView(summary(), 'en'));
    const link = element.querySelector('a.order-row-link') as HTMLAnchorElement | null;

    expect(link?.textContent?.trim()).toBe('ORD-ABC123DEF456');
    expect(link?.getAttribute('href')).toBe('/account/orders/11111111-1111-4111-8111-111111111111');
  });

  it('renders status through the order badge (localized, never plain text)', () => {
    const { element } = setup(toOrderRowView(summary({ status: 'Pending' }), 'en'));
    const badge = element.querySelector('orders-order-status-badge span.status-badge');

    expect(badge?.textContent?.trim()).toBe('Pending');
    expect(badge?.className).toContain('tone-info');
  });

  it('renders no payment status (no such contract field)', () => {
    const { element } = setup(toOrderRowView(summary(), 'en'));

    expect(element.querySelectorAll('dt')).toHaveLength(4);
  });
});

describe('toOrderRowView', () => {
  it('projects display strings without recomputing backend values', () => {
    const view = toOrderRowView(summary(), 'en');

    expect(view.orderId).toBe('11111111-1111-4111-8111-111111111111');
    expect(view.detailsRoute).toBe('/account/orders/11111111-1111-4111-8111-111111111111');
    expect(view.orderNumber).toBe('ORD-ABC123DEF456');
    expect(view.statusText).toBe('Confirmed');
    expect(view.itemCount).toBe(2);
    expect(view.dateText.length).toBeGreaterThan(0);
    expect(view.totalText).toContain('59.98');
  });

  it('formats money and dates per culture (display only)', () => {
    const view = toOrderRowView(summary(), 'de');

    expect(view.totalText).toContain('59,98');
    expect(view.dateText.length).toBeGreaterThan(0);
  });
});
