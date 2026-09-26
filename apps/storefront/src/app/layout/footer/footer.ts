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

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Container } from '@flux/ui';
import { CultureService } from '@flux/i18n';
import { StorefrontNav, type StorefrontNavItem } from '../navigation/navigation';
import { EXPLORE_NAV_ITEMS } from '../../storefront-navigation';
import { LAYOUT_TRANSLATION_KEYS, translateLayoutKey } from '../layout-translations';

@Component({
  selector: 'storefront-footer',
  imports: [StorefrontNav, Container],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontFooter {
  private readonly cultures = inject(CultureService);

  /**
   * Explore destinations with localized labels for the active culture
   * (routes stay app-composed; labels resolve through the layout
   * bundle — never hardcoded, never duplicated).
   */
  readonly exploreNav = computed((): readonly StorefrontNavItem[] =>
    EXPLORE_NAV_ITEMS.map((item) => ({
      label: translateLayoutKey(this.cultures.culture(), item.labelKey),
      route: item.route,
    })),
  );

  /** Localized footer chrome for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      exploreHeading: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.exploreHeading),
      exploreLabel: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.navExploreLabel),
      legal: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.legal, {
        year: new Date().getFullYear(),
      }),
    };
  });
}
