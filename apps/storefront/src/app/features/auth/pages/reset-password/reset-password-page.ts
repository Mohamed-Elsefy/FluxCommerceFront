/**
 * Reset-password page for Sub-Phase 2.10.
 *
 * Consumes the single-use 1h token from `?token=` plus a fresh password
 * (typed twice locally — the backend `ResetPasswordRequest` carries no
 * confirmation field, so matching is enforced client-side only and the
 * wire body stays contract-exact). Success establishes nothing and
 * prompts a login with the new password. A missing token explains itself
 * with a path back to the forgot-password entry point.
 */

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import { isApiError } from '@flux/api';
import { AuthDataAccess } from '../../data-access/auth-data-access';
import {
  applyServerValidationErrors,
  clearServerValidationErrors,
} from '../../data-access/auth-form-errors';
import {
  matchingPasswordsValidator,
  registerPasswordValidators,
} from '../../data-access/auth-validators';
import { FieldErrors } from '../../components/field-errors/field-errors';

@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink, FieldErrors, LoadingIndicator, ErrorState],
  templateUrl: './reset-password-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPage {
  private readonly authDataAccess = inject(AuthDataAccess);
  private readonly route = inject(ActivatedRoute);

  readonly token = signal<string | null>(this.route.snapshot.queryParamMap.get('token'));

  readonly form = new FormGroup(
    {
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: registerPasswordValidators(),
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: registerPasswordValidators(),
      }),
    },
    { validators: matchingPasswordsValidator('newPassword', 'confirmPassword') },
  );

  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly done = signal(false);

  submit(): void {
    const token = this.token();
    this.formError.set(null);
    clearServerValidationErrors(this.form);
    if (token === null || token.length === 0 || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const { newPassword } = this.form.getRawValue();
    this.authDataAccess.resetPassword({ token, newPassword }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.done.set(true);
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
