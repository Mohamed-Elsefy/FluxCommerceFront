/**
 * Supplement S2 contract audit for Step S2.1 —
 * Contract Re-audit Gate (Phase 22 backend evolution).
 *
 * Scope: `docs/phases/SUPPLEMENT_S2_ADAPTIVE_DASHBOARD_AND_DELEGATED_ADMIN.md`
 * §S2.1 (contracts and boundaries only — no feature structure, no API
 * service, no state store, no components, no routes, no pages, no guard
 * changes, no navigation changes).
 *
 * Source of truth (amended `docs/frontend-contract/` diff, 2026-10-04):
 * - `API_CONTRACT.md` §0.5 (permission catalog v2) + §1 (identity
 *   authorization migration: `register-admin` → `admins.create`,
 *   `/admin/users/**` → `users.read` / `users.manage`) + §8 (adaptive
 *   dashboard: any authenticated JWT, nullable per-permission sections,
 *   new `CatalogCountsResponse`) + appendices (admin-fetch 403 guidance).
 * - `AUTH_FLOW.md` (v2 permission claims, endpoint matrix, 403
 *   single-refresh-then-locked guidance).
 * - `DTO_REFERENCE.md` (v2 catalog, nullable `AdminDashboardResponse`,
 *   `CatalogCountsResponse`).
 * - `ENUM_REFERENCE.md` (v2 catalog, `UserResponse.permissions` example).
 * - `ERROR_CATALOG.md` (new `Identity.Forbidden` 403 delegation guard).
 * - `LOCALIZATION_CONTRACT.md` (174 `en` keys, no contract change).
 * - `PAYMENT_INTEGRATION_NOTES.md` (wording only, no contract change).
 *
 * Audited backend surface (the complete CHANGED HTTP surface vs S1):
 * - Permission catalog v2 (11 values): `dashboard.read` REMOVED;
 *   `users.read`, `users.manage`, `admins.create` ADDED. The `Admin`
 *   role grants nothing — every permission is granted manually;
 *   grants apply on the next login/refresh; `SuperAdmin` bypasses
 *   every gate without holding permissions.
 * - Identity: `POST /auth/register-admin` → `admins.create` (creates
 *   permission-less admins); `/admin/users` reads (list/counts/get/
 *   per-user permissions) → `users.read`; role assign, unlock, grant,
 *   revoke → `users.manage` (under anti-escalation guards); the
 *   permission catalog document (`GET /admin/users/permissions`) →
 *   `users.manage` (whoever can grant must be able to list what is
 *   grantable). The per-user permission read stays readable for
 *   display (`users.read`).
 * - Dashboard: `GET /admin/dashboard` → any authenticated JWT (always
 *   `200`, never a bare forbidden screen); sections are per-permission
 *   (`orders` + `recentOrders` ← `orders.read`; `payments` ←
 *   `payments.read` or `payments.stats`; `inventory` ← `inventory.read`;
 *   `catalog` ← `catalog.manage` (new `CatalogCountsResponse`);
 *   `users` ← `SuperAdmin` role directly), `null` (objects) / `[]`
 *   (recent orders) when unauthorized. `null` = not entitled,
 *   `0` / `[]` = entitled but empty.
 * - Errors: new `Identity.Forbidden` 403 (delegation guard:
 *   non-SuperAdmin assigning `SuperAdmin`, touching a SuperAdmin
 *   account, or granting an unheld permission). 403 discipline: one
 *   refresh is legitimate for fresh grants, then an inline locked
 *   state — never a retry loop, never a forced logout (the
 *   interceptor already admits only 401 into recovery).
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - Canonical wire mirrors and transport shapes live in their owning
 *   domain modules (`identity`, `orders`, `payments`, `inventory`,
 *   `dashboard`, `../common/enums`, `../common/shared-types`). This
 *   module aliases nothing structurally and re-declares no wire shape
 *   except the two S2 audit pins below — cross-cutting audit tables
 *   only — so no contract drift is possible. (S2.2 lands the canonical
 *   `CatalogCountsResponse` + nullable dashboard sections in
 *   `dashboard.ts` and the v2 catalog in `../common/enums`; until
 *   then the audit pins here are the single reference for UI work,
 *   and no UI in S2.3–S2.4 may exceed them.)
 * - This module owns the audit-only additions: the v2 catalog pin,
 *   the removed-`dashboard.read` pin, the v2 permission→endpoint
 *   matrix, the dashboard section-gate table, the dashboard auth pin,
 *   the grant-visibility rule, the status-first failure classifiers,
 *   the 403-discipline helper, the pagination/filter/sort matrix, the
 *   route pins, the still-unsupported pins, and the recorded gaps.
 *
 * Backend-authoritative data rule (this step's core constraint):
 * this module performs NO permission derivation, NO totals computation,
 * NO status inference, NO customer-identity resolution, NO saga
 * orchestration, NO webhook handling, and NO idempotency-key minting.
 * Client-side state is never treated as domain truth.
 *
 * Explicitly out of scope (later steps, must not appear here):
 * - S2.2 — no `domains/*` edits, no `api-endpoints.ts` edits, no
 *   `IdentityApiService` methods. (Canonical v2 declarations land
 *   there; this module holds audit tables only.)
 * - S2.3–S2.4 — no dashboard/users pages, states, forms, guards,
 *   or navigation.
 * - S2.5 — no interceptor changes (already 401-only by contract).
 * - No `@Injectable()` store, no signals/computeds, no `HttpClient`.
 *
 * This file is pure types + pure functions: no Angular imports, no
 * `HttpClient`, no browser APIs, no `localStorage`. Every helper is
 * SSR-safe, throws nothing, and performs no HTTP.
 *
 * File naming note: this module is `supplement-s2-audit.ts` (not
 * `*-admin-…`) because the workspace ESLint `**admin**` import guard
 * matches any specifier containing that substring — even a
 * library-internal filename — and would false-positive (same reason as
 * the S1 `contract-evolution-audit.ts` note and ADR-027/029). Exported
 * symbol names keep the descriptive wording; only the filename avoids
 * the substring.
 */

