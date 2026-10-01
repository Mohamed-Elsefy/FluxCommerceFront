/**
 * Supplement S1 contract audit for Step S1.1 —
 * Foundation & Backend Contract Alignment (contract gate).
 *
 * Scope: `docs/phases/SUPPLEMENT_S1_BACKEND_CONTRACT_EVOLUTION.md` §S1.1
 * (contracts and boundaries only — no feature structure, no API service,
 * no state store, no components, no routes, no pages).
 *
 * Source of truth (staged `docs/frontend-contract/` diff, ~319 insertions):
 * - `API_CONTRACT.md` §0.4/§0.5 (permission catalog) + §1.14–1.21 (identity
 *   growth) + §2 (catalog.manage) + §4.5 (admin orders) + §5 (inventory
 *   lists) + §6.5 (admin payments) + §8 (dashboard).
 * - `AUTH_FLOW.md` (permission claims + endpoint matrix).
 * - `DTO_REFERENCE.md` §1 (profile/permission/user shapes) + §4 (refund,
 *   counts) + §5 (inventory counts) + §6 (payment admin shapes) + §8
 *   (dashboard composition).
 * - `ENUM_REFERENCE.md` (Permissions strings + `RefundRequestOutcome`).
 * - `ERROR_CATALOG.md` (5 new codes).
 * - `PAGINATION_CONVENTION.md` (6 new paginated rows).
 * - `PAYMENT_INTEGRATION_NOTES.md` (webhook amount/currency match +
 *   `payment_initiated` event, §4 wording).
 *
 * Audited backend surface (the complete NEW HTTP surface):
 * - Identity: `PUT /auth/profile` (any JWT), `GET /admin/users`
 *   (paged + `status/role/search`, newest-first, SuperAdmin),
 *   `GET /admin/users/counts` (SuperAdmin),
 *   `GET /admin/users/{id}` (SuperAdmin),
 *   `POST /admin/users/{id}/permissions` (SuperAdmin, `409
 *   PermissionAlreadyGranted`), `DELETE
 *   /admin/users/{id}/permissions/{permission}` (SuperAdmin, idempotent),
 *   `GET /admin/users/{id}/permissions` (SuperAdmin),
 *   `GET /admin/users/permissions` (SuperAdmin, full catalog).
 * - Catalog: all writes `[Authorize(catalog.manage)]` (was `AdminPolicy`);
 *   reads stay anonymous. `UpdateProductVariantRequest` gains
 *   `unitPriceAmount?/currency?/status?` (amount+currency paired).
 * - Orders: customer `GET /orders` gains `status?`; new
 *   `[Route admin/orders]`: `GET /admin/orders` (filters
 *   `status/customerId/search/from/to`, newest-first, `orders.read`),
 *   `GET /admin/orders/counts` (`orders.read`),
 *   `GET /admin/orders/{id}` (no ownership scoping, `orders.read`),
 *   `POST /admin/orders/{id}/cancel` (force-cancel any Pending,
 *   `orders.cancel`), `POST /admin/orders/{id}/refund`
 *   (`RefundOrderRequest{reason 1..500}`, `orders.refund`, async saga).
 * - Inventory: reads → `inventory.read`, writes → `inventory.manage`; new
 *   `GET /inventory` (`pageNumber/pageSize/search/maxAvailable`, by SKU),
 *   `GET /inventory/counts` (`lowStockThreshold=5`),
 *   `GET /inventory/reservations`
 *   (`pageNumber/pageSize/status/sku/orderId`, newest-first).
 * - Payments: new `GET /api/payments/mine` (`pageNumber/pageSize/status?`,
 *   caller-owned); new `[Route admin/payments]`:
 *   `GET /admin/payments` (`pageNumber/pageSize/status/orderId/customerId/
 *   from/to`, `payments.read`), `GET /admin/payments/stats`
 *   (`payments.stats`), `GET /admin/payments/{id}` (`payments.read`).
 *   Webhook stays Stripe→API only.
 * - Dashboard: `GET /admin/dashboard?lowStockThreshold=5` →
 *   `AdminDashboardResponse` (`dashboard.read`).
 * - Statuses stay STRINGS on the wire; new-slice timestamps are
 *   `DateTimeOffset` (ISO-8601 strings); pagination `1/20 max 100`.
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - This module declares the NEW audited wire mirrors
 *   (`UpdateProfileRequest`, `GrantPermissionRequest`,
 *   `UserAdminResponse`, `UserAdminCountsResponse`,
 *   `AdminOrderCountsResponse`, `RefundOrderRequest`,
 *   `InventoryCountsResponse`, `PaymentAdminResponse`,
 *   `PaymentAdminStatsResponse`, `AdminDashboardResponse`).
 *   Step S1.2 relocates the canonical declarations into `domains/*`
 *   (`identity`, `orders`, `payments`, `inventory`, new `dashboard`) and
 *   these become aliases — never duplicated.
 * - This module owns the audit-only additions: the permission catalog, the
 *   permission→endpoint matrix, the SuperAdmin-only table, the callable
 *   endpoint tables, the pagination/filter/sort matrix, the newly-supported
 *   pins (delta vs the 14.1 `UNSUPPORTED_*` tables), the still-unsupported
 *   pins, the query shapes + structural pre-checks, the route pins, the
 *   responsibility-boundary tables, and pure status-first classifiers.
 *
 * Backend-authoritative data rule (this step's core constraint):
 * this module performs NO permission derivation, NO totals computation, NO
 * status inference (order `status` never implies payment `status`), NO
 * customer-identity resolution, NO saga orchestration, NO webhook
 * handling, and NO idempotency-key minting. Client-side state is never
 * treated as domain truth.
 *
 * Explicitly out of scope (later steps, must not appear here):
 * - S1.2 — no `domains/*` edits, no `api-endpoints.ts` edits, no
 *   `IdentityApiService` methods.
 * - S1.3 — no `permissionGuard`, no `AuthService` changes, no navigation.
 * - S1.4–S1.10 — no forms, pages, states, badges, or dashboard UI.
 * - No `@Injectable()` store, no signals/computeds, no `HttpClient`.
 *
 * This file is pure types + pure functions: no Angular imports, no
 * `HttpClient`, no browser APIs, no `localStorage`. Every helper is
 * SSR-safe, throws nothing, and performs no HTTP.
 *
 * File naming note: this module is `supplement-s1-contract.ts` (not
 * `s1-admin-…`) because the workspace ESLint `**admin**` import guard
 * matches any specifier containing that substring — even a
 * library-internal filename — and would false-positive (same reason as
 * ADR-027/029). Exported symbol names keep the descriptive wording; only
 * the filename avoids the substring.
 */

