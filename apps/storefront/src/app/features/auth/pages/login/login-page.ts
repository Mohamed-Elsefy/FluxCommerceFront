/**
 * Login page for Sub-Phase 2.4 — the plan's login vertical slice:
 * form → validation → login API → stored session → current user →
 * authenticated → redirect (`PHASE_2` §4.4).
 *
 * Minimal and functional by design: no design system, English-only copy
 * (Phase 4), no session restoration handling (2.8), no guards (2.11).
 * Already-authenticated visits bounce to the return URL immediately.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import { AuthService } from '@flux/auth';
import { isApiError } from '@flux/api';
import { CultureService, resolveApiErrorMessage } from '@flux/i18n';
import { AuthDataAccess } from '../../data-access/auth-data-access';
import {
  applyServerValidationErrors,
  clearServerValidationErrors,
} from '../../data-access/auth-form-errors';
import { authEmailValidators, loginPasswordValidators } from '../../data-access/auth-validators';
import { FieldErrors } from '../../components/field-errors/field-errors';
import { AUTH_TRANSLATION_KEYS, translateAuthKey } from '../../i18n/auth-translations';

@Component({
  selector: 'app-login-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    RouterLinkActive,
    FieldErrors,
    LoadingIndicator,
    ErrorState,
  ],
  templateUrl: './login-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly authDataAccess = inject(AuthDataAccess);
  private readonly auth = inject(AuthService);
  private readonly cultures = inject(CultureService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.loginTitle),
      subtitle: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.loginSubtitle),
      tabLogin: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.tabsLogin),
      tabRegister: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.tabsRegister),
      passwordShow: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.passwordShow),
      passwordHide: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.passwordHide),
      emailLabel: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.loginEmailLabel),
      passwordLabel: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.loginPasswordLabel),
      submit: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.loginSubmit),
      submitting: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.loginSubmitting),
      errorTitle: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.loginErrorTitle),
      forgot: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.loginForgot),
      newHere: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.loginNewHere),
      registerLink: translateAuthKey(culture, AUTH_TRANSLATION_KEYS.loginRegisterLink),
    };
  });

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: authEmailValidators(),
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: loginPasswordValidators(),
    }),
  });

  /** Request in flight: form disabled, spinner shown, double-submit blocked. */
  readonly isSubmitting = signal(false);

  /** Reveals the password text while true (local UI state, never persisted). */
  protected readonly showPassword = signal(false);
  /**
   * Form-level failure, localized through `resolveApiErrorMessage` (stable
   * codes/statuses — never backend text, 11.10). Null when clear.
   */
  readonly formError = signal<string | null>(null);

  constructor() {
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl(this.safeReturnUrl());
    }
  }

  submit(): void {
    this.formError.set(null);
    clearServerValidationErrors(this.form);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSubmitting.set(true);
    const raw = this.form.getRawValue();
    this.authDataAccess.login({ email: raw.email.trim(), password: raw.password }).subscribe({
      next: () => {
        void this.router.navigateByUrl(this.safeReturnUrl());
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

  /**
   * `?returnUrl=` passthrough for post-login redirect (preserved for the
   * 2.11 guards). Accepts same-origin paths only — anything else falls
   * back to `/` to block open redirects.
   */
  private safeReturnUrl(): string {
    const candidate = this.route.snapshot.queryParamMap.get('returnUrl');
    if (candidate !== null && candidate.startsWith('/') && !candidate.startsWith('//')) {
      return candidate;
    }
    return '/';
  }
}