import type { Guid } from '../common/shared-types';
import type { RegisterAdminRequest, UserAdminCountsResponse } from './identity';
import type { AdminOrderCountsResponse, OrderSummaryResponse } from './orders';
import type { PaymentAdminStatsResponse } from './payments';
import type { InventoryCountsResponse } from './inventory';

// ---------------------------------------------------------------------------
// Permission catalog v2 (API_CONTRACT.md §0.5, ENUM_REFERENCE.md Permissions)
// ---------------------------------------------------------------------------

/**
 * Action-level permission catalog v2 (backend Phase 22,
 * `Identity.Domain.Aggregates.PermissionCatalog`, JWT claim type
 * `"permission"` — one claim per grant). `dashboard.read` is REMOVED;
 * `users.read`, `users.manage`, `admins.create` are ADDED. Assigning
 * the `Admin` role grants nothing — every permission is granted
 * manually afterwards; grants apply on the next login/refresh;
 * `SuperAdmin` bypasses every gate without holding permissions.
 *
 * Audit pin: the canonical declaration lives in `../common/enums`
 * (`PERMISSION_CATALOG`) and is migrated there in S2.2 — this table
 * is the S2.1 reference the migration is verified against. Pure data.
 */
export const SUPPLEMENT_S2_PERMISSION_CATALOG = [
  'orders.read',
  'orders.cancel',
  'orders.refund',
  'payments.read',
  'payments.stats',
  'inventory.read',
  'inventory.manage',
  'catalog.manage',
  'users.read',
  'users.manage',
  'admins.create',
] as const;

/** One v2 action-level permission value. */
export type SupplementS2Permission = (typeof SUPPLEMENT_S2_PERMISSION_CATALOG)[number];

/**
 * Whether `value` names a v2 catalog permission. Pure — throws nothing.
 */
export function isSupplementS2Permission(value: unknown): value is SupplementS2Permission {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S2_PERMISSION_CATALOG as readonly string[]).includes(value)
  );
}

/**
 * Removed in v2: `dashboard.read` no longer gates anything. Any
 * remaining reference outside historical ADRs/reports is an S2.2
 * migration miss. Pure data.
 */
