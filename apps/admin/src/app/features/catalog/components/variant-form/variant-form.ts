/**
 * Variant form for Sub-Phase 13.4 — Product Variants Management —
 * plus Supplement S1, Step S1.6 (editable money + status in edit mode).
 *
 * Feature-owned dumb form shared by the variant create and edit pages:
 * typed `FormGroup` over `VariantFormValue` (SKU, name, price, currency,
 * status) with client-side validators for presence and input shape,
 * rendered through the shared admin inputs. Dumb by design — mode,
 * initial values, status options, all copy, and the submit lock arrive
 * as inputs; the validated value leaves through `save`, cancellation
 * through `cancelled`. Submission transport stays in the owning pages.
 *
 * Contract-shaped editing: creation requires money (`unitPriceAmount` +
 * `currency` required); editing makes money optional-but-paired (both
 * or neither — the group-level `moneyPairedValidator` blocks unpaired
 * submits, and the mapper omits the pair when blank) and exposes the
 * sellability `status` select (Active/Inactive — the only backend
 * lifecycle, see `variantStatusDisplay`). The ISO-4217 wire shape stays
 * upper-case (`^[A-Z]{3}$`) via boundary uppercasing; entry accepts
 * either case. SKU uniqueness, price rules, and variant validity stay
 * backend-owned: `400` field maps project through `applyServerErrors()`
 * onto their control paths (rendered verbatim backend-localized),
 * unknown keys return for the page-level notice.
 *
 * SSR/hydration safe: reactive forms only, no browser APIs. RTL safe:
 * logical properties only.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { ADMIN_SERVER_ERROR_KEY } from '../../../../shared/forms/field-errors/field-errors';
import { AdminFormActions } from '../../../../shared/forms/form-actions/form-actions';
import { AdminSelect, type AdminSelectOption } from '../../../../shared/forms/select/select';
import { AdminTextInput } from '../../../../shared/forms/text-input/text-input';
import {
  emptyVariantFormValue,
  toFormErrorPath,
  type VariantFormValue,
} from '../../models/catalog-admin.models';

/** Variant form mode: creation requires money, editing unlocks it. */
export type VariantFormMode = 'create' | 'edit';

/**
 * Group-level money pairing for edit mode: price and currency travel
 * together or not at all (creation enforces presence per control, so
 * this only bites when exactly one side is blank).
 */
export function moneyPairedValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const price = group.get('unitPriceAmount')?.value;
    const currency = group.get('currency')?.value;
    const hasPrice = typeof price === 'string' && price.trim() !== '';
    const hasCurrency = typeof currency === 'string' && currency.trim() !== '';
    return hasPrice === hasCurrency ? null : { moneyUnpaired: true };
  };
}

@Component({
  selector: 'app-variant-form',
  imports: [ReactiveFormsModule, AdminFormActions, AdminSelect, AdminTextInput],
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
        status: value.status === null ? '' : String(value.status),
      });
    }
  }

  /**
   * Editing mode: creation requires money; editing makes money
   * optional-but-paired (group validator) and reveals the status select.
   */
  @Input() set mode(value: VariantFormMode) {
    this.formMode = value;
    if (value === 'edit') {
      this.priceControl().setValidators([Validators.pattern(/^\d+(\.\d+)?$/)]);
      this.currencyControl().setValidators([
        Validators.pattern(/^[A-Za-z]{3}$/),
        Validators.maxLength(3),
      ]);
    } else {
      this.priceControl().setValidators([Validators.required, Validators.pattern(/^\d+(\.\d+)?$/)]);
      this.currencyControl().setValidators([
        Validators.required,
        Validators.pattern(/^[A-Za-z]{3}$/),
        Validators.maxLength(3),
      ]);
    }
    this.priceControl().updateValueAndValidity({ emitEvent: false });
    this.currencyControl().updateValueAndValidity({ emitEvent: false });
  }

  /** Status select options (owner-localized Active/Inactive entries). */
  @Input() statusOptions: readonly AdminSelectOption[] = [];

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
  protected readonly form = new FormGroup(
    {
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
      status: new FormControl<string | null>(''),
    },
    { validators: [moneyPairedValidator()] },
  );

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

  protected statusControl(): FormControl<string | null> {
    return this.form.controls.status;
  }

  /** Whether the status select renders (edit mode only). */
  protected showStatus(): boolean {
    return this.formMode === 'edit';
  }

  /** Whether the pairing notice renders (unpaired money attempt). */
  protected showPairedError(): boolean {
    return this.form.hasError('moneyUnpaired') && (this.form.touched || this.form.dirty);
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
    for (const path of ['sku', 'name', 'unitPriceAmount', 'currency', 'status']) {
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
    const parsed = raw.status === null || raw.status.trim() === '' ? NaN : Number(raw.status);
    // Options constrain input to the two wire values; anything else can
    // only arrive programmatically and maps to `null` (never `NaN`).
    const status = parsed === 0 || parsed === 1 ? parsed : null;
    this.save.emit({
      ...emptyVariantFormValue(),
      sku: raw.sku,
      name: raw.name,
      price: raw.unitPriceAmount,
      currency: raw.currency,
      status,
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
  readonly statusLabel: string;
  readonly pairedError: string;
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
  statusLabel: '',
  pairedError: '',
  submit: '',
  cancel: '',
  saving: '',
};
