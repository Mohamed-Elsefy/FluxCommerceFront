/**
 * Checkout address section component for Sub-Phase 8.4 — Customer &
 * Shipping Information.
 *
 * Presentation only: renders HOW one address section looks (seven
 * contract fields with labels, native inputs, and per-field errors).
 * The owning form decides WHEN and WHAT — the group arrives
 * pre-validated from the checkout form factory, labels and validation
 * templates arrive page-localized, and user intent stays in the group
 * itself (Reactive Forms mutate in place, so editing is seamless with
 * no outputs to emit). No API access, no HTTP, no business rules.
 *
 * Contract fidelity (never fabricated, never calculated):
 * - Seven controls only: `recipientName` (the customer-information
 *   field — the contract carries no email/phone object, so no such
 *   controls exist), `line1`, `line2` (optional), `city`, `region`,
 *   `postalCode`, `countryCode`. No shipping-method control (the
 *   contract carries no method field).
 * - `maxlength` attributes mirror the contract caps; `required`
 *   mirrors the contract `Required` fields (`line2` only is optional).
 *
 * Accessibility: every input has an associated `<label>`, `required`
 * where the contract requires, `aria-invalid` reflecting live validity,
 * and `aria-describedby` pointing at its error wrapper.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import type { CheckoutAddressFormGroup } from '../../forms/checkout-forms';
import { CheckoutFieldErrors, type CheckoutFieldTemplates } from '../field-errors/field-errors';

/** Page-localized labels for one address section (no interpolation left). */
export interface CheckoutAddressLabels {
  readonly sectionTitle: string;
  readonly recipientName: string;
  readonly line1: string;
  readonly line2: string;
  readonly line2Optional: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
  readonly countryCode: string;
}

type AddressFieldName =
  'recipientName' | 'line1' | 'line2' | 'city' | 'region' | 'postalCode' | 'countryCode';

@Component({
  selector: 'checkout-address-form',
  imports: [ReactiveFormsModule, CheckoutFieldErrors],
  templateUrl: './address-form.html',
  styleUrl: './address-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutAddressForm {
  /** Address section group (factory-built, required). */
  @Input({ required: true }) group!: CheckoutAddressFormGroup;
  /** Section labels (page-localized, required). */
  @Input({ required: true }) labels!: CheckoutAddressLabels;
  /** Validation templates (page-localized, required). */
  @Input({ required: true }) templates!: CheckoutFieldTemplates;
  /** Id prefix scoping this section's control ids (shipping vs billing). */
  @Input() idPrefix = 'checkout-address';

  /** Whether the field currently shows as invalid (touched/dirty only). */
  isInvalid(name: AddressFieldName): boolean {
    const control = this.group.controls[name];
    return control.invalid && (control.touched || control.dirty);
  }

  /** Deterministic control id for label association. */
  fieldId(name: AddressFieldName): string {
    return `${this.idPrefix}-${name}`;
  }

  /** Error-wrapper id referenced by `aria-describedby`. */
  errorsId(name: AddressFieldName): string {
    return `${this.fieldId(name)}-errors`;
  }
}