export const SUPPLEMENT_S2_REMOVED_PERMISSIONS = ['dashboard.read'] as const;

/** One permission value removed by the v2 catalog. */
export type SupplementS2RemovedPermission = (typeof SUPPLEMENT_S2_REMOVED_PERMISSIONS)[number];

/**
 * Whether `value` names a permission removed by v2 (migration-hygiene
 * check for S2.2). Pure — throws nothing.
 */
export function isSupplementS2RemovedPermission(
  value: unknown,
): value is SupplementS2RemovedPermission {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S2_REMOVED_PERMISSIONS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Permission → endpoint matrix v2 (API_CONTRACT.md §0.5 + §1 + §8)
// ---------------------------------------------------------------------------

/**
 * Permission → SPA-callable endpoints matrix v2. Backend paths verbatim
 * (`API_CONTRACT.md` §0.5 table + §1 rows). Enforcement failure →
 * `403` (no `extensions.code` — match `status` + endpoint context).
 * The dashboard row is intentionally absent: `GET /admin/dashboard`
 * takes any authenticated JWT (see `SUPPLEMENT_S2_DASHBOARD_AUTH`
 * below). Pure data — throws nothing.
 */
export const SUPPLEMENT_S2_PERMISSION_ENDPOINTS: Record<SupplementS2Permission, readonly string[]> =
  {
    'orders.read': ['GET /admin/orders', 'GET /admin/orders/counts', 'GET /admin/orders/{orderId}'],
    'orders.cancel': ['POST /admin/orders/{orderId}/cancel'],
    'orders.refund': ['POST /admin/orders/{orderId}/refund'],
    'payments.read': ['GET /admin/payments', 'GET /admin/payments/{paymentId}'],
    'payments.stats': ['GET /admin/payments/stats'],
    'inventory.read': [
      'GET /inventory/{sku}',
      'GET /inventory/reservations/{id}',
      'GET /inventory',
      'GET /inventory/counts',
      'GET /inventory/reservations',
    ],
    'inventory.manage': ['POST /inventory', 'PATCH /inventory/{sku}'],
    'catalog.manage': ['catalog writes (reads stay anonymous)'],
    'users.read': [
      'GET /admin/users',
      'GET /admin/users/counts',
      'GET /admin/users/{id}',
      'GET /admin/users/{id}/permissions',
    ],
    'users.manage': [
      'POST /admin/users/{id}/roles',
      'POST /admin/users/{id}/unlock',
      'POST /admin/users/{id}/permissions',
      'DELETE /admin/users/{id}/permissions/{permission}',
      'GET /admin/users/permissions',
    ],
    'admins.create': ['POST /auth/register-admin'],
  };

/**
 * Whether `value` names a v2 permission with a matrix row. Pure —
 * throws nothing.
 */
export function isSupplementS2MatrixPermission(value: unknown): value is SupplementS2Permission {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(SUPPLEMENT_S2_PERMISSION_ENDPOINTS, value)
  );
}

/**
 * Dashboard authorization pin: `GET /admin/dashboard` takes any
 * authenticated JWT (`401` without token; always `200` otherwise —
 * never a bare forbidden screen). Sections gate per
 * `SUPPLEMENT_S2_DASHBOARD_SECTION_GATES` below. Pure data.
 */
export const SUPPLEMENT_S2_DASHBOARD_AUTH = {
  endpoint: 'GET /admin/dashboard',
  auth: 'authenticated',
} as const;

// ---------------------------------------------------------------------------
// Dashboard section gates (API_CONTRACT.md §8)
// ---------------------------------------------------------------------------

/**
 * Dashboard section → entitlement gate. `orders` and `recentOrders`
 * share the `orders.read` gate; `payments` opens on either
 * `payments.read` or `payments.stats`; `users` is `SuperAdmin`-role
 * sourced (not permission-gated). A `null` section (objects) or `[]`
 * (recent orders) means not entitled; `0` / `[]` on an entitled
 * section means entitled but empty. Pure data — throws nothing.
 */
