/**
 * Customer profile page for Sub-Phases 10.2 (Customer Account &
 * Profile) and 10.8 (Localization, RTL, Responsive & Accessibility).
 *
 * Smart page (route-level composition): drives the feature-scoped
 * `AccountState` (provided by the parent `accountRoutes` entry — never
 * a global store) and projects the settled backend profile into a
 * read-only definition list. No forms, no inputs, no edit actions —
 * the backend exposes no profile-edit endpoint (§10.2 constraint).
 *
 * Data flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * ProfilePage (this file — orchestration only)
 *     ↓ AccountState (state/ — profile resource, session re-sync)
 *     ↓ IdentityApiService (@flux/api — GET /auth/me transport)
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
 * to the error banner once per failure (checkout §8.8 pattern);
 * loading and error states expose the shared primitives' live
 * semantics (`role="status"` / `role="alert"`); the profile renders as
 * a definition list (term/description relationships for free).
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.3/10.4 — no orders content or navigation beyond the shell.
 * - Profile editing (no backend contract supports it).
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
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Title } from '@angular/platform-browser';
import { CultureService, formatDate, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import { toProfileView } from '../../models/account.models';
import { ACCOUNT_TRANSLATION_KEYS, translateAccountKey } from '../../i18n/account-translations';
import { AccountState } from '../../state/account-state';

@Component({
  selector: 'profile-page',
  imports: [LoadingIndicator, ErrorState],
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
}
