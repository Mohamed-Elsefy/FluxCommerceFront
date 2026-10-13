/**
 * Similar-products rail component — same-category Pod cards plus the
 * "show more" entry into the filtered shelf.
 *
 * Presentation only: renders HOW similar products look (image, name, link
 * to the details route, shelf link carrying the `categoryId` filter). The
 * owning page decides WHEN and WHAT — items, the active category, and the
 * localized copy arrive as inputs. No API access, no state, no HTTP.
 *
 * Contract fidelity: only backend-provided fields render (image, name —
 * prices live on variants and are not listed, availability is unreadable).
 * Nothing is fabricated.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 */

import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { SimilarProduct } from '../../models/product-details.models';

@Component({
  selector: 'product-details-similar-products',
  imports: [RouterLink],
  templateUrl: './similar-products.html',
  styleUrl: './similar-products.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimilarProducts {
  /** Similar products to render (current product already dropped by state). */
  @Input({ required: true }) products: readonly SimilarProduct[] = [];

  /** Active category id carried into the shelf link filter. */
  @Input({ required: true }) categoryId!: string;

  /** Accessible section label for the rail (page-localized, required). */
  @Input({ required: true }) label!: string;

  /** "Show more" link text (page-localized, required). */
  @Input({ required: true }) linkLabel!: string;

  /** Image ids whose URL proved broken (fallback rendering). */
  protected readonly failedIds = signal<readonly string[]>([]);

  /** Swaps a broken image to the reserved-space fallback box. */
  protected onImageError(id: string): void {
    if (!this.failedIds().includes(id)) {
      this.failedIds.set([...this.failedIds(), id]);
    }
  }

  /** Whether `product` has a renderable primary image. */
  protected hasImage(product: SimilarProduct): boolean {
    const url = product.primaryImage?.imageUrl ?? '';
    return url.trim() !== '' && !this.failedIds().includes(product.id);
  }
}
