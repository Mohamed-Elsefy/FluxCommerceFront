/**
 * Admin dashboard page for Sub-Phase 12.4 — Dashboard Foundation.
 *
 * Page structure only: a localized page header, a live session card
 * (signed-in administrator facts read from the shared `AuthService` —
 * no API call, no invented data), and a responsive grid of
 * upcoming-module cards (Catalog, Inventory, Orders, Payments) rendered
 * as non-interactive placeholders with an "upcoming" badge — no links,
 * so no dead functionality ships.
 *
 * Explicitly out of scope (later phases, must not appear here): module
 * metrics, analytics, and any data-backed card. There is no dashboard
 * API contract, so nothing here performs HTTP: the page composes sync
 * signals plus static metadata only. Loading/empty/error resource states
 * arrive with the first data-backed card (Phases 13–14) through the
 * existing shared async UI — no theater states in the meantime.
 *
 * SSR/hydration safe: signals plus static metadata, no browser APIs.
 * RTL safe: grid auto-flow follows the document direction; logical
 * properties only.
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AuthService } from '@flux/auth';
import { CultureService } from '@flux/i18n';
import { Card } from '@flux/ui';
import { DashboardCard } from './components/dashboard-card/dashboard-card';
import { DASHBOARD_TRANSLATION_KEYS, translateDashboardKey } from './i18n/dashboard-translations';

interface UpcomingModule {
  readonly titleKey: string;
  readonly descriptionKey: string;
}

/** Upcoming modules in portal order (placeholders until Phases 13–14). */
const UPCOMING_MODULES: readonly UpcomingModule[] = [
  {
    titleKey: DASHBOARD_TRANSLATION_KEYS.catalogTitle,
    descriptionKey: DASHBOARD_TRANSLATION_KEYS.catalogDescription,
  },
  {
    titleKey: DASHBOARD_TRANSLATION_KEYS.inventoryTitle,
    descriptionKey: DASHBOARD_TRANSLATION_KEYS.inventoryDescription,
  },
  {
    titleKey: DASHBOARD_TRANSLATION_KEYS.ordersTitle,
    descriptionKey: DASHBOARD_TRANSLATION_KEYS.ordersDescription,
  },
  {
    titleKey: DASHBOARD_TRANSLATION_KEYS.paymentsTitle,
    descriptionKey: DASHBOARD_TRANSLATION_KEYS.paymentsDescription,
  },
];

@Component({
  selector: 'app-dashboard-page',
  imports: [Card, DashboardCard],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly auth = inject(AuthService);
  private readonly cultures = inject(CultureService);

  /** Signed-in administrator facts (route guards guarantee a session). */
  protected readonly session = computed(() => {
    const user = this.auth.currentUser();
    if (user === null) {
      return null;
    }
    return {
      displayName: user.displayName ?? user.email,
      email: user.email,
      roles: user.roles.join(', '),
    };
  });

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const modules = UPCOMING_MODULES.map((module) => ({
      title: translateDashboardKey(culture, module.titleKey),
      description: translateDashboardKey(culture, module.descriptionKey),
    }));
    return {
      title: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.title),
      subtitle: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.subtitle),
      sessionHeading: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.sessionHeading),
      sessionName: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.sessionName),
      sessionEmail: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.sessionEmail),
      sessionRoles: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.sessionRoles),
      modulesHeading: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.modulesHeading),
      upcoming: translateDashboardKey(culture, DASHBOARD_TRANSLATION_KEYS.upcomingBadge),
      modules,
    };
  });
}
