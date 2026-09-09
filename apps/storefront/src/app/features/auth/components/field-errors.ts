/**
 * Shared field-error presentation for auth forms (Sub-Phase 2.4).
 *
 * Presentational only: renders the validation messages of one form control
 * (client-side keys plus backend `server` messages applied via
 * `./data-access/auth-form-errors`). Messages appear once the control is
 * touched or dirty. Copy is minimal English — localization is Phase 4.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { SERVER_ERROR_KEY } from '../data-access/auth-form-errors';

@Component({
  selector: 'auth-field-errors',
  template: `
    @if (shouldShow()) {
      <ul class="field-errors">
        @for (message of messages(); track message) {
          <li>{{ message }}</li>
        }
      </ul>
    }
  `,
  styles: `
    .field-errors {
      margin: 0.25rem 0 0;
      padding-inline-start: 1.25rem;
      color: #b3261e;
      font-size: 0.875rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldErrors {
  /** Control whose errors render; null renders nothing. */
  @Input() control: AbstractControl | null = null;
  /** Human field name used in client-side messages. */
  @Input() label = 'This field';

  shouldShow(): boolean {
    const control = this.control;
    return (
      control !== null &&
      control.invalid &&
      (control.touched || control.dirty) &&
      !control.disabled &&
      this.messages().length > 0
    );
  }

  messages(): string[] {
    const control = this.control;
    if (control === null || control.errors === null) {
      return [];
    }
    const messages: string[] = [];
    const errors = control.errors;
    if (errors['required'] !== undefined || errors['nonBlank'] !== undefined) {
      messages.push(`${this.label} is required.`);
    }
    if (errors['email'] !== undefined) {
      messages.push('Enter a valid email address.');
    }
    if (errors['minlength'] !== undefined) {
      const required = (errors['minlength'] as { requiredLength?: number }).requiredLength;
      messages.push(`${this.label} must be at least ${required ?? '?'} characters.`);
    }
    if (errors['maxlength'] !== undefined) {
      const required = (errors['maxlength'] as { requiredLength?: number }).requiredLength;
      messages.push(`${this.label} must be no more than ${required ?? '?'} characters.`);
    }
    if (errors['passwordComplexity'] !== undefined) {
      messages.push(
        `${this.label} needs upper- and lower-case letters, a digit, and a special character.`,
      );
    }
    if (errors['passwordMismatch'] !== undefined) {
      messages.push('Passwords do not match.');
    }
    const server = errors[SERVER_ERROR_KEY];
    if (Array.isArray(server)) {
      for (const message of server) {
        if (typeof message === 'string') {
          messages.push(message);
        }
      }
    }
    return messages;
  }
}
