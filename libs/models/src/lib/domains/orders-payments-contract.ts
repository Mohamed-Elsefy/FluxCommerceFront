/**
 * Admin Orders & Payments contract audit for Sub-Phase 14.1 —
 * Foundation & Backend Contract Alignment.
 *
 * Scope: `docs/phases/PHASE_14_ADMIN_ORDERS_PAYMENTS.md` §14.1
 * (contracts and boundaries only — no feature structure, no API service,
 * no state store, no components, no routes, no pages).
 *
 * Source of truth:
 * - `docs/frontend-contract/API_CONTRACT.md` §4 (orders) + §6 (payments).
 * - `docs/frontend-contract/DTO_REFERENCE.md` §4 (orders) + §6 (payments).
 * - `docs/frontend-contract/ENUM_REFERENCE.md` §3 (orders) + §5 (payments).
 * - `docs/frontend-contract/ERROR_CATALOG.md` §4 (orders) + §6 (payments).
 * - `docs/frontend-contract/PAGINATION_CONVENTION.md` (which lists paginate).
 * - `docs/frontend-contract/PAYMENT_INTEGRATION_NOTES.md` (SPA rules,
 *   order-poll proxy, client-secret path).
 *
 * Audited backend surface (the complete HTTP contract today —
 * Supplement S1 evolution applied):
 * - Customer orders (`[Route orders][Authorize]`, any authenticated JWT):
 *   `POST /orders/checkout` (customer flow, `Idempotency-Key` header
 *   required), `GET /orders` (paged, caller-owned only, newest-first,
 *   paging params plus optional `status`), `GET /orders/{orderId}`
 *   (ownership-masked `404`), `POST /orders/{orderId}/cancel`
 *   (`Pending`-only, ownership-masked `404`, `409 CancelConflict`).
 * - Admin orders (`[Route admin/orders]`, permission-gated):
 *   `GET /admin/orders` (paged, platform-wide, newest-first, paging
 *   plus `status`/`customerId`/`search`/`from`/`to`),
 *   `GET /admin/orders/counts`, `GET /admin/orders/{orderId}` (no
 *   ownership scoping), `POST /admin/orders/{orderId}/cancel`
 *   (force-cancel any `Pending` order), `POST
 *   /admin/orders/{orderId}/refund` (`RefundOrderRequest{reason}`,
 *   paid orders only, `409 RefundConflict` otherwise).
 * - Customer payments (`[Route api/payments][Authorize]`, note the
 *   inconsistent `api/` prefix): `GET /api/payments/{paymentId}`
 *   (ownership-masked `404`), `GET /api/payments/by-order/{orderId}`
 *   (live client secret, `409 NotReady/NotPayable`, `500
 *   ProviderUnavailable`), `GET /api/payments/mine` (paged,
 *   caller-owned, newest-first, paging plus optional `status`),
 *   `POST /api/payments/webhook` (Stripe→API only, never called by the
 *   SPA, never replicated).
 * - Admin payments (`[Route admin/payments]`, permission-gated):
 *   `GET /admin/payments` (paged, platform-wide, newest-first, paging
 *   plus `status`/`orderId`/`customerId`/`from`/`to`),
 *   `GET /admin/payments/stats` (totals + `totalsByCurrency`),
 *   `GET /admin/payments/{paymentId}` (no ownership scoping).
 *   Read-only: the admin never confirms cards and the live
 *   `clientSecret` is discarded at the mapping boundary.
 * - Order and payment `status` fields are STRINGS on the wire
 *   (`.ToString()`, never enums): `Pending|Cancelled|Confirmed` for
 *   orders, `Pending|Processing|Succeeded|Failed|Cancelled|Refunded` for
 *   payments. All timestamps in this slice are `DateTimeOffset`
 *   (ISO-8601 strings on the wire).
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - Canonical wire mirrors stay the single declaration site: order shapes
 *   live in `./orders`, payment shapes in `./payments`, the initialization
 *   result in `./payment-contract`, status unions in `../common/enums`.
 *   This module aliases them (`AdminOrderSummary`, `AdminPayment`, ...) —
 *   never re-declares — so no contract drift is possible.
 * - This module owns the audit-only additions: the supported-operation
 *   tables, the explicit unsupported-operation pins (no invented lists,
 *   filters, sorts, history, or mutations), the pagination/filtering/
 *   sorting capability matrix, the payment-linkage pin, the admin query
 *   shapes, the admin route-convention pins, the responsibility-boundary
 *   tables, and pure structural classifiers (status-first, never
 *   message-text-based, per `ERROR_CATALOG.md` §0).
 *
 * Backend-authoritative data rule (this sub-phase's core constraint):
 * this module performs NO order-state derivation, NO payment verification,
 * NO totals computation (no `unitPrice * quantity`, no subtotal math, no
 * float-math money helpers — `OrderMoneyResponse` and line-item flat
 * money fields echo verbatim for display only), NO status inference
 * (order `status` never implies payment `status` and vice versa), NO
 * customer-identity resolution (no `userId`/`customerId`/email exists on
 * any order payload), NO saga orchestration, NO webhook handling, and NO
 * idempotency-key minting. Client-side state is never treated as domain
 * truth — only the backend response speaks authoritatively.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 14.2 — no `features/orders/` folder, pages, components, routes.
 * - 14.3–14.5 — no orders list UI, pager wiring, filters, badges,
 *   details page, or address rendering.
 * - 14.6–14.8 — no payment section, `PaymentStatusBadge`, history UI,
 *   or provider integration.
 * - No API service, no `HttpClient`, no envelope mapping, no `ApiClient`
 *   usage, no request cancellation.
 * - No `@Injectable()` store, no signals/computeds, no state machine
 *   implementation (expectation tables only).
 *
 * This file is pure types + pure functions: no Angular imports, no
 * `HttpClient`, no browser APIs, no `localStorage`. Every helper is
 * SSR-safe, throws nothing, and performs no HTTP.
 */

