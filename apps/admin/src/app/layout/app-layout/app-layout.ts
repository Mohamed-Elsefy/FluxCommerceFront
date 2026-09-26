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
 * Navigation composition (12.3): destinations come from the app-owned
 * `ADMIN_NAV_ITEMS` table (routes plus label keys — never hardcoded copy),
 * localized through the admin layout bundle for the active culture. The
 * sidebar stays a dumb renderer; role-aware filtering (`visibleDestinations`
 * over the destinations' optional role allow-lists) is a tested capability
 * that gets wired here the moment a role-differentiated destination exists —
 * today every portal destination admits every portal role, and the shell
 * itself stays free of authentication state (it only reads culture).
 * No business modules live here.
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
import { ADMIN_NAV_ITEMS, type AdminDestination } from '../../admin-navigation';
import { ADMIN_LAYOUT_TRANSLATION_KEYS, translateAdminLayoutKey } from '../layout-translations';
import { AdminHeader } from '../header/header';
import { AdminSidebar, type AdminNavItem } from '../sidebar/sidebar';
import { AdminNotificationHost } from '../../shared/notifications/notification-host/notification-host';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, AdminHeader, AdminSidebar, AdminNotificationHost],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayout {
  private readonly cultures = inject(CultureService);

  /**
   * Sidebar destinations — localized for the active culture (routes stay
   * app-composed; labels resolve through the layout bundle — never
   * hardcoded, never duplicated).
   */
  readonly sidebarNav = computed((): readonly AdminNavItem[] => {
    const culture = this.cultures.culture();
    const localize = (item: AdminDestination): AdminNavItem => ({
      label: translateAdminLayoutKey(culture, item.labelKey),
      route: item.route,
      icon: item.icon,
      children: item.children?.map(localize),
    });
    return ADMIN_NAV_ITEMS.map(localize);
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
