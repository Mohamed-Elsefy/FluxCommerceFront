/**
 * Product card component for Sub-Phase 5.3 — Product Listing.
 *
 * Presentation only: renders HOW one storefront search hit looks (primary
 * image, name, link to the future Product Details route). The owning page
 * decides WHEN and WHAT — the product arrives as an input. No API access,
 * no state, no HTTP — presentational components never call the Catalog API
 * (`ARCHITECTURE.md` §8).
 *
 * Contract fidelity (`DTO_REFERENCE.md` §2.4 — `CatalogProductListItem`):
 * the list contract carries NO price, NO availability, and NO status, so
 * the card renders none of them. Inventing price/availability client-side
 * would be contract drift; they arrive when the backend exposes them
 * (Phase 6 details read at the earliest). Image, name, and the details
 * link are the contract-supported card content.
 *
 * The single link wraps image and name (`/catalog/products/<id>`, matching
 * `GET /catalog/products/{id}`) so assistive technology announces one
 * destination; image `alt` honors the backend-provided text and stays
 * empty otherwise because the adjacent name already labels the link.
 * Native `loading="lazy"` defers offscreen images without JavaScript.
 *
 * Explicitly out of scope (Phase 6, must not appear here): variant/SKU
 * selection, quantity pickers, and add-to-cart actions.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ProductListItem } from '../../models/catalog.models';

@Component({
  selector: 'catalog-product-card',
  imports: [RouterLink],
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCard {
  /** Storefront search hit to render (backend `CatalogProductListItem`). */
  @Input({ required: true }) product!: ProductListItem;
}
