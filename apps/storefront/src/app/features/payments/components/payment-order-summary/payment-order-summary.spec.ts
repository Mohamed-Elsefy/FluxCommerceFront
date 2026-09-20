/**
 * Component tests for the Sub-Phase 9.10 `PaymentOrderSummaryComponent`.
 *
 * Covers the presentational contract only: nothing renders without a
 * view, a projected view renders backend-issued texts verbatim (labels,
 * lines, counts, money rows), and no money math exists anywhere in the
 * projection (a `unitPrice × quantity` product must appear nowhere).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import type { OrderDetailsResponse, OrderMoneyResponse } from '@flux/models';
import {
  PaymentOrderSummaryComponent,
  toPaymentOrderSummaryView,
  type PaymentOrderSummaryLabels,
} from './payment-order-summary';

const LABELS: PaymentOrderSummaryLabels = {
  title: 'Order summary',
  items: 'Items',
  orderNumber: 'Order number',
  quantity: 'Quantity',
  unitPrice: 'Unit price',
  sku: 'SKU',
  subtotal: 'Subtotal',
  shippingCost: 'Shipping',
  discount: 'Discount',
  grandTotal: 'Total',
};

function order(): OrderDetailsResponse {
  return {
    orderId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    orderNumber: 'ORD-ABC123DEF456',
    status: 'Pending',
    subtotal: { amount: 59.98, currency: 'USD' },
    shippingCost: { amount: 0, currency: 'USD' },
    discount: { amount: 0, currency: 'USD' },
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
    shippingAddress: {
      recipientName: 'Ada Lovelace',
      line1: '1 Flux St',
      line2: null,
      city: 'Berlin',
      region: 'BE',
      postalCode: '10115',
      countryCode: 'DE',
    },
    billingAddress: {
      recipientName: 'Ada Lovelace',
      line1: '1 Flux St',
      line2: null,
      city: 'Berlin',
      region: 'BE',
      postalCode: '10115',
      countryCode: 'DE',
    },
    lineItems: [
      {
        productName: 'Tee',
        sku: 'TEE-BLK-M',
        quantity: 2,
        unitPrice: 29.99,
        unitPriceCurrency: 'USD',
        lineTotal: 59.98,
        lineTotalCurrency: 'USD',
      },
    ],
  };
}

function formatMoney(money: OrderMoneyResponse): string {
  return `${money.amount} ${money.currency}`;
}

function setup(): {
  fixture: ComponentFixture<PaymentOrderSummaryComponent>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(PaymentOrderSummaryComponent);
  fixture.componentRef.setInput('labels', LABELS);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('toPaymentOrderSummaryView', () => {
  it('projects backend facts without computing money', () => {
    const view = toPaymentOrderSummaryView(order(), formatMoney);
    expect(view?.orderNumber).toBe('ORD-ABC123DEF456');
    expect(view?.itemCount).toBe(2);
    expect(view?.lines).toHaveLength(1);
    expect(view?.lines[0]).toEqual({
      productName: 'Tee',
      sku: 'TEE-BLK-M',
      quantity: 2,
      unitPriceText: '29.99 USD',
    });
    expect(view?.totals.grandTotalText).toBe('59.98 USD');
  });

  it('returns null for a missing order', () => {
    expect(toPaymentOrderSummaryView(null, formatMoney)).toBeNull();
    expect(toPaymentOrderSummaryView(undefined, formatMoney)).toBeNull();
  });
});

describe('PaymentOrderSummaryComponent', () => {
  it('renders nothing without a view', () => {
    const { fixture, element } = setup();
    expect(fixture.componentInstance).toBeTruthy();
    expect(element.querySelector('.payment-order-summary')).toBeNull();
  });

  it('renders the backend-issued view verbatim', () => {
    const { fixture, element } = setup();
    fixture.componentRef.setInput('view', toPaymentOrderSummaryView(order(), formatMoney));
    fixture.detectChanges();

    const text = element.textContent ?? '';
    expect(text).toContain('Order summary');
    expect(text).toContain('ORD-ABC123DEF456');
    expect(text).toContain('Tee');
    expect(text).toContain('TEE-BLK-M');
    expect(text).toContain('29.99 USD');
    expect(text).toContain('59.98 USD');
  });

  it('projects every label slot from the page-localized labels', () => {
    const { fixture, element } = setup();
    fixture.componentRef.setInput('view', toPaymentOrderSummaryView(order(), formatMoney));
    fixture.detectChanges();

    const text = element.textContent ?? '';
    for (const label of [
      'Order summary',
      'Items',
      'Order number',
      'Quantity',
      'Unit price',
      'SKU',
      'Subtotal',
      'Shipping',
      'Discount',
      'Total',
    ]) {
      expect(text, label).toContain(label);
    }
  });
});