import type { Guid, IsoDateString } from '../common/shared-types';
import type { OrderStatus, PaymentStatus, UserRole, UserStatus } from '../common/enums';
import { VariantStatus } from '../common/enums';

// ---------------------------------------------------------------------------
// Permission catalog (API_CONTRACT.md §0.5, ENUM_REFERENCE.md Permissions)
// ---------------------------------------------------------------------------

/**
 * Action-level permission catalog (backend Phase 21,
 * `Identity.Domain.Aggregates.PermissionCatalog`, JWT claim type
 * `"permission"` — one claim per grant). Assigning the `Admin` role stores
 * the full bundle; grants apply on the next login/refresh; `SuperAdmin`
 * bypasses every gate without holding permissions.
 */
export const SUPPLEMENT_S1_PERMISSIONS = [
  'orders.read',
  'orders.cancel',
  'orders.refund',
  'payments.read',
  'payments.stats',
  'inventory.read',
  'inventory.manage',
  'catalog.manage',
  'dashboard.read',
] as const;

/** One action-level permission value. */
export type SupplementS1Permission = (typeof SUPPLEMENT_S1_PERMISSIONS)[number];

/**
 * Whether `value` names a catalog permission. Pure — throws nothing.
 */
export function isSupplementS1Permission(value: unknown): value is SupplementS1Permission {
  return (
    typeof value === 'string' && (SUPPLEMENT_S1_PERMISSIONS as readonly string[]).includes(value)
  );
}

/**
 * Permission → SPA-callable endpoints matrix (API_CONTRACT.md §0.5).
 * Enforcement failure → `403` (no `extensions.code` — match `status` +
 * endpoint context). Pure data — throws nothing.
 */
export const SUPPLEMENT_S1_PERMISSION_ENDPOINTS: Record<SupplementS1Permission, readonly string[]> =
  {
    'orders.read': ['/orders-list', '/orders/{orderId}', '/orders/counts'],
    'orders.cancel': ['/orders/{orderId}/cancel'],
    'orders.refund': ['/orders/{orderId}/refund'],
    'payments.read': ['/payments', '/payments/{paymentId}'],
    'payments.stats': ['/payments/stats'],
    'inventory.read': ['GET /inventory/**'],
    'inventory.manage': ['POST /inventory', 'PATCH /inventory/{sku}'],
    'catalog.manage': ['catalog writes (reads stay anonymous)'],
    'dashboard.read': ['/dashboard'],
  };

/**
 * Endpoints only `SuperAdmin` may call (user/permission management itself
 * plus `register-admin`): no permission value grants these. Pure data.
 */
export const SUPPLEMENT_S1_SUPERADMIN_ONLY_ENDPOINTS = [
  'POST /auth/register-admin',
  'GET /users',
  'GET /users/counts',
  'GET /users/{id}',
  'POST /users/{id}/roles',
  'POST /users/{id}/permissions',
  'DELETE /users/{id}/permissions/{permission}',
  'GET /users/{id}/permissions',
  'GET /users/permissions',
] as const;

/** One SuperAdmin-only endpoint path. */
export type SupplementS1SuperAdminOnlyEndpoint =
  (typeof SUPPLEMENT_S1_SUPERADMIN_ONLY_ENDPOINTS)[number];

/**
 * Whether `value` names a SuperAdmin-only endpoint. Pure — throws nothing.
 */
