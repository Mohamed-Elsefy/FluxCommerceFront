/**
 * Storefront Order details view models for Sub-Phase 10.4 — Order
 * Details.
 *
 * Scope: `docs/phases/PHASE_10_ORDERS_CUSTOMER_ACCOUNT.md` §10.4 (pure
 * view projection only — no API execution, no state implementation, no
 * pages, no components).
 *
 * Source of truth: `docs/frontend-contract/DTO_REFERENCE.md` §4
 * (`OrderDetailsResponse`, `OrderAddressResponse`,
 * `OrderLineItemResponse`). The canonical wire mirrors stay in
 * `@flux/models` — this module owns the display-only view shapes and
 * the pure backend → view projector. Pure types + pure functions: no
 * Angular, no HTTP, no storage — SSR-safe.
 *
 * Backend-authoritative guardrails (this sub-phase's core constraint):
 * - Every money text formats a backend-issued amount for `culture`
 *   (display only). No subtotal/tax/shipping/total is ever computed,
 *   summed, or reconstructed — line totals render the backend
 *   `lineTotal`, totals rows render the backend `subtotal`/`discount`/
 *   `shippingCost`/`grandTotal`.
 * - `statusText` is the backend `OrderStatus` string verbatim: plain
 *   text, deliberately NOT a badge — status badges and localized status
 *   mapping belong to §10.5.
 * - NO payment status exists in this view: `OrderDetailsResponse`
 *   carries no payment fields (payment truth lives behind
 *   `GET /api/payments/{id}`, whose `paymentId` the checkout contract
 *   never returns). Rendering one would invent API capabilities —
 *   documented, not approximated (Phase 10 §10).
 * - NO tax row exists: the contract carries no tax field (`subtotal`,
 *   `shippingCost`, `discount`, `grandTotal` only).
 * - NO thumbnails exist: line items carry no image/product fields
 *   (`productName`, `sku`, quantities, and prices only).
 * - NO contact details exist beyond the address `recipientName`: the
 *   contract carries no customer email/phone on orders.
 * - Order status and payment status are never derived from each other:
 *   nothing here reads both, because only one exists on this contract.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.5 — no status badges or localized status labels.
 * - 10.6 — no history timeline or polling state.
 */

import { formatCurrency, formatDate, type Culture } from '@flux/i18n';
import type { Order, OrderAddress, OrderItem } from './orders.models';

/**
 * Read-only address block: recipient plus prejoined display lines
 * (`line1`, optional `line2`, locality, country). Pure display joining
 * of backend fields — no normalization, no business rules.
 */
export interface OrderAddressView {
  readonly recipientName: string;
  readonly lines: readonly string[];
}

/**
 * Read-only order line: backend facts only, money preformatted for
 * display. `lineTotalText` formats the backend `lineTotal` — never a
 * locally computed `unitPrice × quantity`.
 */
export interface OrderDetailsItemView {
  readonly productName: string;
  readonly sku: string;
  readonly quantity: number;
  readonly unitPriceText: string;
  readonly lineTotalText: string;
}

/**
 * Read-only totals block: every row formats a backend-issued money
 * object. Absent (`null`) money renders as absent — never zero-filled,
 * never summed.
 */
export interface OrderDetailsTotalsView {
  readonly subtotalText: string;
  readonly discountText: string;
  readonly shippingCostText: string;
  readonly grandTotalText: string;
}

/**
 * Read-only order details view projected from the backend order.
 * Nothing here is editable and nothing round-trips to an endpoint.
 */
export interface OrderDetailsView {
  /** Backend order identifier (opaque to the frontend). */
  readonly orderId: string;
  /** Human-readable backend order number (`ORD-*`). */
  readonly orderNumber: string;
  /** Culture-formatted creation date (display only). */
  readonly dateText: string;
  /** Backend `OrderStatus` string verbatim (plain text, never a badge). */
  readonly statusText: string;
  /**
   * Customer name: the shipping address `recipientName` — the only
   * customer-identifying field the orders contract provides.
   */
  readonly customerName: string;
  /** Backend line count (`itemCount`, structural — never money). */
  readonly itemCount: number;
  /** Backend line items in wire order. */
  readonly items: readonly OrderDetailsItemView[];
  /** Backend shipping address echo. */
  readonly shippingAddress: OrderAddressView;
  /** Backend billing address echo. */
  readonly billingAddress: OrderAddressView;
  /** Backend-issued totals (display only). */
  readonly totals: OrderDetailsTotalsView;
}

/**
 * Projects a display address out of a backend address echo. Blank
 * fragments (`line2` when absent, empty locality parts) are dropped;
 * surviving lines keep wire order. Pure — throws nothing.
 */
export function toOrderAddressView(address: OrderAddress): OrderAddressView {
  const line2 = typeof address.line2 === 'string' ? address.line2.trim() : '';
  const locality = `${address.city}, ${address.region} ${address.postalCode}`
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[,\s]+|[,\s]+$/g, '');
  const lines = [address.line1, line2, locality, address.countryCode].filter(
    (line): line is string => typeof line === 'string' && line.trim() !== '',
  );
  return { recipientName: address.recipientName, lines };
}

/**
 * Projects a display line out of a backend line item. Money formats for
 * `culture` (display only); `lineTotalText` echoes the backend
 * `lineTotal` — never recomputed. Pure — throws nothing, performs no
 * HTTP.
 */
export function toOrderDetailsItemView(item: OrderItem, culture: Culture): OrderDetailsItemView {
  return {
    productName: item.productName,
    sku: item.sku,
    quantity: item.quantity,
    unitPriceText: formatCurrency(item.unitPrice, item.unitPriceCurrency, culture),
    lineTotalText: formatCurrency(item.lineTotal, item.lineTotalCurrency, culture),
  };
}

/**
 * Projects the read-only details view out of a backend order. Verbatim
 * data only — no computation, no edits. Pure — throws nothing,
 * performs no HTTP.
 */
export function toOrderDetailsView(order: Order, culture: Culture): OrderDetailsView {
  return {
    orderId: order.orderId,
    orderNumber: order.orderNumber,
    dateText: formatDate(order.createdAtUtc, culture),
    statusText: order.status,
    customerName: order.shippingAddress.recipientName,
    itemCount: order.itemCount,
    items: order.lineItems.map((item) => toOrderDetailsItemView(item, culture)),
    shippingAddress: toOrderAddressView(order.shippingAddress),
    billingAddress: toOrderAddressView(order.billingAddress),
    totals: {
      subtotalText: formatCurrency(order.subtotal.amount, order.subtotal.currency, culture),
      discountText: formatCurrency(order.discount.amount, order.discount.currency, culture),
      shippingCostText: formatCurrency(
        order.shippingCost.amount,
        order.shippingCost.currency,
        culture,
      ),
      grandTotalText: formatCurrency(order.grandTotal.amount, order.grandTotal.currency, culture),
    },
  };
}
