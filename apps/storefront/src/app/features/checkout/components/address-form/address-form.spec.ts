/**
 * Component tests for the checkout `CheckoutAddressForm` (Sub-Phase
 * 8.4).
 *
 * Covers the presentational contract only (validation lives in
 * `checkout-validators.spec.ts`, serialization in
 * `checkout-forms.spec.ts`): seven contract-bound inputs with labels,
 * ids, `required`/`maxlength`/`autocomplete` mirroring the backend
 * contract, seamless editing into the group, error display gated on
 * touched/dirty with `aria-invalid`/`aria-describedby` wiring, the
 * optional second line, and disabled-section rendering.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { FormBuilder } from '@angular/forms';
import { createCheckoutAddressFormGroup } from '../../forms/checkout-forms';
import { CheckoutAddressForm, type CheckoutAddressLabels } from './address-form';
import type { CheckoutFieldTemplates } from '../field-errors/field-errors';

const LABELS: CheckoutAddressLabels = {
  sectionTitle: 'Shipping address',
  recipientName: 'Full name',
  line1: 'Street address',
  line2: 'Apartment, suite, etc.',
  line2Optional: 'Optional',
  city: 'City',
  region: 'State / Region',
  postalCode: 'Postal code',
  countryCode: 'Country code',
};

const TEMPLATES: CheckoutFieldTemplates = {
  required: '{label} is required.',
  tooLong: '{label} must be no more than {max} characters.',
  invalidCountryCode: '{label} must be 2 uppercase letters (e.g. DE).',
};

const FIELDS = [
  { name: 'recipientName', maxLength: '100', required: true, autocomplete: 'name' },
  { name: 'line1', maxLength: '200', required: true, autocomplete: 'address-line1' },
  { name: 'line2', maxLength: '200', required: false, autocomplete: 'address-line2' },
  { name: 'city', maxLength: '100', required: true, autocomplete: 'address-level2' },
  { name: 'region', maxLength: '100', required: true, autocomplete: 'address-level1' },
  { name: 'postalCode', maxLength: '20', required: true, autocomplete: 'postal-code' },
  { name: 'countryCode', maxLength: '2', required: true, autocomplete: 'country' },
] as const;

function setup(): {
  fixture: ComponentFixture<CheckoutAddressForm>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(CheckoutAddressForm);
  fixture.componentRef.setInput('group', createCheckoutAddressFormGroup(new FormBuilder()));
  fixture.componentRef.setInput('labels', LABELS);
  fixture.componentRef.setInput('templates', TEMPLATES);
  fixture.componentRef.setInput('idPrefix', 'shipping');
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function inputFor(element: HTMLElement, name: string): HTMLInputElement {
  const field = element.querySelector(`#shipping-${name}`);
  expect(field, name).not.toBeNull();
  return field as HTMLInputElement;
}

describe('CheckoutAddressForm structure', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders the section title and seven labeled inputs', () => {
    const { element } = setup();

    expect(element.querySelector('legend')?.textContent).toBe('Shipping address');
    expect(element.querySelectorAll('input').length).toBe(7);
    for (const field of FIELDS) {
      const input = inputFor(element, field.name);
      const label = element.querySelector(`label[for="shipping-${field.name}"]`);
      expect(label?.textContent).toContain(LABELS[field.name as keyof typeof LABELS]);
      expect(input.getAttribute('maxlength')).toBe(field.maxLength);
      expect(input.getAttribute('autocomplete')).toBe(field.autocomplete);
      expect(input.required).toBe(field.required);
    }
  });

  it('marks the second line optional without a required attribute', () => {
    const { element } = setup();

    expect(element.querySelector('label[for="shipping-line2"]')?.textContent).toContain('Optional');
    expect(inputFor(element, 'line2').required).toBe(false);
  });

  it('writes user edits seamlessly into the group', () => {
    const { fixture, element } = setup();

    const input = inputFor(element, 'city');
    input.value = 'Berlin';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.group.controls.city.value).toBe('Berlin');
  });

  it('reflects live validity through aria-invalid without flagging pristine fields', () => {
    const { fixture, element } = setup();

    expect(inputFor(element, 'city').getAttribute('aria-invalid')).toBe('false');
    expect(element.querySelector('.checkout-field-errors')).toBeNull();

    fixture.componentInstance.group.controls.city.markAsTouched();
    fixture.detectChanges();

    expect(inputFor(element, 'city').getAttribute('aria-invalid')).toBe('true');
    expect(element.querySelector('#shipping-city-errors')?.textContent).toContain(
      'City is required.',
    );
  });

  it('wires aria-describedby to each field error wrapper', () => {
    const { element } = setup();

    for (const field of FIELDS) {
      expect(inputFor(element, field.name).getAttribute('aria-describedby')).toBe(
        `shipping-${field.name}-errors`,
      );
    }
  });

  it('disables every input when the section group is disabled', () => {
    const { fixture, element } = setup();

    fixture.componentInstance.group.disable();
    fixture.detectChanges();

    for (const field of FIELDS) {
      expect(inputFor(element, field.name).disabled).toBe(true);
    }
  });
});
