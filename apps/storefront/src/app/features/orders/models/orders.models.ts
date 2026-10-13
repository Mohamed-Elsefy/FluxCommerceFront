/**
 * Storefront Orders feature models for Sub-Phase 10.1 — Orders Contract
 * Audit & Feature Foundation.
 *
 * Scope: `docs/phases/PHASE_10_ORDERS_CUSTOMER_ACCOUNT.md` §10.1
 * (contracts and boundaries only — no API execution, no state
 * implementation, no pages, no components, no routes wiring).
 *
 * Source of truth (audited — see the tables below):
 * - `docs/frontend-contract/API_CONTRACT.md` §4 (orders endpoints).
 * - `docs/frontend-contract/DTO_REFERENCE.md` §4 (orders shapes).
 * - `docs/frontend-contract/ENUM_REFERENCE.md` §3 (order statuses).
 * - `docs/frontend-contract/ERROR_CATALOG.md` §4 (order error codes).
 * - `docs/frontend-contract/PAGINATION_CONVENTION.md` (paging envelope).
 * - `docs/frontend-contract/AUTH_FLOW.md` §4 (endpoint auth matrix).
 *
 * Audited backend surface (the complete customer-facing orders surface):
 * - `GET /orders?pageNumber=&pageSize=` → `ApiResponse<PagedResult<OrderSummaryResponse>>`
 *   (authenticated; defaults `1/20`, max `100`; fixed newest-first, no
 *   sort/filter params; caller-owned only; `200/400/401`).
 * - `GET /orders/{orderId}` → `ApiResponse<OrderDetailsResponse>`
 *   (authenticated + ownership — foreign ids mask as `404`, never probe;
 *   `200/401/404`).
 * - `POST /orders/{orderId}/cancel` → `ApiResponse<OrderDetailsResponse>`
 *   (authenticated + ownership; valid only while `Pending`; `200/401/404/409`).
 * - `GET /auth/me` → `ApiResponse<UserResponse>` (the profile read for
 *   §10.2; authenticated; `200/401/404`).
 * - No order-history endpoint exists and no history fields travel on any
 *   order payload — `ORDERS_HISTORY_SUPPORTED` pins the gap (`false`), so
 *   no timeline is fabricated (see `OrderHistoryEntry`).
 *
 * Backend-authoritative data rule (this sub-phase's core constraint): this
 * module performs NO totals computation, NO status derivation, and NO
 * business transitions — no `unitPrice * quantity`, no subtotal/total
 * summation, no float-math money helpers, no inferring order status from
 * payment status (or the reverse). Money and statuses echo verbatim for
 * display only.
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - Canonical wire mirrors live in `@flux/models` and stay the single
 *   declaration site — `Order`/`OrderSummary`/`OrderItem`/`OrderMoney`/
 *   `OrderAddress`/`CustomerProfile` and the status unions are aliases,
 *   never re-declared, so no contract drift is possible.
 * - This module owns the feature-local additions: pagination bounds, pure
 *   structural guards, independent status predicates, the history-support
 *   pin, route-param shapes, and pure status-first error classifiers (per
 *   `ERROR_CATALOG.md` §0 — `extensions` is `{}` on the `MapError` path,
 *   so classifiers branch on `status` first and treat `code` as a hint,
 *   never on message text).
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.2 — no account shell/page, no profile view, no session wiring.
 * - 10.3 — no orders list page, no pagination UI, no state implementation.
 * - 10.4 — no order details page/views.
 * - 10.5 — no status badges/components, no localized labels.
 * - 10.6 — no history timeline, no polling/sync logic.
 * - 10.7 — no route mounting (see `./orders.routes`).
 */

import type { ParamMap } from '@angular/router';
import type {
  CheckoutResponse,
  OrderAddressResponse,
  OrderDetailsResponse,
  OrderLineItemResponse,
  OrderMoneyResponse,
  OrderSummaryResponse,
  UserResponse,
} from '@flux/models';
import type { OrderStatus, PaymentStatus } from '@flux/models';
import {
  hasFieldErrors,
  isAccessDeniedFailure,
  isAuthFailure,
  isConflictFailure,
  isNotFoundFailure,
  isValidationFailure,
  type NormalizedFailure,
} from '@flux/models';

