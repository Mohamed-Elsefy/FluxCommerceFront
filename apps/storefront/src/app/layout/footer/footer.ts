/**
 * Storefront footer for Sub-Phase 3.6 — Storefront Application Shell.
 *
 * Composition only: brand line, an Explore navigation group reusing
 * `StorefrontNav` (same destinations as the header — only routes that
 * exist), and a copyright line. Additional groups (support, legal, account)
 * arrive with the routes and experiences they would point at.
 *
 * SSR/hydration safe: static markup from constants (the year is the only
 * dynamic value and is stable across server and client renders outside a
 * New-Year boundary). RTL safe: logical properties and direction-aware flex
 * flow only.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Container } from '@flux/ui';
import { StorefrontNav, type StorefrontNavItem } from '../navigation/navigation';

@Component({
  selector: 'storefront-footer',
  imports: [StorefrontNav, Container],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontFooter {
  /** Explore destinations — mirrors the header (only existing routes). */
  readonly exploreNav: readonly StorefrontNavItem[] = [{ label: 'Home', route: '/' }];

  /** Copyright year (render-stable; see class docs). */
  protected readonly year = new Date().getFullYear();
}
