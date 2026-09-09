/**
 * Admin application shell for Sub-Phase 3.7.
 *
 * Composition only — Sidebar, Header, Main outlet:
 *
 * ```text
 * Skip link
 *    ↓
 * AdminSidebar ←→ AdminHeader (toggle) → drawer state lives here
 *    ↓
 * Main → Router Outlet (lazy pages; shell stays eager)
 * ```
 *
 * The mobile drawer state is the only shell state (a local signal, closed
 * on server and client alike): the header toggle opens it, sidebar link
 * activation or the overlay closes it. On desktop viewports the sidebar is
 * persistent and the drawer state is ignored by CSS. Route protection stays
 * in `app.routes.ts` (`authGuard` + `roleGuard`, Phase 2) — never in the
 * shell. No business modules live here.
 *
 * SSR/hydration safe: static composition of SSR-safe children plus
 * closed-drawer markup. RTL safe: grid areas mirror with the document
 * direction; logical properties only.
 */

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AdminHeader } from '../header/header';
import { AdminSidebar, type AdminNavItem } from '../sidebar/sidebar';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, AdminHeader, AdminSidebar],
  templateUrl: './app-layout.html',
  styleUrl: './app-layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLayout {
  /** Sidebar destinations — only routes that exist (business areas arrive with their phases). */
  readonly sidebarNav: readonly AdminNavItem[] = [
    { label: 'Home', route: '/' },
    { label: 'Dashboard', route: '/dashboard' },
  ];

  /** Mobile drawer visibility (local UI state; closed on server and client). */
  readonly drawerOpen = signal(false);

  /** Opens or closes the mobile drawer (header toggle). */
  toggleDrawer(): void {
    this.drawerOpen.update((open) => !open);
  }

  /** Closes the mobile drawer (overlay or sidebar link activation). */
  closeDrawer(): void {
    this.drawerOpen.set(false);
  }
}
