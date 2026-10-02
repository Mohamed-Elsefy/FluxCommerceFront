/**
 * Customer profile page for Sub-Phases 10.2 (Customer Account &
 * Profile) and 10.8 (Localization, RTL, Responsive & Accessibility) —
 * plus Supplement S1, Step S1.4 (Profile Editing).
 *
 * Smart page (route-level composition): drives the feature-scoped
 * `AccountState` (provided by the parent `accountRoutes` entry — never
 * a global store), projects the settled backend profile into a
 * read-only definition list, and hosts the edit toggle + `ProfileForm`
 * for `PUT /auth/profile` submissions.
 *
 * Data flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * ProfilePage (this file — orchestration only)
 *     ↓ AccountState (state/ — profile resource + save slot, session re-sync)
 *     ↓ IdentityApiService (@flux/api — GET /auth/me + PUT /auth/profile)
 *     ↓ AuthService (@flux/auth — session re-sync target)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Identity API
 * ```
 *
 * Page contract:
 * - First render triggers `loadProfile()` from `ngOnInit` (client
 *   navigations, tests) and — only when nothing was ever attempted
 *   (`idle`) — from browser-only `afterNextRender` (post-hydration
 *   entry, where `ngOnInit` ran on the server). Settled error states
 *   never auto-reload; recovery is the explicit retry action.
 * - Untouched (`idle`) renders as loading — server and client start
 *   idle, so SSR and hydration emit identical markup.
 * - Errors render through `flux-error-state` with status-first copy
 *   (`resolveApiErrorMessage` — never backend text) and a retry action
 *   (`AccountState.retry()`); mid-session expiry (`401`) surfaces here
 *   while the interceptor pipeline owns refresh.
 * - The loaded profile renders backend data verbatim (dates via
 *   `formatDate` for the active culture — display only).
 * - Editing: the `Edit profile` toggle mounts `ProfileForm` prefilled
 *   from the settled profile. Submit projects the draft through
 *   `toUpdateProfileRequest` into `AccountState.saveProfile` (duplicate
 *   submits lock while saving). Success refreshes the definition list
 *   from the PUT response (no extra `GET`) and shows the notice;
 *   `400` field maps project onto the form, other failures render the
 *   save banner. Cancel clears the save slot and hides the form.
 *
 * Copy is localized per the active `CultureService.culture()` through
 * the feature-owned account bundle; retry through
 * `common.actions.retry`. Document title follows the localized page
 * title (customer area — no SEO metadata beyond the title).
 *
 * SSR-safe: signals, `Title`, and router templating only — the initial
 * load trigger is browser-guarded via `afterNextRender`. RTL safe:
 * logical properties only, no direction branching.
 *
 * Accessibility (§10.8): labelled section heading with entry focus
 * (browser-only, so route changes announce); load failures move focus
 * to the error banner once per failure (checkout §8.8 pattern); edit
 * open/save/cancel move focus to the first field, the heading, or the
 * edit toggle; loading and error states expose the shared primitives'
 * live semantics (`role="status"` / `role="alert"`); the profile renders
 * as a definition list (term/description relationships for free); field
 * errors expose `role="alert"` with `aria-invalid` inputs.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.3/10.4 — no orders content or navigation beyond the shell.
 */

