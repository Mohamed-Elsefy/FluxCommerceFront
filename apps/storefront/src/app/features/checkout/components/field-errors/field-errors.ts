/**
 * Checkout field-error presentation for Sub-Phase 8.4 — Customer &
 * Shipping Information.
 *
 * Presentational only: renders the validation messages of one address
 * control from page-localized templates (`CheckoutFieldTemplates`,
 * resolved through the checkout `i18n` bundle at the consuming page).
 * Messages appear once the control is touched or dirty (real-time
 * feedback without flagging pristine fields) and expose `role="alert"`
 * so assistive technology announces them.
 *
 * Checkout-owned (not the auth `FieldErrors`): error keys differ
 * (`maxlength`, `pattern` for the country shape) and copy comes from
 * the checkout namespace — features own their presentation
 * (`ARCHITECTURE.md` §7).
 */

import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnDestroy,
  inject,
} from '@angular/core';
import { AbstractControl } from '@angular/forms';
import type { Subscription } from 'rxjs';

/**
 * Localized validation templates with `{label}`/`{max}` slots (see the
 * checkout `i18n` bundle: `checkout.validation.*`).
 */
export interface CheckoutFieldTemplates {
  readonly required: string;
  readonly tooLong: string;
  readonly invalidCountryCode: string;
}

/** Fills `{label}`/`{max}` slots. Pure — throws nothing. */
export function fillFieldTemplate(template: string, label: string, max?: number): string {
  return template.replace('{label}', label).replace('{max}', max === undefined ? '' : String(max));
}

@Component({
  selector: 'checkout-field-errors',
  templateUrl: './field-errors.html',
  styleUrl: './field-errors.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutFieldErrors implements OnChanges, OnDestroy {
  /** Control whose errors render; null renders nothing. */
  @Input() control: AbstractControl | null = null;
  /** Human field name interpolated into `{label}` slots. */
  @Input() label = 'This field';
  /** Localized templates; null renders nothing. */
  @Input() templates: CheckoutFieldTemplates | null = null;

  private readonly changeDetector = inject(ChangeDetectorRef);
  private controlEvents: Subscription | null = null;

  /**
   * Refreshes on every control event (value, status, touched, pristine,
   * disable): `AbstractControl` mutations do not touch @Inputs, so an
   * `OnPush` view would otherwise stay stale until an unrelated check.
   */
  ngOnChanges(): void {
    this.controlEvents?.unsubscribe();
    this.controlEvents =
      this.control?.events.subscribe(() => this.changeDetector.markForCheck()) ?? null;
  }

  ngOnDestroy(): void {
    this.controlEvents?.unsubscribe();
  }

  shouldShow(): boolean {
    const control = this.control;
    return (
      control !== null &&
      this.templates !== null &&
      control.invalid &&
      (control.touched || control.dirty) &&
      !control.disabled &&
      this.messages().length > 0
    );
  }

  messages(): string[] {
    const control = this.control;
    const templates = this.templates;
    if (control === null || control.errors === null || templates === null) {
      return [];
    }
    const messages: string[] = [];
    const errors = control.errors;
    if (errors['required'] !== undefined || errors['nonBlank'] !== undefined) {
      messages.push(fillFieldTemplate(templates.required, this.label));
    }
    if (errors['maxlength'] !== undefined) {
      const required = (errors['maxlength'] as { requiredLength?: number }).requiredLength;
      messages.push(fillFieldTemplate(templates.tooLong, this.label, required ?? 0));
    }
    if (errors['pattern'] !== undefined) {
      messages.push(fillFieldTemplate(templates.invalidCountryCode, this.label));
    }
    return messages;
  }
}
