/**
 * Specification form for Sub-Phase 13.6 — Product Images &
 * Specifications.
 *
 * Feature-owned dumb form shared by the specification add and edit
 * dialogs: typed `FormGroup` over `SpecFormValue` (name, value) with
 * `required` validators on both backend-required fields, rendered
 * through the shared admin inputs. Dumb by design — initial values, all
 * copy, and the submit lock arrive as inputs; the validated value
 * leaves through `save`, cancellation through `cancelled`. Submission
 * transport stays in the owning page.
 *
 * Name/value rules and duplicate names stay backend-owned: `400` field
 * maps project through `applyServerErrors()` onto their control paths
 * (rendered verbatim backend-localized), unknown keys return for the
 * page-level notice.
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
  emptySpecFormValue,
  toFormErrorPath,
  type SpecFormValue,
} from '../../models/catalog-admin.models';

@Component({
  selector: 'app-spec-form',
  imports: [ReactiveFormsModule, AdminFormActions, AdminTextInput],
  templateUrl: './spec-form.html',
  styleUrl: './spec-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SpecForm {
  /** Initial value (add: blank; edit: populated from the row). */
  @Input() set initial(value: SpecFormValue | null) {
    if (value !== null) {
      this.form.patchValue({ name: value.name, value: value.value });
    }
  }

  /** Field labels (owner-localized, single object input). */
  @Input() copy: SpecFormCopy = EMPTY_SPEC_FORM_COPY;
  /** Submission in flight: actions lock with progress copy. */
  @Input() submitting = false;

  /** Emitted with the validated value on submit. */
  @Output() readonly save = new EventEmitter<SpecFormValue>();
  /** Emitted when the cancel action activates. */
  @Output() readonly cancelled = new EventEmitter<void>();

  /** Typed specification form (presence validators only — rules stay backend-owned). */
  protected readonly form = new FormGroup({
    name: new FormControl<string | null>(null, { validators: [Validators.required] }),
    value: new FormControl<string | null>(null, { validators: [Validators.required] }),
  });

  protected nameControl(): FormControl<string | null> {
    return this.form.controls.name;
  }

  protected valueControl(): FormControl<string | null> {
    return this.form.controls.value;
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
    for (const path of ['name', 'value']) {
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
    this.save.emit({ ...emptySpecFormValue(), name: raw.name, value: raw.value });
  }
}

/** Localized specification form copy (single owner-provided object input). */
export interface SpecFormCopy {
  readonly name: string;
  readonly value: string;
  readonly submit: string;
  readonly cancel: string;
  readonly saving: string;
}

const EMPTY_SPEC_FORM_COPY: SpecFormCopy = {
  name: '',
  value: '',
  submit: '',
  cancel: '',
  saving: '',
};