import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnInit,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { CultureService, formatDate, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import {
  profileDraftOf,
  toUpdateProfileRequest,
  type ProfileDraft,
} from '../../models/profile-edit.models';
import { toProfileView } from '../../models/account.models';
import { ACCOUNT_TRANSLATION_KEYS, translateAccountKey } from '../../i18n/account-translations';
import { ProfileForm, type ProfileFormCopy } from '../../components/profile-form/profile-form';
import { AccountState } from '../../state/account-state';

/** Pending focus target consumed once by the after-render effect. */
type ProfileFocusTarget = 'heading' | 'first-field' | 'save-error' | 'edit-button' | null;

@Component({
  selector: 'profile-page',
  imports: [LoadingIndicator, ErrorState, ProfileForm],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage implements OnInit {
  private readonly state = inject(AccountState);
  private readonly cultures = inject(CultureService);
  private readonly title = inject(Title);
  private readonly host = inject(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Failures already moved to the error banner (once-per-failure focus
   * record — plain field, never rendered).
   */
  private focusedError: unknown = null;

  /** Save failures already moved to the save banner (same discipline). */
  private focusedSaveError: unknown = null;

  /** Whether the edit form is mounted. */
  readonly editing = signal(false);

  /** Focus target consumed once by the after-render effect. */
  private readonly pendingFocus = signal<ProfileFocusTarget>(null);

  constructor() {
    // Post-hydration entry: `ngOnInit` ran on the server there, so the
    // client state is still untouched (`idle`) and the browser schedules
    // its own trigger. Fires only from `idle` — settled outcomes
    // (success AND error) stay stable, so error UI never auto-reloads
    // behind the user's back. Never fires on the server —
    // SSR/hydration safe.
    afterNextRender(() => {
      if (this.state.status() === 'idle') {
        this.state.loadProfile();
      }
      // Entry focus skips settled failures so the error banner (focused
      // by the after-render effect below) wins deterministically.
      if (!this.showError()) {
        this.focusHeading();
      }
    });
    effect(() => {
      this.title.setTitle(this.copy().title);
    });
    // Load-failure focus management (§10.8 — the checkout §8.8
    // pattern): once per failure, move focus to the error banner so
    // keyboard and screen-reader users land on the recovery action. An
    // after-render effect (not a plain effect): the banner must exist
    // in the DOM before focusing. Browser-only; no-op for repeats.
    afterRenderEffect(() => {
      const failed = this.showError();
      const error = this.state.error();
      untracked(() => {
        if (failed) {
          this.focusError(error);
        }
      });
    });
    // Save-failure focus management (same discipline as load failures):
    // once per failure, move focus to the save banner.
    afterRenderEffect(() => {
      const failed = this.showSaveError();
      const error = this.state.saveError();
      untracked(() => {
        if (failed) {
          this.focusSaveError(error);
        }
      });
    });
    // Pending-focus pump: edit open/save/cancel request focus, the
    // after-render effect lands it once the target exists in the DOM.
    afterRenderEffect(() => {
      const target = this.pendingFocus();
      untracked(() => {
        if (target !== null) {
          this.pendingFocus.set(null);
          this.focusTarget(target);
        }
      });
    });
    // Save success: hide the form (the notice drives from state) and
    // return focus to the heading.
    effect(() => {
      if (this.state.isSaveSuccess()) {
        untracked(() => {
          this.editing.set(false);
          this.pendingFocus.set('heading');
        });
      }
    });
  }

  ngOnInit(): void {
    this.state.loadProfile();
  }

  /** Localized page copy for the active culture. */
  readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileTitle),
      loading: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileLoading),
      loadErrorTitle: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileLoadErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      fieldName: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileFieldName),
      fieldEmail: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileFieldEmail),
      fieldEmailVerified: translateAccountKey(
        culture,
        ACCOUNT_TRANSLATION_KEYS.profileFieldEmailVerified,
      ),
      fieldPhone: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileFieldPhone),
      fieldRoles: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileFieldRoles),
      fieldLanguage: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileFieldLanguage),
      fieldTimezone: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileFieldTimezone),
      fieldMemberSince: translateAccountKey(
        culture,
        ACCOUNT_TRANSLATION_KEYS.profileFieldMemberSince,
      ),
      verifiedYes: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileVerifiedYes),
      verifiedNo: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileVerifiedNo),
      notProvided: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileNotProvided),
      editTitle: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileEditTitle),
      saveSuccess: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileEditSaveSuccess),
      saveErrorTitle: translateAccountKey(
        culture,
        ACCOUNT_TRANSLATION_KEYS.profileEditSaveErrorTitle,
      ),
    };
  });

  /** Localized profile-form copy (labels, hints, actions). */
  readonly formCopy = computed<ProfileFormCopy | null>(() => {
    const culture = this.cultures.culture();
    return {
      firstName: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileFieldName),
      lastName: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileFieldName),
      phoneNumber: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileFieldPhone),
      avatarUrl: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileFieldAvatar),
      preferredLanguage: translateAccountKey(
        culture,
        ACCOUNT_TRANSLATION_KEYS.profileFieldLanguage,
      ),
      timeZone: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileFieldTimezone),
      languageHint: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileEditLanguageHint, {
        culture,
      }),
      timezoneHint: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileEditTimezoneHint),
      save: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileEditSave),
      saving: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileEditSaving),
      cancel: translateAccountKey(culture, ACCOUNT_TRANSLATION_KEYS.profileEditCancel),
    };
  });

  /** Read-only profile view, or `null` until the backend profile settles. */
  readonly view = computed(() => {
    const profile = this.state.profile();
    return profile === null ? null : toProfileView(profile);
  });

  /** Loading shell covers both untouched (`idle`) and in-flight states. */
  readonly showLoading = computed(() => {
    const status = this.state.status();
    return status === 'idle' || status === 'loading';
  });

  /** Whether the last profile load failed. */
  readonly showError = computed(() => this.state.status() === 'error');

  /** Localized failure message (status-first, never backend text). */
  readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.state.error(), this.cultures.culture()),
  );

  /** Localized save failure message (status-first, never backend text). */
  readonly saveErrorMessage = computed(() =>
    resolveApiErrorMessage(this.state.saveError(), this.cultures.culture()),
  );

  /** Backend field-error map for the form (`errors{}` keyed by C# names). */
  readonly serverErrors = computed(() => this.state.saveError()?.validationErrors ?? null);

  /** Whether the update request is in flight (disables form actions). */
  readonly isSaving = computed(() => this.state.isSaving());

  /** Whether the last save failed (drives the save banner). */
  readonly showSaveError = computed(() => this.state.saveStatus() === 'error');

  /** Whether the save notice shows (settled success with the form hidden). */
  readonly showSaveSuccess = computed(() => this.state.isSaveSuccess() && !this.editing());

  /** Editable draft prefilled from the settled profile. */
  readonly draft = computed((): ProfileDraft | null => {
    const profile = this.state.profile();
    return profile === null ? null : profileDraftOf(profile);
  });

  /** Display roles (verbatim backend claims) or the not-provided note. */
  readonly rolesText = computed(() => {
    const roles = this.view()?.roles ?? [];
    return roles.length > 0 ? roles.join(', ') : this.copy().notProvided;
  });

  /** Display phone or the not-provided note. */
  readonly phoneText = computed(() => this.view()?.phone ?? this.copy().notProvided);

  /** Culture-formatted registration date or the not-provided note. */
  readonly memberSinceText = computed(() => {
    const formatted = formatDate(this.view()?.registeredAtUtc ?? '', this.cultures.culture());
    return formatted !== '' ? formatted : this.copy().notProvided;
  });

  /** Retries the failed profile load (forced fresh request). */
  onRetry(): void {
    this.state.retry();
  }

  /**
   * Opens the edit form (clears any previous save outcome so a reopened
   * form never shows a stale notice or banner) and moves focus to the
   * first field once mounted.
   */
  onEdit(): void {
    this.state.resetSave();
    this.editing.set(true);
    this.pendingFocus.set('first-field');
  }

  /**
   * Submits the validated draft. The form blocks invalid drafts; the
   * state locks duplicate submits while saving.
   */
  onSaveDraft(draft: ProfileDraft): void {
    this.state.saveProfile(toUpdateProfileRequest(draft));
  }

  /**
   * Cancels editing: clears the save slot, hides the form, and returns
   * focus to the edit toggle.
   */
  onCancelEdit(): void {
    this.state.resetSave();
    this.editing.set(false);
    this.pendingFocus.set('edit-button');
  }

  /**
   * Moves keyboard/screen-reader focus to the page heading on entry so
   * route changes announce. Browser-only (SSR never focuses). Targets
   * the heading id (the page heading is an h2 under the shell h1).
   */
  private focusHeading(): void {
    if (!this.isBrowser) {
      return;
    }
    const target = this.host.nativeElement.querySelector('#profile-page-title');
    if (target instanceof HTMLElement) {
      target.focus();
    }
  }

  /**
   * Moves focus to the load-error banner for a new failure. Records the
   * failure only once focus actually moves: a missing banner leaves the
   * error unrecorded so a later render retries. Browser-only (SSR never
   * focuses); no-op for repeats. Plain field (never rendered).
   */
  private focusError(error: unknown): void {
    if (!this.isBrowser || error === null || error === this.focusedError) {
      return;
    }
    const target = this.host.nativeElement.querySelector('[data-error-focus]');
    if (target instanceof HTMLElement) {
      this.focusedError = error;
      target.focus();
    }
  }

  /**
   * Moves focus to the save-error banner for a new save failure (same
   * once-per-failure discipline as load errors).
   */
  private focusSaveError(error: unknown): void {
    if (!this.isBrowser || error === null || error === this.focusedSaveError) {
      return;
    }
    const target = this.host.nativeElement.querySelector('[data-save-error-focus]');
    if (target instanceof HTMLElement) {
      this.focusedSaveError = error;
      target.focus();
    }
  }

  /**
   * Lands a requested focus target (edit open → first field; save →
   * heading; cancel → edit toggle). Missing targets resolve silently —
   * focus is enhancement, never load-bearing.
   */
  private focusTarget(target: Exclude<ProfileFocusTarget, null>): void {
    if (!this.isBrowser) {
      return;
    }
    const selector =
      target === 'first-field'
        ? '#profile-first-name'
        : target === 'save-error'
          ? '[data-save-error-focus]'
          : target === 'edit-button'
            ? '#profile-edit-button'
            : '#profile-page-title';
    const node = this.host.nativeElement.querySelector(selector);
    if (node instanceof HTMLElement) {
      node.focus();
    }
  }
}