export const SUPPLEMENT_S2_DASHBOARD_SECTION_GATES = {
  orders: { permissions: ['orders.read'] },
  recentOrders: { permissions: ['orders.read'] },
  payments: { permissions: ['payments.read', 'payments.stats'] },
  inventory: { permissions: ['inventory.read'] },
  catalog: { permissions: ['catalog.manage'] },
  users: { roles: ['SuperAdmin'] },
} as const;

/** One adaptive dashboard section. */
export type SupplementS2DashboardSection = keyof typeof SUPPLEMENT_S2_DASHBOARD_SECTION_GATES;

/**
 * Whether `value` names an adaptive dashboard section. Pure — throws
 * nothing.
 */
export function isSupplementS2DashboardSection(
  value: unknown,
): value is SupplementS2DashboardSection {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(SUPPLEMENT_S2_DASHBOARD_SECTION_GATES, value)
  );
}

// ---------------------------------------------------------------------------
// Frontend aliases (never re-declared — audit pins for S2.2)
// ---------------------------------------------------------------------------

/**
 * `POST /auth/register-admin` body. Already canonical in `identity.ts`
 * (`RegisterAdminRequest` — 4 non-nullable strings); this alias exists
 * so S2.4 imports the S2 boundary instead of reaching across domains.
 * The account it creates starts permission-less (grants afterwards).
 */
export type SupplementS2RegisterAdminRequest = RegisterAdminRequest;

/**
 * `GET /admin/dashboard` catalog section pin
 * (`DTO_REFERENCE.md` §8: `CatalogCountsResponse{totalProducts,
 * activeProducts, totalCategories, totalVariants}`, all `int`).
 * S2.2 lands the canonical declaration in `dashboard.ts`; until then
 * this audit pin is the single reference (never re-declared
 * elsewhere). Pure type.
 */
export interface SupplementS2CatalogCounts {
  totalProducts: number;
  activeProducts: number;
  totalCategories: number;
  totalVariants: number;
}

/**
 * `GET /admin/dashboard` snapshot audit pin (`DTO_REFERENCE.md` §8):
 * every object section is nullable (`null` / absent = not entitled),
 * `recentOrders` is newest-first, fixed at 5, `[]` when unauthorized.
 * Section shapes are aliased from their owning domains (never
 * re-declared). S2.2 lands the canonical nullable declaration in
 * `dashboard.ts`. Pure type.
 */
export interface SupplementS2DashboardSnapshot {
  orders?: AdminOrderCountsResponse | null;
  payments?: PaymentAdminStatsResponse | null;
  inventory?: InventoryCountsResponse | null;
  catalog?: SupplementS2CatalogCounts | null;
  users?: UserAdminCountsResponse | null;
  recentOrders: OrderSummaryResponse[];
}

/**
 * Structural pre-check for a catalog-counts section: all four counts
 * are integers `>= 0`. Pure — throws nothing.
 */
export function isValidSupplementS2CatalogCounts(
  value: SupplementS2CatalogCounts | null | undefined,
): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  return (
    Number.isInteger(value.totalProducts) &&
    value.totalProducts >= 0 &&
    Number.isInteger(value.activeProducts) &&
    value.activeProducts >= 0 &&
    Number.isInteger(value.totalCategories) &&
    value.totalCategories >= 0 &&
    Number.isInteger(value.totalVariants) &&
    value.totalVariants >= 0
  );
}

// ---------------------------------------------------------------------------
// Grant-visibility rule (recorded product decision, S2 Objective)
// ---------------------------------------------------------------------------

/**
 * Recorded product decision: the "grant permission" affordance is
 * visible to `SuperAdmin` and to holders of `users.manage`, fully
 * hidden for everyone else (no disabled state, no placeholder).
 * Denials that still occur (anti-escalation races) surface as error
 * toasts via `Identity.Forbidden`. Pure — throws nothing.
 */
export function canViewSupplementS2GrantSection(
  viewer: { isSuperAdmin: boolean; permissions: readonly string[] } | null | undefined,
): boolean {
  if (viewer === null || viewer === undefined) {
    return false;
  }
  if (viewer.isSuperAdmin) {
    return true;
  }
  return viewer.permissions.includes('users.manage');
}

// ---------------------------------------------------------------------------
// Error-code table + status-first classifiers (ERROR_CATALOG.md)
// ---------------------------------------------------------------------------

