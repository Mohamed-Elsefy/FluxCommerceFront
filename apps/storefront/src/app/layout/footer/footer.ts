/**
 * Storefront footer — Kinetic glass panel (DESIGN §6.11).
 *
 * Composition only: lowercase wordmark + tagline, Shop group (purchase
 * path), Account group (authenticated area + login entry), and a reserved
 * personal-info group (placeholder copy until real data is provided —
 * never a dead link). Legal line closes the panel.
 *
 * SSR/hydration safe: static markup from constants (the year is the only
 * dynamic value). RTL safe: logical properties and direction-aware flex.
 */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Container } from '@flux/ui';
import { CultureService } from '@flux/i18n';
import { StorefrontNav, type StorefrontNavItem } from '../navigation/navigation';
import { ACCOUNT_NAV_ITEMS, EXPLORE_NAV_ITEMS, SHOP_NAV_ITEMS } from '../../storefront-navigation';
import {
  LAYOUT_TRANSLATION_KEYS,
  translateLayoutKey,
} from '../layout-translations/layout-translations';

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

  /** Shop destinations (purchase path). */
  readonly shopNav = computed((): readonly StorefrontNavItem[] =>
    SHOP_NAV_ITEMS.map((item) => ({
      label: translateLayoutKey(this.cultures.culture(), item.labelKey),
      route: item.route,
    })),
  );

  /** Account destinations (authenticated area + login entry). */
  readonly accountNav = computed((): readonly StorefrontNavItem[] =>
    ACCOUNT_NAV_ITEMS.map((item) => ({
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
      shopHeading: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.shopHeading),
      accountHeading: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.accountHeading),
      personalHeading: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.personalHeading),
      personalPlaceholder: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.personalPlaceholder),
      tagline: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.tagline),
      description: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.description),
      legal: translateLayoutKey(culture, LAYOUT_TRANSLATION_KEYS.legal, {
        year: new Date().getFullYear(),
      }),
    };
  });
}
