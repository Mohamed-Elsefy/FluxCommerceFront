/**
 * Typed-form validators for the Sub-Phase 8.4 checkout form slice.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §4 and
 * `docs/frontend-contract/DTO_REFERENCE.md` §4 (`CheckoutAddressRequest`
 * `DataAnnotations`: `recipientName`/`line1`/`line2` ≤ 200/100 details
 * below, `city`/`region` ≤ 100, `postalCode` ≤ 20, `countryCode` exactly
 * 2 UPPER). Client rules mirror the backend contract so invalid input is
 * rejected locally; the backend remains authoritative and its `400` field
 * errors are applied separately in a later sub-phase.
 *
 * Backend rules mirrored here:
 * - `recipientName`: required, ≤ 100.
 * - `line1`: required, ≤ 200. `line2`: optional, ≤ 200 when present.
 * - `city`/`region`: required, ≤ 100.
 * - `postalCode`: required, ≤ 20.
 * - `countryCode`: required, exactly 2 uppercase ASCII letters.
 *
 * The `nonBlank` helper is feature-local (duplicating the 6-line auth
 * version by design): checkout must not depend on auth-feature
 * internals (`ARCHITECTURE.md` §7 — features own their code).
 */

import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import {
  CHECKOUT_ADDRESS_LINE_MAX_LENGTH,
  CHECKOUT_CITY_MAX_LENGTH,
  CHECKOUT_POSTAL_CODE_MAX_LENGTH,
  CHECKOUT_RECIPIENT_NAME_MAX_LENGTH,
  CHECKOUT_REGION_MAX_LENGTH,
} from '../models/checkout.models';

/** `countryCode` wire shape: exactly 2 uppercase ASCII letters. */
export const CHECKOUT_COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;

/** Required free-text address validators: required + non-blank + length cap. */
function requiredTextValidators(maxLength: number): ValidatorFn[] {
  return [Validators.required, nonBlankValidator(), Validators.maxLength(maxLength)];
}

/** Customer-name validators (`recipientName`: required, ≤ 100). */
export function checkoutRecipientNameValidators(): ValidatorFn[] {
  return requiredTextValidators(CHECKOUT_RECIPIENT_NAME_MAX_LENGTH);
}

/** Street-line validators (`line1`: required, ≤ 200). */
export function checkoutLine1Validators(): ValidatorFn[] {
  return requiredTextValidators(CHECKOUT_ADDRESS_LINE_MAX_LENGTH);
}

/** Optional second-line validators (`line2`: ≤ 200 when present, never required). */
export function checkoutLine2Validators(): ValidatorFn[] {
  return [Validators.maxLength(CHECKOUT_ADDRESS_LINE_MAX_LENGTH)];
}

/** City validators (`city`: required, ≤ 100). */
export function checkoutCityValidators(): ValidatorFn[] {
  return requiredTextValidators(CHECKOUT_CITY_MAX_LENGTH);
}

/** Region validators (`region`: required, ≤ 100). */
export function checkoutRegionValidators(): ValidatorFn[] {
  return requiredTextValidators(CHECKOUT_REGION_MAX_LENGTH);
}

/** Postal-code validators (`postalCode`: required, ≤ 20). */
export function checkoutPostalCodeValidators(): ValidatorFn[] {
  return requiredTextValidators(CHECKOUT_POSTAL_CODE_MAX_LENGTH);
}

/**
 * Country-code validators (`countryCode`: required, exactly 2 uppercase
 * letters). The pattern mirrors the wire shape — lowercase or long
 * input stays invalid locally instead of failing at the backend.
 */
export function checkoutCountryCodeValidators(): ValidatorFn[] {
  return [Validators.required, Validators.pattern(CHECKOUT_COUNTRY_CODE_PATTERN)];
}

/**
 * Rejects whitespace-only values (the backend length rules would accept
 * `"   "`; `Validators.required` alone would too).
 */
export function nonBlankValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const value = control.value;
    if (typeof value !== 'string' || value.length === 0) {
      return null;
    }
    return value.trim().length === 0 ? { nonBlank: true } : null;
  };
}
