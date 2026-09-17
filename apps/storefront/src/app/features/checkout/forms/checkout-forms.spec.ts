/**
 * Unit tests for the Sub-Phase 8.4 checkout form factory and serializer.
 *
 * Covers the typed structure (shipping + billing sections with the
 * seven contract fields each, plus the billing-same flag — and
 * deliberately NO email/phone/shipping-method controls), the
 * billing-disable mechanics, verbatim serialization with the
 * billing-copy on flag, and valid/invalid form states.
 */

import { FormBuilder } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  createCheckoutAddressFormGroup,
  createCheckoutFormGroup,
  setBillingSameAsShipping,
  toCheckoutFormData,
} from './checkout-forms';

const ADDRESS_KEYS = [
  'recipientName',
  'line1',
  'line2',
  'city',
  'region',
  'postalCode',
  'countryCode',
] as const;

function fillShipping(form: ReturnType<typeof createCheckoutFormGroup>) {
  form.controls.shippingAddress.setValue({
    recipientName: 'Ada Lovelace',
    line1: '1 Flux St',
    line2: '',
    city: 'Berlin',
    region: 'BE',
    postalCode: '10115',
    countryCode: 'DE',
  });
}

describe('createCheckoutAddressFormGroup', () => {
  it('builds the seven contract fields, all empty and invalid', () => {
    const group = createCheckoutAddressFormGroup(new FormBuilder());

    expect(Object.keys(group.controls).sort()).toEqual([...ADDRESS_KEYS].sort());
    expect(group.invalid).toBe(true);
    expect(group.controls.line2.invalid).toBe(false);
  });
});

describe('createCheckoutFormGroup', () => {
  it('builds shipping + billing sections with an unchecked same-flag', () => {
    const form = createCheckoutFormGroup(new FormBuilder());

    expect(Object.keys(form.controls).sort()).toEqual(
      ['billingAddress', 'billingSameAsShipping', 'shippingAddress'].sort(),
    );
    expect(form.controls.billingSameAsShipping.value).toBe(false);
    expect(form.invalid).toBe(true);
  });

  it('carries no email, phone, or shipping-method controls (contract has none)', () => {
    const form = createCheckoutFormGroup(new FormBuilder());
    const names = JSON.stringify(Object.keys(form.controls));

    expect(names).not.toContain('email');
    expect(names).not.toContain('phone');
    expect(names).not.toContain('shippingMethod');
    expect(names).not.toContain('method');
  });

  it('validates to true with both sections populated', () => {
    const form = createCheckoutFormGroup(new FormBuilder());
    fillShipping(form);
    form.controls.billingAddress.setValue(form.controls.shippingAddress.getRawValue());

    expect(form.valid).toBe(true);
  });

  it('transitions from invalid to valid as sections fill', () => {
    const form = createCheckoutFormGroup(new FormBuilder());
    expect(form.invalid).toBe(true);

    fillShipping(form);
    expect(form.invalid).toBe(true);

    form.controls.billingAddress.setValue(form.controls.shippingAddress.getRawValue());
    expect(form.valid).toBe(true);
  });

  it('never blocks validity on the optional second line', () => {
    const form = createCheckoutFormGroup(new FormBuilder());
    fillShipping(form);
    form.controls.billingAddress.setValue(form.controls.shippingAddress.getRawValue());

    form.controls.shippingAddress.controls.line2.setValue('Apt 4, Floor 2');
    expect(form.valid).toBe(true);

    form.controls.shippingAddress.controls.line2.setValue('');
    expect(form.valid).toBe(true);
  });

  it('blocks the full form on a malformed country code', () => {
    const form = createCheckoutFormGroup(new FormBuilder());
    fillShipping(form);
    form.controls.billingAddress.setValue(form.controls.shippingAddress.getRawValue());

    form.controls.shippingAddress.controls.countryCode.setValue('de');
    expect(form.invalid).toBe(true);
    expect(form.controls.shippingAddress.controls.countryCode.errors?.['pattern']).toBeTruthy();

    form.controls.shippingAddress.controls.countryCode.setValue('DE');
    expect(form.valid).toBe(true);
  });
});

describe('setBillingSameAsShipping', () => {
  it('disables the billing section while set and re-enables on clear', () => {
    const form = createCheckoutFormGroup(new FormBuilder());

    setBillingSameAsShipping(form, true);
    expect(form.controls.billingAddress.disabled).toBe(true);

    setBillingSameAsShipping(form, false);
    expect(form.controls.billingAddress.enabled).toBe(true);
  });

  it('keeps a disabled billing section out of .value but in getRawValue', () => {
    const form = createCheckoutFormGroup(new FormBuilder());
    setBillingSameAsShipping(form, true);

    expect('billingAddress' in form.value).toBe(false);
    expect('billingAddress' in form.getRawValue()).toBe(true);
  });
});

describe('toCheckoutFormData', () => {
  it('serializes both sections verbatim with the flag', () => {
    const form = createCheckoutFormGroup(new FormBuilder());
    fillShipping(form);
    form.controls.billingAddress.setValue({
      recipientName: 'Grace Hopper',
      line1: '2 Cobol Ave',
      line2: 'Apt 4',
      city: 'Paris',
      region: 'IDF',
      postalCode: '75001',
      countryCode: 'FR',
    });

    expect(toCheckoutFormData(form)).toEqual({
      shippingAddress: {
        recipientName: 'Ada Lovelace',
        line1: '1 Flux St',
        line2: '',
        city: 'Berlin',
        region: 'BE',
        postalCode: '10115',
        countryCode: 'DE',
      },
      billingAddress: {
        recipientName: 'Grace Hopper',
        line1: '2 Cobol Ave',
        line2: 'Apt 4',
        city: 'Paris',
        region: 'IDF',
        postalCode: '75001',
        countryCode: 'FR',
      },
      billingSameAsShipping: false,
    });
  });

  it('copies shipping to billing verbatim when the flag is set', () => {
    const form = createCheckoutFormGroup(new FormBuilder());
    fillShipping(form);
    form.controls.billingSameAsShipping.setValue(true);

    const data = toCheckoutFormData(form);

    expect(data.billingSameAsShipping).toBe(true);
    expect(data.billingAddress).toEqual(data.shippingAddress);
  });

  it('reflects live edits in later serializations', () => {
    const form = createCheckoutFormGroup(new FormBuilder());
    fillShipping(form);
    form.controls.billingAddress.setValue(form.controls.shippingAddress.getRawValue());
    expect(toCheckoutFormData(form).shippingAddress.city).toBe('Berlin');

    form.controls.shippingAddress.controls.city.setValue('Munich');

    expect(toCheckoutFormData(form).shippingAddress.city).toBe('Munich');
  });
});
