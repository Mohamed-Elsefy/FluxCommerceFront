/**
 * Checkout order summary component for Sub-Phase 8.5 — Order Summary.
 *
 * Presentation only: renders HOW the pre-submission review looks (cart
 * lines with backend-issued unit prices, structural counts, and
 * backend-issued money rows). The owning page decides WHEN and WHAT —
 * the view arrives preformatted (money formatted for the active culture
 * at the page via `formatCurrency`; labels page-localized), projected
 * from the §8.1 `CheckoutOrderSummary` through `toOrderSummaryView`
 * below, itself projected live from the Cart feature state in 8.6+.
 * Dynamic sync therefore flows through inputs: new cart data means a
 * new view object, never an in-place mutation. No API access, no HTTP,
 * no state writes, no price math — presentational components never call
 * backend APIs (`ARCHITECTURE.md` §8).
 *
 * Backend-authoritative guardrails (this sub-phase's core constraint):
 * - Lines render the backend unit-price snapshot and quantity as
 *   separate facts. Line totals render NOWHERE: the cart contract
 *   exposes no `lineTotal` and this component performs no
 *   `unitPrice × quantity` multiplication.
 * - Money rows (`subtotal`/`shippingCost`/`discount`/`grandTotal`)
 *   render backend-issued texts only, row by row. Absent money renders
 *   the pending note — never a locally summed zero or total.
 * - No shipping-method section exists: the checkout contract carries no
 *   method field (§8.1 gap), so there is nothing to select or display.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 8.6 — no page, no form wiring, no `CheckoutState`/submission
 *   orchestration, no cart-change recovery UI.
 * - Phase 9 — no payment, Stripe, or client-secret logic.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { OrderMoneyResponse } from '@flux/models';
import type { CheckoutOrderSummary } from '../../models/checkout.models';

/** One review line: backend facts only, price preformatted by the page. */
export interface OrderSummaryLineView {
  readonly productName: string;
  readonly sku: string;
  readonly quantity: number;
  readonly unitPriceText: string;
}

/** Backend-issued money rows; `null` means the backend provided none yet. */
export interface OrderSummaryTotalsView {
  readonly subtotalText: string | null;
  readonly shippingCostText: string | null;
  readonly discountText: string | null;
  readonly grandTotalText: string | null;
}

/** Preformatted order-summary view model, projected by the owning page. */
export interface OrderSummaryView {
  readonly lines: readonly OrderSummaryLineView[];
  readonly itemCount: number;
  readonly distinctItemCount: number;
  readonly totals: OrderSummaryTotalsView;
}

/** Page-localized labels for the summary (no interpolation left). */
export interface OrderSummaryLabels {
  readonly title: string;
  readonly items: string;
  readonly emptyTitle: string;
  readonly emptyMessage: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly sku: string;
  readonly subtotal: string;
  readonly shippingCost: string;
  readonly discount: string;
  readonly grandTotal: string;
  readonly totalsPending: string;
}

/**
 * Projects a §8.1 checkout order summary into the render view. Money is
 * formatted through the page-supplied formatter (culture-aware,
 * display-only); lines map verbatim — quantities and amounts are never
 * multiplied, never summed. Returns `null` for missing or line-free
 * summaries (the component renders its empty state). Pure — throws
 * nothing, performs no HTTP.
 */
export function toOrderSummaryView(
  summary: CheckoutOrderSummary | null | undefined,
  formatMoney: (money: OrderMoneyResponse) => string,
): OrderSummaryView | null {
  if (!summary || summary.lines.length === 0) {
    return null;
  }
  const text = (money: OrderMoneyResponse | null): string | null =>
    money === null ? null : formatMoney(money);
  return {
    lines: summary.lines.map((line) => ({
      productName: line.productName,
      sku: line.sku,
      quantity: line.quantity,
      unitPriceText: formatMoney({ amount: line.unitPriceAmount, currency: line.currency }),
    })),
    itemCount: summary.itemCount,
    distinctItemCount: summary.distinctItemCount,
    totals: {
      subtotalText: text(summary.subtotal),
      shippingCostText: text(summary.shippingCost),
      discountText: text(summary.discount),
      grandTotalText: text(summary.grandTotal),
    },
  };
}

@Component({
  selector: 'checkout-order-summary',
  templateUrl: './order-summary.html',
  styleUrl: './order-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderSummaryComponent {
  /** Preformatted review view; `null` renders the empty state. */
  @Input() view: OrderSummaryView | null = null;
  /** Summary labels (page-localized, required). */
  @Input({ required: true }) labels!: OrderSummaryLabels;

  /** Whether at least one backend-issued money row exists. */
  hasTotals(): boolean {
    const totals = this.view?.totals;
    if (!totals) {
      return false;
    }
    return (
      totals.subtotalText !== null ||
      totals.shippingCostText !== null ||
      totals.discountText !== null ||
      totals.grandTotalText !== null
    );
  }
}
