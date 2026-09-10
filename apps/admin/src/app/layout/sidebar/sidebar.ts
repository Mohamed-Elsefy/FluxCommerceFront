/**
 * Admin sidebar navigation for Sub-Phase 3.7 — Admin Application Shell.
 *
 * Presentation only: renders destination links from `items` (app-owned —
 * today only routes that exist: Home, Dashboard; catalog/orders/inventory
 * entries arrive with their admin phases, never as dead links), active
 * route styling, a desktop collapse rail, and a mobile drawer mode driven
 * by the parent shell.
 *
 * State ownership: `drawerOpen` is an input owned by `AppLayout` because the
 * header toggle and the overlay live outside this component. Link activation
 * in drawer mode notifies the parent through `navigated` so it can close
 * the drawer. Active styling comes from `routerLinkActive` with
 * `aria-current="page"`; keyboard behavior comes free from native anchors.
 *
 * No desktop collapse rail: without a Phase 3 icon set, collapsing to an
 * icon rail would leave invisible focus targets (labels hidden, links still
 * tabbable). The persistent sidebar plus the mobile drawer cover the
 * required responsive behaviors ("expanded/collapsed ... where required").
 *
 * SSR/hydration safe: expanded and closed by default on server and client,
 * no browser APIs. RTL safe: `inset-inline-start` positioning and
 * direction-aware flow; no physical properties.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Single sidebar entry: visible label plus an existing admin route. */
export interface AdminNavItem {
  readonly label: string;
  readonly route: string;
}

@Component({
  selector: 'admin-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.data-drawer]': `drawerOpen ? 'open' : 'closed'`,
  },
})
export class AdminSidebar {
  /** Destinations to render (app-owned; only existing routes). */
  @Input() items: readonly AdminNavItem[] = [];
  /** Mobile drawer visibility (owned by the parent shell). */
  @Input() drawerOpen = false;
  /** Emitted when a destination is activated (parent closes the drawer). */
  @Output() readonly navigated = new EventEmitter<void>();
}
