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
 * - Canonical wire mirrors and transport shapes live in their owning
 *   domain modules: identity (`UpdateProfileRequest`,
 *   `GrantPermissionRequest`, `UserAdminResponse`,
 *   `UserAdminCountsResponse`, `UserListQuery`, validators),
 *   orders (`AdminOrderCountsResponse`, `RefundOrderRequest`,
 *   `AdminOrdersQuery`, `RefundSubmission`, validators), inventory
 *   (`InventoryCountsResponse`, list queries, validators), payments
 *   (`PaymentAdminResponse`, `PaymentAdminStatsResponse`, list queries,
 *   validators), dashboard (`AdminDashboardResponse`, `DashboardQuery`),
 *   catalog (`UpdateProductVariantRequest`, price validator), and
 *   `../common/enums` (`Permission`/`PERMISSION_CATALOG`) plus
 *   `../common/shared-types` (`PageQuery`). This module aliases nothing
 *   and re-declares nothing — cross-cutting audit tables only — so no
 *   contract drift is possible.
 * - This module owns the audit-only additions: the permission→endpoint
 *   matrix, the SuperAdmin-only table, the callable endpoint tables, the
 *   newly-supported pins (delta vs the 14.1/13.1 `UNSUPPORTED_*` tables),
 *   the still-unsupported pins, the pagination/filter/sort matrix, the
 *   route-id scaffolding, the route pins, the status-first failure
 *   classifiers, and the responsibility-boundary tables.
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
 *   `IdentityApiService` methods. (Done: canonical declarations now live
 *   in `domains/*`; this module holds audit tables only.)
 * - S1.3 — no `permissionGuard`, no `AuthService` changes, no navigation.
 * - S1.4–S1.10 — no forms, pages, states, badges, or dashboard UI.
 * - No `@Injectable()` store, no signals/computeds, no `HttpClient`.
 *
 * This file is pure types + pure functions: no Angular imports, no
 * `HttpClient`, no browser APIs, no `localStorage`. Every helper is
 * SSR-safe, throws nothing, and performs no HTTP.
 *
 * File naming note: this module is `contract-evolution-audit.ts` (not
 * `*-admin-…`) because the workspace ESLint `**admin**` import guard
 * matches any specifier containing that substring — even a
 * library-internal filename — and would false-positive (same reason as
 * ADR-027/029). Exported symbol names keep the descriptive wording; only
 * the filename avoids the substring.
 */

import type { Guid } from '../common/shared-types';
import type { Permission } from '../common/enums';

// ---------------------------------------------------------------------------
// Permission catalog (API_CONTRACT.md §0.5, ENUM_REFERENCE.md Permissions)
// ---------------------------------------------------------------------------

/**
 * Action-level permission catalog (backend Phase 21,
 * `Identity.Domain.Aggregates.PermissionCatalog`, JWT claim type
 * `"permission"` — one claim per grant). Canonical declaration lives in
 * `../common/enums` (`PERMISSION_CATALOG`); assigning the `Admin` role
 * stores the full bundle; grants apply on the next login/refresh;
 * `SuperAdmin` bypasses every gate without holding permissions.
 */

/**
 * Permission → SPA-callable endpoints matrix (API_CONTRACT.md §0.5).
 * Enforcement failure → `403` (no `extensions.code` — match `status` +
 * endpoint context). Pure data — throws nothing.
 */
export const SUPPLEMENT_S1_PERMISSION_ENDPOINTS: Record<Permission, readonly string[]> = {
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
 * only. The per-domain validators (`isValidUserListQuery`,
 * `isValidAdminOrdersQuery`, …) enforce the value shapes. Pure data —
 * throws nothing.
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
// Supplement route pins (confirm with the Admin app in S1.5/S1.10)
// ---------------------------------------------------------------------------

/**
 * Single-id route scaffolding: order details, payment status, and user
 * details reads take an id only (`GET /orders/{id}`,
 * `GET /payments/{id}`, `GET /users/{id}` take no other params;
 * other-customer ids mask as `404`). Pure types — throws nothing.
 */
export interface SupplementIdQuery {
  readonly id: Guid;
}

/**
 * Structural pre-check for a single-id query: a non-blank id.
 * Pure — throws nothing.
 */
export function isValidSupplementIdQuery(query: SupplementIdQuery | null | undefined): boolean {
  return (
    query !== null && query !== undefined && typeof query.id === 'string' && query.id.trim() !== ''
  );
}

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
// live in `../common/enums`). Status filters accept the same values
// case-insensitively; unknown future strings count as non-terminal (keep
// polling, per `ENUM_REFERENCE.md` §8).
