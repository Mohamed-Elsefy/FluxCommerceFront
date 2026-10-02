/**
 * Admin users landing page for Supplement S1, Step S1.5 — Admin Users &
 * Permissions.
 *
 * Smart page (route-level composition): reads the feature-scoped
 * `UsersCountsState` (route-provided `usersRoutes` entry — never a
 * global store), rendering the backend-issued counts as fact cards plus
 * the deep link into the users list.
 *
 * Data flow (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * UsersHomePage (this file — orchestration only)
 *     ↓ UsersCountsState (../state — counts slot)
 *     ↓ IdentityApiService (@flux/api — GET /admin/users/counts)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Identity API
 * ```
 *
 * Contract fidelity (S1.1 audit): every bucket echoes verbatim for
 * display (never an input to math). Resource states: idle → loading →
 * success | error through the shared primitives with localized copy and
 * retry. Failures resolve through `resolveApiErrorMessage` (never
 * backend text).
 *
 * SSR/hydration safe: signals plus markup, no browser APIs. RTL safe:
 * logical properties only.
 */

import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CultureService, formatNumber, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { Card, ErrorState, LoadingIndicator } from '@flux/ui';
import { UsersCountsState } from '../../state/users-counts-state';
import { USERS_TRANSLATION_KEYS, translateUsersKey } from '../../i18n/users-translations';

@Component({
  selector: 'app-users-home-page',
  imports: [RouterLink, Card, ErrorState, LoadingIndicator],
  templateUrl: './users-home-page.html',
  styleUrl: './users-home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersHomePage implements OnInit {
  private readonly counts = inject(UsersCountsState);
  private readonly cultures = inject(CultureService);

  /** Current counts snapshot (idle → loading → success | error). */
  protected readonly slot = this.counts.counts;

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      heading: translateUsersKey(culture, USERS_TRANSLATION_KEYS.homeHeading),
      subheading: translateUsersKey(culture, USERS_TRANSLATION_KEYS.homeSubheading),
      countsHeading: translateUsersKey(culture, USERS_TRANSLATION_KEYS.homeCountsHeading),
      viewList: translateUsersKey(culture, USERS_TRANSLATION_KEYS.homeViewList),
      loading: translateUsersKey(culture, USERS_TRANSLATION_KEYS.homeLoading),
      errorTitle: translateUsersKey(culture, USERS_TRANSLATION_KEYS.homeErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      factTotal: translateUsersKey(culture, USERS_TRANSLATION_KEYS.factTotal),
      factPending: translateUsersKey(culture, USERS_TRANSLATION_KEYS.factPending),
      factActive: translateUsersKey(culture, USERS_TRANSLATION_KEYS.factActive),
      factSuspended: translateUsersKey(culture, USERS_TRANSLATION_KEYS.factSuspended),
      factLocked: translateUsersKey(culture, USERS_TRANSLATION_KEYS.factLocked),
      factDeleted: translateUsersKey(culture, USERS_TRANSLATION_KEYS.factDeleted),
      factCustomers: translateUsersKey(culture, USERS_TRANSLATION_KEYS.factCustomers),
      factAdmins: translateUsersKey(culture, USERS_TRANSLATION_KEYS.factAdmins),
      factSuperAdmins: translateUsersKey(culture, USERS_TRANSLATION_KEYS.factSuperAdmins),
      factUnverified: translateUsersKey(culture, USERS_TRANSLATION_KEYS.factUnverified),
      factLockedOut: translateUsersKey(culture, USERS_TRANSLATION_KEYS.factLockedOut),
    };
  });

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.slot().error, this.cultures.culture()),
  );

  /** Culture-formatted count facts (display only — never inputs to math). */
  protected readonly facts = computed(() => {
    const culture = this.cultures.culture();
    const data = this.slot().data;
    if (data === null) {
      return [];
    }
    const copy = this.copy();
    const rows: Array<{ label: string; value: string }> = [
      { label: copy.factTotal, value: formatNumber(data.total, culture) },
      { label: copy.factPending, value: formatNumber(data.pending, culture) },
      { label: copy.factActive, value: formatNumber(data.active, culture) },
      { label: copy.factSuspended, value: formatNumber(data.suspended, culture) },
      { label: copy.factLocked, value: formatNumber(data.locked, culture) },
      { label: copy.factDeleted, value: formatNumber(data.deleted, culture) },
      { label: copy.factCustomers, value: formatNumber(data.customers, culture) },
      { label: copy.factAdmins, value: formatNumber(data.admins, culture) },
      { label: copy.factSuperAdmins, value: formatNumber(data.superAdmins, culture) },
      { label: copy.factUnverified, value: formatNumber(data.unverified, culture) },
      { label: copy.factLockedOut, value: formatNumber(data.lockedOut, culture) },
    ];
    return rows;
  });

  ngOnInit(): void {
    this.counts.load();
  }

  /** Counts retry re-enters a fresh snapshot. */
  protected retry(): void {
    this.counts.reload();
  }
}