export type { OrderStatus, PaymentStatus };

/**
 * Frontend `Order` model. Alias of the canonical `OrderDetailsResponse`
 * (`GET /orders/{orderId}` and cancel payload) — re-exported, not
 * re-declared, so the backend shape keeps one declaration site.
 */
export type Order = OrderDetailsResponse;

/**
 * Frontend `OrderSummary` model. Alias of the canonical
 * `OrderSummaryResponse` (`GET /orders` page item) — re-exported, not
 * re-declared.
 */
export type OrderSummary = OrderSummaryResponse;

/**
 * Frontend `OrderItem` model. Alias of the canonical
 * `OrderLineItemResponse` (split flat money fields — display only, never
 * inputs to math) — re-exported, not re-declared.
 */
export type OrderItem = OrderLineItemResponse;

/**
 * Frontend `OrderMoney` model. Alias of the canonical
 * `OrderMoneyResponse` (nested totals money) — re-exported, not
 * re-declared.
 */
export type OrderMoney = OrderMoneyResponse;

/**
 * Frontend `OrderAddress` model. Alias of the canonical
 * `OrderAddressResponse` (shipping/billing echo) — re-exported, not
 * re-declared.
 */
export type OrderAddress = OrderAddressResponse;

/**
 * Frontend `CustomerProfile` model. Alias of the canonical `UserResponse`
 * (`GET /auth/me` payload, consumed read-only by §10.2) — re-exported,
 * not re-declared.
 */
export type CustomerProfile = UserResponse;

/**
 * Order creation handoff into the orders area (`POST /orders/checkout`
 * payload, owned by Phase 8). Alias of the canonical `CheckoutResponse` —
 * the only order context later phases need to link checkout → orders.
 */
export type OrderEntry = CheckoutResponse;

/**
 * Reads the display currency out of an order summary or order without
 * computing anything: the backend-issued `grandTotal.currency` verbatim,
 * or `null` when absent. Pure — throws nothing, performs no HTTP.
 */
export function orderCurrencyOf(order: OrderSummary | Order | null | undefined): string | null {
  const currency = order?.grandTotal?.currency;
  return typeof currency === 'string' && currency !== '' ? currency : null;
}

// ---------------------------------------------------------------------------
// Order pagination contract (`PAGINATION_CONVENTION.md`, `GET /orders`)
// ---------------------------------------------------------------------------

/** `GET /orders` default page (`OrderPaginationRules.DefaultPageNumber`). */
export const ORDERS_DEFAULT_PAGE_NUMBER = 1;

/** `GET /orders` default size (`OrderPaginationRules.DefaultPageSize`). */
export const ORDERS_DEFAULT_PAGE_SIZE = 20;

/** `GET /orders` minimum page (`OrderPaginationRules.MinPageNumber`). */
export const ORDERS_MIN_PAGE_NUMBER = 1;

/** `GET /orders` minimum size (`OrderPaginationRules.MinPageSize`). */
export const ORDERS_MIN_PAGE_SIZE = 1;

/** `GET /orders` maximum size (`OrderPaginationRules.MaxPageSize`). */
export const ORDERS_MAX_PAGE_SIZE = 100;

/**
 * Orders list query (`GET /orders?pageNumber=&pageSize=&status=`). Paging
 * fields optional and 1-based; omitted values resolve to backend
 * defaults (`1/20`). Fixed newest-first ordering — no sort params.
 * `status` filters caller-owned orders (`Pending|Cancelled|Confirmed`,
 * case-insensitive; unknown → backend `400`).
 */
export interface OrdersQuery {
  readonly pageNumber?: number;
  readonly pageSize?: number;
  readonly status?: string;
}

/**
 * Alias naming the paginated orders request shape for §10.3 consumers.
 */
export type OrderPagination = OrdersQuery;

