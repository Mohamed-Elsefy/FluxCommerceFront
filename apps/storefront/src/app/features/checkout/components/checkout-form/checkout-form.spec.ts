/**
 * Component tests for the composed checkout `CheckoutFormComponent`
 * (Sub-Phase 8.4).
 *
 * Covers the form contract only (structure and serialization live in
 * `checkout-forms.spec.ts`, validation in
 * `checkout-validators.spec.ts`): section composition with scoped ids,
 * the same-flag disabling billing editing, invalid-submit flagging with
 * no emission, valid-submit emission of `CheckoutFormData` (verbatim +
 * billing copy), and rendered labels from inputs. No HTTP, no feature
 * state, no order execution.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import type { CheckoutFormData } from '../../state/checkout-state-boundaries';
import { CheckoutFormComponent, type CheckoutFormLabels } from './checkout-form';

function addressLabels(sectionTitle: string) {
  return {
    sectionTitle,
    recipientName: 'Full name',
    line1: 'Street address',
    line2: 'Apartment, suite, etc.',
    line2Optional: 'Optional',
    city: 'City',
    region: 'State / Region',
    postalCode: 'Postal code',
    countryCode: 'Country code',
  };
}

const LABELS: CheckoutFormLabels = {
  shipping: addressLabels('Shipping address'),
  billing: addressLabels('Billing address'),
  billingSameAsShipping: 'Billing address is the same as shipping',
  submit: 'Continue',
  templates: {
    required: '{label} is required.',
    tooLong: '{label} must be no more than {max} characters.',
    invalidCountryCode: '{label} must be 2 uppercase letters (e.g. DE).',
  },
};

function setup(): {
  fixture: ComponentFixture<CheckoutFormComponent>;
  element: HTMLElement;
  emitted: CheckoutFormData[];
} {
  const emitted: CheckoutFormData[] = [];
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(CheckoutFormComponent);
  fixture.componentRef.setInput('labels', LABELS);
  fixture.componentInstance.formSubmit.subscribe((data) => emitted.push(data));
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement, emitted };
}

function fillAddress(
  fixture: ComponentFixture<CheckoutFormComponent>,
  section: 'shippingAddress' | 'billingAddress',
  overrides: Record<string, string> = {},
): void {
  fixture.componentInstance.form.controls[section].setValue({
    recipientName: 'Ada Lovelace',
    line1: '1 Flux St',
    line2: '',
    city: 'Berlin',
    region: 'BE',
    postalCode: '10115',
    countryCode: 'DE',
    ...overrides,
  });
  fixture.detectChanges();
}

function sameCheckbox(element: HTMLElement): HTMLInputElement {
  const box = element.querySelector('#checkout-billing-same');
  expect(box).not.toBeNull();
  return box as HTMLInputElement;
}

describe('CheckoutFormComponent composition', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders shipping and billing sections with scoped control ids', () => {
    const { element } = setup();

    expect(element.querySelector('#shipping-city')).not.toBeNull();
    expect(element.querySelector('#billing-city')).not.toBeNull();
    expect(element.textContent).toContain('Shipping address');
    expect(element.textContent).toContain('Billing address');
    expect(element.textContent).toContain('Billing address is the same as shipping');
    expect(element.querySelector('.checkout-submit')?.textContent).toBe('Continue');
  });

  it('disables billing editing while the same-flag is checked', () => {
    const { fixture, element } = setup();
    const box = sameCheckbox(element);

    box.checked = true;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect((element.querySelector('#billing-city') as HTMLInputElement).disabled).toBe(true);

    box.checked = false;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect((element.querySelector('#billing-city') as HTMLInputElement).disabled).toBe(false);
  });

  it('flags every field and emits nothing on invalid continue', () => {
    const { fixture, element, emitted } = setup();

    element.querySelector('form')?.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(emitted).toEqual([]);
    expect(fixture.componentInstance.form.touched).toBe(true);
    expect(element.querySelector('.checkout-field-errors')).not.toBeNull();
  });

  it('emits verbatim form data on valid continue', () => {
    const { fixture, emitted } = setup();
    fillAddress(fixture, 'shippingAddress');
    fillAddress(fixture, 'billingAddress', { city: 'Paris', countryCode: 'FR' });

    fixture.componentInstance.submit();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.shippingAddress.city).toBe('Berlin');
    expect(emitted[0]?.billingAddress.city).toBe('Paris');
    expect(emitted[0]?.billingSameAsShipping).toBe(false);
  });

  it('emits a shipping copy for billing when the same-flag is set', () => {
    const { fixture, element, emitted } = setup();
    fillAddress(fixture, 'shippingAddress');
    const box = sameCheckbox(element);
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    fixture.componentInstance.submit();

    expect(emitted).toHaveLength(1);
    expect(emitted[0]?.billingSameAsShipping).toBe(true);
    expect(emitted[0]?.billingAddress).toEqual(emitted[0]?.shippingAddress);
  });

  it('allows editing after a flagged invalid submit', () => {
    const { fixture, emitted } = setup();

    fixture.componentInstance.submit();
    expect(emitted).toEqual([]);

    fillAddress(fixture, 'shippingAddress');
    fillAddress(fixture, 'billingAddress');
    fixture.componentInstance.submit();

    expect(emitted).toHaveLength(1);
  });
});
