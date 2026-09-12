/**
 * Product image gallery component for Sub-Phase 6.3 — Product Image
 * Gallery.
 *
 * Presentation only: renders HOW product images look (main image plus a
 * thumbnail selector list). The owning page decides WHEN and WHAT — the
 * image list arrives as an input from feature state. No API access, no
 * HTTP — presentational components never call the Catalog API
 * (`ARCHITECTURE.md` §8).
 *
 * Selection is gallery-local UI state (`ARCHITECTURE.md` §9 — "Selected
 * image" is explicitly local state): an explicit thumbnail choice wins when
 * it still exists, otherwise the backend `isPrimary` image, otherwise the
 * first image (wire order is `displayOrder` server-side). The feature state
 * holds the resource only, never the selection.
 *
 * Fallbacks: an empty list renders the localized missing-image message; a
 * blank or broken URL renders a labelled fallback box instead of a broken
 * `<img>` (tracked per image id through the native `error` event — no
 * polling, no timers).
 *
 * Accessibility: thumbnails are native buttons (Tab/Enter/Space free) with
 * `aria-pressed` selection state and per-image `aria-label`s; the main
 * image honors backend `altText` with product-name and localized fallbacks;
 * thumbnails stay decorative (`alt=""`) because their buttons already
 * label them. Visible `:focus-visible` indicators on every button.
 *
 * SSR/hydration safe: markup derives from inputs and signals only — no
 * `window`/`document`/`localStorage`. RTL safe: logical properties only,
 * wire order preserved, no direction branching.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * variant selection, quantity, and add-to-cart controls.
 */

import { ChangeDetectionStrategy, Component, computed, inject, Input, signal } from '@angular/core';
import { CultureService } from '@flux/i18n';
import type { ProductImage } from '../../models/product-details.models';
import {
  PRODUCT_DETAILS_TRANSLATION_KEYS,
  translateProductDetailsKey,
} from '../../i18n/product-details-translations';

@Component({
  selector: 'product-details-gallery',
  templateUrl: './product-gallery.html',
  styleUrl: './product-gallery.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductGallery {
  /** Images to render (feature-loaded, ordered by `displayOrder` server-side). */
  @Input({ required: true }) images: readonly ProductImage[] = [];

  /** Product name: `alt`-text fallback when the backend provides none. */
  @Input() productName: string | null = null;

  private readonly cultures = inject(CultureService);

  /** Explicit thumbnail choice (`null` = automatic: primary, else first). */
  private readonly manualSelection = signal<string | null>(null);

  /** Image ids whose URL proved blank or broken (fallback rendering). */
  private readonly failedIds = signal<readonly string[]>([]);

  /** Localized gallery chrome for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateProductDetailsKey(culture, PRODUCT_DETAILS_TRANSLATION_KEYS.galleryTitle),
      noImages: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.galleryNoImages,
      ),
    };
  });

  /**
   * Active main image: the manual selection while it still exists, else
   * the backend primary, else the first image. Plain method (not a
   * computed): `@Input`s are not signals, so freshness comes from change
   * detection re-evaluation instead.
   */
  protected activeImage(): ProductImage | null {
    const images = this.images;
    if (images.length === 0) {
      return null;
    }
    return (
      images.find((image) => image.id === this.manualSelection()) ??
      images.find((image) => image.isPrimary) ??
      images[0] ??
      null
    );
  }

  /** Whether `image` is the active main image (thumbnail pressed state). */
  protected isActive(image: ProductImage): boolean {
    return this.activeImage()?.id === image.id;
  }

  /** Selects a thumbnail as the main image. */
  protected select(id: string): void {
    this.manualSelection.set(id);
  }

  /**
   * Accessible image name: backend `altText`, else the product name, else
   * the localized generic label. Never empty for the main image.
   */
  protected imageName(image: ProductImage): string {
    return (
      image.altText ??
      this.productName ??
      translateProductDetailsKey(
        this.cultures.culture(),
        PRODUCT_DETAILS_TRANSLATION_KEYS.galleryImageFallback,
      )
    );
  }

  /** Accessible thumbnail action label (`View image: {name}`). */
  protected thumbnailLabel(image: ProductImage): string {
    return translateProductDetailsKey(
      this.cultures.culture(),
      PRODUCT_DETAILS_TRANSLATION_KEYS.galleryViewImage,
      { name: this.imageName(image) },
    );
  }

  /** Whether `image` has a renderable URL (non-blank and not yet failed). */
  protected hasUsableUrl(image: ProductImage): boolean {
    return image.imageUrl.trim() !== '' && !this.failedIds().includes(image.id);
  }

  /** Marks an image as broken so it renders the fallback (native `error` event). */
  protected onImageError(id: string): void {
    if (!this.failedIds().includes(id)) {
      this.failedIds.set([...this.failedIds(), id]);
    }
  }
}
