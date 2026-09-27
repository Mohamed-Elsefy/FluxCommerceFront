/**
 * Category form for Sub-Phase 13.5 — Category Management.
 *
 * Feature-owned dumb form shared by the category create and edit pages:
 * typed `FormGroup` over `CategoryFormValue` (name, slug, description,
 * optional parent) with client-side `required` validators on the
 * backend-required fields, rendered through the shared admin inputs.
 * Dumb by design — initial values, parent options, all copy, and the
 * submit lock arrive as inputs; the validated value leaves through
 * `save`, cancellation through `cancelled`. Submission transport stays
 * in the owning pages.
 *
 * Hierarchy follows the backend model: `parentId` is a nullable
 * reference rendered as a select with an empty top-level option — no
 * tree widget exists because no tree endpoint exists. Name/slug
 * uniqueness, own-parent cycles, and deleted-parent rules stay
 * backend-owned: `400` field maps project through `applyServerErrors()`
 * onto their control paths (rendered verbatim backend-localized),
 * unknown keys return for the page-level notice.
 *
 * SSR/hydration safe: reactive forms only, no browser APIs. RTL safe:
 * logical properties only.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ADMIN_SERVER_ERROR_KEY } from '../../../../shared/forms/field-errors/field-errors';
import { AdminFormActions } from '../../../../shared/forms/form-actions/form-actions';
import { AdminSelect, type AdminSelectOption } from '../../../../shared/forms/select/select';
import { AdminTextInput } from '../../../../shared/forms/text-input/text-input';
import { AdminTextarea } from '../../../../shared/forms/textarea/textarea';
import {
  emptyCategoryFormValue,
  toFormErrorPath,
  type CategoryFormValue,
} from '../../models/catalog-admin.models';

@Component({
  selector: 'app-category-form',
  imports: [ReactiveFormsModule, AdminFormActions, AdminSelect, AdminTextInput, AdminTextarea],
  templateUrl: './category-form.html',
  styleUrl: './category-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryForm {
  /** Initial value (create: blank; edit: populated once loaded). */
  @Input() set initial(value: CategoryFormValue | null) {
    if (value !== null) {
      this.form.patchValue({
        name: value.name,
        slug: value.slug,
        description: value.description,
        parentId: value.parentId,
      });
    }
  }

  /** Parent options (owner-localized labels, empty top-level option included). */
  @Input() parents: readonly AdminSelectOption[] = [];
  /** Field labels and hints (owner-localized, single object input). */
  @Input() copy: CategoryFormCopy = EMPTY_CATEGORY_FORM_COPY;
  /** Submission in flight: actions lock with progress copy. */
  @Input() submitting = false;

  /** Emitted with the validated value on submit. */
  @Output() readonly save = new EventEmitter<CategoryFormValue>();
  /** Emitted when the cancel action activates. */
  @Output() readonly cancelled = new EventEmitter<void>();

  /** Typed category form (presence validators only — rules stay backend-owned). */
  protected readonly form = new FormGroup({
    name: new FormControl<string | null>(null, { validators: [Validators.required] }),
    slug: new FormControl<string | null>(null, { validators: [Validators.required] }),
    description: new FormControl<string | null>(null),
    parentId: new FormControl<string | null>(null),
  });

  protected nameControl(): FormControl<string | null> {
    return this.form.controls.name;
  }

  protected slugControl(): FormControl<string | null> {
    return this.form.controls.slug;
  }

  protected descriptionControl(): FormControl<string | null> {
    return this.form.controls.description;
  }

  protected parentControl(): FormControl<string | null> {
    return this.form.controls.parentId;
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
    for (const path of ['name', 'slug', 'description', 'parentId']) {
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
      ...emptyCategoryFormValue(),
      name: raw.name,
      slug: raw.slug,
      description: raw.description,
      parentId: raw.parentId,
    });
  }
}

/** Localized category form copy (single owner-provided object input). */
export interface CategoryFormCopy {
  readonly name: string;
  readonly slug: string;
  readonly slugHint: string;
  readonly description: string;
  readonly parent: string;
  readonly submit: string;
  readonly cancel: string;
  readonly saving: string;
}

const EMPTY_CATEGORY_FORM_COPY: CategoryFormCopy = {
  name: '',
  slug: '',
  slugHint: '',
  description: '',
  parent: '',
  submit: '',
  cancel: '',
  saving: '',
};
