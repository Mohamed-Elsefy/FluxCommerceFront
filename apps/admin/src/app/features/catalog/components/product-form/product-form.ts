/**
 * Product form for Sub-Phase 13.3 — Product Management.
 *
 * Feature-owned dumb form shared by the create and edit pages: typed
 * `FormGroup` over `ProductFormValue` (name, slug, description,
 * category, visibility, SEO group), client-side `required` validators on
 * the backend-required selections, and the shared admin inputs
 * (text/textarea/select + form actions). Dumb by design — initial values,
 * option lists, all copy, and the submit lock arrive as inputs; the
 * validated value leaves through `save`, cancellation through
 * `cancelled`. Submission transport stays in the owning pages.
 *
 * Backend validation arrives through `applyServerErrors()`: the page
 * passes the normalized `ApiError.validationErrors` map (C#/DTO property
 * names) and this form projects each entry onto its control path
 * (`toFormErrorPath`) as a `server` error rendered verbatim
 * (backend-localized) by the shared field errors. Unknown keys return
 * for the page-level notice instead of failing silently. Client errors
 * merge — server messages never wipe client validity.
 *
 * SSR/hydration safe: reactive forms only, no browser APIs. RTL safe:
 * logical properties only.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ADMIN_SERVER_ERROR_KEY } from '../../../../shared/forms/field-errors/field-errors';
import type { AdminSelectOption } from '../../../../shared/forms/select/select';
import { AdminFormActions } from '../../../../shared/forms/form-actions/form-actions';
import { AdminSelect } from '../../../../shared/forms/select/select';
import { AdminTextInput } from '../../../../shared/forms/text-input/text-input';
import { AdminTextarea } from '../../../../shared/forms/textarea/textarea';
import {
  emptyProductFormValue,
  toFormErrorPath,
  type ProductFormValue,
} from '../../models/catalog-admin.models';

@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule, AdminFormActions, AdminSelect, AdminTextInput, AdminTextarea],
  templateUrl: './product-form.html',
  styleUrl: './product-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductForm {
  /** Initial value (create: blank; edit: populated once loaded). */
  @Input() set initial(value: ProductFormValue | null) {
    if (value !== null) {
      this.form.patchValue({
        name: value.name,
        slug: value.slug,
        description: value.description,
        categoryId: value.categoryId,
        visibility: value.visibility,
        seo: {
          title: value.seoTitle,
          description: value.seoDescription,
          keywords: value.seoKeywords,
        },
      });
    }
  }

  /** Category options (owner-localized labels, empty option included). */
  @Input() categories: readonly AdminSelectOption[] = [];
  /** Visibility options (owner-localized labels, empty option included). */
  @Input() visibilityOptions: readonly AdminSelectOption[] = [];
  /** Field labels and hints (owner-localized, single object input). */
  @Input() copy: ProductFormCopy = EMPTY_FORM_COPY;
  /** Submission in flight: actions lock with progress copy. */
  @Input() submitting = false;

  /** Emitted with the validated value on submit. */
  @Output() readonly save = new EventEmitter<ProductFormValue>();
  /** Emitted when the cancel action activates. */
  @Output() readonly cancelled = new EventEmitter<void>();

  /** Typed product form (validators mirror the backend-required fields). */
  protected readonly form = new FormGroup({
    name: new FormControl<string | null>(null, { validators: [Validators.required] }),
    slug: new FormControl<string | null>(null, { validators: [Validators.required] }),
    description: new FormControl<string | null>(null),
    categoryId: new FormControl<string | null>(null, { validators: [Validators.required] }),
    visibility: new FormControl<string | null>(null, { validators: [Validators.required] }),
    seo: new FormGroup({
      title: new FormControl<string | null>(null),
      description: new FormControl<string | null>(null),
      keywords: new FormControl<string | null>(null),
    }),
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

  protected categoryControl(): FormControl<string | null> {
    return this.form.controls.categoryId;
  }

  protected visibilityControl(): FormControl<string | null> {
    return this.form.controls.visibility;
  }

  protected seoTitleControl(): FormControl<string | null> {
    return this.form.controls.seo.controls.title;
  }

  protected seoDescriptionControl(): FormControl<string | null> {
    return this.form.controls.seo.controls.description;
  }

  protected seoKeywordsControl(): FormControl<string | null> {
    return this.form.controls.seo.controls.keywords;
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
    const clear = (path: string): void => {
      const control = this.form.get(path);
      if (control !== null && control.errors !== null && ADMIN_SERVER_ERROR_KEY in control.errors) {
        const { [ADMIN_SERVER_ERROR_KEY]: _dropped, ...rest } = control.errors;
        control.setErrors(Object.keys(rest).length === 0 ? null : rest);
      }
    };
    for (const path of [
      'name',
      'slug',
      'description',
      'categoryId',
      'visibility',
      'seo.title',
      'seo.description',
      'seo.keywords',
    ]) {
      clear(path);
    }
  }

  /** Validates and emits the value; invalid submits only mark fields. */
  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting) {
      return;
    }
    const raw = this.form.getRawValue();
    const value: ProductFormValue = {
      ...(emptyProductFormValue() as ProductFormValue),
      name: raw.name,
      slug: raw.slug,
      description: raw.description,
      categoryId: raw.categoryId,
      visibility: raw.visibility,
      seoTitle: raw.seo.title,
      seoDescription: raw.seo.description,
      seoKeywords: raw.seo.keywords,
    };
    this.save.emit(value);
  }
}

/** Localized form copy (single owner-provided object input). */
export interface ProductFormCopy {
  readonly name: string;
  readonly slug: string;
  readonly slugHint: string;
  readonly description: string;
  readonly category: string;
  readonly visibility: string;
  readonly seoTitle: string;
  readonly seoDescription: string;
  readonly seoKeywords: string;
  readonly seoKeywordsHint: string;
  readonly submit: string;
  readonly cancel: string;
  readonly saving: string;
}

const EMPTY_FORM_COPY: ProductFormCopy = {
  name: '',
  slug: '',
  slugHint: '',
  description: '',
  category: '',
  visibility: '',
  seoTitle: '',
  seoDescription: '',
  seoKeywords: '',
  seoKeywordsHint: '',
  submit: '',
  cancel: '',
  saving: '',
};