export function isSupplementS1SuperAdminOnlyEndpoint(
  value: unknown,
): value is SupplementS1SuperAdminOnlyEndpoint {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S1_SUPERADMIN_ONLY_ENDPOINTS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// SPA-callable endpoint tables (audited backend surface)
// ---------------------------------------------------------------------------

/**
 * New identity endpoints callable by the SPA. `PUT /auth/profile` takes any
 * authenticated JWT; the rest are `SuperAdmin`-only. Pure data.
 */
export const SUPPLEMENT_S1_CALLABLE_IDENTITY_ENDPOINTS = [
  'PUT /auth/profile',
  'GET /users',
  'GET /users/counts',
  'GET /users/{id}',
  'POST /users/{id}/permissions',
  'DELETE /users/{id}/permissions/{permission}',
  'GET /users/{id}/permissions',
  'GET /users/permissions',
] as const;

/**
 * New order endpoints callable by the SPA. The five `/orders/*` rows are
 * the `[Route admin/orders]` surface (permission-gated); `GET /orders`
 * gains the `status` filter for the caller-owned customer list. Pure data.
 */
export const SUPPLEMENT_S1_CALLABLE_ORDER_ENDPOINTS = [
  'GET /orders',
  'GET /orders-list',
  'GET /orders/counts',
  'GET /orders/{orderId}',
  'POST /orders/{orderId}/cancel',
  'POST /orders/{orderId}/refund',
] as const;

/**
 * New payment endpoints callable by the SPA. `GET /api/payments/mine` is
 * caller-owned (customer); the three `/payments` rows are the
 * `[Route admin/payments]` surface (permission-gated, read-only, no
 * Stripe calls). The webhook is Stripe→API only and never appears here.
 * Pure data.
 */
export const SUPPLEMENT_S1_CALLABLE_PAYMENT_ENDPOINTS = [
  'GET /api/payments/mine',
  'GET /payments',
  'GET /payments/stats',
  'GET /payments/{paymentId}',
] as const;

/**
 * New inventory endpoints callable by the SPA (`inventory.read`; writes
 * stay `POST /inventory` + `PATCH /inventory/{sku}` under
 * `inventory.manage`). Pure data.
 */
export const SUPPLEMENT_S1_CALLABLE_INVENTORY_ENDPOINTS = [
  'GET /inventory',
  'GET /inventory/counts',
  'GET /inventory/reservations',
] as const;

/** The single dashboard endpoint (`dashboard.read`). Pure data. */
export const SUPPLEMENT_S1_CALLABLE_DASHBOARD_ENDPOINTS = ['GET /dashboard'] as const;

/**
 * Whether `value` names any Supplement S1 SPA-callable endpoint.
 * Pure — throws nothing.
 */
export function isSupplementS1CallableEndpoint(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const tables: readonly (readonly string[])[] = [
    SUPPLEMENT_S1_CALLABLE_IDENTITY_ENDPOINTS,
    SUPPLEMENT_S1_CALLABLE_ORDER_ENDPOINTS,
    SUPPLEMENT_S1_CALLABLE_PAYMENT_ENDPOINTS,
    SUPPLEMENT_S1_CALLABLE_INVENTORY_ENDPOINTS,
    SUPPLEMENT_S1_CALLABLE_DASHBOARD_ENDPOINTS,
  ];
  return tables.some((table) => (table as readonly string[]).includes(value));
}

// ---------------------------------------------------------------------------
// Newly-supported pins (delta vs the 14.1 / 13.1 UNSUPPORTED_* tables)
// ---------------------------------------------------------------------------

/**
 * Operations the 14.1/13.1 audits pinned as unsupported that the evolved
 * contract now supports. S1.8–S1.10 flip these pins; anything absent from
 * both this list and the still-unsupported list below must be re-audited
 * in S1.1 before implementation. Pure data.
 */
export const SUPPLEMENT_S1_NEWLY_SUPPORTED_OPERATIONS = [
  'orders-list-all',
  'order-status-filter',
  'order-customer-filter',
  'order-date-filter',
  'order-search',
  'order-force-cancel',
  'order-refund',
  'payment-list',
  'payment-status-filter',
  'inventory-stock-list',
  'inventory-reservation-list',
  'inventory-counts',
  'user-list',
  'user-permission-manage',
  'profile-edit',
  'dashboard-snapshot',
] as const;

/** One newly-supported operation. */
export type SupplementS1NewlySupportedOperation =
  (typeof SUPPLEMENT_S1_NEWLY_SUPPORTED_OPERATIONS)[number];

/**
 * Operations that remain unsupported after the evolution and must never
 * be implemented or simulated: no payment history/timeline endpoint, no
 * SPA webhook call, no admin-driven checkout. Pure data.
 */
export const SUPPLEMENT_S1_STILL_UNSUPPORTED_OPERATIONS = [
  'payment-history',
  'payment-timeline',
  'webhook-spa-call',
  'checkout-from-admin',
] as const;

/** One still-unsupported operation. */
export type SupplementS1StillUnsupportedOperation =
  (typeof SUPPLEMENT_S1_STILL_UNSUPPORTED_OPERATIONS)[number];

/**
 * Whether `value` names a newly-supported operation. Pure — throws nothing.
 */
export function isSupplementS1NewlySupportedOperation(
  value: unknown,
): value is SupplementS1NewlySupportedOperation {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S1_NEWLY_SUPPORTED_OPERATIONS as readonly string[]).includes(value)
  );
}

/**
 * Whether `value` names a still-unsupported operation. Pure — throws nothing.
 */
export function isSupplementS1StillUnsupportedOperation(
  value: unknown,
): value is SupplementS1StillUnsupportedOperation {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S1_STILL_UNSUPPORTED_OPERATIONS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Pagination / filtering / sorting capability matrix
// ---------------------------------------------------------------------------

/**
 * Paginated reads in the supplement slice (all `pageNumber >= 1`,
 * `1 <= pageSize <= 100`, defaults `1`/`20`). Single-resource reads
 * (`GET /orders/{id}`, `GET /payments/{id}`, `GET /users/{id}`,
 * `GET /dashboard`, `GET /inventory/counts`, `GET /orders/counts`,
 * `GET /users/counts`, `GET /payments/stats`) must never be wrapped in
 * pager logic. Pure data.
 */
export const SUPPLEMENT_S1_PAGINATED_READS = [
  'userList',
  'orderList',
  'paymentList',
  'paymentsMine',
  'inventoryList',
  'reservationList',
] as const;

/** One paginated supplement read. */
export type SupplementS1PaginatedRead = (typeof SUPPLEMENT_S1_PAGINATED_READS)[number];

/**
 * Whether the named supplement read paginates (`PagedResult` envelope).
 * Pure — throws nothing.
 */
export function isSupplementS1PaginatedRead(value: unknown): value is SupplementS1PaginatedRead {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S1_PAGINATED_READS as readonly string[]).includes(value)
  );
}

