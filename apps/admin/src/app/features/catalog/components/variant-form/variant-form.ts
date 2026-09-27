/**
 * Variant form for Sub-Phase 13.4 — Product Variants Management.
 *
 * Feature-owned dumb form shared by the variant create and edit pages:
 * typed `FormGroup` over `VariantFormValue` (SKU, name, price, currency)
 * with client-side validators for presence and input shape, rendered
 * through the shared admin inputs. Dumb by design — mode, initial
 * values, all copy, and the submit lock arrive as inputs; the validated
 * value leaves through `save`, cancellation through `cancelled`.
 * Submission transport stays in the owning pages.
 *
 * Contract-shaped editing: price and currency travel on create ONLY
 * (the update endpoint accepts `sku` + `name` and nothing else), so
 * `mode: 'edit'` disables both controls as read-only display with the
 * locked hint — the form can never submit money it cannot send. SKU
 * uniqueness, price rules, and variant validity stay backend-owned:
 * `400` field maps project through `applyServerErrors()` onto their
 * control paths (rendered verbatim backend-localized), unknown keys
 * return for the page-level notice.
 *
 * SSR/hydration safe: reactive forms only, no browser APIs. RTL safe:
 * logical properties only.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ADMIN_SERVER_ERROR_KEY } from '../../../../shared/forms/field-errors/field-errors';
import { AdminFormActions } from '../../../../shared/forms/form-actions/form-actions';
import { AdminTextInput } from '../../../../shared/forms/text-input/text-input';
import {
  emptyVariantFormValue,
  toFormErrorPath,
  type VariantFormValue,
} from '../../models/catalog-admin.models';

/** Variant form mode: creation edits money, editing locks it read-only. */
export type VariantFormMode = 'create' | 'edit';

@Component({
  selector: 'app-variant-form',
  imports: [ReactiveFormsModule, AdminFormActions, AdminTextInput],
  templateUrl: './variant-form.html',
  styleUrl: './variant-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VariantForm {
  /** Initial value (create: blank; edit: populated once loaded). */
  @Input() set initial(value: VariantFormValue | null) {
    if (value !== null) {
      this.form.patchValue({
        sku: value.sku,
        name: value.name,
        unitPriceAmount: value.price,
        currency: value.currency,
      });
    }
  }

  /** Editing mode (price/currency lock as read-only display when editing). */
  @Input() set mode(value: VariantFormMode) {
    this.formMode = value;
    if (value === 'edit') {
      this.priceControl().disable({ emitEvent: false });
      this.currencyControl().disable({ emitEvent: false });
    } else {
      this.priceControl().enable({ emitEvent: false });
      this.currencyControl().enable({ emitEvent: false });
    }
  }

  /** Field labels and hints (owner-localized, single object input). */
  @Input() copy: VariantFormCopy = EMPTY_VARIANT_FORM_COPY;
  /** Submission in flight: actions lock with progress copy. */
  @Input() submitting = false;

  /** Emitted with the validated value on submit. */
  @Output() readonly save = new EventEmitter<VariantFormValue>();
  /** Emitted when the cancel action activates. */
  @Output() readonly cancelled = new EventEmitter<void>();

  private formMode: VariantFormMode = 'create';

  /**
   * Typed variant form (presence + shape validators only — rules stay
   * backend-owned). Control names mirror the DTO camelCase (`sku`,
   * `name`, `unitPriceAmount`, `currency`) so backend `errors{}` keys
   * project onto their paths through the shared `toFormErrorPath`
   * mapper with no per-form table.
   */
  protected readonly form = new FormGroup({
    sku: new FormControl<string | null>(null, { validators: [Validators.required] }),
    name: new FormControl<string | null>(null, { validators: [Validators.required] }),
    unitPriceAmount: new FormControl<string | null>(null, {
      validators: [Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)],
    }),
    currency: new FormControl<string | null>(null, {
      validators: [
        Validators.required,
        Validators.pattern(/^[A-Za-z]{3}$/),
        Validators.maxLength(3),
      ],
    }),
  });

  protected skuControl(): FormControl<string | null> {
    return this.form.controls.sku;
  }

  protected nameControl(): FormControl<string | null> {
    return this.form.controls.name;
  }

  protected priceControl(): FormControl<string | null> {
    return this.form.controls.unitPriceAmount;
  }

  protected currencyControl(): FormControl<string | null> {
    return this.form.controls.currency;
  }

  /** Whether money controls render as read-only display. */
  protected priceLocked(): boolean {
    return this.formMode === 'edit';
  }

  /**
   * Projects backend field errors onto their control paths. Returns the
   * keys that match no control, for the page-level notice. Never throws.
   */
  applyServerErrors(errors: Record<string, string[]>): string[] {
    const unknown: string[] = [];
    for (const [key, messages] of Object.entries(errors)) {
      const control = this.form.get(toFormErrorPath(key));
      if (control === null) {
        unknown.push(key);
      } else {
        control.setErrors({ ...(control.errors ?? {}), [ADMIN_SERVER_ERROR_KEY]: messages });
        control.markAsTouched();
      }
    }
    return unknown;
  }

  /** Clears server errors (fresh attempt starts clean, client state kept). */
  clearServerErrors(): void {
    for (const path of ['sku', 'name', 'unitPriceAmount', 'currency']) {
      const control = this.form.get(path);
      if (control !== null && control.errors !== null && ADMIN_SERVER_ERROR_KEY in control.errors) {
        const { [ADMIN_SERVER_ERROR_KEY]: _dropped, ...rest } = control.errors;
        control.setErrors(Object.keys(rest).length === 0 ? null : rest);
      }
    }
  }

  /** Validates and emits the value; invalid submits only mark fields. */
  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting) {
      return;
    }
    const raw = this.form.getRawValue();
    this.save.emit({
      ...emptyVariantFormValue(),
      sku: raw.sku,
      name: raw.name,
      price: raw.unitPriceAmount,
      currency: raw.currency,
    });
  }
}

/** Localized variant form copy (single owner-provided object input). */
export interface VariantFormCopy {
  readonly sku: string;
  readonly name: string;
  readonly price: string;
  readonly currency: string;
  readonly currencyHint: string;
  readonly priceLockedHint: string;
  readonly submit: string;
  readonly cancel: string;
  readonly saving: string;
}

const EMPTY_VARIANT_FORM_COPY: VariantFormCopy = {
  sku: '',
  name: '',
  price: '',
  currency: '',
  currencyHint: '',
  priceLockedHint: '',
  submit: '',
  cancel: '',
  saving: '',
};
