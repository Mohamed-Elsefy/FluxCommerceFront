/**
 * Forgot-password page for Sub-Phase 2.10.
 *
 * Email form → `POST /auth/forgot-password` → unconditional success panel.
 * The backend always answers `200` to block account enumeration, so the
 * page must never distinguish "account exists" from "account unknown" —
 * the same confirmation shows for every syntactically valid email.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import { isApiError } from '@flux/api';
import { CultureService, resolveApiErrorMessage } from '@flux/i18n';
import { AuthDataAccess } from '../../data-access/auth-data-access';
import { AUTH_TRANSLATION_KEYS, translateAuthKey } from '../../i18n/auth-translations';
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
  private readonly cultures = inject(CultureService);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: authEmailValidators(),
    }),
  });

  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly sentTo = signal<string | null>(null);

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.forgotTitle),
      subtitle: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.forgotSubtitle),
      emailLabel: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.forgotEmailLabel),
      submit: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.forgotSubmit),
      submitting: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.forgotSubmitting),
      errorTitle: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.forgotErrorTitle),
      doneTitle: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.forgotDoneTitle),
      backToLogin: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.forgotBackToLogin),
      remembered: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.forgotRemembered),
      signInLink: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.forgotSignInLink),
    };
  });

  /** Localized confirmation copy (email interpolated). */
  protected readonly doneMessage = computed(() =>
    translateAuthKey(this.cultures.culture(), AUTH_TRANSLATION_KEYS.forgotDoneMessage, {
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
    this.authDataAccess.forgotPassword(email).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        this.sentTo.set(email);
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
