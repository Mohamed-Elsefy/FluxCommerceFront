/**
 * Orders contract mirrors for Sub-Phase 1.1.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §4 and
 * `docs/frontend-contract/DTO_REFERENCE.md` §4
 * (`FluxCommerce.Modules.Orders.Contracts`, `[Route orders][Authorize]`).
 *
 * Notes:
 * - Requests DO use `DataAnnotations` (address lengths, `countryCode` exactly
 *   2 upper ISO-3166, `cartId` required).
 * - `Idempotency-Key` is a REQUIRED header on `POST /orders/checkout`
 *   (1..128 chars, trimmed, NOT in the body). Same key + same body replays the
 *   original order; same key + different body → `409 IdempotencyConflict`.
 * - `status` fields are STRINGS (`OrderStatus.ToString()`), never the enum.
 * - Money: nested `OrderMoneyResponse` on totals, split flat fields on line
 *   items. Decimals travel as JSON numbers.
 * - New orders start `Pending`; the saga moves them to `Confirmed|Cancelled`
 *   asynchronously — poll `GET /orders/{id}`.
 * - `GET /orders/{id}` masks other-customer ids as `404` (IDOR protection).
 */

import type { Guid, IsoDateString } from '../common/shared-types';
import type { PageQuery } from '../common/shared-types';
import { isValidPageQuery } from '../common/shared-types';
import type { OrderStatus } from '../common/enums';

/** Shipping/billing address — `line2` optional, everything else required. */
export interface CheckoutAddressRequest {
  recipientName: string;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
}

/** `POST /orders/checkout` body (+ `Idempotency-Key` header, not in body). */
export interface CheckoutRequest {
  cartId: Guid;
  shippingAddress: CheckoutAddressRequest;
  billingAddress: CheckoutAddressRequest;
}

/** `POST /orders/checkout` payload — poll for the terminal status. */
export interface CheckoutResponse {
  orderId: Guid;
  orderNumber: string;
  status: OrderStatus;
  createdAtUtc: IsoDateString;
}

/** Nested money object on order totals. */
export interface OrderMoneyResponse {
  amount: number;
  currency: string;
}

/** Address echo on `OrderDetailsResponse`. */
export interface OrderAddressResponse {
  recipientName: string;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
}

/** Line item — split flat money fields (not nested). */
export interface OrderLineItemResponse {
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  unitPriceCurrency: string;
  lineTotal: number;
  lineTotalCurrency: string;
}

/** `GET /orders` page item — newest-first, caller-owned only. */
export interface OrderSummaryResponse {
  orderId: Guid;
  orderNumber: string;
  status: OrderStatus;
  grandTotal: OrderMoneyResponse;
  itemCount: number;
  createdAtUtc: IsoDateString;
}

/** `GET /orders/{orderId}` (+ cancel) payload. */
export interface OrderDetailsResponse {
  orderId: Guid;
  orderNumber: string;
  status: OrderStatus;
  subtotal: OrderMoneyResponse;
  shippingCost: OrderMoneyResponse;
  discount: OrderMoneyResponse;
  grandTotal: OrderMoneyResponse;
  itemCount: number;
  createdAtUtc: IsoDateString;
  shippingAddress: OrderAddressResponse;
  billingAddress: OrderAddressResponse;
  lineItems: OrderLineItemResponse[];
}

/** `GET /admin/orders/counts` payload (`orders.read`, all `int`). */
export interface AdminOrderCountsResponse {
  total: number;
  pending: number;
  confirmed: number;
  cancelled: number;
}

/**
 * `POST /admin/orders/{orderId}/refund` body (`orders.refund`).
 * `reason` is `[Required][StringLength(500, MinimumLength = 1)]`; only
 * paid (`Completed` saga) orders are eligible.
 */
export interface RefundOrderRequest {
  reason: string;
}

/** Backend order statuses accepted as the `status` filter (case-insensitive). */
export const ORDER_STATUS_FILTER_VALUES: readonly OrderStatus[] = [
  'Pending',
  'Cancelled',
  'Confirmed',
];

/**
 * Whether `value` names a filter-accepted order status (case-insensitive;
 * unknown → backend `400`). Pure — throws nothing.
 */
export function isOrderStatusFilter(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    ORDER_STATUS_FILTER_VALUES.some((s) => s.toLowerCase() === value.toLowerCase())
  );
}

/**
 * `GET /admin/orders` query (`orders.read`): paging +
 * `status?/customerId?/search?/from?/to?` (newest-first, platform-wide).
 * Unknown `status` or `from > to` → backend `400`.
 */
export interface AdminOrdersQuery extends PageQuery {
  status?: string;
  customerId?: Guid;
  search?: string;
  from?: string;
  to?: string;
}

/**
 * Structural pre-check for an admin order-list query: paging bounds,
 * known status when present, non-blank ids/search, `from <= to` when both
 * present (lexicographic ISO-8601 comparison). Pure — throws nothing.
 */
export function isValidAdminOrdersQuery(query: AdminOrdersQuery | null | undefined): boolean {
  if (!isValidPageQuery(query)) {
    return false;
  }
  if (query === null || query === undefined) {
    return true;
  }
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    if (!isOrderStatusFilter(query.status)) {
      return false;
    }
  }
  if (
    query.customerId !== undefined &&
    query.customerId !== null &&
    query.customerId.trim() === ''
  ) {
    return false;
  }
  if (query.search !== undefined && query.search !== null && query.search.trim() === '') {
    return false;
  }
  if (
    query.from !== undefined &&
    query.from !== null &&
    query.from !== '' &&
    query.to !== undefined &&
    query.to !== null &&
    query.to !== '' &&
    query.from > query.to
  ) {
    return false;
  }
  return true;
}

/**
 * `POST /admin/orders/{orderId}/refund` submission (`orders.refund`): the
 * order id (route) plus `reason` (body, 1..500 chars). Only paid
 * (`Completed` saga) orders are eligible — `404 Order.NotFound`,
 * `409 Order.RefundConflict` (in-flight duplicate stays `200`
 * idempotent). Structural pre-check only. Pure — throws nothing.
 */
export interface RefundSubmission {
  readonly orderId: Guid;
  readonly reason: string;
}

/**
 * Structural pre-check for a refund submission. Pure — throws nothing.
 */
export function isValidRefundSubmission(submission: RefundSubmission | null | undefined): boolean {
  if (submission === null || submission === undefined) {
    return false;
  }
  if (typeof submission.orderId !== 'string' || submission.orderId.trim() === '') {
    return false;
  }
  if (typeof submission.reason !== 'string') {
    return false;
  }
  const length = submission.reason.length;
  return length >= 1 && length <= 500;
}
