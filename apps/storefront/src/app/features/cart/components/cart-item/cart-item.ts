/**
 * Cart line item component for Sub-Phase 7.4 — Cart Page & UI.
 *
 * Presentation only: renders HOW one cart line looks (product
 * thumbnail resolved from the product read model with placeholder
 * fallback, linked product name, SKU and backend-provided unit price
 * rows, quantity control, remove action). The owning page decides WHEN
 * and WHAT — the line arrives as a preformatted view model
 * (`CartItemView`: backend line plus page-localized, culture-formatted
 * strings plus the resolved thumbnail), and user intent leaves through
 * `quantityChange`/`remove`. No API access, no HTTP, no i18n service,
 * no price math — presentational components never call backend APIs
 * (`ARCHITECTURE.md` §8).
 *
 * Contract fidelity (§7.4 rules — strictly backend-driven, never
 * calculated, never fabricated):
 * - Product name + SKU render from the backend line only.
 * - Unit price renders the page-formatted backend snapshot
 *   (`unitPriceAmount` + `currency` via `formatCurrency` at the page —
 *   display only, never an input to math).
 * - Line totals render nowhere: `CartItemResponse` carries no `lineTotal`
 *   and the UI performs no `unitPrice × quantity` multiplication (§7.4
 *   boundary — the backend remains authoritative for totals).
 * - Thumbnails render the backend-resolved primary image when known,
 *   else the placeholder: cart lines carry no image URL in any readable
 *   contract, so the owning page resolves `GET /catalog/products/{id}`
 *   thumbnails through feature state and the component never fabricates
 *   imagery.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 7.5/7.7 — no identity handling, no merge wiring.
 * - Phase 8 — no checkout, pricing, totals, or payment logic.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CartItem } from '../../models/cart.models';
import { QuantityControl } from '../quantity-control/quantity-control';

/** Page-localized labels for one cart line (no per-item interpolation left). */
export interface CartItemLabels {
  readonly unitPrice: string;
  readonly sku: string;
  readonly quantity: string;
  readonly decrease: string;
  readonly increase: string;
  readonly invalidQuantity: string;
}

/**
 * Preformatted cart line view model, projected by the owning page from
 * backend lines: `unitPriceText` formats the backend price snapshot for
 * the active culture (display only), `removeLabel` carries the
 * interpolated accessible remove label, and `imageUrl`/`imageAlt` carry
 * the resolved product thumbnail (`null`/fallback when unresolvable —
 * cart lines carry no image URL in any readable contract). The component
 * renders these strings verbatim — it resolves nothing.
 */
export interface CartItemView {
  readonly item: CartItem;
  readonly unitPriceText: string;
  readonly removeLabel: string;
  readonly imageUrl: string | null;
  readonly imageAlt: string;
}

@Component({
  selector: 'cart-item',
  imports: [RouterLink, QuantityControl],
  templateUrl: './cart-item.html',
  styleUrl: './cart-item.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartItemComponent {
  /** Preformatted line view model (page-projected, required). */
  @Input({ required: true }) view!: CartItemView;

  /** Line labels (page-localized, required). */
  @Input({ required: true }) labels!: CartItemLabels;

  /** Freezes quantity and remove controls while a mutation is in flight. */
  @Input() disabled = false;

  /** Emitted with the new quantity on every valid quantity change. */
  @Output() readonly quantityChange = new EventEmitter<number>();

  /** Emitted when the remove action is pressed. */
  @Output() readonly remove = new EventEmitter<void>();
}