/**
 * Minimal normalized-failure view this module classifies: an HTTP
 * `status` plus the best-effort `code` and endpoint context.
 * Compatible with the Phase 1 `ApiError` without importing it. Wire
 * reality (`ERROR_CATALOG.md` §0): business errors carry NO machine
 * `code` (`extensions: {}`) — only the localized `detail` — so every
 * classifier branches on `status` first and treats `code` as a
 * development-time hint. Pure data.
 */
export interface SupplementS2Failure {
  readonly status: number;
  readonly code?: string;
  readonly endpoint?: string;
}

/**
 * The S2 error-code delta: `Identity.Forbidden` 403 (delegation guard
 * — non-SuperAdmin assigning `SuperAdmin`, touching a SuperAdmin
 * account, or granting an unheld permission). No localization key —
 * falls back to the English description; display `detail` as-is.
 * The `code` column is a documentation/hint value — the UI must
 * branch on `status` + endpoint context, never on message text.
 */
export const SUPPLEMENT_S2_ERROR_CODES = [
  {
    code: 'Identity.Forbidden',
    status: 403,
    meaning: 'Delegation guard: SuperAdmin role/target or unheld-permission grant',
  },
] as const;

/** The S2 error-code value. */
export type SupplementS2ErrorCode = (typeof SUPPLEMENT_S2_ERROR_CODES)[number]['code'];

/**
 * Whether `value` names the S2 error code (hint-level only — never
 * sufficient for UI branching alone). Pure — throws nothing.
 */
export function isSupplementS2ErrorCode(value: unknown): value is SupplementS2ErrorCode {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S2_ERROR_CODES as readonly { code: string }[]).some((e) => e.code === value)
  );
}

/**
 * Whether the failure is the delegation-guard denial (`403` on a
 * users/register-admin write — `Identity.Forbidden`). Status-first:
 * any `403` on those endpoints counts (the wire carries no machine
 * code). Surfaces as an error toast; never retried, never logged
 * out. Pure — throws nothing.
 */
export function isSupplementS2ForbiddenFailure(
  failure: SupplementS2Failure | null | undefined,
): boolean {
  return failure?.status === 403;
}

/**
 * Whether the failure is a validation failure (`400` with an
 * `errors{field:[msg]}` map). Pure — throws nothing.
 */
export function isSupplementS2ValidationFailure(
  failure: SupplementS2Failure | null | undefined,
): boolean {
  return failure?.status === 400;
}

/**
 * Whether the failure is a missing entity (`404` — unknown user id,
 * masked stranger, unknown order/payment id). Never probe ids on
 * this path. Pure — throws nothing.
 */
export function isSupplementS2NotFoundFailure(
  failure: SupplementS2Failure | null | undefined,
): boolean {
  return failure?.status === 404;
}

/**
 * Whether the failure is a domain conflict (`409` —
 * `PermissionAlreadyGranted`, `RoleAlreadyAssigned`,
 * `IdempotencyConflict`, `CancelConflict`, `NotReady`, `NotPayable`,
 * `DuplicateSku`). Recovery is input change or timed retry, never
 * blind retry. Pure — throws nothing.
 */
export function isSupplementS2ConflictFailure(
  failure: SupplementS2Failure | null | undefined,
): boolean {
  return failure?.status === 409;
}

/**
 * Whether the failure is an authorization failure (`401`
 * anonymous/expired JWT → login/refresh; `403` missing permission or
 * delegation guard → inline locked state). Guards stay UX-only; the
 * backend stays authoritative. Pure — throws nothing.
 */
export function isSupplementS2AuthFailure(
  failure: SupplementS2Failure | null | undefined,
): boolean {
  return failure?.status === 401 || failure?.status === 403;
}

/**
 * 403 discipline pin (`AUTH_FLOW.md` admin-fetch guidance): on `403`
 * one refresh is legitimate (permissions may have been granted
 * moments ago and land on the next login/refresh); if it still 403s,
 * render the inline locked state. Never a retry loop, never a forced
 * logout — the session is valid but unauthorized. Pure — throws
 * nothing.
 */
