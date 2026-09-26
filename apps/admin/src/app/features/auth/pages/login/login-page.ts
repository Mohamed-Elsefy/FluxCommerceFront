/**
 * Admin login page for Sub-Phase 12.1 — Admin Route & Authorization
 * Integration.
 *
 * Scope: `docs/phases/PHASE_12_ADMIN_PORTAL_FOUNDATION.md` §12.1. The
 * portal's anonymous entry point: form → validation → login API → stored
 * session → current user → redirect (`?returnUrl=`, same-origin only,
 * default `/dashboard`).
 *
 * Minimal by design: no registration/recovery links (the Admin portal
 * has no such routes), no role checks here — whether the session may
 * enter the portal stays with the route guards (`authGuard` + `roleGuard`,
 * `Admin`/`SuperAdmin`) and backend authorization stays authoritative.
 * Already-authenticated visits bounce to the return URL immediately.
 * Copy resolves through the feature-owned auth bundle (§12.9).
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import { AuthService } from '@flux/auth';
import { isApiError } from '@flux/api';
import { CultureService, resolveApiErrorMessage } from '@flux/i18n';
import { AdminAuthDataAccess } from '../../data-access/admin-auth-data-access';
import { ADMIN_AUTH_TRANSLATION_KEYS, translateAdminAuthKey } from '../../i18n/auth-translations';

@Component({
  selector: 'app-admin-login-page',
  imports: [ReactiveFormsModule, ErrorState, LoadingIndicator],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLoginPage {
  private readonly authDataAccess = inject(AdminAuthDataAccess);
  private readonly auth = inject(AuthService);
  private readonly cultures = inject(CultureService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8)],
    }),
  });

  /** Request in flight: form disabled, spinner shown, double-submit blocked. */
  readonly isSubmitting = signal(false);
  /** Form-level failure, localized through `resolveApiErrorMessage`. Null when clear. */
  readonly formError = signal<string | null>(null);

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateAdminAuthKey(culture, ADMIN_AUTH_TRANSLATION_KEYS.loginTitle),
      subtitle: translateAdminAuthKey(culture, ADMIN_AUTH_TRANSLATION_KEYS.loginSubtitle),
      emailLabel: translateAdminAuthKey(culture, ADMIN_AUTH_TRANSLATION_KEYS.loginEmailLabel),
      passwordLabel: translateAdminAuthKey(culture, ADMIN_AUTH_TRANSLATION_KEYS.loginPasswordLabel),
      emailError: translateAdminAuthKey(culture, ADMIN_AUTH_TRANSLATION_KEYS.loginEmailError),
      passwordError: translateAdminAuthKey(culture, ADMIN_AUTH_TRANSLATION_KEYS.loginPasswordError),
      errorTitle: translateAdminAuthKey(culture, ADMIN_AUTH_TRANSLATION_KEYS.loginErrorTitle),
      submit: translateAdminAuthKey(culture, ADMIN_AUTH_TRANSLATION_KEYS.loginSubmit),
      submitting: translateAdminAuthKey(culture, ADMIN_AUTH_TRANSLATION_KEYS.loginSubmitting),
    };
  });

  constructor() {
    if (this.auth.isAuthenticated()) {
      void this.router.navigateByUrl(this.safeReturnUrl());
    }
  }

  submit(): void {
    this.formError.set(null);
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
        this.formError.set(
          resolveApiErrorMessage(isApiError(error) ? error : null, this.cultures.culture()),
        );
      },
    });
  }

  /**
   * `?returnUrl=` passthrough for post-login redirect. Accepts same-origin
   * paths only — anything else falls back to `/dashboard` to block open
   * redirects.
   */
  private safeReturnUrl(): string {
    const candidate = this.route.snapshot.queryParamMap.get('returnUrl');
    if (candidate !== null && candidate.startsWith('/') && !candidate.startsWith('//')) {
      return candidate;
    }
    return '/dashboard';
  }
}
