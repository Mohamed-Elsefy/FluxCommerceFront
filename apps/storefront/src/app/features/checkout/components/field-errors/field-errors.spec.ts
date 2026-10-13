/**
 * Component tests for the checkout `CheckoutFieldErrors` (Sub-Phase
 * 8.4).
 *
 * Covers the presentational contract only (validation itself lives in
 * `checkout-validators.spec.ts`): per-key template resolution with
 * `{label}`/`{max}` slots, the touched-or-dirty display rule, the
 * disabled/null guards, and the `role="alert"` announcement surface.
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { AbstractControl, FormControl, Validators } from '@angular/forms';
import {
  CheckoutFieldErrors,
  fillFieldTemplate,
  type CheckoutFieldTemplates,
} from './field-errors';

const TEMPLATES: CheckoutFieldTemplates = {
  required: '{label} is required.',
  tooLong: '{label} must be no more than {max} characters.',
  invalidCountryCode: '{label} must be 2 uppercase letters (e.g. DE).',
};

function setup(
  control: AbstractControl | null,
  label = 'City',
): {
  fixture: ComponentFixture<CheckoutFieldErrors>;
  element: HTMLElement;
} {
  TestBed.configureTestingModule({});
  const fixture = TestBed.createComponent(CheckoutFieldErrors);
  fixture.componentRef.setInput('control', control);
  fixture.componentRef.setInput('label', label);
  fixture.componentRef.setInput('templates', TEMPLATES);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

function shown(element: HTMLElement): string[] {
  return [...element.querySelectorAll('.checkout-field-errors li')].map(
    (item) => item.textContent ?? '',
  );
}

describe('fillFieldTemplate', () => {
  it('fills label and max slots', () => {
    expect(fillFieldTemplate('{label} is required.', 'City')).toBe('City is required.');
    expect(fillFieldTemplate('{label} ≤ {max}.', 'City', 100)).toBe('City ≤ 100.');
  });
});

describe('CheckoutFieldErrors display rule', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('renders nothing without a control or templates', () => {
    const { element, fixture } = setup(null);
    fixture.componentRef.setInput('templates', null);
    fixture.detectChanges();

    expect(shown(element)).toEqual([]);
  });

  it('hides errors on pristine valid-touched controls and shows them once touched', () => {
    const control = new FormControl('', [Validators.required]);
    const { element, fixture } = setup(control);
    expect(shown(element)).toEqual([]);

    control.markAsTouched();
    fixture.detectChanges();

    expect(shown(element)).toEqual(['City is required.']);
  });

  it('shows errors for dirty controls', () => {
    const control = new FormControl('x', [Validators.required]);
    const { element, fixture } = setup(control);

    control.setValue('');
    control.markAsDirty();
    fixture.detectChanges();

    expect(shown(element)).toEqual(['City is required.']);
  });

  it('hides errors on disabled controls', () => {
    const control = new FormControl('', [Validators.required]);
    control.disable();
    const { element, fixture } = setup(control);

    control.markAsTouched();
    fixture.detectChanges();

    expect(shown(element)).toEqual([]);
  });

  it('resolves maxlength errors with the contract cap', () => {
    const control = new FormControl('a'.repeat(101), [Validators.maxLength(100)]);
    const { element, fixture } = setup(control);

    control.markAsTouched();
    fixture.detectChanges();

    expect(shown(element)).toEqual(['City must be no more than 100 characters.']);
  });

  it('resolves pattern errors to the country-code message', () => {
    const control = new FormControl('de', [Validators.pattern(/^[A-Z]{2}$/)]);
    const { element, fixture } = setup(control, 'Country code');

    control.markAsTouched();
    fixture.detectChanges();

    expect(shown(element)).toEqual(['Country code must be 2 uppercase letters (e.g. DE).']);
  });

  it('announces messages through role="alert"', () => {
    const control = new FormControl('', [Validators.required]);
    const { element, fixture } = setup(control);

    control.markAsTouched();
    fixture.detectChanges();

    expect(element.querySelector('.checkout-field-errors')?.getAttribute('role')).toBe('alert');
  });
});
