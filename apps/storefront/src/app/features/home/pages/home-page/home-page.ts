import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CultureService } from '@flux/i18n';
import { HOME_TRANSLATION_KEYS, translateHomeKey } from '../../i18n/home-translations';

/**
 * Storefront Home page — the primary entry point for product discovery
 * (Sub-Phase 5.2, localized in 5.9) and the cart (Phase 7 entry link).
 *
 * Composition only: brand heading, the discovery entry section linking
 * to the Catalog feature (`/catalog`, where category discovery and
 * navigation live), and the cart entry section linking to the Cart
 * feature (`/cart`). Home owns no catalog or cart data and imports no
 * catalog/cart internals — cross-feature needs go through routes, never
 * through another feature's implementation (`ARCHITECTURE.md` §7).
 * Product discovery UI itself (category list, resource states) is
 * catalog-owned; cart contents and state are cart-owned.
 *
 * Entry copy is localized per the active `CultureService.culture()`
 * through the home-owned bundle (same ownership pattern as the catalog
 * bundle — short entry strings are duplicated, never imported across
 * features). The brand heading stays as-is (proper noun, not UI copy).
 */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  templateUrl: './home-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly cultures = inject(CultureService);

  /** Localized discovery entry copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateHomeKey(culture, HOME_TRANSLATION_KEYS.discoveryTitle),
      subtitle: translateHomeKey(culture, HOME_TRANSLATION_KEYS.discoverySubtitle),
      link: translateHomeKey(culture, HOME_TRANSLATION_KEYS.discoveryLink),
      cartTitle: translateHomeKey(culture, HOME_TRANSLATION_KEYS.cartTitle),
      cartSubtitle: translateHomeKey(culture, HOME_TRANSLATION_KEYS.cartSubtitle),
      cartLink: translateHomeKey(culture, HOME_TRANSLATION_KEYS.cartLink),
    };
  });
}
