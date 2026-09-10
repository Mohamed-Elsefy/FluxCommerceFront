/**
 * Storefront main navigation for Sub-Phase 3.6 — Storefront Application
 * Shell.
 *
 * Presentation only: renders a link list from `items` (feature/app-owned
 * destinations — today only routes that exist: Home; Catalog/Cart/Checkout
 * entries arrive with their feature phases, never as dead links). Active
 * route styling comes from `routerLinkActive` (exact match for `/`, prefix
 * otherwise) with `aria-current="page"`; keyboard behavior comes free from
 * native anchors. One component serves desktop (horizontal) and mobile
 * (vertical) placement via `orientation` — no device-specific duplicates.
 *
 * SSR/hydration safe: pure markup + CSS, no browser APIs. RTL safe: flex
 * flow follows the document direction; logical properties only.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** Single navigation entry: visible label plus an existing app route. */
export interface StorefrontNavItem {
  readonly label: string;
  readonly route: string;
}

@Component({
  selector: 'storefront-nav',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './navigation.html',
  styleUrl: './navigation.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontNav {
  /** Destinations to render (app-owned; only existing routes). */
  @Input() items: readonly StorefrontNavItem[] = [];
  /** Layout flow: horizontal bar or vertical menu. */
  @Input() orientation: 'horizontal' | 'vertical' = 'horizontal';
  /** Accessible landmark name (unique per placement). */
  @Input() label = 'Main';
}
