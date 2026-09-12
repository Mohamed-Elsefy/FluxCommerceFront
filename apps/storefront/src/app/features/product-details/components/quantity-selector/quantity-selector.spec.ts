/**
 * Component tests for the `QuantitySelector` (Sub-Phase 6.6 — Quantity
 * Selection).
 *
 * Covers the presentational contract only (quantity state lives in
 * `ProductDetailsState`, covered by `product-details-state.spec.ts`):
 * increment/decrement emission, minimum-bound disabling, valid-text
 * emission, invalid-text prevention (no emit + localized error), blur
 * revert, and accessible native controls with labels.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { QuantitySelector } from './quantity-selector';

function setup(options: { quantity?: number } = {}): {
  fixture: ComponentFixture<QuantitySelector>;
  element: HTMLElement;
  emitted: number[];
} {
  const emitted: number[] = [];
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(QuantitySelector);
  fixture.componentRef.setInput('quantity', options.quantity ?? 1);
  fixture.componentRef.setInput('label', 'Quantity');
  fixture.componentRef.setInput('decreaseLabel', 'Decrease quantity');
  fixture.componentRef.setInput('increaseLabel', 'Increase quantity');
  fixture.componentRef.setInput('invalidMessage', 'Enter a whole number of 1 or more.');
  fixture.componentInstance.quantityChange.subscribe((value: number) => emitted.push(value));
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement, emitted };
}

function buttons(element: HTMLElement): HTMLButtonElement[] {
  return [...element.querySelectorAll('.quantity-selector-button')].map(
    (button) => button as HTMLButtonElement,
  );
}

function input(element: HTMLElement): HTMLInputElement {
  const field = element.querySelector('.quantity-selector-input');
  expect(field).not.toBeNull();
  return field as HTMLInputElement;
}

function typeText(
  fixture: ComponentFixture<QuantitySelector>,
  element: HTMLElement,
  text: string,
): void {
  input(element).value = text;
  input(element).dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

describe('QuantitySelector stepping', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the committed quantity', () => {
    const { element } = setup({ quantity: 3 });

    expect(input(element).value).toBe('3');
  });

  it('increments on increase', () => {
    const { element, fixture, emitted } = setup({ quantity: 2 });

    buttons(element)[1]?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(emitted).toEqual([3]);
  });

  it('decrements on decrease above the minimum', () => {
    const { element, fixture, emitted } = setup({ quantity: 3 });

    buttons(element)[0]?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(emitted).toEqual([2]);
  });

  it('disables decrement at the minimum and never emits below it', () => {
    const { fixture, element, emitted } = setup({ quantity: 1 });
    const decrease = buttons(element)[0];

    expect(decrease?.disabled).toBe(true);

    fixture.componentInstance.decrease();
    expect(emitted).toEqual([]);
  });
});

describe('QuantitySelector text input', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('emits valid typed quantities without an error', () => {
    const { element, fixture, emitted } = setup({ quantity: 1 });

    typeText(fixture, element, '4');

    expect(emitted).toEqual([4]);
    expect(element.querySelector('.quantity-selector-error')).toBeNull();
    expect(input(element).getAttribute('aria-invalid')).toBe('false');
  });

  it('blocks invalid text with a localized error and no emission', () => {
    const { element, fixture, emitted } = setup({ quantity: 2 });

    for (const text of ['', '0', '-3', '2.5', 'two']) {
      typeText(fixture, element, text);
    }

    expect(emitted).toEqual([]);
    expect(element.querySelector('.quantity-selector-error')?.textContent?.trim()).toBe(
      'Enter a whole number of 1 or more.',
    );
    expect(input(element).getAttribute('aria-invalid')).toBe('true');
    expect(input(element).getAttribute('aria-describedby')).toBe('quantity-input-error');
  });

  it('reverts an invalid draft to the committed quantity on blur', () => {
    const { element, fixture } = setup({ quantity: 2 });

    typeText(fixture, element, 'oops');
    expect(element.querySelector('.quantity-selector-error')).not.toBeNull();

    input(element).dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(input(element).value).toBe('2');
    expect(element.querySelector('.quantity-selector-error')).toBeNull();
  });
});

describe('QuantitySelector accessibility', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('exposes labelled native controls', () => {
    const { element } = setup({});
    const [decrease, increase] = buttons(element);

    expect(decrease?.tagName).toBe('BUTTON');
    expect(decrease?.getAttribute('type')).toBe('button');
    expect(decrease?.getAttribute('aria-label')).toBe('Decrease quantity');
    expect(increase?.getAttribute('aria-label')).toBe('Increase quantity');
    expect(input(element).getAttribute('aria-label')).toBe('Quantity');
    expect(input(element).getAttribute('inputmode')).toBe('numeric');
  });
});