export function supplementS2ForbiddenNextStep(
  alreadyRefreshedOnce: boolean,
): 'refresh-once' | 'render-locked' {
  return alreadyRefreshedOnce ? 'render-locked' : 'refresh-once';
}

// ---------------------------------------------------------------------------
// Pagination / filtering / sorting capability matrix
// ---------------------------------------------------------------------------

/**
 * Paginated reads in the S2 slice (all `pageNumber >= 1`,
 * `1 <= pageSize <= 100`, defaults `1`/`20`). Unchanged from S1 —
 * S2 adds no new paginated surface. Single-resource reads
 * (`GET /admin/users/{id}`, `GET /admin/users/permissions`,
 * `GET /admin/users/counts`) and the dashboard snapshot (fixed
 * `recentOrders` newest 5) must never be wrapped in pager logic.
 * Pure data.
 */
export const SUPPLEMENT_S2_PAGINATED_READS = [
  'userList',
  'orderList',
  'paymentList',
  'paymentsMine',
  'inventoryList',
  'reservationList',
] as const;

/** One paginated S2 read. */
export type SupplementS2PaginatedRead = (typeof SUPPLEMENT_S2_PAGINATED_READS)[number];

/**
 * Whether the named S2 read paginates (`PagedResult` envelope). The
 * dashboard snapshot never paginates. Pure — throws nothing.
 */
export function isSupplementS2PaginatedRead(value: unknown): value is SupplementS2PaginatedRead {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S2_PAGINATED_READS as readonly string[]).includes(value)
  );
}

/**
 * Sorting support: NO S2 read accepts `sortBy`/`sortDirection`
 * (users/orders/payments/reservations are fixed newest-first;
 * inventory items are fixed by SKU). Always `false` — pinned so
 * S2.3–S2.4 cannot invent a sort control. Pure — throws nothing.
 */
export function supportsSupplementS2Sorting(_read: string | null | undefined): boolean {
  return false;
}

/**
 * Filter params supported per S2 read (unchanged from S1). Empty
 * array means paging only. The per-domain validators
 * (`isValidUserListQuery`, `isValidAdminOrdersQuery`, …) enforce the
 * value shapes. Pure data — throws nothing.
 */
export const SUPPLEMENT_S2_READ_FILTERS: Record<SupplementS2PaginatedRead, readonly string[]> = {
  userList: ['status', 'role', 'search'],
  orderList: ['status', 'customerId', 'search', 'from', 'to'],
  paymentList: ['status', 'orderId', 'customerId', 'from', 'to'],
  paymentsMine: ['status'],
  inventoryList: ['search', 'maxAvailable'],
  reservationList: ['status', 'sku', 'orderId'],
};

/**
 * Whether the named S2 read supports backend filtering. Pure —
 * throws nothing.
 */
export function supportsSupplementS2Filtering(read: string | null | undefined): boolean {
  if (typeof read !== 'string') {
    return false;
  }
  const filters = (SUPPLEMENT_S2_READ_FILTERS as Record<string, readonly string[]>)[read];
  return filters !== undefined && filters.length > 0;
}

// ---------------------------------------------------------------------------
// Supplement route pins (confirm with the Admin app in S2.3/S2.4)
// ---------------------------------------------------------------------------

/**
 * S2 feature route segments: `dashboard` stays the post-login landing
 * for everyone (the `permissionGuard` mount is dropped in S2.3 — the
 * shell `roleGuard` over `Admin`/`SuperAdmin` remains the entry gate);
 * `users` migrates from `roleGuard(SuperAdmin)` to `permissionGuard`
 * over `['users.read', 'users.manage', 'admins.create']` (OR
 * semantics) with `permissionGuard(['admins.create'])` on the `new`
 * child route (S2.4). Pure data.
 */
export const SUPPLEMENT_S2_ROUTES = {
  dashboard: 'dashboard',
  users: 'users',
  usersNew: 'new',
} as const;

/** One S2 feature route segment. */
export type SupplementS2Route = (typeof SUPPLEMENT_S2_ROUTES)[keyof typeof SUPPLEMENT_S2_ROUTES];

/**
 * Whether `value` names an S2 feature route segment. Pure — throws
 * nothing.
 */
