/**
 * Admin sidebar navigation for Sub-Phase 12.3 — Admin Navigation & Sidebar.
 *
 * Presentation only: renders destination links from `items` (app-owned —
 * only routes that exist; later entries arrive with their phases, never
 * as dead links). Entries may nest (grouped subsections) and carry a
 * decorative icon glyph rendered through the shared `flux-icon` slot —
 * labels always carry meaning, icons never do. Active styling comes from
 * `routerLinkActive` with `aria-current="page"` (exact match for `/`,
 * prefix otherwise); keyboard behavior comes free from native anchors.
 *
 * State ownership: `drawerOpen` is an input owned by `AppLayout` because
 * the header toggle and the overlay live outside this component. Link
 * activation in drawer mode notifies the parent through `navigated` so it
 * can close the drawer. Role filtering and label localization happen
 * where the destinations are composed (the shell) — never here.
 *
 * No desktop collapse rail: without an icon set, collapsing to an icon
 * rail would leave invisible focus targets (labels hidden, links still
 * tabbable). The persistent sidebar plus the mobile drawer cover the
 * required responsive behaviors.
 *
 * SSR/hydration safe: expanded and closed by default on server and
 * client, no browser APIs. RTL safe: `inset-inline-start` positioning
 * and direction-aware flow; no physical properties.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '@flux/ui';

/** Sidebar entry: a localized label, an optional route, icon, and nesting. */
export interface AdminNavItem {
  /** Visible label (localized by the composing shell). */
  readonly label: string;
  /** Destination route. `undefined` renders a group label for nested sections. */
  readonly route?: string;
  /** Decorative icon glyph (shared `flux-icon` slot). */
  readonly icon?: string;
  /** Nested destinations (rendered as a grouped subsection). */
  readonly children?: readonly AdminNavItem[];
}

@Component({
  selector: 'admin-sidebar',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive, Icon],
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
  /** Accessible landmark name (shell-localized). */
  @Input() label = 'Admin';
  /** Visible brand line (shell-localized). */
  @Input() brand = 'FluxCommerce Admin';
  /** Mobile drawer visibility (owned by the parent shell). */
  @Input() drawerOpen = false;
  /** Emitted when a destination is activated (parent closes the drawer). */
  @Output() readonly navigated = new EventEmitter<void>();
}