import type { Guid } from '../common/shared-types';
import type { OrderStatus, PaymentStatus } from '../common/enums';
import type {
  CheckoutResponse,
  OrderAddressResponse,
  OrderDetailsResponse,
  OrderLineItemResponse,
  OrderMoneyResponse,
  OrderSummaryResponse,
} from './orders';
import type { PaymentResponse } from './payments';
import type { PaymentInitializationResult } from './payment-contract';

// ---------------------------------------------------------------------------
// Frontend domain models (aliases — the wire stays canonical)
// ---------------------------------------------------------------------------

/** Frontend admin order row. Alias of the canonical `OrderSummaryResponse`. */
export type AdminOrderSummary = OrderSummaryResponse;

/** Frontend admin order details. Alias of `OrderDetailsResponse`. */
export type AdminOrderDetails = OrderDetailsResponse;

/** Frontend admin order line item (split flat money fields, verbatim). */
export type AdminOrderLineItem = OrderLineItemResponse;

/** Frontend admin order address (shipping/billing echo, verbatim). */
export type AdminOrderAddress = OrderAddressResponse;

/** Frontend admin order money object (nested totals, verbatim). */
export type AdminOrderMoney = OrderMoneyResponse;

/** Frontend admin checkout handoff (customer-flow entry, verbatim). */
export type AdminCheckoutEntry = CheckoutResponse;

/**
 * Frontend admin payment model. Alias of the canonical `PaymentResponse`
 * (`GET /api/payments/{id}` payload) — re-exported, not re-declared.
 */
export type AdminPayment = PaymentResponse;

/**
 * Frontend admin payment-initialization model. Alias of the canonical
 * `PaymentInitializationResult` (`GET /api/payments/by-order/{orderId}`
 * payload) — the only path that yields a `paymentId` for a known order,
 * since no order payload carries payment fields.
 */
export type AdminPaymentInitialization = PaymentInitializationResult;

// ---------------------------------------------------------------------------
// Supported operations (audited — API_CONTRACT.md §§4/6)
// ---------------------------------------------------------------------------

/**
 * SPA-callable admin order path templates. `POST /orders/checkout` is
 * deliberately absent: it is the customer purchase flow (cart-owned,
 * `Idempotency-Key` required), never an admin operation. Supplement S1
 * added the `[Route admin/orders]` surface: the platform-wide list with
 * filters, the counts read, the unscoped details read, and the
 * force-cancel/refund mutations.
 */
export const ADMIN_CALLABLE_ORDER_ENDPOINTS = [
  '/orders',
  '/orders/{orderId}',
  '/orders/{orderId}/cancel',
  '/admin/orders',
  '/admin/orders/counts',
  '/admin/orders/{orderId}',
  '/admin/orders/{orderId}/cancel',
  '/admin/orders/{orderId}/refund',
] as const;