/**
 * Sorting support: NO supplement read accepts `sortBy`/`sortDirection`
 * (orders/payments/reservations/users are fixed newest-first; inventory
 * items are fixed by SKU). Always `false` — pinned so S1.7–S1.10 cannot
 * invent a sort control. Pure — throws nothing.
 */
export function supportsSupplementS1Sorting(_read: string | null | undefined): boolean {
  return false;
}

/**
 * Filter params supported per supplement read. Empty array means paging
 * only. Pure data — throws nothing.
 */
export const SUPPLEMENT_S1_READ_FILTERS: Record<SupplementS1PaginatedRead, readonly string[]> = {
  userList: ['status', 'role', 'search'],
  orderList: ['status', 'customerId', 'search', 'from', 'to'],
  paymentList: ['status', 'orderId', 'customerId', 'from', 'to'],
  paymentsMine: ['status'],
  inventoryList: ['search', 'maxAvailable'],
  reservationList: ['status', 'sku', 'orderId'],
};

/**
 * Whether the named supplement read supports backend filtering.
 * Pure — throws nothing.
 */
export function supportsSupplementS1Filtering(read: string | null | undefined): boolean {
  if (typeof read !== 'string') {
    return false;
  }
  const filters = (SUPPLEMENT_S1_READ_FILTERS as Record<string, readonly string[]>)[read];
  return filters !== undefined && filters.length > 0;
}

// ---------------------------------------------------------------------------
// New wire mirrors (audited DTOs — S1.2 relocates these into domains/*)
// ---------------------------------------------------------------------------

/**
 * `PUT /auth/profile` body (any authenticated JWT). All fields nullable:
 * `null` keeps the current value, empty clears optional fields
 * (phone/avatar). Wire casing is camelCase.
 */
export interface SupplementUpdateProfileRequest {
  readonly firstName?: string | null;
  readonly lastName?: string | null;
  readonly phoneNumber?: string | null;
  readonly avatarUrl?: string | null;
  readonly preferredLanguage?: string | null;
  readonly timeZone?: string | null;
}

/**
 * `POST /users/{id}/permissions` body (SuperAdmin only). The user id
 * travels in the route, never in the body — one catalog value per call.
 */
export interface SupplementGrantPermissionRequest {
  readonly permission: SupplementS1Permission;
}

/**
 * `GET /auth/me` extension: the authoritative permission list used for
 * menu rendering. Identity `UserResponse` gains this field in S1.2.
 */
export interface SupplementUserPermissions {
  readonly permissions: string[];
}

/**
 * `GET /users/{id}` + `GET /users` item payload: `UserResponse` plus
 * lockout telemetry. `failedAccessAttemptCount: int`,
 * `lockoutEndUtc?: DateTime|null`, `isLocked: bool`.
 */
export interface SupplementUserRecord {
  readonly id: Guid;
  readonly email: string;
  readonly roles: string[];
  readonly isEmailVerified: boolean;
  readonly registeredAtUtc: IsoDateString;
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName?: string | null;
  readonly phoneNumber?: string | null;
  readonly isPhoneVerified: boolean;
  readonly avatarUrl?: string | null;
  readonly preferredLanguage: string;
  readonly timeZone: string;
  readonly status: UserStatus;
  readonly permissions: string[];
  readonly failedAccessAttemptCount: number;
  readonly lockoutEndUtc?: IsoDateString | null;
  readonly isLocked: boolean;
}

/** `GET /users/counts` payload (all `int`). */
export interface SupplementUserCounts {
  readonly total: number;
  readonly pending: number;
  readonly active: number;
  readonly suspended: number;
  readonly locked: number;
  readonly deleted: number;
  readonly customers: number;
  readonly admins: number;
  readonly superAdmins: number;
  readonly unverified: number;
  readonly lockedOut: number;
}

/** `GET /orders/counts` payload (all `int`). */
export interface SupplementOrderCounts {
  readonly total: number;
  readonly pending: number;
  readonly confirmed: number;
  readonly cancelled: number;
}

/**
 * `POST /orders/{orderId}/refund` body (`orders.refund`).
 * `reason` is `[Required][StringLength(500, MinimumLength = 1)]`.
 */
export interface SupplementRefundOrderRequest {
  readonly reason: string;
}

/** `GET /inventory/counts` payload (all `int`). */
export interface SupplementInventoryCounts {
  readonly totalItems: number;
  readonly totalOnHand: number;
  readonly totalReserved: number;
  readonly lowStockItems: number;
  readonly pendingReservations: number;
  readonly committedReservations: number;
  readonly releasedReservations: number;
  readonly expiredReservations: number;
}

/**
 * `GET /api/payments/mine` + `GET /payments*` item payload: the explicit
 * `PaymentAdminResponse` contract (same shape as the customer view).
 * Timestamps are `DateTimeOffset`; `version: long`.
 */
