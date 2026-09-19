/**
 * Payment order summary component for Sub-Phase 9.10 — Payment UI &
 * Checkout Integration.
 *
 * Presentation only: renders WHAT the paid order contains (order
 * number, backend-issued lines with unit prices, structural counts, and
 * backend-issued money rows). The owning page decides WHEN and WHAT —
 * the view arrives preformatted (money formatted for the active culture
 * at the page via `formatCurrency`; labels page-localized), projected
 * from the §9.10 `OrderDetailsResponse` slot through
 * `toPaymentOrderSummaryView` below. Dynamic sync flows through inputs:
 * new order data means a new view object, never an in-place mutation.
 * No API access, no HTTP, no state writes, no price math —
 * presentational components never call backend APIs
 * (`ARCHITECTURE.md` §8).
 *
 * Backend-authoritative guardrails (this sub-phase's core constraint):
 * - Lines render the backend unit price and quantity as separate facts.
 *   Line totals render NOWHERE: the projection carries none and this
 *   component performs no `unitPrice × quantity` multiplication.
 * - Money rows (`subtotal`/`shippingCost`/`discount`/`grandTotal`)
 *   render backend-issued texts only, row by row. A missing order
 *   renders nothing (the page owns the loading state) — never locally
 *   summed zeros or totals.
 *
 * SSR-safe: static markup from inputs only, no browser APIs. RTL safe:
 * logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.11 — no security/SSR audit changes.
 * - Phase 10 — no order polling or order-history reads (single display
 *   snapshot only).
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { OrderDetailsResponse, OrderMoneyResponse } from '@flux/models';

/** One summary line: backend facts only, price preformatted by the page. */
export interface PaymentOrderSummaryLineView {
  readonly productName: string;
  readonly sku: string;
  readonly quantity: number;
  readonly unitPriceText: string;
}

/** Backend-issued money rows as display texts. */
export interface PaymentOrderSummaryTotalsView {
  readonly subtotalText: string;
  readonly shippingCostText: string;
  readonly discountText: string;
  readonly grandTotalText: string;
}

/** Preformatted order-summary view model, projected by the owning page. */
export interface PaymentOrderSummaryView {
  readonly orderNumber: string;
  readonly lines: readonly PaymentOrderSummaryLineView[];
  readonly itemCount: number;
  readonly totals: PaymentOrderSummaryTotalsView;
}

/** Page-localized labels for the summary (no interpolation left). */
export interface PaymentOrderSummaryLabels {
  readonly title: string;
  readonly items: string;
  readonly orderNumber: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly sku: string;
  readonly subtotal: string;
  readonly shippingCost: string;
  readonly discount: string;
  readonly grandTotal: string;
}

/**
 * Projects a backend `OrderDetailsResponse` into the render view. Money
 * is formatted through the page-supplied formatter (culture-aware,
 * display-only); lines map verbatim — quantities and amounts are never
 * multiplied, never summed. Returns `null` for a missing order (the
 * component renders nothing). Pure — throws nothing, performs no HTTP.
 */
export function toPaymentOrderSummaryView(
  order: OrderDetailsResponse | null | undefined,
  formatMoney: (money: OrderMoneyResponse) => string,
): PaymentOrderSummaryView | null {
  if (!order) {
    return null;
  }
  return {
    orderNumber: order.orderNumber,
    lines: order.lineItems.map((line) => ({
      productName: line.productName,
      sku: line.sku,
      quantity: line.quantity,
      unitPriceText: formatMoney({ amount: line.unitPrice, currency: line.unitPriceCurrency }),
    })),
    itemCount: order.itemCount,
    totals: {
      subtotalText: formatMoney(order.subtotal),
      shippingCostText: formatMoney(order.shippingCost),
      discountText: formatMoney(order.discount),
      grandTotalText: formatMoney(order.grandTotal),
    },
  };
}

@Component({
  selector: 'payment-order-summary',
  templateUrl: './payment-order-summary.html',
  styleUrl: './payment-order-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentOrderSummaryComponent {
  /** Preformatted order view; `null` renders nothing (page owns loading). */
  @Input() view: PaymentOrderSummaryView | null = null;
  /** Summary labels (page-localized, required). */
  @Input({ required: true }) labels!: PaymentOrderSummaryLabels;
}