/** One SPA-callable admin order path template. */
export type AdminCallableOrderEndpoint = (typeof ADMIN_CALLABLE_ORDER_ENDPOINTS)[number];

/**
 * SPA-callable admin payment path templates. The webhook is Stripe→API
 * only and never appears here by design. Supplement S1 added the
 * `[Route admin/payments]` surface: the platform-wide list with filters,
 * the stats read, and the unscoped details read (all read-only — the
 * admin never confirms cards and the live `clientSecret` is discarded
 * at the mapping boundary).
 */
export const ADMIN_CALLABLE_PAYMENT_ENDPOINTS = [
  '/api/payments/{paymentId}',
  '/api/payments/by-order/{orderId}',
  '/admin/payments',
  '/admin/payments/stats',
  '/admin/payments/{paymentId}',
] as const;

/** One SPA-callable admin payment path template. */
export type AdminCallablePaymentEndpoint = (typeof ADMIN_CALLABLE_PAYMENT_ENDPOINTS)[number];

/**
 * Whether the SPA may call the given orders/payments path template.
 * `true` only for a listed order or payment read/mutation template —
 * checkout-from-admin and the webhook return `false`. Pure — throws
 * nothing.
 */
export function isAdminCallableOrdersPaymentsEndpoint(path: string | null | undefined): boolean {
  if (typeof path !== 'string') {
    return false;
  }
  return (
    (ADMIN_CALLABLE_ORDER_ENDPOINTS as readonly string[]).includes(path) ||
    (ADMIN_CALLABLE_PAYMENT_ENDPOINTS as readonly string[]).includes(path)
  );
}

// ---------------------------------------------------------------------------
// Explicitly unsupported operations (no invented capability — §14.1 gate)
// ---------------------------------------------------------------------------

/**
 * Order operations that DO NOT exist in the backend contract and must
 * never be implemented in the admin UI. Pinned so later sub-phases cannot
 * invent them. Supplement S1 unlocked the platform-wide list, its
 * filters, and cancel/refund mutations — those former pins live in
 * `SUPPLEMENT_S1_NEWLY_SUPPORTED_OPERATIONS` (see
 * `./contract-evolution-audit`), not here.
 */
export const UNSUPPORTED_ADMIN_ORDER_OPERATIONS = [
  'order-sorting',
  'order-customer-identity',
  'order-payment-linkage',
  'order-confirm',
  'checkout-from-admin',
] as const;

/** One explicitly unsupported admin order operation. */
export type UnsupportedAdminOrderOperation = (typeof UNSUPPORTED_ADMIN_ORDER_OPERATIONS)[number];

/**
 * Payment operations that DO NOT exist in the backend contract and must
 * never be implemented in the admin UI. Supplement S1 unlocked the
 * platform-wide list and its status filter — those former pins live in
 * `SUPPLEMENT_S1_NEWLY_SUPPORTED_OPERATIONS` (see
 * `./contract-evolution-audit`), not here. There is still no history
 * endpoint, no failed-payments query, and no admin payment mutation —
 * lists plus stats plus single-resource reads are the complete
 * supported surface.
 */
export const UNSUPPORTED_ADMIN_PAYMENT_OPERATIONS = [
  'payment-history',
  'failed-payments-list',
  'payment-create',
  'payment-confirm-admin',
  'payment-cancel-admin',
  'payment-refund-admin',
  'webhook-spa-call',
] as const;

/** One explicitly unsupported admin payment operation. */
export type UnsupportedAdminPaymentOperation =
  (typeof UNSUPPORTED_ADMIN_PAYMENT_OPERATIONS)[number];

/**
 * Whether `value` names an explicitly unsupported admin order operation.
 * Pure — throws nothing.
 */
export function isUnsupportedAdminOrderOperation(
  value: unknown,
): value is UnsupportedAdminOrderOperation {
  return (
    typeof value === 'string' &&
    (UNSUPPORTED_ADMIN_ORDER_OPERATIONS as readonly string[]).includes(value)
  );
}

/**
 * Whether `value` names an explicitly unsupported admin payment
 * operation. Pure — throws nothing.
 */
