/**
 * Admin user details page for Supplement S1, Step S1.5 — Admin Users &
 * Permissions (details + permission slice).
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `UserDetailsState` (route-provided `usersRoutes` entry — never a
 * global store), rendering the `UserAdminResponse` facts, the lockout
 * telemetry, and the granted-permission list with grant/revoke actions.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * UserDetailsPage (this file — orchestration + page-local submissions)
 *     ↓ UserDetailsState (../state — details/permissions/catalog reads)
 *     ↓ IdentityApiService (@flux/api — GET + POST/DELETE permission calls)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Identity API
 * ```
 *
 * Contract fidelity (S2.1 audit): identity, roles, status, lockout
 * telemetry, and permission values render verbatim; the live JWT behind
 * a permission derives from the next login/refresh, never from this UI.
 * The grant/revoke affordances render for `SuperAdmin` and
 * `users.manage` holders only (fully hidden otherwise); delegation
 * denials (`403 Identity.Forbidden` anti-escalation races) surface as
 * error toasts, never retried, never logged out.
 * Grant is additive (duplicate → `409 PermissionAlreadyGranted`,
 * surfaced via error toast, never retried blindly); revoke is
 * idempotent and runs behind the confirm dialog (destructive action).
 * Submissions stay page-local (the 13.10 adjustment pattern):
 * success notifies and reloads details + permissions; failures notify
 * (`resolveApiErrorMessage` — never backend text) with the form state
 * preserved. Duplicate submits lock while a submission is in flight.
 *
 * Resource states: idle → loading → success | error through the shared
 * primitives with localized copy and retry (unknown ids arrive as
 * `404` — the shared error state, never probed). The permissions slot
 * stays independent: its failures render their own error block without
 * hiding settled user facts.
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  CultureService,
  formatDate,
  formatNumber,
  resolveApiErrorMessage,
  translateKey,
} from '@flux/i18n';
import { Card, EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { AuthService } from '@flux/auth';
import { IdentityApiService, isApiError } from '@flux/api';
import type { GrantPermissionRequest } from '@flux/models';
import { AdminDialog } from '../../../../shared/dialog/dialog';
import { AdminNotificationService } from '../../../../shared/notifications/notification-service';
import { AdminSelect, type AdminSelectOption } from '../../../../shared/forms/select/select';
import { UserStatusBadge } from '../../components/user-status-badge/user-status-badge';
import { UserDetailsState } from '../../state/user-details-state';
import { USERS_TRANSLATION_KEYS, translateUsersKey } from '../../i18n/users-translations';

@Component({
  selector: 'app-user-details-page',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AdminDialog,
    AdminSelect,
    Card,
    EmptyState,
    ErrorState,
    LoadingIndicator,
    UserStatusBadge,
  ],
  templateUrl: './user-details-page.html',
  styleUrl: './user-details-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserDetailsPage {
  private readonly details = inject(UserDetailsState);
  private readonly identity = inject(IdentityApiService);
  private readonly auth = inject(AuthService);
  private readonly cultures = inject(CultureService);
  private readonly notifications = inject(AdminNotificationService);
  private readonly formBuilder = inject(FormBuilder);

  /** Route user id (`null` until the first param emission). */
  private readonly userId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))),
    { initialValue: null as string | null },
  );

  /**
   * Whether the grant/revoke affordances render (recorded S2 product
   * decision): visible to `SuperAdmin` and to holders of
   * `users.manage`, fully hidden for everyone else (no disabled
   * state, no placeholder). The granted list itself stays readable
   * for display.
   */
  protected readonly canManagePermissions = computed(
    () => this.auth.isSuperAdmin() || this.auth.hasPermission('users.manage')(),
  );

  /** Current user record (idle → loading → success | error). */
  protected readonly record = this.details.details;

  /** Granted permissions (independent slot — see the state). */
  protected readonly granted = this.details.permissions;

  /** Full permission catalog (grant picker source). */
  protected readonly catalog = this.details.catalog;

  /** Grant picker control (catalog value, empty until chosen). */
  protected readonly grantControl = this.formBuilder.nonNullable.control('');

  /** Grant form group (owns the `ngSubmit` output the template binds). */
  protected readonly grantForm = this.formBuilder.nonNullable.group({
    permission: this.grantControl,
  });

  /** Submission in flight (actions lock, duplicate submits no-op). */
  protected readonly submitting = signal(false);

  /** Permission pending revoke confirmation (`null` = dialog closed). */
  protected readonly pendingRevoke = signal<string | null>(null);

  constructor() {
    // Drives both read slots from the route id (initial value included,
    // changes followed). Runs `untracked` so settled responses never
    // reschedule the effect into an infinite fetch loop — the id is the
    // only dependency.
    effect(() => {
      const id = this.userId();
      untracked(() => {
        if (id !== null) {
          this.details.load(id);
        }
      });
    });
    this.details.loadCatalog();
  }

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      back: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsBack),
      loading: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsLoading),
      errorTitle: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      factsTitle: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsFactsTitle),
      factEmail: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsFactEmail),
      factFirstName: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsFactFirstName),
      factLastName: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsFactLastName),
      factDisplayName: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsFactDisplayName),
      factRoles: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsFactRoles),
      factStatus: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsFactStatus),
      factVerified: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsFactVerified),
      factPhone: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsFactPhone),
      factRegistered: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsFactRegistered),
      factFailedAttempts: translateUsersKey(
        culture,
        USERS_TRANSLATION_KEYS.detailsFactFailedAttempts,
      ),
      factLockoutEnd: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsFactLockoutEnd),
      factLocked: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsFactLocked),
      verifiedYes: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsVerifiedYes),
      verifiedNo: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsVerifiedNo),
      permissionsTitle: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsPermissionsTitle),
      permissionsEmpty: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsPermissionsEmpty),
      permissionsErrorTitle: translateUsersKey(
        culture,
        USERS_TRANSLATION_KEYS.detailsPermissionsErrorTitle,
      ),
      grantTitle: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsGrantTitle),
      grantLabel: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsGrantLabel),
      grantSubmit: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsGrantSubmit),
      dialogTitle: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsDialogTitle),
      dialogConfirm: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsDialogConfirm),
      dialogCancel: translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsDialogCancel),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.record().error, this.cultures.culture()),
  );

  /** Localized permissions failure message (never backend text). */
  protected readonly permissionsErrorMessage = computed(() =>
    resolveApiErrorMessage(this.granted().error, this.cultures.culture()),
  );

  /** Revoke dialog message (permission + email snapshot at open time). */
  protected readonly dialogMessage = computed(() => {
    const permission = this.pendingRevoke();
    const email = this.record().data?.email ?? '';
    if (permission === null) {
      return '';
    }
    return translateUsersKey(this.cultures.culture(), USERS_TRANSLATION_KEYS.detailsDialogMessage, {
      permission,
      email,
    });
  });

  /** Grant picker options: catalog minus already-granted values. */
  protected readonly grantOptions = computed((): readonly AdminSelectOption[] => {
    const catalog = this.catalog().data ?? [];
    const granted = new Set(this.granted().data ?? []);
    return catalog
      .filter((permission) => !granted.has(permission))
      .map((permission) => ({ value: permission, label: permission }));
  });

  /** Grants the picked permission (additive; duplicate → surfaced 409). */
  protected grant(): void {
    const id = this.userId();
    const permission = this.grantControl.value.trim();
    // Options render from the backend catalog itself, so the picked value
    // is a catalog value by construction; the backend re-validates.
    const body = { permission: permission as GrantPermissionRequest['permission'] };
    if (id === null || permission === '' || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.identity.grantPermission(id, body).subscribe({
      next: () => {
        this.submitting.set(false);
        this.grantControl.setValue('');
        this.details.load(id);
        const culture = this.cultures.culture();
        this.notifications.success(
          translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsNotifyGrantTitle),
          translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsNotifyGrantMessage, {
            permission,
            email: this.record().data?.email ?? '',
          }),
        );
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const culture = this.cultures.culture();
        this.notifications.error(
          translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsNotifyErrorTitle),
          isApiError(error)
            ? resolveApiErrorMessage(error, culture)
            : translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsNotifyErrorTitle),
        );
      },
    });
  }

  /** Opens the revoke confirmation dialog for one permission. */
  protected askRevoke(permission: string): void {
    this.pendingRevoke.set(permission);
  }

  /** Closes the revoke dialog without acting. */
  protected cancelRevoke(): void {
    this.pendingRevoke.set(null);
  }

  /**
   * Confirms the revoke: closes the dialog first (duplicate clicks
   * cannot re-enter), then runs the idempotent call. Success notifies
   * and reloads; failures notify with the resolved message.
   */
  protected confirmRevoke(): void {
    const id = this.userId();
    const permission = this.pendingRevoke();
    this.pendingRevoke.set(null);
    if (id === null || permission === null || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.identity.revokePermission(id, permission).subscribe({
      next: () => {
        this.submitting.set(false);
        this.details.load(id);
        const culture = this.cultures.culture();
        this.notifications.success(
          translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsNotifyRevokeTitle),
          translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsNotifyRevokeMessage, {
            permission,
            email: this.record().data?.email ?? '',
          }),
        );
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const culture = this.cultures.culture();
        this.notifications.error(
          translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsNotifyErrorTitle),
          isApiError(error)
            ? resolveApiErrorMessage(error, culture)
            : translateUsersKey(culture, USERS_TRANSLATION_KEYS.detailsNotifyErrorTitle),
        );
      },
    });
  }

  /** Details retry re-enters the current route id. */
  protected retry(): void {
    const id = this.userId();
    if (id !== null) {
      this.details.reload(id);
    }
  }

  /** Revoke button label for one permission (`Revoke {permission}`). */
  protected revokeActionLabel(permission: string): string {
    return translateUsersKey(this.cultures.culture(), USERS_TRANSLATION_KEYS.detailsRevokeLabel, {
      permission,
    });
  }

  /** Culture-formatted lockout end (or the empty marker). */
  protected lockoutEndText(): string {
    const record = this.record().data;
    if (record?.lockoutEndUtc === undefined || record.lockoutEndUtc === null) {
      return '—';
    }
    return formatDate(record.lockoutEndUtc, this.cultures.culture());
  }

  /** Culture-formatted failed-attempt count. */
  protected failedAttemptsText(): string {
    const record = this.record().data;
    if (record === null) {
      return '';
    }
    return formatNumber(record.failedAccessAttemptCount, this.cultures.culture());
  }
}
