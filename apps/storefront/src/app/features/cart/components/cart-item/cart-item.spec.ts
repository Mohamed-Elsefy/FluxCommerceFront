/**
 * Component tests for the cart `CartItemComponent` (Sub-Phase 7.4 — Cart
 * Page & UI).
 *
 * Covers the presentational contract only (cart contents live in
 * `CartState`, covered by `cart-state.spec.ts`): backend line rendering
 * (name, SKU, page-formatted unit price), the backend-authoritative
 * pricing pin (no locally computed line total is rendered), the
 * resolved product thumbnail (with placeholder fallback), the details
 * link, quantity bubbling, remove emission, and the in-flight `disabled`
 * freeze.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { formatCurrency } from '@flux/i18n';
import type { CartItem } from '../../models/cart.models';
import { CartItemComponent, type CartItemLabels, type CartItemView } from './cart-item';

const LINE: CartItem = {
  productId: '22222222-2222-4222-8222-222222222222',
  variantId: 'aaaaaaaa-1111-4111-8111-111111111111',
  sku: 'TEE-BLK-M',
  productName: 'Tee',
  unitPriceAmount: 29.99,
  currency: 'USD',
  quantity: 2,
};

const LABELS: CartItemLabels = {
  unitPrice: 'Unit price',
  sku: 'SKU',
  quantity: 'Quantity',
  decrease: 'Decrease quantity',
  increase: 'Increase quantity',
  invalidQuantity: 'Enter a whole number of 1 or more.',
};

function viewFor(item: CartItem = LINE): CartItemView {
  return {
    item,
    unitPriceText: formatCurrency(item.unitPriceAmount, item.currency, 'en'),
    removeLabel: `Remove ${item.productName}`,
    imageUrl: '/cdn/tee.jpg',
    imageAlt: 'Tee front view',
  };
}

function setup(options: { view?: CartItemView; disabled?: boolean } = {}): {
  fixture: ComponentFixture<CartItemComponent>;
  element: HTMLElement;
  quantities: number[];
  removes: number[];
} {
  const quantities: number[] = [];
  const removes: number[] = [];
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(CartItemComponent);
  fixture.componentRef.setInput('view', options.view ?? viewFor());
  fixture.componentRef.setInput('labels', LABELS);
  fixture.componentRef.setInput('disabled', options.disabled ?? false);
  fixture.componentInstance.quantityChange.subscribe((value: number) => quantities.push(value));
  fixture.componentInstance.remove.subscribe(() => {
    removes.push(1);
  });
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement, quantities, removes };
}

describe('CartItemComponent rendering', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the backend product name, SKU, and unit price', () => {
    const { element } = setup();
    const text = element.textContent ?? '';

    expect(element.querySelector('.cart-item-name')?.textContent).toBe('Tee');
    expect(text).toContain('TEE-BLK-M');
    expect(text).toContain(formatCurrency(29.99, 'USD', 'en'));
  });

  it('renders no locally computed line total (backend-authoritative pricing)', () => {
    const { element } = setup();
    const text = element.textContent ?? '';
    // Quantity (2) times the unit-price snapshot ($29.99) must never be
    // computed locally: the forbidden product of that multiplication
    // pins the omission.
    const forbiddenLineTotal = formatCurrency(
      LINE.unitPriceAmount * LINE.quantity,
      LINE.currency,
      'en',
    );

    expect(forbiddenLineTotal).not.toBe('');
    expect(text).not.toContain(forbiddenLineTotal);
  });

  it('renders the resolved product image with the details link', () => {
    const { element } = setup();
    const image = element.querySelector('.cart-item-image') as HTMLImageElement | null;
    const link = element.querySelector('.cart-item-name a');

    expect(image?.getAttribute('src')).toBe('/cdn/tee.jpg');
    expect(image?.getAttribute('alt')).toBe('Tee front view');
    expect(link?.getAttribute('href')).toBe(
      '/catalog/products/22222222-2222-4222-8222-222222222222',
    );
    expect(link?.textContent).toBe('Tee');
  });

  it('renders the fallback box when the product image is unresolvable', () => {
    const { fixture } = setup();
    fixture.componentRef.setInput('view', { ...viewFor(), imageUrl: null, imageAlt: 'Tee' });
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('.cart-item-image')).toBeNull();
    expect(element.querySelector('.cart-item-thumb-fallback')).not.toBeNull();
    expect(element.querySelector('.cart-item-name')?.textContent).toBe('Tee');
  });
});

describe('CartItemComponent actions', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('bubbles valid quantity changes from the control', () => {
    const { element, fixture, quantities } = setup();
    const increase = [...element.querySelectorAll('.quantity-control-button')][1];

    increase?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(quantities).toEqual([3]);
  });

  it('emits remove from the icon-only basket button with the accessible label', () => {
    const { element, fixture, removes } = setup();
    const remove = element.querySelector('.cart-item-remove') as HTMLButtonElement | null;

    expect(remove?.getAttribute('aria-label')).toBe('Remove Tee');
    expect(remove?.querySelector('svg')).not.toBeNull();

    remove?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(removes).toEqual([1]);
  });

  it('freezes quantity and remove controls while disabled', () => {
    const { element } = setup({ disabled: true });
    const remove = element.querySelector('.cart-item-remove') as HTMLButtonElement | null;
    const steppers = [...element.querySelectorAll('.quantity-control-button')].map(
      (button) => button as HTMLButtonElement,
    );
    const field = element.querySelector('.quantity-control-input') as HTMLInputElement | null;

    // Native disabled controls suppress real user interaction; the freeze
    // is pinned through the disabled attributes the page drives.
    expect(remove?.disabled).toBe(true);
    expect(steppers.every((button) => button.disabled)).toBe(true);
    expect(field?.disabled).toBe(true);
  });
});