export function isUnsupportedAdminPaymentOperation(
  value: unknown,
): value is UnsupportedAdminPaymentOperation {
  return (
    typeof value === 'string' &&
    (UNSUPPORTED_ADMIN_PAYMENT_OPERATIONS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Pagination / filtering / sorting capability matrix
// ---------------------------------------------------------------------------

/**
 * The paginated reads in this slice, Supplement S1 matrix: the
 * caller-owned `GET /orders` (paging plus optional `status`), the
 * platform-wide `GET /admin/orders` (paging plus `status`/`customerId`/
 * `search`/`from`/`to`), the caller-owned `GET /api/payments/mine`
 * (paging plus optional `status`), and the platform-wide
 * `GET /admin/payments` (paging plus `status`/`orderId`/`customerId`/
 * `from`/`to`). All newest-first (`pageNumber >= 1`,
 * `1 <= pageSize <= 100`, defaults `1`/`20`). Single-resource payment
 * reads (`GET /api/payments/{id}`,
 * `GET /api/payments/by-order/{orderId}`, `GET /admin/payments/stats`,
 * `GET /admin/payments/{id}`) must never be wrapped in pager logic.
 */
export const PAGINATED_ADMIN_ORDERS_READS = [
  'listOrders',
  'listAdminOrders',
  'listMine',
  'listAdminPayments',
] as const;

/** One paginated admin orders/payments read. */
export type PaginatedAdminOrdersRead = (typeof PAGINATED_ADMIN_ORDERS_READS)[number];

/**
 * Admin-consumed orders/payments reads that return single resources
 * (never `PagedResult`): order details, order cancel (returns the updated
 * `OrderDetailsResponse`), payment status, payment by-order, payment
 * stats, admin payment details.
 */
export const NON_PAGINATED_ADMIN_ORDERS_READS = [
  'orderDetails',
  'cancelOrder',
  'paymentStatus',
  'paymentByOrder',
  'paymentStats',
  'getAdminPayment',
] as const;

/** One non-paginated admin orders/payments read. */
export type NonPaginatedAdminOrdersRead = (typeof NON_PAGINATED_ADMIN_ORDERS_READS)[number];

/**
 * Whether the named admin orders read paginates (`PagedResult` envelope).
 * Pure — throws nothing.
 */
export function isPaginatedAdminOrdersRead(value: unknown): value is PaginatedAdminOrdersRead {
  return (
    typeof value === 'string' && (PAGINATED_ADMIN_ORDERS_READS as readonly string[]).includes(value)
  );
}

/**
 * Sorting support: NO orders or payments read accepts `sortBy`/
 * `sortDirection` (`GET /orders` is fixed newest-first; payment reads are
 * single-resource). Always `false` — pinned so 14.4 cannot invent a sort
 * control. Pure — throws nothing.
 */
export function supportsAdminOrdersSorting(_read: string | null | undefined): boolean {
  return false;
}

/**
 * Filtering support, Supplement S1 matrix: `listAdminOrders` accepts
 * `status`/`customerId`/`search`/`from`/`to` and `listOrders` accepts
 * `status` (unknown values and `from > to` → backend `400`). Every
 * other order read takes ids only. Pure — throws nothing.
 */
export function supportsAdminOrdersFiltering(read: string | null | undefined): boolean {
  return read === 'listOrders' || read === 'listAdminOrders';
}

/**
 * Payment filtering support, Supplement S1 matrix: `listAdminPayments`
 * accepts `status`/`orderId`/`customerId`/`from`/`to` and `listMine`
 * accepts `status` (unknown values and `from > to` → backend `400
 * Payment.ValidationFailed`). Every other payment read takes ids only
 * or nothing (`paymentStats`). Pure — throws nothing.
 */
export function supportsAdminPaymentsFiltering(read: string | null | undefined): boolean {
  return read === 'listMine' || read === 'listAdminPayments';
}

/**
 * Paging bounds shared by the single paginated read
 * (`pageNumber >= 1`, `1 <= pageSize <= 100`, defaults `1`/`20`).
 * Structural pre-check only — never a substitute for the backend
 * `400 Order.ValidationFailed` on violation. Pure — throws nothing.
 */
export function isValidAdminOrdersPagingQuery(
  query: { pageNumber?: number | null; pageSize?: number | null } | null | undefined,
): boolean {
  if (query === null || query === undefined) {
    return true;
  }
  const { pageNumber, pageSize } = query;
  if (pageNumber !== undefined && pageNumber !== null) {
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      return false;
    }
  }
  if (pageSize !== undefined && pageSize !== null) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Admin query shapes (transport only — no backend logic)
// ---------------------------------------------------------------------------

/**
 * Admin order-list query. Customer `GET /orders` accepts paging plus an
 * optional `status` filter (caller-owned only); admin
 * `GET /admin/orders` accepts paging plus `status`/`customerId`/`search`
 * (`order-number` substring)/`from`/`to` (platform-wide, newest-first).
 * Unknown `status` or `from > to` → backend `400`. Nulls/omission mean
 * "server default" (`pageNumber 1`, `pageSize 20`).
 */
export interface AdminOrderListQuery {
  readonly pageNumber?: number;
  readonly pageSize?: number;
  readonly status?: string;
  readonly customerId?: string;
  readonly search?: string;
  readonly from?: string;
  readonly to?: string;
}

/**
 * Admin order-details query: the order id only
 * (`GET /orders/{orderId}` takes no other params; other-customer ids mask
 * as `404`).
 */
export interface AdminOrderDetailsQuery {
  readonly orderId: Guid;
}

/**
 * Admin payment-status query: the payment id only
 * (`GET /api/payments/{paymentId}` takes no other params; the id arrives
 * via the by-order read because no order payload carries payment fields).
 */
export interface AdminPaymentStatusQuery {
  readonly paymentId: Guid;
}

/**
 * Admin payment by-order query: the order id only
 * (`GET /api/payments/by-order/{orderId}` takes no other params;
 * `409 NotReady` means saga lag — poll/retry; `409 NotPayable` means the
 * payment is terminal).
 */
export interface AdminPaymentByOrderQuery {
  readonly orderId: Guid;
}

/**
 * Structural pre-check for an order-details query: a non-blank id.
 * Pure — throws nothing.
 */
export function isValidAdminOrderDetailsQuery(
  query: AdminOrderDetailsQuery | null | undefined,
): boolean {
  return (
    query !== null &&
    query !== undefined &&
    typeof query.orderId === 'string' &&
    query.orderId.trim() !== ''
  );
}

/**
 * Structural pre-check for a payment-status query: a non-blank id.
 * Pure — throws nothing.
 */
export function isValidAdminPaymentStatusQuery(
  query: AdminPaymentStatusQuery | null | undefined,
): boolean {
  return (
    query !== null &&
    query !== undefined &&
    typeof query.paymentId === 'string' &&
    query.paymentId.trim() !== ''
  );
}

/**
 * Structural pre-check for a payment by-order query: a non-blank id.
 * Pure — throws nothing.
 */
export function isValidAdminPaymentByOrderQuery(
  query: AdminPaymentByOrderQuery | null | undefined,
): boolean {
  return (
    query !== null &&
    query !== undefined &&
    typeof query.orderId === 'string' &&
    query.orderId.trim() !== ''
  );
}

// ---------------------------------------------------------------------------
// Order / payment status tables (strings on the wire — ENUM_REFERENCE §§3/5)
// ---------------------------------------------------------------------------

/** Backend order statuses (`OrderStatus.ToString()` on the wire). */
export const ADMIN_ORDER_STATUSES = ['Pending', 'Cancelled', 'Confirmed'] as const;

/** One backend order status. */
export type AdminOrderStatus = (typeof ADMIN_ORDER_STATUSES)[number];

/** Backend payment statuses (`PaymentStatus.ToString()` on the wire). */
export const ADMIN_PAYMENT_STATUSES = [
  'Pending',
  'Processing',
  'Succeeded',
  'Failed',
  'Cancelled',
  'Refunded',
] as const;

/** One backend payment status. */
export type AdminPaymentStatus = (typeof ADMIN_PAYMENT_STATUSES)[number];

/** Terminal order statuses: polling may stop. */
export const TERMINAL_ADMIN_ORDER_STATUSES: readonly OrderStatus[] = ['Cancelled', 'Confirmed'];

/** Terminal payment statuses: polling may stop. */
export const TERMINAL_ADMIN_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'Succeeded',
  'Failed',
  'Cancelled',
  'Refunded',
];

/**
 * Whether `value` names a backend order status. Pure — throws nothing.
 */
export function isAdminOrderStatus(value: unknown): value is AdminOrderStatus {
  return typeof value === 'string' && (ADMIN_ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Whether `value` names a backend payment status. Pure — throws nothing.
 */
export function isAdminPaymentStatus(value: unknown): value is AdminPaymentStatus {
  return typeof value === 'string' && (ADMIN_PAYMENT_STATUSES as readonly string[]).includes(value);
}

/**
 * Whether the order status is terminal (`Cancelled | Confirmed`).
 * Unknown future strings count as non-terminal (keep polling — see
 * `ENUM_REFERENCE.md` §8). Pure — throws nothing.
 */
export function isTerminalAdminOrderStatus(status: OrderStatus | string): boolean {
  return (TERMINAL_ADMIN_ORDER_STATUSES as readonly string[]).includes(status);
}

/**
 * Whether the order is still actionable (`Pending` — the only status the
 * `cancel` endpoint accepts). Pure — throws nothing.
 */
export function isPendingAdminOrderStatus(status: OrderStatus | string): boolean {
  return status === 'Pending';
}

/**
 * Whether the payment status is terminal (`Succeeded | Failed |
 * Cancelled | Refunded`). Unknown future strings count as non-terminal
 * (keep polling). Pure — throws nothing.
 */
export function isTerminalAdminPaymentStatus(status: PaymentStatus | string): boolean {
  return (TERMINAL_ADMIN_PAYMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * Whether the payment is backend-confirmed paid (`Succeeded` → order
 * `Confirmed`). The ONLY success signal — an order-poll proxy or a
 * provider-side confirmation without this is not finality. Pure — throws
 * nothing.
 */
export function isSuccessfulAdminPaymentStatus(status: PaymentStatus | string): boolean {
  return status === 'Succeeded';
}

/**
 * Whether the payment is a failure the customer may retry from
 * (`Failed | Cancelled`). `Refunded` is post-pay compensation, not a
 * retry signal. Pure — throws nothing.
 */
export function isFailedAdminPaymentStatus(status: PaymentStatus | string): boolean {
  return status === 'Failed' || status === 'Cancelled';
}

/**
 * Projects the status out of an admin order payload. Pure — throws
 * nothing, performs no HTTP, derives nothing.
 */
export function adminOrderStatusOf(
  order: AdminOrderDetails | AdminOrderSummary | null | undefined,
): OrderStatus | null {
  return order?.status ?? null;
}

/**
 * Projects the status out of an admin payment payload. Pure — throws
 * nothing, performs no HTTP, verifies nothing.
 */
export function adminPaymentStatusOf(
  payment: AdminPayment | null | undefined,
): PaymentStatus | null {
  return payment?.status ?? null;
}

// ---------------------------------------------------------------------------
// Admin route & naming conventions (§14.1: confirm with the Admin app)
// ---------------------------------------------------------------------------

/**
 * Admin feature route segments for Phase 14, mounted as lazy children of
 * the guarded portal shell (`apps/admin/.../features/<feature>/`,
 * `loadChildren` boundaries, `Admin`/`SuperAdmin` via the existing
 * `authGuard` + `roleGuard` chain from `ADMIN_PORTAL_ROLES` — no separate
 * admin auth system; backend authorization stays authoritative).
 * Business pages (14.2+) arrive with their sub-phases; this table pins the
 * segments so later work cannot invent parallel top-level paths.
 *
 * Payment presentation stays inside the Orders feature unless the
 * contract and UI complexity justify a separate feature (per
 * `PHASE_14_ADMIN_ORDERS_PAYMENTS.md` §14.6) — the `payments` segment is
 * reserved for that case only.
 */
export const ADMIN_PHASE_14_ROUTES = {
  orders: 'orders',
  payments: 'payments',
} as const;

/** One Phase 14 admin feature route segment. */
export type AdminPhase14Route = (typeof ADMIN_PHASE_14_ROUTES)[keyof typeof ADMIN_PHASE_14_ROUTES];

/**
 * Whether `value` names a Phase 14 admin feature route segment.
 * Pure — throws nothing.
 */
export function isAdminPhase14Route(value: unknown): value is AdminPhase14Route {
  return (
    typeof value === 'string' &&
    (Object.values(ADMIN_PHASE_14_ROUTES) as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Error-code classifiers (status-first, ERROR_CATALOG.md §§4/6)
// ---------------------------------------------------------------------------

/**
 * Minimal normalized-failure view this module classifies: an HTTP `status`
 * plus the best-effort `code`. Compatible with the Phase 1 `ApiError`
 * without importing it (keeps this module free of class-valued imports —
 * types only). Note the wire reality (`ERROR_CATALOG.md` §0): business
 * errors carry NO machine `code` on the wire (`extensions: {}`) — only
 * the localized `detail` — so every classifier below branches on `status`
 * first and treats `code` as a development-time hint. Payment failures
 * additionally have zero `CodeToKey` entries backend-side (all fall back
 * to English descriptions).
 */
export interface AdminOrdersPaymentsFailure {
  readonly status: number;
  readonly code?: string;
}

/**
 * Whether the failure is a missing entity (`404` — unknown order id,
 * unknown payment id, OR other-customer id, IDOR-masked with a
 * server-side warning log for payments). Never probe ids on this path.
 * Pure — throws nothing.
 */
export function isAdminOrdersNotFoundFailure(
  failure: AdminOrdersPaymentsFailure | null | undefined,
): boolean {
  return failure?.status === 404;
}

/**
 * Whether the failure is a domain conflict (`409` — `IdempotencyConflict`,
 * `VariantUnavailable`, `CurrencyMismatch`, `DuplicateVariant`,
 * `CancelConflict`, `NotReady`, `NotPayable`, `DuplicateIntent`,
 * terminal-state payment writes). Recovery is input change or timed
 * retry (for `NotReady` saga lag), never blind retry. Pure — throws
 * nothing.
 */
export function isAdminOrdersConflictFailure(
  failure: AdminOrdersPaymentsFailure | null | undefined,
): boolean {
  return failure?.status === 409;
}

/**
 * Whether the failure is a validation failure (`400` with an
 * `errors{field:[msg]}` map — `DataAnnotations` + domain for orders,
 * intent-request guards for payments). Field keys are DTO property names;
 * display `detail` + the map, never raw codes. Pure — throws nothing.
 */
export function isAdminOrdersValidationFailure(
  failure: AdminOrdersPaymentsFailure | null | undefined,
): boolean {
  return failure?.status === 400;
}

/**
 * Whether the failure is an authorization failure (`401` anonymous/expired
 * JWT → login/refresh; `403` non-admin role or foreign cart → `/forbidden`
 * / ownership handling). Guards stay UX-only; the backend stays
 * authoritative. Pure — throws nothing.
 */
export function isAdminOrdersAuthFailure(
  failure: AdminOrdersPaymentsFailure | null | undefined,
): boolean {
  return failure?.status === 401 || failure?.status === 403;
}

// ---------------------------------------------------------------------------
// Responsibility boundary (Admin UX vs. Backend Truth)
// ---------------------------------------------------------------------------

/**
 * Frontend-owned admin concerns (Phase 14 principle: Angular presents the
 * order/payment workflow and owns provider-adjacent display). Presentation,
 * feature state, and navigation only — no truth, no orchestration.
 */
export const FRONTEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES = [
  'orders-ux',
  'payment-presentation',
  'feature-state',
  'loading-error-handling',
  'navigation',
  'notifications',
] as const;

/** One frontend-owned admin concern. */
export type FrontendAdminOrdersPaymentsResponsibility =
  (typeof FRONTEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES)[number];

/**
 * Backend-owned orders/payments concerns (Phase 14 principle: the backend
 * owns order/payment truth and business orchestration). The SPA must never
 * duplicate any of these — no totals math, no status derivation, no
 * payment verification, no saga management, no webhook handling, no
 * compensation.
 */
export const BACKEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES = [
  'order-state',
  'payment-state',
  'payment-verification',
  'status-transitions',
  'pricing-rules',
  'inventory-coordination',
  'saga-orchestration',
  'compensation',
  'webhook-processing',
  'idempotency',
  'validation',
  'authorization',
  'ownership',
] as const;

/** One backend-owned admin concern. */
export type BackendAdminOrdersPaymentsResponsibility =
  (typeof BACKEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES)[number];

/**
 * Whether `value` names a frontend-owned admin concern. Pure — throws
 * nothing.
 */
export function isFrontendAdminOrdersPaymentsResponsibility(
  value: unknown,
): value is FrontendAdminOrdersPaymentsResponsibility {
  return (
    typeof value === 'string' &&
    (FRONTEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES as readonly string[]).includes(value)
  );
}

/**
 * Whether `value` names a backend-owned admin concern — and therefore
 * something the SPA must never implement. Pure — throws nothing.
 */
export function isBackendAdminOrdersPaymentsResponsibility(
  value: unknown,
): value is BackendAdminOrdersPaymentsResponsibility {
  return (
    typeof value === 'string' &&
    (BACKEND_ADMIN_ORDERS_PAYMENTS_RESPONSIBILITIES as readonly string[]).includes(value)
  );
}
