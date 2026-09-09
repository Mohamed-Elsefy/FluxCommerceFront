/**
 * Resend-verification page for Sub-Phase 2.10.
 *
 * Email form → `POST /auth/resend-verification` → send receipt. Copy
 * branches on the backend `emailSent` flag: sent means "check your inbox",
 * unsent means the account is already verified and the user should sign
 * in instead. Establishes nothing.
 */

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import { isApiError } from '@flux/api';
import type { ResendVerificationResponse } from '@flux/models';
import { AuthDataAccess } from '../../data-access/auth-data-access';
import {
  applyServerValidationErrors,
  clearServerValidationErrors,
} from '../../data-access/auth-form-errors';
import { authEmailValidators } from '../../data-access/auth-validators';
import { FieldErrors } from '../../components/field-errors';

@Component({
  selector: 'app-resend-verification-page',
  imports: [ReactiveFormsModule, RouterLink, FieldErrors, LoadingIndicator, ErrorState],
  templateUrl: './resend-verification-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResendVerificationPage {
  private readonly authDataAccess = inject(AuthDataAccess);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: authEmailValidators(),
    }),
  });

  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly receipt = signal<ResendVerificationResponse | null>(null);
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
    this.authDataAccess.resendVerification(email).subscribe({
      next: (receipt) => {
        this.isSubmitting.set(false);
        this.sentTo.set(email);
        this.receipt.set(receipt);
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
