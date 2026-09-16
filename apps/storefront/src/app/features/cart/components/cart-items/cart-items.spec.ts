/**
 * Component tests for the cart `CartItems` list (Sub-Phase 7.4 — Cart
 * Page & UI).
 *
 * Covers the presentational contract only (cart contents live in
 * `CartState`, covered by `cart-state.spec.ts`): line rendering in
 * backend order, per-line quantity bubbling with line identity, per-line
 * remove bubbling with line identity, and the in-flight `disabled`
 * freeze forwarded to every line.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import type { CartItem } from '../../models/cart.models';
import type { CartItemLabels, CartItemView } from '../cart-item/cart-item';
import { CartItems, type CartLineQuantityChange } from './cart-items';

const LABELS: CartItemLabels = {
  unitPrice: 'Unit price',
  sku: 'SKU',
  quantity: 'Quantity',
  decrease: 'Decrease quantity',
  increase: 'Increase quantity',
  invalidQuantity: 'Enter a whole number of 1 or more.',
};

function viewFor(sku: string, variantId: string, quantity: number): CartItemView {
  const item: CartItem = {
    productId: '22222222-2222-4222-8222-222222222222',
    variantId,
    sku,
    productName: `Tee ${sku}`,
    unitPriceAmount: 29.99,
    currency: 'USD',
    quantity,
  };
  return { item, unitPriceText: '$29.99', removeLabel: `Remove Tee ${sku}` };
}

const VIEWS: readonly CartItemView[] = [
  viewFor('TEE-BLK-M', 'aaaaaaaa-1111-4111-8111-111111111111', 2),
  viewFor('TEE-WHT-M', 'bbbbbbbb-2222-4222-8222-222222222222', 1),
];

function setup(options: { views?: readonly CartItemView[]; disabled?: boolean } = {}): {
  fixture: ComponentFixture<CartItems>;
  element: HTMLElement;
  quantities: CartLineQuantityChange[];
  removes: string[];
} {
  const quantities: CartLineQuantityChange[] = [];
  const removes: string[] = [];
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(CartItems);
  fixture.componentRef.setInput('views', options.views ?? VIEWS);
  fixture.componentRef.setInput('title', 'Cart items');
  fixture.componentRef.setInput('itemLabels', LABELS);
  fixture.componentRef.setInput('disabled', options.disabled ?? false);
  fixture.componentInstance.quantityChange.subscribe((change) => quantities.push(change));
  fixture.componentInstance.remove.subscribe((variantId: string) => removes.push(variantId));
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement, quantities, removes };
}

describe('CartItems rendering', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the heading and every line in backend order', () => {
    const { element } = setup();
    const lines = [...element.querySelectorAll('.cart-items-line')];

    expect(element.querySelector('.cart-items-title')?.textContent).toBe('Cart items');
    expect(lines).toHaveLength(2);
    expect(lines[0]?.textContent).toContain('Tee TEE-BLK-M');
    expect(lines[1]?.textContent).toContain('Tee TEE-WHT-M');
  });
});

describe('CartItems actions', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('bubbles per-line quantity changes with line identity', () => {
    const { element, fixture, quantities } = setup();
    const increase = element
      .querySelectorAll('.cart-items-line')[1]
      ?.querySelectorAll('.quantity-control-button')[1];

    increase?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(quantities).toEqual([
      { variantId: 'bbbbbbbb-2222-4222-8222-222222222222', quantity: 2 },
    ]);
  });

  it('bubbles per-line removes with line identity', () => {
    const { element, fixture, removes } = setup();
    const remove = element
      .querySelectorAll('.cart-items-line')[0]
      ?.querySelector('.cart-item-remove');

    remove?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(removes).toEqual(['aaaaaaaa-1111-4111-8111-111111111111']);
  });

  it('freezes every line control while disabled', () => {
    const { element } = setup({ disabled: true });
    const steppers = [...element.querySelectorAll('.quantity-control-button')].map(
      (button) => button as HTMLButtonElement,
    );
    const removes = [...element.querySelectorAll('.cart-item-remove')].map(
      (button) => button as HTMLButtonElement,
    );

    expect(steppers).toHaveLength(4);
    expect(steppers.every((button) => button.disabled)).toBe(true);
    expect(removes.every((button) => button.disabled)).toBe(true);
  });
});