/**
 * Structural pre-check for an orders query against the contract bounds
 * (`pageNumber >= 1`, `1 <= pageSize <= 100`, integers; known `status`
 * values only). Never a substitute for backend validation
 * (`Order.ValidationFailed` stays authoritative) — it only keeps
 * unusable input from reaching the call. Pure — throws nothing.
 */
export function isValidOrdersQuery(query: OrdersQuery | null | undefined): boolean {
  if (query === null || query === undefined) {
    return true;
  }
  const { pageNumber, pageSize, status } = query;
  if (
    pageNumber !== undefined &&
    (!Number.isInteger(pageNumber) || pageNumber < ORDERS_MIN_PAGE_NUMBER)
  ) {
    return false;
  }
  if (
    pageSize !== undefined &&
    (!Number.isInteger(pageSize) ||
      pageSize < ORDERS_MIN_PAGE_SIZE ||
      pageSize > ORDERS_MAX_PAGE_SIZE)
  ) {
    return false;
  }
  if (status !== undefined && status !== null && status !== '') {
    const known = ['pending', 'cancelled', 'confirmed'];
    if (!known.includes(String(status).toLowerCase())) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Order route params (shapes only — mounting belongs to §10.7)
// ---------------------------------------------------------------------------

/** Route parameter naming the order (`/account/orders/:orderId`, §10.4). */
export const ORDERS_ORDER_ID_PARAM = 'orderId' as const;

/** Orders list path (proposed — finalized when §10.7 mounts the routes). */
export const ORDERS_LIST_PATH = '/account/orders' as const;

/**
 * Orders route params: the customer order being viewed. Existence and
 * ownership stay backend-owned (`GET /orders/{id}` masks foreign ids as
 * `404`).
 */
export interface OrdersRouteParams {
  readonly orderId: string;
}

/**
 * Whether `value` is a usable order id: a non-blank string. Structural
 * pre-check only. Pure — throws nothing.
 */
export function isValidOrderId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Reads orders route params out of a route `ParamMap`. Returns `null`
 * for a missing or blank `:orderId` (nothing to load — the page stays in
 * its empty state, never a fabricated id). Pure — throws nothing,
 * performs no HTTP.
 */
export function readOrdersRouteParams(
  paramMap: ParamMap | null | undefined,
): OrdersRouteParams | null {
  const orderId = paramMap?.get(ORDERS_ORDER_ID_PARAM) ?? null;
  if (!isValidOrderId(orderId)) {
    return null;
  }
  return { orderId };
}

/**
 * Builds the orders list path (`/account/orders`). Pure — throws nothing.
 */
export function ordersPath(): string {
  return ORDERS_LIST_PATH;
}

/**
 * Builds the order details path for an order (`/account/orders/:orderId`).
 * Pure — throws nothing.
 */
export function orderDetailsPath(orderId: string): string {
  return `${ORDERS_LIST_PATH}/${orderId}`;
}

// ---------------------------------------------------------------------------
// Order status predicates (independent — never cross-derived)
// ---------------------------------------------------------------------------

/** Closed order-status set (`ENUM_REFERENCE.md` §3, strings on the wire). */
export const ORDER_STATUSES: readonly OrderStatus[] = ['Pending', 'Cancelled', 'Confirmed'];

/**
 * Whether `value` names a known order status. Unknown future strings
 * return `false` (render raw, treat as non-terminal — see
 * `ENUM_REFERENCE.md` §8). Pure — throws nothing.
 */
export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Whether the order is awaiting saga completion (`Pending` — poll
 * `GET /orders/{id}`). Pure — throws nothing.
 */
export function isPendingOrder(status: OrderStatus | string): boolean {
  return status === 'Pending';
}

/**
 * Whether the order reached terminal success (`Confirmed` — payment
 * succeeded). The ONLY paid signal on the order side. Pure — throws
 * nothing.
 */
export function isConfirmedOrder(status: OrderStatus | string): boolean {
  return status === 'Confirmed';
}

/**
 * Whether the order reached terminal failure (`Cancelled` — failure or
 * compensation). Pure — throws nothing.
 */
export function isCancelledOrder(status: OrderStatus | string): boolean {
  return status === 'Cancelled';
}

/**
 * Whether the order status is terminal (`Cancelled | Confirmed`):
 * polling may stop. Unknown future strings count as non-terminal (keep
 * polling). Pure — throws nothing.
 */
export function isTerminalOrder(status: OrderStatus | string): boolean {
  return status === 'Cancelled' || status === 'Confirmed';
}

/**
 * Whether the order may still be cancelled by the customer (`Pending`
 * only — cancelling a finalized order yields `409 CancelConflict`).
 * Pure — throws nothing.
 */
export function isCancellableOrder(status: OrderStatus | string): boolean {
  return status === 'Pending';
}

/** Closed payment-status set (`ENUM_REFERENCE.md` §5, strings on wire). */
export const ORDERS_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'Pending',
  'Processing',
  'Succeeded',
  'Failed',
  'Cancelled',
  'Refunded',
];

/**
 * Whether `value` names a known payment status. Unknown future strings
 * return `false` (render raw, treat as non-terminal). Pure — throws
 * nothing. Kept independent from order status by design (§10.5 rule: the
 * frontend must never derive one status from the other).
 */
export function isOrdersPaymentStatus(value: unknown): value is PaymentStatus {
  return (
    typeof value === 'string' && (ORDERS_PAYMENT_STATUSES as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Order history support pin (audited gap — no backend history contract)
// ---------------------------------------------------------------------------

/**
 * Whether the backend exposes order status history: `false`. No
 * history endpoint exists and no history fields travel on any order
 * payload, so §10.6 must not render a timeline until the backend lands
 * one. This constant pins the gap so later sub-phases never invent a
 * history from frontend state changes.
 */
export const ORDERS_HISTORY_SUPPORTED = false as const;

/**
 * Whether order history display is supported. Always `false` in the
 * current contract. Pure — throws nothing.
 */
export function isOrderHistorySupported(): false {
  return ORDERS_HISTORY_SUPPORTED;
}

/**
 * Frontend-side order-history observation (never a wire DTO — the backend
 * defines none). Reserved for a future backend history shape; until
 * `ORDERS_HISTORY_SUPPORTED` turns `true`, no code may populate or
 * render collections of this record.
 */
export interface OrderHistoryEntry {
  readonly orderId: string;
  readonly status: OrderStatus;
  readonly observedAtUtc: string;
  readonly source: 'order-details';
}

// ---------------------------------------------------------------------------
// Orders error codes (status-first classifiers, `ERROR_CATALOG.md` §4)
// ---------------------------------------------------------------------------

/**
 * `400` orders failures: bad idempotency key, empty cart, bad address,
 * bad list params (`pageNumber < 1` / `pageSize` outside `1..100`).
 */
export type OrdersValidationErrorCode =
  | 'Order.InvalidIdempotencyKey'
  | 'Order.CartEmpty'
  | 'Order.InvalidAddress'
  | 'Order.ValidationFailed';

/**
 * Authentication failures around orders: anonymous checkout/list/reads
 * (`401` — recovery is login/refresh, never retry).
 */
export type OrdersAuthErrorCode =
  'Order.AuthenticationRequired' | 'Order.QueryAuthenticationRequired';

/**
 * Ownership rejection (`403` — checkout against a foreign cart only;
 * `GET` reads mask foreign ids as `404` instead).
 */
export type OrdersAccessDeniedErrorCode = 'Order.CartAccessDenied';

/**
 * Missing order/cart (`404` — unknown id OR other-customer id,
 * IDOR-masked; never probe ids on these paths).
 */
export type OrdersNotFoundErrorCode = 'Order.CartNotFound' | 'Order.NotFound';

/**
 * `409` orders conflicts: idempotency-key reuse, delisted variant at
 * revalidation, duplicate lines, mixed currencies, late cancel.
 */
export type OrdersConflictErrorCode =
  | 'Order.IdempotencyConflict'
  | 'Order.VariantUnavailable'
  | 'Order.DuplicateVariant'
  | 'Order.CurrencyMismatch'
  | 'Order.CancelConflict';

/**
 * Every machine-readable orders failure the storefront branches on.
 * Codes are best-effort on the wire (`extensions` is `{}` on the
 * `MapError` path — `ERROR_CATALOG.md` §0), so classifiers below branch
 * on `status` first and treat `code` as a hint, never on message text.
 */
export type OrdersErrorCode =
  | OrdersValidationErrorCode
  | OrdersAuthErrorCode
  | OrdersAccessDeniedErrorCode
  | OrdersNotFoundErrorCode
  | OrdersConflictErrorCode;

/** Closed code set: every future branch names one of these. */
export const ORDERS_ERROR_CODES: readonly OrdersErrorCode[] = [
  'Order.InvalidIdempotencyKey',
  'Order.CartEmpty',
  'Order.InvalidAddress',
  'Order.ValidationFailed',
  'Order.AuthenticationRequired',
  'Order.QueryAuthenticationRequired',
  'Order.CartAccessDenied',
  'Order.CartNotFound',
  'Order.NotFound',
  'Order.IdempotencyConflict',
  'Order.VariantUnavailable',
  'Order.DuplicateVariant',
  'Order.CurrencyMismatch',
  'Order.CancelConflict',
];

/**
 * Whether `value` names an orders error code. Pure — throws nothing.
 */
export function isOrdersErrorCode(value: unknown): value is OrdersErrorCode {
  return typeof value === 'string' && (ORDERS_ERROR_CODES as readonly string[]).includes(value);
}

/**
 * Minimal normalized-failure view this module classifies — alias of the
 * shared `NormalizedFailure` (Refactoring Phase E: single status-first
 * shape across features; the domain-specific `isCancelConflictFailure`
 * stays here).
 */
export type OrdersFailure = NormalizedFailure;

/**
 * Whether the failure is a `400` validation rejection (bad key, empty
 * cart, bad address, bad list params). Delegates to the shared
 * classifier — Pure, throws nothing.
 */
export function isOrdersValidationFailure(failure: OrdersFailure | null | undefined): boolean {
  return isValidationFailure(failure);
}

/**
 * Whether the failure carries field-level validation messages (the 400
 * validation shape). Delegates to the shared classifier. Pure.
 */
export function hasOrdersFieldErrors(failure: OrdersFailure | null | undefined): boolean {
  return hasFieldErrors(failure);
}

/**
 * Whether the failure is an authentication failure (`401` — anonymous
 * call or expired session). Recovery is login/refresh, never retry.
 * Delegates to the shared classifier. Pure.
 */
export function isOrdersAuthFailure(failure: OrdersFailure | null | undefined): boolean {
  return isAuthFailure(failure);
}

/**
 * Whether the failure is an ownership rejection (`403 CartAccessDenied`
 * — cart belongs to another user/guest). Delegates to the shared
 * classifier. Pure.
 */
export function isOrdersAccessDeniedFailure(failure: OrdersFailure | null | undefined): boolean {
  return isAccessDeniedFailure(failure);
}

/**
 * Whether the failure is a missing order/cart (`404` — unknown id or
 * unknown/other-customer order on the read). Recovery is refetch or
 * back-to-list. Delegates to the shared classifier. Pure.
 */
export function isOrdersNotFoundFailure(failure: OrdersFailure | null | undefined): boolean {
  return isNotFoundFailure(failure);
}

/**
 * Whether the failure is a `409` conflict (idempotency reuse,
 * unavailable variant, duplicate line, currency mix, late cancel).
 * Never retried with the same input. Delegates to the shared
 * classifier. Pure.
 */
export function isOrdersConflictFailure(failure: OrdersFailure | null | undefined): boolean {
  return isConflictFailure(failure);
}

/**
 * Whether the failure is specifically a late cancel (`409` with the
 * `Order.CancelConflict` hint — the order left `Pending`). Prefers the
 * code hint when present, falls back to the `409` status. Pure — throws
 * nothing.
 */
export function isCancelConflictFailure(failure: OrdersFailure | null | undefined): boolean {
  if (!failure || failure.status !== 409) {
    return false;
  }
  if (failure.code === undefined) {
    return true;
  }
  return failure.code === 'Order.CancelConflict';
}
