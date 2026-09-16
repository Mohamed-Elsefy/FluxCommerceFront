/**
 * Cart items list component for Sub-Phase 7.4 — Cart Page & UI.
 *
 * Presentation only: renders HOW the settled cart lines look (section
 * heading plus one `CartItemComponent` per backend line, tracked by
 * `variantId`). The owning page decides WHEN and WHAT — the preformatted
 * line view models arrive as inputs and per-line intent bubbles back up
 * with its line identity attached (`quantityChange` carries
 * `{variantId, quantity}`, `remove` carries `variantId`). No API access,
 * no HTTP, no price math — presentational components never call backend
 * APIs (`ARCHITECTURE.md` §8).
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 7.5/7.7 — no identity handling, no merge wiring.
 * - Phase 8 — no checkout, pricing, totals, or payment logic.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CartItemComponent, type CartItemLabels, type CartItemView } from '../cart-item/cart-item';

/** Per-line quantity intent leaving the list with its line identity. */
export interface CartLineQuantityChange {
  readonly variantId: string;
  readonly quantity: number;
}

@Component({
  selector: 'cart-items',
  imports: [CartItemComponent],
  templateUrl: './cart-items.html',
  styleUrl: './cart-items.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartItems {
  /** Preformatted line view models in backend order (page-projected, required). */
  @Input({ required: true }) views!: readonly CartItemView[];

  /** Visible section heading (page-localized, required). */
  @Input({ required: true }) title!: string;

  /** Line labels (page-localized, required). */
  @Input({ required: true }) itemLabels!: CartItemLabels;

  /** Freezes every line control while a cart mutation is in flight. */
  @Input() disabled = false;

  /** Emitted with line identity on every valid per-line quantity change. */
  @Output() readonly quantityChange = new EventEmitter<CartLineQuantityChange>();

  /** Emitted with the line identity on every per-line remove action. */
  @Output() readonly remove = new EventEmitter<string>();
}
