/**
 * Order summary row component for Sub-Phase 10.3 — Orders List.
 *
 * Presentation only: renders HOW one customer order reads (order number
 * linked to the details route, backend-issued date, status, item count,
 * and total). The owning page decides WHEN and WHAT — the row arrives
 * preformatted (date and money formatted for the active culture at the
 * page via `formatDate`/`formatCurrency`; labels page-localized),
 * projected from `OrderSummary` through `toOrderRowView` below.
 * Dynamic sync flows through inputs: new page data means a new view
 * object, never an in-place mutation. No API access, no HTTP, no state
 * writes, no price math — presentational components never call backend
 * APIs (`ARCHITECTURE.md` §8).
 *
 * Backend-authoritative guardrails (this sub-phase's core constraint):
 * - The order number, date, item count, and total echo the backend
 *   summary verbatim. The total is display text only — never an input
 *   to math, never recomputed from lines.
 * - `statusText` is the backend `OrderStatus` string verbatim: plain
 *   text, deliberately NOT a badge — status badges and localized
 *   status mapping belong to §10.5.
 * - NO payment status renders here: neither `OrderSummaryResponse` nor
 *   `OrderDetailsResponse` carries payment fields (payment truth lives
 *   behind `GET /api/payments/{id}`, whose `paymentId` the checkout
 *   contract never returns). Rendering one would invent API
 *   capabilities — documented, not approximated (Phase 10 §10).
 * - Order status and payment status are never derived from each other:
 *   nothing here reads both, because only one exists on this contract.
 *
 * The single details link carries the order number
 * (`/account/orders/<orderId>`, matching `GET /orders/{orderId}`) so
 * assistive technology announces one destination per row.
 *
 * SSR/hydration safe: static markup from inputs only, no browser APIs.
 * RTL safe: logical properties only, no direction branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.4 — no details content (the link target lands there).
 * - 10.5 — no status badges or localized status labels.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatCurrency, formatDate, type Culture } from '@flux/i18n';
import { orderDetailsPath, type OrderSummary } from '../../models/orders.models';

/** One orders-list row: backend facts only, date and total preformatted. */
export interface OrderRowView {
  /** Backend order identifier (opaque to the frontend). */
  readonly orderId: string;
  /** Details destination (`/account/orders/<orderId>`). */
  readonly detailsRoute: string;
  /** Human-readable backend order number (`ORD-*`). */
  readonly orderNumber: string;
  /** Culture-formatted creation date (display only). */
  readonly dateText: string;
  /** Backend `OrderStatus` string verbatim (plain text, never a badge). */
  readonly statusText: string;
  /** Backend line count (`itemCount`, structural — never money). */
  readonly itemCount: number;
  /** Culture-formatted backend grand total (display only). */
  readonly totalText: string;
}

/** Page-localized labels for the row (no interpolation left). */
export interface OrderRowLabels {
  readonly date: string;
  readonly status: string;
  readonly items: string;
  readonly total: string;
}

/**
 * Projects a row view out of a backend order summary. Date and money
 * format for `culture` (display only); every other field echoes
 * verbatim — no totals math, no status derivation. Pure — throws
 * nothing, performs no HTTP.
 */
export function toOrderRowView(summary: OrderSummary, culture: Culture): OrderRowView {
  return {
    orderId: summary.orderId,
    detailsRoute: orderDetailsPath(summary.orderId),
    orderNumber: summary.orderNumber,
    dateText: formatDate(summary.createdAtUtc, culture),
    statusText: summary.status,
    itemCount: summary.itemCount,
    totalText: formatCurrency(summary.grandTotal.amount, summary.grandTotal.currency, culture),
  };
}

@Component({
  selector: 'orders-order-summary-row',
  imports: [RouterLink],
  templateUrl: './order-summary-row.html',
  styleUrl: './order-summary-row.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderSummaryRow {
  /** Preformatted row view to render (projected by the owning page). */
  @Input({ required: true }) view!: OrderRowView;

  /** Page-localized field labels (required). */
  @Input({ required: true }) labels!: OrderRowLabels;
}
