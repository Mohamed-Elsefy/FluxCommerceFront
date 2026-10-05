/**
 * Admin user creation page — creates one administrator account
 * (`POST /auth/register-admin`, `admins.create`).
 *
 * Smart page (route-level composition) within the users context
 * (`/users/new`, additionally guarded by `admins.create`): owns the
 * creation form and the created admin result — over the shared
 * `IdentityApiService` transport seam (`@flux/api`, S1.2) directly —
 * no feature façade duplicates a thin typed transport that already
 * exists (rules 12.11/Phase-12: no parallel admin transport). No
 * feature state: submission locks and the result record are page-local
 * signals, the smallest appropriate scope.
 *
 * Creation contract (API_CONTRACT.md §1.2 — only backend-exposed
 * operations): `{ email, password, firstName, lastName }` (all
 * non-nullable strings server-side); the account starts
 * permission-less (grants happen afterwards via the user details
 * page), so no permission picker ships here. Duplicates surface as
 * `409 Identity.DuplicateEmail`; field rules stay backend-owned and
 * surface through the form channels (`400` field maps project onto
 * their controls, everything else renders as the form-level notice).
 * Client validation covers presence, email shape, and the 8-char
 * password floor only — the full password policy (length ceiling plus
 * upper/lower/digit/special) stays backend-owned. Re-entrant submits
 * while creation is in flight are no-ops.
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 */

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CultureService, resolveApiErrorMessage } from '@flux/i18n';
import { Card, ErrorState } from '@flux/ui';
import { IdentityApiService, isApiError } from '@flux/api';
import type { UserResponse } from '@flux/models';
import { ADMIN_SERVER_ERROR_KEY } from '../../../../shared/forms/field-errors/field-errors';
import { AdminTextInput } from '../../../../shared/forms/text-input/text-input';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { toFormErrorPath } from '../../../catalog/models/catalog-admin.models';
import { toRegisterAdminRequest } from '../../models/users-admin.models';
import { USERS_TRANSLATION_KEYS, translateUsersKey } from '../../i18n/users-translations';