export interface SupplementPaymentRecord {
  readonly id: Guid;
  readonly orderId: Guid;
  readonly customerId: Guid;
  readonly amount: number;
  readonly currency: string;
  readonly status: PaymentStatus;
  readonly providerPaymentIntentId?: string | null;
  readonly provider?: string | null;
  readonly createdAtUtc: IsoDateString;
  readonly updatedAtUtc?: IsoDateString | null;
  readonly version: number;
}

/** One per-currency rollup inside `GET /payments/stats`. */
export interface SupplementPaymentCurrencyTotal {
  readonly currency: string;
  readonly succeededCount: number;
  readonly succeededTotalAmount: number;
}

/** `GET /payments/stats` payload. */
export interface SupplementPaymentStats {
  readonly total: number;
  readonly pending: number;
  readonly processing: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly cancelled: number;
  readonly refunded: number;
  readonly totalsByCurrency: readonly SupplementPaymentCurrencyTotal[];
}

/**
 * `GET /dashboard` payload: per-module overviews composed by the host
 * (each section shape is defined in its owning module section).
 * `recentOrders` is newest-first, fixed at 5.
 */
export interface SupplementDashboard {
  readonly orders: SupplementOrderCounts;
  readonly payments: SupplementPaymentStats;
  readonly inventory: SupplementInventoryCounts;
  readonly users: SupplementUserCounts;
  readonly recentOrdersCount: number;
}

/**
 * Expanded variant update (`UpdateProductVariantRequest` gains priced +
 * status fields in the evolved contract): price needs amount+currency
 * together; `status` toggles sellability. Wire numbers for `status`
 * (`VariantStatus`), strings for the rest.
 */
export interface SupplementVariantUpdate {
  readonly sku?: string | null;
  readonly name?: string | null;
  readonly unitPriceAmount?: number | null;
  readonly currency?: string | null;
  readonly status?: VariantStatus | null;
}

/**
 * Structural pre-check for a variant update: amount+currency travel paired
 * (both present or both absent); a present status must be a known
 * `VariantStatus`. Never a substitute for backend validation.
 * Pure — throws nothing.
 */
