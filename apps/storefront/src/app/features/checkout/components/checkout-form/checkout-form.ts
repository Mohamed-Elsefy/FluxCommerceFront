/**
 * Composed checkout form component for Sub-Phase 8.4 — Customer &
 * Shipping Information.
 *
 * Presentation + form state only: owns the typed checkout `FormGroup`
 * (shipping + billing sections plus the billing-same flag), renders the
 * two address sections with a same-as-shipping toggle and a continue
 * action, and emits validated `CheckoutFormData` for the owning page
 * (8.6+) to drive `CheckoutState.setFormData`/`submitOrder`.
 *
 * The component performs no API access, writes no feature state, and
 * executes no order submission: `submit()` validates locally
 * (`markAllAsTouched` + no emit when invalid) and emits data only. No
 * business or pricing rules live here — validators come from the
 * contract-mirroring factory, values serialize verbatim.
 *
 * SSR/hydration safe: markup from inputs only, no browser APIs. RTL
 * safe: logical properties only, no direction branching.
 */

import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  inject,
  Input,
  Output,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import type { CheckoutFormData } from '../../state/checkout-state-boundaries';
import {
  createCheckoutFormGroup,
  setBillingSameAsShipping,
  toCheckoutFormData,
  type CheckoutFormGroup,
} from '../../forms/checkout-forms';
import { CheckoutAddressForm, type CheckoutAddressLabels } from '../address-form/address-form';
import type { CheckoutFieldTemplates } from '../field-errors/field-errors';

/** Page-localized labels for the whole form (no interpolation left). */
export interface CheckoutFormLabels {
  readonly shipping: CheckoutAddressLabels;
  readonly billing: CheckoutAddressLabels;
  readonly billingSameAsShipping: string;
  readonly submit: string;
  readonly templates: CheckoutFieldTemplates;
}

@Component({
  selector: 'checkout-form',
  imports: [ReactiveFormsModule, CheckoutAddressForm],
  templateUrl: './checkout-form.html',
  styleUrl: './checkout-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutFormComponent {
  private readonly formBuilder = inject(FormBuilder);

  /** Typed checkout form (factory-built, owned here). */
  readonly form: CheckoutFormGroup = createCheckoutFormGroup(this.formBuilder);

  /** Form labels (page-localized, required). */
  @Input({ required: true }) labels!: CheckoutFormLabels;

  /** Emitted with validated form data on continue. Never emits when invalid. */
  @Output() readonly formSubmit = new EventEmitter<CheckoutFormData>();

  /** Syncs the same-flag control and disables/enables billing editing. */
  onBillingSameAsShippingChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.form.controls.billingSameAsShipping.setValue(checked);
    setBillingSameAsShipping(this.form, checked);
  }

  /** Emits validated form data; flags every field when invalid. No HTTP, no state writes. */
  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.formSubmit.emit(toCheckoutFormData(this.form));
  }
}
