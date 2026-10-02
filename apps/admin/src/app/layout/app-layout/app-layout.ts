/**
 * Admin application shell for Sub-Phases 3.7 + 12.3.
 *
 * Composition only — Sidebar, Header, Main outlet, Notification host:
 *
 * ```text
 * Skip link
 *    ↓
 * AdminSidebar ←→ AdminHeader (toggle) → drawer state lives here
 *    ↓
 * Main → Router Outlet (lazy pages; shell stays eager)
 *    ↓
 * Notification host (portal-wide toasts/alerts, 12.7)
 * ```
 *
 * The mobile drawer state is the only shell state (a local signal, closed
 * on server and client alike): the header toggle opens it, sidebar link
 * activation or the overlay closes it. On desktop viewports the sidebar is
 * persistent and the drawer state is ignored by CSS. Route protection stays
 * in `app.routes.ts` (`authGuard` + `roleGuard`) — never in the shell.
 *
 * Navigation composition (12.3, permission-filtered in Supplement S1):
 * destinations come from the app-owned `ADMIN_NAV_ITEMS` table (routes
 * plus label keys — never hardcoded copy), filtered per session by the
 * shell-scoped `AdminNavState` and localized through the admin layout
 * bundle for the active culture. The sidebar stays a dumb renderer and
 * the shell stays free of auth symbols (rule 3.7) — session reads live
 * one layer up, in app-owned composition code. No business modules here.
 *
 * SSR/hydration safe: static composition of SSR-safe children plus
 * closed-drawer markup. RTL safe: grid areas mirror with the document
 * direction; logical properties only.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CultureService } from '@flux/i18n';
import { AdminNavState } from '../../admin-nav-state';
import type { AdminDestination } from '../../admin-navigation';
import {
  ADMIN_LAYOUT_TRANSLATION_KEYS,
  translateAdminLayoutKey,
} from '../layout-translations/layout-translations';
import { AdminHeader } from '../header/header';
import { AdminSidebar, type AdminNavItem } from '../sidebar/sidebar';
import { AdminNotificationHost } from '../../shared/notifications/notification-host/notification-host';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, AdminHeader, AdminSidebar, AdminNotificationHost],
  providers: [AdminNavState],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayout {
  private readonly cultures = inject(CultureService);
  private readonly navState = inject(AdminNavState);

  /**
   * Sidebar destinations — permission-filtered for the current session by
   * the shell-scoped `AdminNavState`, then localized for the active
   * culture (routes stay app-composed; labels resolve through the layout
   * bundle — never hardcoded, never duplicated). `SuperAdmin` bypasses
   * every permission gate, so it always sees the full menu; everyone else
   * sees only what the last `GET /auth/me` granted.
   */
  readonly sidebarNav = computed((): readonly AdminNavItem[] => {
    const culture = this.cultures.culture();
    const destinations = this.navState.destinations();
    const localize = (item: AdminDestination): AdminNavItem => ({
      label: translateAdminLayoutKey(culture, item.labelKey),
      route: item.route,
      icon: item.icon,
      children: item.children?.map(localize),
    });
    return destinations.map(localize);
  });

  /** Localized sidebar landmark name for the active culture. */
  readonly sidebarLabel = computed(() =>
    translateAdminLayoutKey(this.cultures.culture(), ADMIN_LAYOUT_TRANSLATION_KEYS.navSidebarLabel),
  );

  /** Localized brand line for the active culture. */
  readonly brandLabel = computed(() =>
    translateAdminLayoutKey(this.cultures.culture(), ADMIN_LAYOUT_TRANSLATION_KEYS.brandLabel),
  );

  /** Localized skip-link copy for the active culture. */
  readonly skipLink = computed(() =>
    translateAdminLayoutKey(this.cultures.culture(), ADMIN_LAYOUT_TRANSLATION_KEYS.skipLink),
  );

  /** Localized drawer-overlay label for the active culture. */
  readonly overlayLabel = computed(() =>
    translateAdminLayoutKey(
      this.cultures.culture(),
      ADMIN_LAYOUT_TRANSLATION_KEYS.drawerCloseOverlay,
    ),
  );

  /** Localized notification-host copy for the active culture. */
  readonly notificationsLabel = computed(() =>
    translateAdminLayoutKey(
      this.cultures.culture(),
      ADMIN_LAYOUT_TRANSLATION_KEYS.notificationsLabel,
    ),
  );

  /** Localized notification dismiss action for the active culture. */
  readonly notificationsDismiss = computed(() =>
    translateAdminLayoutKey(
      this.cultures.culture(),
      ADMIN_LAYOUT_TRANSLATION_KEYS.notificationsDismiss,
    ),
  );

  /** Mobile drawer visibility (local UI state; closed on server and client). */
  readonly drawerOpen = signal(false);

  private readonly header = viewChild(AdminHeader);

  /** Opens or closes the mobile drawer (header toggle). */
  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  /** Closes the mobile drawer (overlay or sidebar link activation). */
  closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  /** Dismisses the mobile drawer from anywhere, returning focus to the toggle. */
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.drawerOpen()) {
      this.closeDrawer();
      this.header()?.focusToggle();
    }
  }
}
