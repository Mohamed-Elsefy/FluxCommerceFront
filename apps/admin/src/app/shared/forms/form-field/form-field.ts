/**
 * Admin form field for Sub-Phase 12.6 — Filtering & Form Primitives.
 *
 * Layout primitive for one labeled form row: a label, a projected
 * control (native input, select, textarea, checkbox, or a shared
 * control wrapper), an optional hint, and control validation messages
 * (`admin-field-errors`). Dumb by design — validation rules,
 * values, and submission stay in the owning feature's typed form.
 *
 * Label association runs through `fieldId` (mirroring the feature's
 * control id); without one the label renders unassociated, so features
 * should always pass ids. SSR/hydration safe: static markup from inputs
 * only. RTL safe: logical properties only.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import { AdminFieldErrors } from '../field-errors/field-errors';

@Component({
  selector: 'admin-form-field',
  imports: [AdminFieldErrors],
  templateUrl: './form-field.html',
  styleUrl: './form-field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFormField {
  /** Visible label (owner-localized, required). */
  @Input({ required: true }) label = '';
  /** Control for validation messages; null renders no messages. */
  @Input() control: AbstractControl | null = null;
  /** Control id for label association (owner-provided). */
  @Input() fieldId: string | null = null;
  /** Supporting hint text (owner-localized). */
  @Input() hint: string | null = null;
}
