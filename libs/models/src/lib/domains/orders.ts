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

import type { Guid, IsoDateString } from './shared-types';
import type { OrderStatus } from './enums';

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