export function isValidSupplementVariantUpdate(
  update: SupplementVariantUpdate | null | undefined,
): boolean {
  if (update === null || update === undefined) {
    return false;
  }
  const hasAmount = update.unitPriceAmount !== undefined && update.unitPriceAmount !== null;
  const hasCurrency = update.currency !== undefined && update.currency !== null;
  if (hasAmount !== hasCurrency) {
    return false;
  }
  if (hasAmount && !(typeof update.unitPriceAmount === 'number' && update.unitPriceAmount > 0)) {
    return false;
  }
  const status = update.status;
  if (status !== undefined && status !== null) {
    if (status !== VariantStatus.Active && status !== VariantStatus.Inactive) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Query shapes (transport only — no backend logic) + structural pre-checks
// ---------------------------------------------------------------------------

/** Shared paging bounds (`pageNumber >= 1`, `1 <= pageSize <= 100`). */
export interface SupplementPagingQuery {
  readonly pageNumber?: number;
  readonly pageSize?: number;
}

/**
 * Structural pre-check for paging bounds. Null/undefined means "server
 * defaults" (`1`/`20`) and passes. Pure — throws nothing.
 */
export function isValidSupplementPagingQuery(
  query: SupplementPagingQuery | null | undefined,
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

/** Backend order statuses accepted as the `status` filter (case-insensitive). */
export const SUPPLEMENT_ORDER_STATUS_FILTER_VALUES: readonly string[] = [
  'Pending',
  'Cancelled',
  'Confirmed',
];

/** Backend payment statuses accepted as the `status` filter (case-insensitive). */
export const SUPPLEMENT_PAYMENT_STATUS_FILTER_VALUES: readonly string[] = [
  'Pending',
  'Processing',
  'Succeeded',
  'Failed',
  'Cancelled',
  'Refunded',
];

/**
 * Whether `value` names a filter-accepted order status (case-insensitive;
 * unknown → backend `400`). Pure — throws nothing.
 */
export function isSupplementOrderStatusFilter(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    SUPPLEMENT_ORDER_STATUS_FILTER_VALUES.some((s) => s.toLowerCase() === value.toLowerCase())
  );
}

/**
 * Whether `value` names a filter-accepted payment status
 * (case-insensitive; unknown → backend `400 Payment.ValidationFailed`).
 * Pure — throws nothing.
 */
export function isSupplementPaymentStatusFilter(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    SUPPLEMENT_PAYMENT_STATUS_FILTER_VALUES.some((s) => s.toLowerCase() === value.toLowerCase())
  );
}

/**
 * `GET /orders-list` query: paging + `status?/customerId?/search?/from?/to?`
 * (newest-first). Unknown `status` or `from > to` → backend `400`.
 */
export interface SupplementOrderListQuery extends SupplementPagingQuery {
  readonly status?: string;
  readonly customerId?: Guid;
  readonly search?: string;
  readonly from?: string;
  readonly to?: string;
}

/**
 * Structural pre-check for an order-list query: paging bounds, known
 * status when present, non-blank ids/search, `from <= to` when both
 * present (lexicographic ISO-8601 comparison). Pure — throws nothing.
 */
export function isValidSupplementOrderListQuery(
  query: SupplementOrderListQuery | null | undefined,
): boolean {
  if (!isValidSupplementPagingQuery(query)) {
    return false;
  }
  if (query === null || query === undefined) {
    return true;
  }
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    if (!isSupplementOrderStatusFilter(query.status)) {
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
 * `GET /payments` query: paging + `status?/orderId?/customerId?/from?/to?`
 * (newest-first). Unknown `status` or `from > to` → backend `400
 * Payment.ValidationFailed`.
 */
export interface SupplementPaymentListQuery extends SupplementPagingQuery {
  readonly status?: string;
  readonly orderId?: Guid;
  readonly customerId?: Guid;
  readonly from?: string;
  readonly to?: string;
}

/**
 * Structural pre-check for a payment-list query. Pure — throws nothing.
 */
export function isValidSupplementPaymentListQuery(
  query: SupplementPaymentListQuery | null | undefined,
): boolean {
  if (!isValidSupplementPagingQuery(query)) {
    return false;
  }
  if (query === null || query === undefined) {
    return true;
  }
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    if (!isSupplementPaymentStatusFilter(query.status)) {
      return false;
    }
  }
  if (query.orderId !== undefined && query.orderId !== null && query.orderId.trim() === '') {
    return false;
  }
  if (
    query.customerId !== undefined &&
    query.customerId !== null &&
    query.customerId.trim() === ''
  ) {
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
 * `GET /api/payments/mine` query: paging + optional `status`
 * (caller-owned only). Unknown `status` → `400 Payment.ValidationFailed`.
 */
export interface SupplementPaymentsMineQuery extends SupplementPagingQuery {
  readonly status?: string;
}

/**
 * Structural pre-check for a payments-mine query. Pure — throws nothing.
 */
export function isValidSupplementPaymentsMineQuery(
  query: SupplementPaymentsMineQuery | null | undefined,
): boolean {
  if (!isValidSupplementPagingQuery(query)) {
    return false;
  }
  if (query === null || query === undefined) {
    return true;
  }
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    if (!isSupplementPaymentStatusFilter(query.status)) {
      return false;
    }
  }
  return true;
}

/**
 * `GET /inventory` query: paging + `search?` (SKU substring,
 * case-insensitive) + `maxAvailable?` (available-quantity ceiling).
 * Ordered by SKU. Negative `maxAvailable` → `400 ValidationFailed`.
 */
export interface SupplementInventoryListQuery extends SupplementPagingQuery {
  readonly search?: string;
  readonly maxAvailable?: number;
}

/**
 * Structural pre-check for an inventory-list query. Pure — throws nothing.
 */
export function isValidSupplementInventoryListQuery(
  query: SupplementInventoryListQuery | null | undefined,
): boolean {
  if (!isValidSupplementPagingQuery(query)) {
    return false;
  }
  if (query === null || query === undefined) {
    return true;
  }
  if (query.search !== undefined && query.search !== null && query.search.trim() === '') {
    return false;
  }
  if (query.maxAvailable !== undefined && query.maxAvailable !== null) {
    if (!Number.isInteger(query.maxAvailable) || query.maxAvailable < 0) {
      return false;
    }
  }
  return true;
}

/** Reservation statuses accepted as the `status` filter. */
export const SUPPLEMENT_RESERVATION_STATUS_FILTER_VALUES: readonly string[] = [
  'Pending',
  'Committed',
  'Released',
  'Expired',
];

/**
 * `GET /inventory/reservations` query: paging + `status?/sku?/orderId?`
 * (newest-first). Unknown `status`, bad SKU, or empty orderId → `400`.
 */
export interface SupplementReservationListQuery extends SupplementPagingQuery {
  readonly status?: string;
  readonly sku?: string;
  readonly orderId?: Guid;
}

/**
 * Structural pre-check for a reservation-list query. Pure — throws nothing.
 */
export function isValidSupplementReservationListQuery(
  query: SupplementReservationListQuery | null | undefined,
): boolean {
  if (!isValidSupplementPagingQuery(query)) {
    return false;
  }
  if (query === null || query === undefined) {
    return true;
  }
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    const known = SUPPLEMENT_RESERVATION_STATUS_FILTER_VALUES.some(
      (s) => s.toLowerCase() === (query.status as string).toLowerCase(),
    );
    if (!known) {
      return false;
    }
  }
  if (query.sku !== undefined && query.sku !== null && query.sku.trim() === '') {
    return false;
  }
  if (query.orderId !== undefined && query.orderId !== null && query.orderId.trim() === '') {
    return false;
  }
  return true;
}

/** User statuses accepted as the `status` filter (names, case-insensitive). */
export const SUPPLEMENT_USER_STATUS_FILTER_VALUES: readonly string[] = [
  'Pending',
  'Active',
  'Suspended',
  'Locked',
  'Deleted',
];

/** Roles accepted as the `role` filter (names, case-insensitive). */
export const SUPPLEMENT_USER_ROLE_FILTER_VALUES: readonly UserRole[] = [
  'Customer',
  'Admin',
  'SuperAdmin',
];

/**
 * `GET /users` query: paging + `status?/role?/search?` (email/first/last
 * substring, newest-first). Unknown `status`/`role` → `400`.
 */
export interface SupplementUserListQuery extends SupplementPagingQuery {
  readonly status?: string;
  readonly role?: string;
  readonly search?: string;
}

/**
 * Structural pre-check for a user-list query. Pure — throws nothing.
 */
export function isValidSupplementUserListQuery(
  query: SupplementUserListQuery | null | undefined,
): boolean {
  if (!isValidSupplementPagingQuery(query)) {
    return false;
  }
  if (query === null || query === undefined) {
    return true;
  }
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    const known = SUPPLEMENT_USER_STATUS_FILTER_VALUES.some(
      (s) => s.toLowerCase() === query.status?.toLowerCase(),
    );
    if (!known) {
      return false;
    }
  }
  if (query.role !== undefined && query.role !== null && query.role !== '') {
    const known = SUPPLEMENT_USER_ROLE_FILTER_VALUES.some(
      (r) => r.toLowerCase() === query.role?.toLowerCase(),
    );
    if (!known) {
      return false;
    }
  }
  if (query.search !== undefined && query.search !== null && query.search.trim() === '') {
    return false;
  }
  return true;
}

/**
 * Single-id queries: order details, payment status, user details,
 * payment by-order. Non-blank id only. Pure — throws nothing.
 */
export interface SupplementIdQuery {
  readonly id: Guid;
}

/**
 * Structural pre-check for a single-id query. Pure — throws nothing.
 */
export function isValidSupplementIdQuery(query: SupplementIdQuery | null | undefined): boolean {
  return (
    query !== null && query !== undefined && typeof query.id === 'string' && query.id.trim() !== ''
  );
}

/**
 * `POST /orders/{orderId}/refund` submission: order id + `reason`
 * (`[Required][StringLength(500, MinimumLength = 1)]`). Only paid
 * (`Completed` saga) orders are eligible — `404 Order.NotFound`,
 * `409 Order.RefundConflict` (in-flight duplicate stays `200`
 * idempotent). Structural pre-check only. Pure — throws nothing.
 */
export interface SupplementRefundSubmission {
  readonly orderId: Guid;
  readonly reason: string;
}

/**
 * Structural pre-check for a refund submission: non-blank id + reason
 * of 1..500 chars. Pure — throws nothing.
 */
export function isValidSupplementRefundSubmission(
  submission: SupplementRefundSubmission | null | undefined,
): boolean {
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

/**
 * `POST /users/{id}/permissions` submission: user id + one catalog
 * permission. Unknown permission → `400 Identity.InvalidPermission`;
 * already-granted → `409 Identity.PermissionAlreadyGranted`.
 * Pure — throws nothing.
 */
export interface SupplementPermissionGrant {
  readonly userId: Guid;
  readonly permission: string;
}

/**
 * Structural pre-check for a permission grant. Pure — throws nothing.
 */
export function isValidSupplementPermissionGrant(
  grant: SupplementPermissionGrant | null | undefined,
): boolean {
  if (grant === null || grant === undefined) {
    return false;
  }
  if (typeof grant.userId !== 'string' || grant.userId.trim() === '') {
    return false;
  }
  return isSupplementS1Permission(grant.permission);
}

/**
 * `GET /dashboard` query: `lowStockThreshold?` (default 5, inclusive
 * available ceiling for the inventory section). Negative → `400`.
 * Pure — throws nothing.
 */
export interface SupplementDashboardQuery {
  readonly lowStockThreshold?: number;
}

/**
 * Structural pre-check for a dashboard query. Pure — throws nothing.
 */
export function isValidSupplementDashboardQuery(
  query: SupplementDashboardQuery | null | undefined,
): boolean {
  if (query === null || query === undefined) {
    return true;
  }
  const { lowStockThreshold } = query;
  if (lowStockThreshold === undefined || lowStockThreshold === null) {
    return true;
  }
  return Number.isInteger(lowStockThreshold) && lowStockThreshold >= 0;
}

// ---------------------------------------------------------------------------
// Supplement route pins (confirm with the Admin app in S1.5/S1.10)
// ---------------------------------------------------------------------------

/**
 * New supplement feature route segment: `users` (SuperAdmin-only,
 * lazy child of the guarded portal shell). The `dashboard` segment
 * already exists (static page today, live API in S1.10) and is reused,
 * not re-declared.
 */
export const SUPPLEMENT_S1_ROUTES = {
  users: 'users',
  dashboard: 'dashboard',
} as const;

/** One supplement feature route segment. */
export type SupplementS1Route = (typeof SUPPLEMENT_S1_ROUTES)[keyof typeof SUPPLEMENT_S1_ROUTES];

/**
 * Whether `value` names a supplement feature route segment.
 * Pure — throws nothing.
 */
export function isSupplementS1Route(value: unknown): value is SupplementS1Route {
  return (
    typeof value === 'string' &&
    (Object.values(SUPPLEMENT_S1_ROUTES) as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Error-code table + status-first classifiers (ERROR_CATALOG.md new codes)
// ---------------------------------------------------------------------------

/**
 * Minimal normalized-failure view this module classifies: an HTTP `status`
 * plus the best-effort `code`. Compatible with the Phase 1 `ApiError`
 * without importing it. Wire reality (`ERROR_CATALOG.md` §0): business
 * errors carry NO machine `code` (`extensions: {}`) — only the localized
 * `detail` — so every classifier branches on `status` first and treats
 * `code` as a development-time hint. Pure data.
 */
export interface SupplementS1Failure {
  readonly status: number;
  readonly code?: string;
}

/**
 * The 5 new error codes with their HTTP status and meaning. The `code`
 * column is a documentation/hint value — the UI must branch on `status`
 * + endpoint context, never on message text.
 */
export const SUPPLEMENT_S1_ERROR_CODES = [
  {
    code: 'Identity.InvalidPermission',
    status: 400,
    meaning: 'Unknown permission string on grant/revoke',
  },
  {
    code: 'Identity.PermissionAlreadyGranted',
    status: 409,
    meaning: 'No-op grant of an already-held permission',
  },
  {
    code: 'Order.RefundConflict',
    status: 409,
    meaning: 'Refund of a non-paid order (no/in-flight saga, missing payment correlation)',
  },
  {
    code: 'Inventory.ValidationFailed',
    status: 400,
    meaning:
      'List/count params invalid (pagination, status, SKU, order filter, negative threshold)',
  },
  {
    code: 'Payment.ValidationFailed',
    status: 400,
    meaning: 'List params invalid (pagination, status, date filters)',
  },
] as const;

/** One new supplement error-code value. */
export type SupplementS1ErrorCode = (typeof SUPPLEMENT_S1_ERROR_CODES)[number]['code'];

/**
 * Whether `value` names one of the 5 new error codes (hint-level only —
 * never sufficient for UI branching alone). Pure — throws nothing.
 */
export function isSupplementS1ErrorCode(value: unknown): value is SupplementS1ErrorCode {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S1_ERROR_CODES as readonly { code: string }[]).some((e) => e.code === value)
  );
}

/**
 * Whether the failure is a missing entity (`404` — unknown order/payment/
 * user id, masked stranger, empty payment for `by-order`). Never probe ids
 * on this path. Pure — throws nothing.
 */
export function isSupplementS1NotFoundFailure(
  failure: SupplementS1Failure | null | undefined,
): boolean {
  return failure?.status === 404;
}

/**
 * Whether the failure is a domain conflict (`409` — `RefundConflict`,
 * `PermissionAlreadyGranted`, `CancelConflict`, `NotReady`, `NotPayable`,
 * `DuplicateSku`). Recovery is input change or timed retry (for `NotReady`
 * saga lag), never blind retry. In-flight refund duplicates stay `200`
 * idempotent rather than surfacing here. Pure — throws nothing.
 */
export function isSupplementS1ConflictFailure(
  failure: SupplementS1Failure | null | undefined,
): boolean {
  return failure?.status === 409;
}

/**
 * Whether the failure is a validation failure (`400` with an
 * `errors{field:[msg]}` map — `InvalidPermission`, `ValidationFailed`,
 * profile/order/refund/user-query guards). Field keys are DTO property
 * names; display `detail` + the map, never raw codes. Pure — throws nothing.
 */
export function isSupplementS1ValidationFailure(
  failure: SupplementS1Failure | null | undefined,
): boolean {
  return failure?.status === 400;
}

/**
 * Whether the failure is an authorization failure (`401` anonymous/expired
 * JWT → login/refresh; `403` missing permission or wrong role →
 * `/forbidden`). Guards stay UX-only; the backend stays authoritative.
 * Pure — throws nothing.
 */
export function isSupplementS1AuthFailure(
  failure: SupplementS1Failure | null | undefined,
): boolean {
  return failure?.status === 401 || failure?.status === 403;
}

// ---------------------------------------------------------------------------
// Responsibility boundary (Supplement UX vs. Backend Truth)
// ---------------------------------------------------------------------------

/**
 * Frontend-owned supplement concerns: presentation, feature state, and
 * navigation only — no truth, no orchestration.
 */
export const FRONTEND_SUPPLEMENT_S1_RESPONSIBILITIES = [
  'users-ux',
  'permission-presentation',
  'profile-editing',
  'feature-state',
  'loading-error-handling',
  'navigation',
  'notifications',
] as const;

/** One frontend-owned supplement concern. */
export type FrontendSupplementS1Responsibility =
  (typeof FRONTEND_SUPPLEMENT_S1_RESPONSIBILITIES)[number];

/**
 * Backend-owned supplement concerns: the SPA must never duplicate any of
 * these — no permission derivation, no totals math, no status inference,
 * no payment verification, no saga management, no webhook handling.
 */
export const BACKEND_SUPPLEMENT_S1_RESPONSIBILITIES = [
  'permission-grants',
  'user-state',
  'order-state',
  'payment-state',
  'inventory-state',
  'payment-verification',
  'status-transitions',
  'pricing-rules',
  'saga-orchestration',
  'compensation',
  'webhook-processing',
  'idempotency',
  'validation',
  'authorization',
  'ownership',
] as const;

/** One backend-owned supplement concern. */
export type BackendSupplementS1Responsibility =
  (typeof BACKEND_SUPPLEMENT_S1_RESPONSIBILITIES)[number];

/**
 * Whether `value` names a frontend-owned supplement concern.
 * Pure — throws nothing.
 */
export function isFrontendSupplementS1Responsibility(
  value: unknown,
): value is FrontendSupplementS1Responsibility {
  return (
    typeof value === 'string' &&
    (FRONTEND_SUPPLEMENT_S1_RESPONSIBILITIES as readonly string[]).includes(value)
  );
}

/**
 * Whether `value` names a backend-owned supplement concern — and
 * therefore something the SPA must never implement. Pure — throws nothing.
 */
export function isBackendSupplementS1Responsibility(
  value: unknown,
): value is BackendSupplementS1Responsibility {
  return (
    typeof value === 'string' &&
    (BACKEND_SUPPLEMENT_S1_RESPONSIBILITIES as readonly string[]).includes(value)
  );
}

// Order and payment `status` fields stay STRINGS on the wire
// (`OrderStatus.ToString()` / `PaymentStatus.ToString()` — canonical unions
// live in `../common/enums` and are referenced above, never re-declared
// here). Status filters accept the same values case-insensitively; unknown
// future strings count as non-terminal (keep polling, per
// `ENUM_REFERENCE.md` §8).
