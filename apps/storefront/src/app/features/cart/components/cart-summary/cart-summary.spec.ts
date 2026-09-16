/**
 * Component tests for the cart `CartSummary` (Sub-Phase 7.4 — Cart Page
 * & UI).
 *
 * Covers the presentational contract only (totals live in `CartState`,
 * covered by `cart-state.spec.ts`): count rendering, backend-money rows
 * shown only when present, the pending-totals note while money is
 * absent, clear emission with the in-flight freeze, and the checkout
 * navigation boundary (anchor only — no checkout logic).
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, describe, expect, it } from 'vitest';
import { CartSummary } from './cart-summary';

function setup(
  options: {
    subtotalText?: string | null;
    totalText?: string | null;
    totalsNote?: string | null;
    clearing?: boolean;
  } = {},
): {
  fixture: ComponentFixture<CartSummary>;
  element: HTMLElement;
  clears: number[];
} {
  const clears: number[] = [];
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(CartSummary);
  fixture.componentRef.setInput('title', 'Order summary');
  fixture.componentRef.setInput('itemsLabel', 'Items');
  fixture.componentRef.setInput('itemsValue', '3');
  fixture.componentRef.setInput('subtotalLabel', 'Subtotal');
  fixture.componentRef.setInput('subtotalText', options.subtotalText ?? null);
  fixture.componentRef.setInput('totalLabel', 'Total');
  fixture.componentRef.setInput('totalText', options.totalText ?? null);
  // Explicit `undefined` check (not `??`): tests must be able to pass
  // `null` through to hide the note.
  fixture.componentRef.setInput(
    'totalsNote',
    options.totalsNote === undefined ? 'Finalized at checkout.' : options.totalsNote,
  );
  fixture.componentRef.setInput('clearLabel', 'Clear cart');
  fixture.componentRef.setInput('checkoutLabel', 'Proceed to checkout');
  fixture.componentRef.setInput('clearing', options.clearing ?? false);
  fixture.componentInstance.clear.subscribe(() => {
    clears.push(1);
  });
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement, clears };
}

describe('CartSummary rendering', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the count without money rows while the backend provides none', () => {
    const { element } = setup();
    const text = element.textContent ?? '';

    expect(element.querySelector('.cart-summary-title')?.textContent).toBe('Order summary');
    expect(text).toContain('Items');
    expect(text).toContain('3');
    expect(element.querySelector('.cart-summary-note')?.textContent).toBe('Finalized at checkout.');
    // Money rows stay hidden until backend money exists — never locally summed.
    expect(text).not.toContain('Subtotal');
    expect(text).not.toContain('Total');
  });

  it('renders backend money rows once provided (structure ready, no component change)', () => {
    const { element } = setup({
      subtotalText: '$59.98',
      totalText: '$59.98',
      totalsNote: null,
    });
    const text = element.textContent ?? '';

    expect(text).toContain('Subtotal');
    expect(text).toContain('Total');
    expect(text).toContain('$59.98');
    expect(element.querySelector('.cart-summary-note')).toBeNull();
  });
});

describe('CartSummary actions', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('emits clear on the clear action', () => {
    const { element, fixture, clears } = setup();
    const clear = element.querySelector('.cart-summary-clear') as HTMLButtonElement | null;

    expect(clear?.textContent?.trim()).toBe('Clear cart');

    clear?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(clears).toEqual([1]);
  });

  it('disables the clear action while clearing', () => {
    const { element } = setup({ clearing: true });
    const clear = element.querySelector('.cart-summary-clear') as HTMLButtonElement | null;

    expect(clear?.disabled).toBe(true);
  });

  it('exposes the checkout navigation boundary as an anchor only', () => {
    const { element } = setup();
    const checkout = element.querySelector('.cart-summary-checkout');

    expect(checkout?.tagName).toBe('A');
    expect(checkout?.getAttribute('href')).toBe('/checkout');
    expect(checkout?.textContent?.trim()).toBe('Proceed to checkout');
  });
});
