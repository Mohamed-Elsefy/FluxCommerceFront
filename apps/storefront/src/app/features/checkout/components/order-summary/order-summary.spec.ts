/**
 * Component tests for the checkout `OrderSummaryComponent` (Sub-Phase
 * 8.5) plus the `toOrderSummaryView` projector.
 *
 * Covers the presentational contract only: line rendering from
 * backend-issued facts (name, SKU, quantity, preformatted unit price),
 * backend money rows verbatim with per-row presence, the pending note
 * when money is absent (never locally summed), the empty state, label
 * resolution from inputs, dynamic sync on input change — and the two
 * hard guardrails: NO computed line totals anywhere, and NO
 * shipping-method UI (the contract carries neither).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import type { OrderMoneyResponse } from '@flux/models';
import type { CheckoutOrderSummary } from '../../models/checkout.models';
import {
  OrderSummaryComponent,
  toOrderSummaryView,
  type OrderSummaryLabels,
  type OrderSummaryView,
} from './order-summary';

const LABELS: OrderSummaryLabels = {
  title: 'Order summary',
  items: 'Items',
  emptyTitle: 'Nothing to review',
  emptyMessage: 'Your cart is empty.',
  quantity: 'Quantity',
  unitPrice: 'Unit price',
  sku: 'SKU',
  subtotal: 'Subtotal',
  shippingCost: 'Shipping',
  discount: 'Discount',
  grandTotal: 'Total',
  totalsPending: 'Totals are finalized when your order is created.',
};

function summary(overrides: Partial<CheckoutOrderSummary> = {}): CheckoutOrderSummary {
  return {
    cartId: '11111111-1111-4111-8111-111111111111',
    lines: [
      {
        productName: 'Tee',
        sku: 'TEE-BLK-M',
        quantity: 2,
        unitPriceAmount: 29.99,
        currency: 'USD',
      },
    ],
    itemCount: 2,
    distinctItemCount: 1,
    currency: 'USD',
    subtotal: null,
    shippingCost: null,
    discount: null,
    grandTotal: null,
    ...overrides,
  };
}

function formatMoney(money: OrderMoneyResponse): string {
  return `${money.amount.toFixed(2)} ${money.currency}`;
}

function viewOf(overrides: Partial<CheckoutOrderSummary> = {}): OrderSummaryView | null {
  return toOrderSummaryView(summary(overrides), formatMoney);
}

function setup(view: OrderSummaryView | null): {
  fixture: ComponentFixture<OrderSummaryComponent>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(OrderSummaryComponent);
  fixture.componentRef.setInput('view', view);
  fixture.componentRef.setInput('labels', LABELS);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('toOrderSummaryView', () => {
  it('returns null for missing and line-free summaries', () => {
    expect(toOrderSummaryView(null, formatMoney)).toBeNull();
    expect(toOrderSummaryView(undefined, formatMoney)).toBeNull();
    expect(toOrderSummaryView(summary({ lines: [] }), formatMoney)).toBeNull();
  });

  it('maps lines verbatim through the page formatter without math', () => {
    const seen: OrderMoneyResponse[] = [];
    const view = toOrderSummaryView(summary(), (money) => {
      seen.push(money);
      return formatMoney(money);
    });

    expect(view?.lines).toEqual([
      { productName: 'Tee', sku: 'TEE-BLK-M', quantity: 2, unitPriceText: '29.99 USD' },
    ]);
    // The formatter sees the unit snapshot only — never a computed line total.
    expect(seen).toEqual([{ amount: 29.99, currency: 'USD' }]);
    expect(view?.itemCount).toBe(2);
    expect(view?.distinctItemCount).toBe(1);
  });

  it('maps absent money to null texts and backend money to formatted rows', () => {
    expect(viewOf()?.totals).toEqual({
      subtotalText: null,
      shippingCostText: null,
      discountText: null,
      grandTotalText: null,
    });

    const withMoney = viewOf({
      subtotal: { amount: 59.98, currency: 'USD' },
      shippingCost: { amount: 0, currency: 'USD' },
      discount: { amount: 5, currency: 'USD' },
      grandTotal: { amount: 54.98, currency: 'USD' },
    });
    expect(withMoney?.totals).toEqual({
      subtotalText: '59.98 USD',
      shippingCostText: '0.00 USD',
      discountText: '5.00 USD',
      grandTotalText: '54.98 USD',
    });
  });
});

describe('OrderSummaryComponent rendering', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the title, counts, and backend-issued line facts', () => {
    const { element } = setup(viewOf());

    expect(element.querySelector('.order-summary-title')?.textContent).toBe('Order summary');
    expect(element.querySelector('.order-summary-count')?.textContent).toContain('Items: 2');
    expect(element.querySelector('.order-summary-name')?.textContent).toBe('Tee');
    const text = element.textContent ?? '';
    expect(text).toContain('SKU: TEE-BLK-M');
    expect(text).toContain('Quantity: 2');
    expect(text).toContain('Unit price: 29.99 USD');
  });

  it('renders multiple lines with structural counts', () => {
    const { element } = setup(
      viewOf({
        lines: [
          {
            productName: 'Tee',
            sku: 'TEE-BLK-M',
            quantity: 2,
            unitPriceAmount: 29.99,
            currency: 'USD',
          },
          {
            productName: 'Hoodie',
            sku: 'HDD-GRY-L',
            quantity: 1,
            unitPriceAmount: 49.5,
            currency: 'USD',
          },
        ],
        itemCount: 3,
        distinctItemCount: 2,
      }),
    );

    expect(element.querySelectorAll('.order-summary-line')).toHaveLength(2);
    expect(element.querySelector('.order-summary-count')?.textContent).toContain('Items: 3');
    const text = element.textContent ?? '';
    expect(text).toContain('HDD-GRY-L');
    expect(text).toContain('49.50 USD');
  });

  it('never renders computed line totals', () => {
    const { element } = setup(viewOf());

    // 2 × 29.99 would be 59.98 — that product must appear nowhere: the
    // contract exposes no lineTotal and the component multiplies nothing.
    expect(element.textContent).not.toContain('59.98');
  });

  it('renders backend money rows verbatim when provided', () => {
    const { element } = setup(
      viewOf({
        subtotal: { amount: 59.98, currency: 'USD' },
        shippingCost: { amount: 0, currency: 'USD' },
        discount: { amount: 5, currency: 'USD' },
        grandTotal: { amount: 54.98, currency: 'USD' },
      }),
    );
    const text = element.textContent ?? '';

    expect(text).toContain('Subtotal');
    expect(text).toContain('59.98 USD');
    expect(text).toContain('Shipping');
    expect(text).toContain('0.00 USD');
    expect(text).toContain('Discount');
    expect(text).toContain('5.00 USD');
    expect(text).toContain('Total');
    expect(text).toContain('54.98 USD');
    expect(element.querySelector('.order-summary-pending')).toBeNull();
  });

  it('renders only the provided money rows (partial backend data stays honest)', () => {
    const { element } = setup(viewOf({ grandTotal: { amount: 54.98, currency: 'USD' } }));
    const text = element.textContent ?? '';

    expect(text).toContain('54.98 USD');
    expect(element.querySelector('.order-summary-totals')).not.toBeNull();
  });

  it('renders the pending note — never local sums — when money is absent', () => {
    const { element } = setup(viewOf());
    const text = element.textContent ?? '';

    expect(element.querySelector('.order-summary-totals')).toBeNull();
    expect(text).toContain('Totals are finalized when your order is created.');
  });

  it('renders no shipping-method UI (the contract carries no method field)', () => {
    const { element } = setup(viewOf());

    expect(element.querySelector('select')).toBeNull();
    expect(element.textContent).not.toMatch(/shipping method/i);
  });

  it('renders the empty state for missing views', () => {
    const { element } = setup(null);

    expect(element.querySelector('.order-summary-empty-title')?.textContent).toBe(
      'Nothing to review',
    );
    expect(element.textContent).toContain('Your cart is empty.');
    expect(element.querySelector('.order-summary-lines')).toBeNull();
  });

  it('syncs dynamically when the view input changes', () => {
    const { fixture, element } = setup(viewOf());
    expect(element.textContent).toContain('Tee');

    fixture.componentRef.setInput(
      'view',
      viewOf({
        lines: [
          {
            productName: 'Hoodie',
            sku: 'HDD-GRY-L',
            quantity: 1,
            unitPriceAmount: 49.5,
            currency: 'USD',
          },
        ],
        itemCount: 1,
        distinctItemCount: 1,
      }),
    );
    fixture.detectChanges();

    expect(element.textContent).toContain('Hoodie');
    expect(element.textContent).not.toContain('Tee');
    expect(element.querySelector('.order-summary-count')?.textContent).toContain('Items: 1');
  });
});
