/**
 * Product grid component for Sub-Phase 5.3 — Product Listing.
 *
 * Presentation only: renders HOW a product set lays out (a responsive
 * list of reusable `ProductCard`s). The owning page decides WHEN and WHAT
 * — items arrive as an input; loading/empty/error states stay with the
 * page and the shared `@flux/ui` primitives. No API access, no state, no
 * HTTP. Reused by every listing surface (category listing now; search,
 * filter, and sort surfaces in 5.5–5.6).
 *
 * List semantics (`ul`/`li`) let assistive technology announce the result
 * set; the fluid `auto-fill` grid scales from mobile to desktop without
 * breakpoint overrides or device-specific duplicates.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { ProductStatus } from '@flux/models';
import type { ProductCardItem } from '../../models/catalog.models';
import { ProductCard } from '../product-card/product-card';

@Component({
  selector: 'catalog-product-grid',
  imports: [ProductCard],
  templateUrl: './product-grid.html',
  styleUrl: './product-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductGrid {
  /** Products to render (one reusable card each, backend order kept). */
  @Input({ required: true }) products: readonly ProductCardItem[] = [];

  /**
   * Presentation shape: `grid` (responsive multi-row matrix) or `rail`
   * (single-row horizontal scroll shelf). Pages pick per surface.
   */
  @Input() layout: 'grid' | 'rail' = 'grid';

  /**
   * Localized status labels by backend status (page-localized).
   * Missing entries render no sticker — same as unknown status.
   */
  @Input() statusLabels: Readonly<Partial<Record<ProductStatus, string>>> = {};

  /** Localized sticker label for a status (`null` renders no sticker). */
  protected statusLabelFor(status: ProductStatus | null | undefined): string | null {
    if (status === null || status === undefined) {
      return null;
    }
    return this.statusLabels[status] ?? null;
  }
}
