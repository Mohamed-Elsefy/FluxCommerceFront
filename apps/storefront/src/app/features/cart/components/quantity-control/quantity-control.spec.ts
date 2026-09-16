/**
 * Component tests for the cart `QuantityControl` (Sub-Phase 7.4 — Cart
 * Page & UI).
 *
 * Covers the presentational contract only (cart quantities live in
 * `CartState`, covered by `cart-state.spec.ts`): increment/decrement
 * emission, minimum-bound disabling, valid-text emission, invalid-text
 * prevention (no emit + localized error), blur revert, the in-flight
 * `disabled` freeze, and accessible native controls with labels.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { QuantityControl } from './quantity-control';

function setup(options: { quantity?: number; disabled?: boolean } = {}): {
  fixture: ComponentFixture<QuantityControl>;
  element: HTMLElement;
  emitted: number[];
} {
  const emitted: number[] = [];
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(QuantityControl);
  fixture.componentRef.setInput('quantity', options.quantity ?? 1);
  fixture.componentRef.setInput('label', 'Quantity');
  fixture.componentRef.setInput('decreaseLabel', 'Decrease quantity');
  fixture.componentRef.setInput('increaseLabel', 'Increase quantity');
  fixture.componentRef.setInput('invalidMessage', 'Enter a whole number of 1 or more.');
  fixture.componentRef.setInput('disabled', options.disabled ?? false);
  fixture.componentInstance.quantityChange.subscribe((value: number) => emitted.push(value));
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement, emitted };
}

function buttons(element: HTMLElement): HTMLButtonElement[] {
  return [...element.querySelectorAll('.quantity-control-button')].map(
    (button) => button as HTMLButtonElement,
  );
}

function input(element: HTMLElement): HTMLInputElement {
  const field = element.querySelector('.quantity-control-input');
  expect(field).not.toBeNull();
  return field as HTMLInputElement;
}

function typeText(
  fixture: ComponentFixture<QuantityControl>,
  element: HTMLElement,
  text: string,
): void {
  input(element).value = text;
  input(element).dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

describe('QuantityControl stepping', () => {
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

  it('freezes stepping while disabled (in-flight mutation)', () => {
    const { fixture, element, emitted } = setup({ quantity: 2, disabled: true });

    expect(buttons(element)[0]?.disabled).toBe(true);
    expect(buttons(element)[1]?.disabled).toBe(true);
    expect(input(element).disabled).toBe(true);

    fixture.componentInstance.decrease();
    fixture.componentInstance.increase();
    expect(emitted).toEqual([]);
  });
});

describe('QuantityControl text input', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('emits valid typed quantities without an error', () => {
    const { element, fixture, emitted } = setup({ quantity: 1 });

    typeText(fixture, element, '4');

    expect(emitted).toEqual([4]);
    expect(element.querySelector('.quantity-control-error')).toBeNull();
    expect(input(element).getAttribute('aria-invalid')).toBe('false');
  });

  it('blocks invalid text with a localized error and no emission', () => {
    const { element, fixture, emitted } = setup({ quantity: 1 });

    typeText(fixture, element, 'two');

    expect(emitted).toEqual([]);
    expect(element.querySelector('.quantity-control-error')?.textContent).toContain(
      'Enter a whole number of 1 or more.',
    );
    expect(input(element).getAttribute('aria-invalid')).toBe('true');
  });

  it('reverts invalid drafts to the committed quantity on blur', () => {
    const { element, fixture } = setup({ quantity: 2 });

    typeText(fixture, element, '0');
    input(element).dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(input(element).value).toBe('2');
    expect(element.querySelector('.quantity-control-error')).toBeNull();
  });

  it('ignores keystrokes while disabled', () => {
    const { element, fixture, emitted } = setup({ quantity: 2, disabled: true });

    typeText(fixture, element, '5');

    expect(emitted).toEqual([]);
  });
});

describe('QuantityControl accessibility', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('labels every control accessibly', () => {
    const { element } = setup({ quantity: 2 });

    expect(element.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('Quantity');
    expect(buttons(element)[0]?.getAttribute('aria-label')).toBe('Decrease quantity');
    expect(buttons(element)[1]?.getAttribute('aria-label')).toBe('Increase quantity');
    expect(input(element).getAttribute('aria-label')).toBe('Quantity');
    expect(input(element).getAttribute('inputmode')).toBe('numeric');
  });
});
