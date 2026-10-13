/**
 * Image form for Sub-Phase 13.6 — Product Images & Specifications.
 *
 * Feature-owned dumb form shared by the image add and edit dialogs:
 * typed `FormGroup` over `ImageFormValue` (URL, alt text, display
 * order, primary flag) with client-side validators for presence and
 * input shape, rendered through the shared admin inputs. Dumb by
 * design — mode, initial values, all copy, and the submit lock arrive
 * as inputs; the validated value leaves through `save`, cancellation
 * through `cancelled`. Submission transport stays in the owning page.
 *
 * Contract-shaped editing: URL-based references only (confirmed in
 * 13.1 — the URL field carries a URL string, no file input exists
 * anywhere). `primary` travels on add ONLY (the update endpoint
 * accepts no primary flag — primary moves through `set-primary`
 * only), so `mode: 'edit'` hides the checkbox and the mapper never
 * sends it. URL/order rules stay backend-owned: `400` field maps
 * project through `applyServerErrors()` onto their control paths
 * (rendered verbatim backend-localized), unknown keys return for the
 * page-level notice.
 *
 * SSR/hydration safe: reactive forms only, no browser APIs. RTL safe:
 * logical properties only.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ADMIN_SERVER_ERROR_KEY } from '../../../../shared/forms/field-errors/field-errors';
import { AdminCheckbox } from '../../../../shared/forms/checkbox/checkbox';
import { AdminFormActions } from '../../../../shared/forms/form-actions/form-actions';
import { AdminTextInput } from '../../../../shared/forms/text-input/text-input';
import { AdminTextarea } from '../../../../shared/forms/textarea/textarea';
import {
  emptyImageFormValue,
  toFormErrorPath,
  type ImageFormValue,
} from '../../models/catalog-admin.models';

/** Image form mode: adding carries the primary flag, editing does not. */
export type ImageFormMode = 'create' | 'edit';

@Component({
  selector: 'app-image-form',
  imports: [ReactiveFormsModule, AdminCheckbox, AdminFormActions, AdminTextInput, AdminTextarea],
  templateUrl: './image-form.html',
  styleUrl: './image-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageForm {
  /** Initial value (add: blank; edit: populated from the row). */
  @Input() set initial(value: ImageFormValue | null) {
    if (value !== null) {
      this.form.patchValue({
        imageUrl: value.url,
        altText: value.altText,
        displayOrder: value.order,
        isPrimary: value.primary,
      });
    }
  }

  /** Editing mode (the primary checkbox renders on add only). */
  @Input() mode: ImageFormMode = 'create';

  /** Field labels and hints (owner-localized, single object input). */
  @Input() copy: ImageFormCopy = EMPTY_IMAGE_FORM_COPY;
  /** Submission in flight: actions lock with progress copy. */
  @Input() submitting = false;

  /** Emitted with the validated value on submit. */
  @Output() readonly save = new EventEmitter<ImageFormValue>();
  /** Emitted when the cancel action activates. */
  @Output() readonly cancelled = new EventEmitter<void>();

  /**
   * Typed image form (presence + shape validators only — rules stay
   * backend-owned). Control names mirror the DTO camelCase
   * (`imageUrl`, `altText`, `displayOrder`, `isPrimary`) so backend
   * `errors{}` keys project onto their paths through the shared
   * `toFormErrorPath` mapper with no per-form table.
   */
  protected readonly form = new FormGroup({
    imageUrl: new FormControl<string | null>(null, { validators: [Validators.required] }),
    altText: new FormControl<string | null>(null),
    displayOrder: new FormControl<string | null>(null, {
      validators: [Validators.required, Validators.pattern(/^\d+$/)],
    }),
    isPrimary: new FormControl<boolean | null>(false),
  });

  protected urlControl(): FormControl<string | null> {
    return this.form.controls.imageUrl;
  }

  protected altControl(): FormControl<string | null> {
    return this.form.controls.altText;
  }

  protected orderControl(): FormControl<string | null> {
    return this.form.controls.displayOrder;
  }

  protected primaryControl(): FormControl<boolean | null> {
    return this.form.controls.isPrimary;
  }

  /** Whether the primary checkbox renders (add only). */
  protected showPrimary(): boolean {
    return this.mode === 'create';
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
    for (const path of ['imageUrl', 'altText', 'displayOrder']) {
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
      ...emptyImageFormValue(),
      url: raw.imageUrl,
      altText: raw.altText,
      order: raw.displayOrder,
      primary: raw.isPrimary ?? false,
    });
  }
}

/** Localized image form copy (single owner-provided object input). */
export interface ImageFormCopy {
  readonly url: string;
  readonly urlHint: string;
  readonly altText: string;
  readonly order: string;
  readonly primary: string;
  readonly submit: string;
  readonly cancel: string;
  readonly saving: string;
}

const EMPTY_IMAGE_FORM_COPY: ImageFormCopy = {
  url: '',
  urlHint: '',
  altText: '',
  order: '',
  primary: '',
  submit: '',
  cancel: '',
  saving: '',
};
