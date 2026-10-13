import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { CultureService } from '@flux/i18n';
import { Card, Icon } from '@flux/ui';
import { FALLBACK_SOCIAL_IMAGE, setCanonicalUrl } from '@flux/utils';
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
 *
 * SEO (11.3): the only SEO-sensitive metadata owned here is the home
 * title, description, social tags, and canonical (`/`). `Title`/`Meta`
 * apply in `ngOnInit` (server + client) and refresh in an effect on
 * culture changes; the description reuses the discovery subtitle so no
 * new translation keys are needed. Authenticated/private pages stay
 * outside this strategy by design.
 */
@Component({
  selector: 'app-home-page',
  imports: [RouterLink, Card, Icon],
  templateUrl: './home-page.html',
  styleUrl: './home-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage implements OnInit {
  private readonly cultures = inject(CultureService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);

  /** Localized discovery entry copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const t = (k: string): string => translateHomeKey(culture, k);
    const k = HOME_TRANSLATION_KEYS;
    return {
      heroTitle: t(k.heroTitle),
      heroSubtitle: t(k.heroSubtitle),
      heroPrimary: t(k.heroPrimary),
      heroImageAlt: t(k.heroImageAlt),
      heroNote: t(k.heroNote),
      perksTitle: t(k.perksTitle),
      perksIndex: t(k.perksIndex),
      perksFastTitle: t(k.perksFastTitle),
      perksFastText: t(k.perksFastText),
      perksSecureTitle: t(k.perksSecureTitle),
      perksSecureText: t(k.perksSecureText),
      perksReturnTitle: t(k.perksReturnTitle),
      perksReturnText: t(k.perksReturnText),
      perksLangTitle: t(k.perksLangTitle),
      perksLangText: t(k.perksLangText),
      ctaIndex: t(k.ctaIndex),
      ctaTitle: t(k.ctaTitle),
      ctaShopTitle: t(k.ctaShopTitle),
      ctaShopText: t(k.ctaShopText),
      ctaShopLink: t(k.ctaShopLink),
      ctaTrackTitle: t(k.ctaTrackTitle),
      ctaTrackText: t(k.ctaTrackText),
      ctaTrackLink: t(k.ctaTrackLink),
      ctaAccountTitle: t(k.ctaAccountTitle),
      ctaAccountText: t(k.ctaAccountText),
      ctaAccountLink: t(k.ctaAccountLink),
    };
  });

  constructor() {
    // Dynamic metadata (11.3): tracks the culture; `Title`/`Meta` write
    // the document only (no signals touched inside, so no dependency
    // besides the tracked reads above). Effects never run on the server —
    // `ngOnInit` covers the SSR pass.
    effect(() => {
      this.applyMetadata();
    });
  }

  ngOnInit(): void {
    // Runs on server and client alike: metadata applies during SSR (an
    // SSR-safe write into the prerendered `<head>`).
    this.applyMetadata();
  }

  /**
   * Applies home metadata (11.3 title/description strategy): the document
   * title follows the `{label} | FluxCommerce` workspace convention, the
   * description reuses the localized hero subtitle, and the canonical
   * is the home path. `Title`/`Meta` update tags in place, and
   * `setCanonicalUrl` keeps a single canonical tag, so re-runs never
   * duplicate metadata.
   *
   * Social (11.4): `og:url` mirrors the canonical; `og:image` is the
   * bundled fallback (the home surface has no single product image);
   * `twitter:card` mirrors the OpenGraph tags for X previews.
   */
  private applyMetadata(): void {
    const copy = this.copy();
    const title = `${copy.heroTitle} | FluxCommerce`;
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: copy.heroSubtitle });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: copy.heroSubtitle });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: '/' });
    this.meta.updateTag({ property: 'og:image', content: FALLBACK_SOCIAL_IMAGE });
    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: copy.heroSubtitle });
    setCanonicalUrl(this.document, '/');
  }
}
