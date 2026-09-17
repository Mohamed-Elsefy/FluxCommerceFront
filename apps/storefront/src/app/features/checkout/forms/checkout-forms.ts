/**
 * Checkout form factory and serializer for Sub-Phase 8.4 — Customer &
 * Shipping Information.
 *
 * Typed `FormBuilder` groups mirroring the backend contract
 * (`CheckoutRequest`: shipping + billing addresses; no customer object,
 * no shipping method — see the contract-honest notes below), plus the
 * pure mapping from a form value to the §8.1 `CheckoutFormData` consumed
 * by `CheckoutState.setFormData` (8.3) and ultimately to
 * `CreateOrderRequest` via `buildCreateOrderRequest` (§8.1 models).
 *
 * Contract-honest structure (never fabricated, test-pinned):
 * - Customer information: the contract carries no customer fields beyond
 *   the address `recipientName` (no email, no phone). There are
 *   therefore no email/phone controls — the "Full name" control in each
 *   address group IS the customer section. Adding unmapped controls
 *   would violate the map-cleanly-to-backend acceptance criterion.
 * - Shipping method: `CheckoutRequest` carries no method field, so the
 *   form has no `shippingMethod` control (`CHECKOUT_SHIPPING_…` gap,
 *   §8.1 models).
 *
 * This module performs no business logic: validators come from
 * `./checkout-validators` (contract bounds), values pass through
 * verbatim (no trimming, no casing, no totals), and billing-copy on
 * `billingSameAsShipping` is a verbatim data copy — not a rule.
 */

import { FormBuilder, FormControl, FormGroup } from '@angular/forms';
import type { CheckoutFormData } from '../state/checkout-state-boundaries';
import {
  checkoutCityValidators,
  checkoutCountryCodeValidators,
  checkoutLine1Validators,
  checkoutLine2Validators,
  checkoutPostalCodeValidators,
  checkoutRecipientNameValidators,
  checkoutRegionValidators,
} from './checkout-validators';

/** Typed controls of one address section (all raw strings, `''` = empty). */
export interface CheckoutAddressFormControls {
  readonly recipientName: FormControl<string>;
  readonly line1: FormControl<string>;
  readonly line2: FormControl<string>;
  readonly city: FormControl<string>;
  readonly region: FormControl<string>;
  readonly postalCode: FormControl<string>;
  readonly countryCode: FormControl<string>;
}

/** Typed address section group. */
export type CheckoutAddressFormGroup = FormGroup<CheckoutAddressFormControls>;

/** Typed controls of the whole checkout form. */
export interface CheckoutFormControls {
  readonly shippingAddress: CheckoutAddressFormGroup;
  readonly billingAddress: CheckoutAddressFormGroup;
  readonly billingSameAsShipping: FormControl<boolean>;
}

/** Typed checkout form group. */
export type CheckoutFormGroup = FormGroup<CheckoutFormControls>;

/**
 * Builds one address section with contract-mirroring validators.
 * Pure construction — performs no HTTP and triggers nothing.
 */
export function createCheckoutAddressFormGroup(formBuilder: FormBuilder): CheckoutAddressFormGroup {
  return formBuilder.nonNullable.group({
    recipientName: ['', checkoutRecipientNameValidators()],
    line1: ['', checkoutLine1Validators()],
    line2: ['', checkoutLine2Validators()],
    city: ['', checkoutCityValidators()],
    region: ['', checkoutRegionValidators()],
    postalCode: ['', checkoutPostalCodeValidators()],
    countryCode: ['', checkoutCountryCodeValidators()],
  });
}

/**
 * Builds the checkout form: shipping + billing sections plus the
 * billing-same-as-shipping flag (unchecked by default — both sections
 * independently editable). Pure construction.
 */
export function createCheckoutFormGroup(formBuilder: FormBuilder): CheckoutFormGroup {
  return formBuilder.nonNullable.group({
    shippingAddress: createCheckoutAddressFormGroup(formBuilder),
    billingAddress: createCheckoutAddressFormGroup(formBuilder),
    billingSameAsShipping: formBuilder.nonNullable.control<boolean>(false),
  });
}

/**
 * Applies the billing-same-as-shipping flag to an existing form: checked
 * disables the billing section (excluded from `.value`, kept in
 * `getRawValue`), unchecked re-enables it for independent editing.
 * Form-state mechanics only — not a business rule.
 */
export function setBillingSameAsShipping(form: CheckoutFormGroup, same: boolean): void {
  if (same) {
    form.controls.billingAddress.disable();
  } else {
    form.controls.billingAddress.enable();
  }
}

/**
 * Serializes a form value to the §8.1 `CheckoutFormData` shape. Values
 * pass through verbatim (no trimming, no casing — backend validation
 * stays authoritative); when `billingSameAsShipping` is set, billing is
 * a verbatim copy of shipping. Pure — throws nothing, performs no HTTP.
 */
export function toCheckoutFormData(form: CheckoutFormGroup): CheckoutFormData {
  const raw = form.getRawValue();
  const shippingAddress = { ...raw.shippingAddress };
  return {
    shippingAddress,
    billingAddress: raw.billingSameAsShipping ? { ...shippingAddress } : { ...raw.billingAddress },
    billingSameAsShipping: raw.billingSameAsShipping,
  };
}
