/**
 * Resend-verification page for Sub-Phase 2.10.
 *
 * Email form → `POST /auth/resend-verification` → send receipt. Copy
 * branches on the backend `emailSent` flag: sent means "check your inbox",
 * unsent means the account is already verified and the user should sign
 * in instead. Establishes nothing.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import { isApiError } from '@flux/api';
import { CultureService, resolveApiErrorMessage } from '@flux/i18n';
import type { ResendVerificationResponse } from '@flux/models';
import { AuthDataAccess } from '../../data-access/auth-data-access';
import { AUTH_TRANSLATION_KEYS, translateAuthKey } from '../../i18n/auth-translations';
import {
  applyServerValidationErrors,
  clearServerValidationErrors,
} from '../../data-access/auth-form-errors';
import { authEmailValidators } from '../../data-access/auth-validators';
import { FieldErrors } from '../../components/field-errors/field-errors';

@Component({
  selector: 'app-resend-verification-page',
  imports: [ReactiveFormsModule, RouterLink, FieldErrors, LoadingIndicator, ErrorState],
  templateUrl: './resend-verification-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResendVerificationPage {
  private readonly authDataAccess = inject(AuthDataAccess);
  private readonly cultures = inject(CultureService);

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

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      doneTitle: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.resendDoneTitle),
      verifiedMessage: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.resendVerifiedMessage),
      backToLogin: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.resendBackToLogin),
      title: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.resendTitle),
      subtitle: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.resendSubtitle),
      emailLabel: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.resendEmailLabel),
      submit: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.resendSubmit),
      submitting: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.resendSubmitting),
      errorTitle: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.resendErrorTitle),
      verifiedPrompt: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.resendVerifiedPrompt),
      signInLink: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.resendSignInLink),
    };
  });

  /** Localized confirmation copy (email interpolated). */
  protected readonly sentMessage = computed(() =>
    translateAuthKey(this.cultures.culture(), AUTH_TRANSLATION_KEYS.resendSentMessage, {
      email: this.sentTo() ?? '',
    }),
  );

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
        const apiError = isApiError(error) ? error : null;
        if (apiError !== null) {
          applyServerValidationErrors(this.form, apiError.validationErrors);
        }
        this.formError.set(resolveApiErrorMessage(apiError, this.cultures.culture()));
      },
    });
  }
}