export function isSupplementS2Route(value: unknown): value is SupplementS2Route {
  return (
    typeof value === 'string' &&
    (Object.values(SUPPLEMENT_S2_ROUTES) as readonly string[]).includes(value)
  );
}

/**
 * Single-id route scaffolding: user details reads take an id only
 * (`GET /admin/users/{id}` takes no other params; stranger ids mask
 * as `404`). Pure types — throws nothing.
 */
export interface SupplementS2IdQuery {
  readonly id: Guid;
}

/**
 * Structural pre-check for a single-id query: a non-blank id. Pure —
 * throws nothing.
 */
export function isValidSupplementS2IdQuery(query: SupplementS2IdQuery | null | undefined): boolean {
  return (
    query !== null && query !== undefined && typeof query.id === 'string' && query.id.trim() !== ''
  );
}

// ---------------------------------------------------------------------------
// Still-unsupported pins + recorded gaps (never fabricated)
// ---------------------------------------------------------------------------

/**
 * Operations that remain unsupported after the Phase 22 evolution and
 * must never be implemented or simulated: no payment history/timeline
 * endpoint, no SPA webhook call, no admin-driven checkout, no
 * client-side permission derivation (grants land on next
 * login/refresh only). Pure data.
 */
export const SUPPLEMENT_S2_STILL_UNSUPPORTED_OPERATIONS = [
  'payment-history',
  'payment-timeline',
  'webhook-spa-call',
  'checkout-from-admin',
  'client-permission-derivation',
] as const;

/** One still-unsupported operation. */
export type SupplementS2StillUnsupportedOperation =
  (typeof SUPPLEMENT_S2_STILL_UNSUPPORTED_OPERATIONS)[number];

/**
 * Whether `value` names a still-unsupported operation. Pure — throws
 * nothing.
 */
export function isSupplementS2StillUnsupportedOperation(
  value: unknown,
): value is SupplementS2StillUnsupportedOperation {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S2_STILL_UNSUPPORTED_OPERATIONS as readonly string[]).includes(value)
  );
}

/**
 * Recorded contract gaps / discrepancies (documented, never
 * fabricated — S2.3+ must honor them):
 * - `permission-catalog-superadmin-note`: the S2 Objective text says
 *   only the permission catalog document stays `SuperAdmin`-only,
 *   but the amended contract (`API_CONTRACT.md` §1.17 + `AUTH_FLOW.md`
 *   matrix + S2.1 task list) gates `GET /admin/users/permissions` by
 *   `users.manage`. The contract wins (it is the source of truth);
 *   the Objective sentence is treated as stale wording.
 * - `dashboard-users-section-role-gated`: the dashboard `users`
 *   section is gated by the `SuperAdmin` ROLE directly (not by a
 *   permission) — the drill-down stays `isSuperAdmin`-gated even for
 *   `users.read` holders.
 * - `user-response-permissions-authoritative`: menus and section
 *   rendering read `GET /auth/me` `permissions: string[]`; JWT claims
 *   are never trusted for authz display beyond the token lifetime.
 * Pure data.
 */
export const SUPPLEMENT_S2_RECORDED_GAPS = [
  'permission-catalog-superadmin-note',
  'dashboard-users-section-role-gated',
  'user-response-permissions-authoritative',
] as const;

/** One recorded S2 contract gap. */
export type SupplementS2RecordedGap = (typeof SUPPLEMENT_S2_RECORDED_GAPS)[number];

/**
 * Whether `value` names a recorded S2 contract gap. Pure — throws
 * nothing.
 */
export function isSupplementS2RecordedGap(value: unknown): value is SupplementS2RecordedGap {
  return (
    typeof value === 'string' && (SUPPLEMENT_S2_RECORDED_GAPS as readonly string[]).includes(value)
  );
}

// Order and payment `status` fields stay STRINGS on the wire
// (`OrderStatus.ToString()` / `PaymentStatus.ToString()` — canonical unions
// live in `../common/enums`). Status filters accept the same values
// case-insensitively; unknown future strings count as non-terminal (keep
// polling, per `ENUM_REFERENCE.md` §8).
