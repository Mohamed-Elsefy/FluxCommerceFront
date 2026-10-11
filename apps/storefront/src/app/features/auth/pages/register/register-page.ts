/**
 * Registration page for Sub-Phase 2.4 — the plan's registration vertical
 * slice: form → validation → register API → result state (`PHASE_2` §4.4).
 *
 * Success never authenticates: the contract issues no tokens on register
 * and new accounts are `Pending` until the verification email is consumed,
 * so the page swaps to a pending-verification state (email address echoed
 * for confirmation) instead of redirecting or storing a session.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import { isApiError } from '@flux/api';
import { CultureService, resolveApiErrorMessage } from '@flux/i18n';
import { AuthDataAccess, type RegistrationResult } from '../../data-access/auth-data-access';
import { AUTH_TRANSLATION_KEYS, translateAuthKey } from '../../i18n/auth-translations';
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
  imports: [
    ReactiveFormsModule,
    RouterLink,
    RouterLinkActive,
    FieldErrors,
    LoadingIndicator,
    ErrorState,
  ],
  templateUrl: './register-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPage {
  private readonly authDataAccess = inject(AuthDataAccess);
  private readonly cultures = inject(CultureService);

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

  /** Reveals the password text while true (local UI state, never persisted). */
  protected readonly showPassword = signal(false);
  /** Form-level failure, localized through `resolveApiErrorMessage` (11.10). Null when clear. */
  readonly formError = signal<string | null>(null);

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerTitle),
      subtitle: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerSubtitle),
      tabLogin: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.tabsLogin),
      tabRegister: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.tabsRegister),
      passwordShow: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.passwordShow),
      passwordHide: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.passwordHide),
      emailLabel: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerEmailLabel),
      passwordLabel: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerPasswordLabel),
      firstNameLabel: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerFirstNameLabel),
      lastNameLabel: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerLastNameLabel),
      submit: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerSubmit),
      submitting: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerSubmitting),
      errorTitle: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerErrorTitle),
      doneTitle: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerDoneTitle),
      resendPrompt: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerResendPrompt),
      resendLink: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerResendLink),
      backToLogin: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerBackToLogin),
      haveAccount: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerHaveAccount),
      signInLink: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.registerSignInLink),
    };
  });

  /** Localized success panel copy (email interpolated). */
  protected readonly doneCopy = computed(() => {
    const culture = this.cultures.culture();
    const email = this.result()?.email ?? '';
    const verified = this.result()?.isEmailVerified === true;
    return {
      message: translateAuthKey(
        culture,
        verified
          ? AUTH_TRANSLATION_KEYS.registerDoneVerified
          : AUTH_TRANSLATION_KEYS.registerDonePending,
        { email },
      ),
    };
  });
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
          const apiError = isApiError(error) ? error : null;
          if (apiError !== null) {
            applyServerValidationErrors(this.form, apiError.validationErrors);
          }
          this.formError.set(resolveApiErrorMessage(apiError, this.cultures.culture()));
        },
      });
  }
}
