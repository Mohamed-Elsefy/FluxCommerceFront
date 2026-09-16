/**
 * Cart summary component for Sub-Phase 7.4 — Cart Page & UI.
 *
 * Presentation only: renders HOW the cart summary looks (item count,
 * backend-authoritative money rows when present, clear action, and the
 * checkout navigation boundary). The owning page decides WHEN and WHAT —
 * every string arrives preformatted from backend values for the active
 * culture (counts via `formatNumber`, money via `formatCurrency`), and
 * the clear intent leaves through `clear`. No API access, no HTTP, no
 * price math — presentational components never call backend APIs
 * (`ARCHITECTURE.md` §8).
 *
 * Contract fidelity (§7.4 rules — strictly backend-driven, never
 * calculated, never fabricated):
 * - Money rows render ONLY from non-null page-formatted backend money
 *   (`subtotalText`/`totalText`); the cart contract currently carries no
 *   totals object, so both stay `null` and their rows stay hidden until
 *   a backend totals source provides them (structure ready, no component
 *   change needed then).
 * - While money is absent the `totalsNote` (page-localized, e.g. totals
 *   finalized at checkout) renders instead — the summary never shows a
 *   locally summed amount.
 * - The checkout anchor is a navigation boundary only
 *   (`routerLink="/checkout"`): no checkout, shipping, tax, order, or
 *   payment logic lives here or anywhere in Phase 7 (Phase 8 owns it).
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 7.5/7.7 — no identity handling, no merge wiring.
 * - Phase 8 — no checkout page, shipping, tax, order, or payment logic.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'cart-summary',
  imports: [RouterLink],
  templateUrl: './cart-summary.html',
  styleUrl: './cart-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartSummary {
  /** Visible section heading (page-localized, required). */
  @Input({ required: true }) title!: string;

  /** Item count row label (page-localized, required). */
  @Input({ required: true }) itemsLabel!: string;

  /** Page-formatted item count for the active culture (required). */
  @Input({ required: true }) itemsValue!: string;

  /** Subtotal row label (page-localized, required). */
  @Input({ required: true }) subtotalLabel!: string;

  /** Page-formatted backend subtotal, or `null` while the backend provides none. */
  @Input({ required: true }) subtotalText!: string | null;

  /** Total row label (page-localized, required). */
  @Input({ required: true }) totalLabel!: string;

  /** Page-formatted backend total, or `null` while the backend provides none. */
  @Input({ required: true }) totalText!: string | null;

  /** Pending-totals note, or `null` once backend money renders. */
  @Input({ required: true }) totalsNote!: string | null;

  /** Clear-cart action label (page-localized, required). */
  @Input({ required: true }) clearLabel!: string;

  /** Checkout navigation label (page-localized, required). */
  @Input({ required: true }) checkoutLabel!: string;

  /** Disables the clear action while a cart mutation is in flight. */
  @Input() clearing = false;

  /** Emitted when the clear-cart action is pressed. */
  @Output() readonly clear = new EventEmitter<void>();
}
