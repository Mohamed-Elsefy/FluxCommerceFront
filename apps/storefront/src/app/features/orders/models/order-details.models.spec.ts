/**
 * Unit tests for the Sub-Phase 10.4 order details view models.
 *
 * Covers the pure projectors only (address joining, item projection,
 * full details projection). The contract mirrors themselves live in
 * `@flux/models` (already covered by Phase 1 specs) and are aliased —
 * never re-declared — so these tests assert the aliasing compiles and
 * the projectors behave, not backend shapes.
 *
 * Backend-authoritative pins: no helper under test computes money
 * (line totals echo the backend `lineTotal`); status echoes verbatim
 * (no badge, no mapping); the view carries no payment status, no tax
 * row, no thumbnails, and no contact details beyond `recipientName`
 * (no such contract fields).
 */

import { describe, expect, it } from 'vitest';
import type { Order, OrderAddress, OrderItem } from './orders.models';
import {
  toOrderAddressView,
  toOrderDetailsItemView,
  toOrderDetailsView,
} from './order-details.models';

function address(overrides: Partial<OrderAddress> = {}): OrderAddress {
  return {
    recipientName: 'Ada Lovelace',
    line1: '1 Flux St',
    line2: null,
    city: 'Berlin',
    region: 'BE',
    postalCode: '10115',
    countryCode: 'DE',
    ...overrides,
  };
}

function item(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    productName: 'Tee',
    sku: 'TEE-BLK-M',
    quantity: 2,
    unitPrice: 29.99,
    unitPriceCurrency: 'USD',
    lineTotal: 59.98,
    lineTotalCurrency: 'USD',
    ...overrides,
  };
}

function order(overrides: Partial<Order> = {}): Order {
  return {
    orderId: '11111111-1111-4111-8111-111111111111',
    orderNumber: 'ORD-ABC123DEF456',
    status: 'Confirmed',
    subtotal: { amount: 59.98, currency: 'USD' },
    shippingCost: { amount: 0, currency: 'USD' },
    discount: { amount: 0, currency: 'USD' },
    grandTotal: { amount: 59.98, currency: 'USD' },
    itemCount: 2,
    createdAtUtc: '2026-09-04T10:00:00Z',
    shippingAddress: address(),
    billingAddress: address(),
    lineItems: [item()],
    ...overrides,
  };
}

describe('toOrderAddressView', () => {
  it('joins backend address fields into display lines', () => {
    expect(toOrderAddressView(address())).toEqual({
      recipientName: 'Ada Lovelace',
      lines: ['1 Flux St', 'Berlin, BE 10115', 'DE'],
    });
  });

  it('keeps a provided second line in wire order', () => {
    expect(toOrderAddressView(address({ line2: 'Apt 4' })).lines).toEqual([
      '1 Flux St',
      'Apt 4',
      'Berlin, BE 10115',
      'DE',
    ]);
  });

  it('drops blank fragments without throwing', () => {
    expect(
      toOrderAddressView(address({ line2: '   ', city: '', region: '', postalCode: '' })).lines,
    ).toEqual(['1 Flux St', 'DE']);
  });
});

describe('toOrderDetailsItemView', () => {
  it('echoes the backend line total instead of recomputing it', () => {
    // A deliberately inconsistent backend lineTotal proves the projector
    // never multiplies: display follows the backend, not the math.
    const view = toOrderDetailsItemView(
      item({ quantity: 3, unitPrice: 10, lineTotal: 999.99 }),
      'en',
    );

    expect(view.productName).toBe('Tee');
    expect(view.sku).toBe('TEE-BLK-M');
    expect(view.quantity).toBe(3);
    expect(view.unitPriceText).toContain('10');
    expect(view.lineTotalText).toContain('999.99');
  });

  it('formats money per culture (display only)', () => {
    expect(toOrderDetailsItemView(item(), 'de').lineTotalText).toContain('59,98');
  });
});

describe('toOrderDetailsView', () => {
  it('projects backend facts verbatim for display', () => {
    const view = toOrderDetailsView(order(), 'en');

    expect(view.orderId).toBe('11111111-1111-4111-8111-111111111111');
    expect(view.orderNumber).toBe('ORD-ABC123DEF456');
    expect(view.statusText).toBe('Confirmed');
    expect(view.customerName).toBe('Ada Lovelace');
    expect(view.itemCount).toBe(2);
    expect(view.dateText.length).toBeGreaterThan(0);
    expect(view.items).toHaveLength(1);
    expect(view.totals.subtotalText).toContain('59.98');
    expect(view.totals.discountText).toContain('0');
    expect(view.totals.shippingCostText).toContain('0');
    expect(view.totals.grandTotalText).toContain('59.98');
  });

  it('projects both address echoes independently', () => {
    const view = toOrderDetailsView(
      order({ billingAddress: address({ line1: '2 Other Rd', city: 'Paris' }) }),
      'en',
    );

    expect(view.shippingAddress.lines[0]).toBe('1 Flux St');
    expect(view.billingAddress.lines[0]).toBe('2 Other Rd');
  });

  it('exposes no invented capability surface (payment, tax, media, contacts)', () => {
    const view = toOrderDetailsView(order(), 'en');

    expect(view).not.toHaveProperty('paymentStatus');
    expect(view).not.toHaveProperty('tax');
    expect(view).not.toHaveProperty('thumbnail');
    expect(view).not.toHaveProperty('email');
    expect(view).not.toHaveProperty('phone');
    expect(view.totals).not.toHaveProperty('taxText');
  });
});
