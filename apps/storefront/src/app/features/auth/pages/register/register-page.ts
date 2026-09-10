/**
 * Registration page for Sub-Phase 2.4 — the plan's registration vertical
 * slice: form → validation → register API → result state (`PHASE_2` §4.4).
 *
 * Success never authenticates: the contract issues no tokens on register
 * and new accounts are `Pending` until the verification email is consumed,
 * so the page swaps to a pending-verification state (email address echoed
 * for confirmation) instead of redirecting or storing a session.
 */

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import { isApiError } from '@flux/api';
import { AuthDataAccess, type RegistrationResult } from '../../data-access/auth-data-access';
import {
  applyServerValidationErrors,
  clearServerValidationErrors,
} from '../../data-access/auth-form-errors';
import {
  authEmailValidators,
  authNameValidators,
  registerPasswordValidators,
} from '../../data-access/auth-validators';
import { FieldErrors } from '../../components/field-errors/field-errors';

@Component({
  selector: 'app-register-page',
  imports: [ReactiveFormsModule, RouterLink, FieldErrors, LoadingIndicator, ErrorState],
  templateUrl: './register-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly authDataAccess = inject(AuthDataAccess);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: authEmailValidators(),
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: registerPasswordValidators(),
    }),
    firstName: new FormControl('', {
      nonNullable: true,
      validators: authNameValidators(),
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: authNameValidators(),
    }),
  });

  /** Request in flight: form disabled, spinner shown, double-submit blocked. */
  readonly isSubmitting = signal(false);
  /** Form-level failure (backend localized `detail` verbatim). Null when clear. */
  readonly formError = signal<string | null>(null);
  /** Successful registration outcome; when set, the form swaps to pending UI. */
  readonly result = signal<RegistrationResult | null>(null);

  submit(): void {
    this.formError.set(null);
    clearServerValidationErrors(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const raw = this.form.getRawValue();
    this.authDataAccess
      .register({
        email: raw.email.trim(),
        password: raw.password,
        firstName: raw.firstName.trim(),
        lastName: raw.lastName.trim(),
      })
      .subscribe({
        next: (outcome) => {
          this.isSubmitting.set(false);
          this.result.set(outcome);
        },
        error: (error: unknown) => {
          this.isSubmitting.set(false);
          if (isApiError(error)) {
            applyServerValidationErrors(this.form, error.validationErrors);
            this.formError.set(error.message);
          } else {
            this.formError.set('Something went wrong. Please try again.');
          }
        },
      });
  }
}
