/**
 * Forgot-password page for Sub-Phase 2.10.
 *
 * Email form → `POST /auth/forgot-password` → unconditional success panel.
 * The backend always answers `200` to block account enumeration, so the
 * page must never distinguish "account exists" from "account unknown" —
 * the same confirmation shows for every syntactically valid email.
 */

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import { isApiError } from '@flux/api';
import { AuthDataAccess } from '../../data-access/auth-data-access';
import {
  applyServerValidationErrors,
  clearServerValidationErrors,
} from '../../data-access/auth-form-errors';
import { authEmailValidators } from '../../data-access/auth-validators';
import { FieldErrors } from '../../components/field-errors/field-errors';

@Component({
  selector: 'app-forgot-password-page',
  imports: [ReactiveFormsModule, RouterLink, FieldErrors, LoadingIndicator, ErrorState],
  templateUrl: './forgot-password-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForgotPasswordPage {
  private readonly authDataAccess = inject(AuthDataAccess);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: authEmailValidators(),
    }),
  });

  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly sentTo = signal<string | null>(null);

  submit(): void {
    this.formError.set(null);
    clearServerValidationErrors(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const email = this.form.getRawValue().email.trim();
    this.authDataAccess.forgotPassword(email).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.sentTo.set(email);
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