@Component({
  selector: 'app-user-create-page',
  imports: [ReactiveFormsModule, RouterLink, AdminTextInput, Card, ErrorState],
  templateUrl: './user-create-page.html',
  styleUrl: './user-create-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserCreatePage {
  private readonly identity = inject(IdentityApiService);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);

  /** Email editor (presence plus shape; normalization stays backend-owned). */
  protected readonly emailControl = new FormControl<string | null>(null, {
    validators: [Validators.required, Validators.email],
  });

  /**
   * Password editor (presence plus the 8-char floor; the full policy —
   * ceiling plus upper/lower/digit/special — stays backend-owned and
   * surfaces through the form channels).
   */
  protected readonly passwordControl = new FormControl<string | null>(null, {
    validators: [Validators.required, Validators.minLength(8)],
  });

  /** First-name editor (presence; trimming stays backend-owned). */
  protected readonly firstNameControl = new FormControl<string | null>(null, {
    validators: [Validators.required],
  });

  /** Last-name editor (presence; trimming stays backend-owned). */
  protected readonly lastNameControl = new FormControl<string | null>(null, {
    validators: [Validators.required],
  });

  /** Creation form group (owns the `ngSubmit` output the template binds). */
  protected readonly form = new FormGroup({
    email: this.emailControl,
    password: this.passwordControl,
    firstName: this.firstNameControl,
    lastName: this.lastNameControl,
  });

  /** Submission in flight (actions lock, duplicate submits no-op). */
  protected readonly submitting = signal(false);

  /** Form-level failure notice (`null` when clean). */
  protected readonly formError = signal<string | null>(null);

  /** Created admin record from the last successful creation (`null` until then). */
  protected readonly result = signal<UserResponse | null>(null);

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateUsersKey(culture, USERS_TRANSLATION_KEYS.createHeading),
      subheading: translateUsersKey(culture, USERS_TRANSLATION_KEYS.createSubheading),
      emailLabel: translateUsersKey(culture, USERS_TRANSLATION_KEYS.createEmailLabel),
      passwordLabel: translateUsersKey(culture, USERS_TRANSLATION_KEYS.createPasswordLabel),
      passwordHint: translateUsersKey(culture, USERS_TRANSLATION_KEYS.createPasswordHint),
      firstNameLabel: translateUsersKey(culture, USERS_TRANSLATION_KEYS.createFirstNameLabel),
      lastNameLabel: translateUsersKey(culture, USERS_TRANSLATION_KEYS.createLastNameLabel),
      submit: translateUsersKey(culture, USERS_TRANSLATION_KEYS.createSubmit),
      saving: translateUsersKey(culture, USERS_TRANSLATION_KEYS.createSaving),
      back: translateUsersKey(culture, USERS_TRANSLATION_KEYS.createBack),
      formErrorTitle: translateUsersKey(culture, USERS_TRANSLATION_KEYS.createFormErrorTitle),
      successResultTitle: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsFactsTitle),
      viewUser: translateUsersKey(culture, USERS_TRANSLATION_KEYS.createViewUser),
    };
  });

  /**
   * Submits the creation form: closes over validated input, then runs
   * the backend call under the submit lock. Success notifies and renders
   * the backend-returned created record with a deep link to its details;
   * failures project `400` field maps onto their controls and render
   * everything else (including `409` duplicate email and `401`/`403`)
   * as the form-level notice with user input preserved.
   */
  protected submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) {
      return;
    }
    const body = toRegisterAdminRequest(
      this.emailControl.value,
      this.passwordControl.value,
      this.firstNameControl.value,
      this.lastNameControl.value,
    );
    this.submitting.set(true);
    this.formError.set(null);
    this.clearServerErrors();
    this.identity.registerAdmin(body).subscribe({
      next: (envelope) => {
        this.submitting.set(false);
        const record = envelope.data ?? null;
        if (record === null) {
          this.failGeneric();
          return;
        }
        this.result.set(record);
        const culture = this.cultures.culture();
        this.notifications.success(
          translateUsersKey(culture, USERS_TRANSLATION_KEYS.createSuccessTitle),
          translateUsersKey(culture, USERS_TRANSLATION_KEYS.createSuccessMessage, {
            email: record.email,
          }),
        );
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.submitting.set(false);
    if (isApiError(error) && error.status === 400 && error.validationErrors !== undefined) {
      const unknown = this.applyServerErrors(error.validationErrors);
      if (unknown.length === 0) {
        return;
      }
    }
    const culture = this.cultures.culture();
    this.formError.set(
      isApiError(error)
        ? resolveApiErrorMessage(error, culture)
        : translateUsersKey(culture, USERS_TRANSLATION_KEYS.createFormErrorTitle),
    );
  }

  private failGeneric(): void {
    this.submitting.set(false);
    this.formError.set(
      translateUsersKey(this.cultures.culture(), USERS_TRANSLATION_KEYS.createFormErrorTitle),
    );
  }

  private applyServerErrors(errors: Record<string, string[]>): string[] {
    const unknown: string[] = [];
    for (const [key, messages] of Object.entries(errors)) {
      const control = this.form.get(toFormErrorPath(key));
      if (control === null) {
        unknown.push(key);
      } else {
        control.setErrors({ ...(control.errors ?? {}), [ADMIN_SERVER_ERROR_KEY]: messages });
        control.markAsTouched();
      }
    }
    return unknown;
  }

  private clearServerErrors(): void {
    for (const path of ['email', 'password', 'firstName', 'lastName']) {
      const control = this.form.get(path);
      if (control !== null && control.errors !== null && ADMIN_SERVER_ERROR_KEY in control.errors) {
        const { [ADMIN_SERVER_ERROR_KEY]: _dropped, ...rest } = control.errors;
        control.setErrors(Object.keys(rest).length === 0 ? null : rest);
      }
    }
  }
}
