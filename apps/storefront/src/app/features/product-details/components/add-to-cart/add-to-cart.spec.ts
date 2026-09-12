/**
 * Component tests for the `AddToCart` button (Sub-Phase 6.7 — Add to Cart
 * Integration).
 *
 * Covers the presentational contract only (submission state lives in
 * `ProductDetailsState`, covered by `product-details-state.spec.ts`):
 * idle/adding/added/error rendering, activation emission, duplicate and
 * disabled guards, and keyboard-operable native controls.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AddToCartStatus } from '../../models/product-details.models';
import { AddToCart } from './add-to-cart';

function setup(
  options: {
    status?: AddToCartStatus;
    disabled?: boolean;
    errorMessage?: string | null;
  } = {},
): {
  fixture: ComponentFixture<AddToCart>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(AddToCart);
  fixture.componentRef.setInput('status', options.status ?? 'idle');
  fixture.componentRef.setInput('disabled', options.disabled ?? false);
  fixture.componentRef.setInput('addLabel', 'Add to cart');
  fixture.componentRef.setInput('addingLabel', 'Adding…');
  fixture.componentRef.setInput('addedLabel', 'Added to cart.');
  fixture.componentRef.setInput(
    'errorMessage',
    options.errorMessage === undefined ? null : options.errorMessage,
  );
  fixture.componentRef.setInput('retryLabel', 'Try again');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AddToCart states', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the idle action enabled', () => {
    const { element } = setup({});
    const button = element.querySelector('.add-to-cart-button');

    expect(button?.textContent).toContain('Add to cart');
    expect(button?.hasAttribute('disabled')).toBe(false);
  });

  it('renders progress disabled while adding', () => {
    const { element } = setup({ status: 'adding' });
    const button = element.querySelector('.add-to-cart-button');

    expect(button?.textContent).toContain('Adding…');
    expect(button?.hasAttribute('disabled')).toBe(true);
    expect(element.querySelector('flux-spinner')).not.toBeNull();
  });

  it('renders the confirmation instead of the button once added', () => {
    const { element } = setup({ status: 'added' });

    expect(element.querySelector('.add-to-cart-button')).toBeNull();
    const confirmation = element.querySelector('.add-to-cart-confirmation');
    expect(confirmation?.textContent).toBe('Added to cart.');
    expect(confirmation?.getAttribute('role')).toBe('status');
  });

  it('renders the error with retry affordance on failure', () => {
    const { element } = setup({ status: 'error', errorMessage: 'Something went wrong.' });
    const error = element.querySelector('.add-to-cart-error');

    expect(error?.textContent).toBe('Something went wrong.');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(element.querySelector('.add-to-cart-retry')?.textContent).toContain('Try again');
  });

  it('hides the error block without a message', () => {
    const { element } = setup({ status: 'error', errorMessage: null });

    expect(element.querySelector('.add-to-cart-error')).toBeNull();
    expect(element.querySelector('.add-to-cart-retry')).not.toBeNull();
  });
});

describe('AddToCart activation guards', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('emits on valid activation', () => {
    const { element, fixture } = setup({});
    const component = fixture.componentInstance;
    const emit = vi.spyOn(component.add, 'emit');

    element.querySelector('.add-to-cart-button')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('never emits while adding (duplicate-submission lock)', () => {
    const { fixture } = setup({ status: 'adding' });
    const component = fixture.componentInstance;
    const emit = vi.spyOn(component.add, 'emit');

    component.requestAdd();

    expect(emit).not.toHaveBeenCalled();
  });

  it('never emits when disabled (invalid/unavailable guard)', () => {
    const { fixture } = setup({ disabled: true });
    const component = fixture.componentInstance;
    const emit = vi.spyOn(component.add, 'emit');

    component.requestAdd();

    expect(emit).not.toHaveBeenCalled();
  });

  it('emits retry activations after failure', () => {
    const { element, fixture } = setup({ status: 'error', errorMessage: 'Failure.' });
    const component = fixture.componentInstance;
    const emit = vi.spyOn(component.add, 'emit');

    element.querySelector('.add-to-cart-retry')?.dispatchEvent(new Event('click'));
    fixture.detectChanges();

    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('exposes native buttons for keyboard operation', () => {
    const { element } = setup({});
    const button = element.querySelector('.add-to-cart-button');

    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('type')).toBe('button');
  });
});
