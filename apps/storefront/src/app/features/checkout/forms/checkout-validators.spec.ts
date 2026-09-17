/**
 * Unit tests for the Sub-Phase 8.4 checkout validators.
 *
 * Covers every factory against its backend contract bound (required,
 * blank-rejection, length caps, country-code shape): valid values pass,
 * and each bound fails independently with the expected error key.
 */

import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  CHECKOUT_COUNTRY_CODE_PATTERN,
  checkoutCityValidators,
  checkoutCountryCodeValidators,
  checkoutLine1Validators,
  checkoutLine2Validators,
  checkoutPostalCodeValidators,
  checkoutRecipientNameValidators,
  checkoutRegionValidators,
  nonBlankValidator,
} from './checkout-validators';

function errorsFor(validators: ReturnType<typeof checkoutCityValidators>, value: unknown) {
  return new FormControl(value, validators).errors;
}

describe('required address text validators', () => {
  it('accepts populated values within bounds', () => {
    expect(errorsFor(checkoutRecipientNameValidators(), 'Ada Lovelace')).toBeNull();
    expect(errorsFor(checkoutLine1Validators(), '1 Flux St')).toBeNull();
    expect(errorsFor(checkoutCityValidators(), 'Berlin')).toBeNull();
    expect(errorsFor(checkoutRegionValidators(), 'BE')).toBeNull();
    expect(errorsFor(checkoutPostalCodeValidators(), '10115')).toBeNull();
  });

  it('rejects missing values as required', () => {
    for (const factory of [
      checkoutRecipientNameValidators,
      checkoutLine1Validators,
      checkoutCityValidators,
      checkoutRegionValidators,
      checkoutPostalCodeValidators,
    ]) {
      expect(errorsFor(factory(), '')?.['required']).toBeTruthy();
    }
  });

  it('rejects whitespace-only values as non-blank', () => {
    for (const factory of [
      checkoutRecipientNameValidators,
      checkoutLine1Validators,
      checkoutCityValidators,
      checkoutRegionValidators,
      checkoutPostalCodeValidators,
    ]) {
      expect(errorsFor(factory(), '   ')?.['nonBlank']).toBeTruthy();
    }
  });

  it('rejects over-length values per contract cap', () => {
    expect(
      errorsFor(checkoutRecipientNameValidators(), 'a'.repeat(101))?.['maxlength'],
    ).toBeTruthy();
    expect(errorsFor(checkoutLine1Validators(), 'a'.repeat(201))?.['maxlength']).toBeTruthy();
    expect(errorsFor(checkoutCityValidators(), 'a'.repeat(101))?.['maxlength']).toBeTruthy();
    expect(errorsFor(checkoutRegionValidators(), 'a'.repeat(101))?.['maxlength']).toBeTruthy();
    expect(errorsFor(checkoutPostalCodeValidators(), 'a'.repeat(21))?.['maxlength']).toBeTruthy();
  });

  it('accepts values exactly at the caps', () => {
    expect(errorsFor(checkoutRecipientNameValidators(), 'a'.repeat(100))).toBeNull();
    expect(errorsFor(checkoutLine1Validators(), 'a'.repeat(200))).toBeNull();
    expect(errorsFor(checkoutPostalCodeValidators(), 'a'.repeat(20))).toBeNull();
  });
});

describe('checkoutLine2Validators (optional second line)', () => {
  it('accepts empty values without a required error', () => {
    expect(errorsFor(checkoutLine2Validators(), '')).toBeNull();
  });

  it('rejects over-length values', () => {
    expect(errorsFor(checkoutLine2Validators(), 'a'.repeat(201))?.['maxlength']).toBeTruthy();
  });
});

describe('checkoutCountryCodeValidators (exactly 2 uppercase)', () => {
  it('accepts two uppercase letters', () => {
    expect(errorsFor(checkoutCountryCodeValidators(), 'DE')).toBeNull();
    expect(errorsFor(checkoutCountryCodeValidators(), 'US')).toBeNull();
  });

  it('rejects missing values as required', () => {
    expect(errorsFor(checkoutCountryCodeValidators(), '')?.['required']).toBeTruthy();
  });

  it('rejects lowercase, long, short, and non-letter codes as pattern', () => {
    for (const value of ['de', 'DEU', 'D', '12', 'D1']) {
      expect(errorsFor(checkoutCountryCodeValidators(), value)?.['pattern']).toBeTruthy();
    }
  });

  it('pins the shared pattern to the contract shape', () => {
    expect(CHECKOUT_COUNTRY_CODE_PATTERN.test('DE')).toBe(true);
    expect(CHECKOUT_COUNTRY_CODE_PATTERN.test('de')).toBe(false);
  });
});

describe('nonBlankValidator', () => {
  it('passes empty and non-string values through (required owns those)', () => {
    expect(nonBlankValidator()(new FormControl(''))).toBeNull();
    expect(nonBlankValidator()(new FormControl(null))).toBeNull();
  });

  it('rejects whitespace-only strings', () => {
    expect(nonBlankValidator()(new FormControl('   '))).toEqual({ nonBlank: true });
  });

  it('accepts padded real values', () => {
    expect(nonBlankValidator()(new FormControl('  Ada  '))).toBeNull();
  });
});
