/**
 * Supplement S3 contract delta audit for Step S3.1 —
 * Contract Delta Re-audit Gate (users write re-centralization).
 *
 * Scope: `docs/phases/SUPPLEMENT_S3_USERS_WRITE_RECENTRALIZATION.md`
 * §S3.1 (contracts and boundaries only — no feature structure, no API
 * service, no state store, no components, no routes, no pages, no guard
 * changes, no navigation changes).
 *
 * Source of truth (amended `docs/frontend-contract/`, backend removal
 * of `users.manage` + `admins.create`):
 * - `API_CONTRACT.md` §0.5 (permission catalog v3, 9 values) + §1
 *   (register-admin → `SuperAdmin`; users writes + permission catalog
 *   document → `SuperAdmin`; users reads → `users.read`) + §8
 *   (adaptive dashboard unchanged, except the `users` section gate
 *   moves from the `SuperAdmin` role to `users.read`).
 * - `AUTH_FLOW.md` (v3 permission claims, endpoint matrix).
 * - `DTO_REFERENCE.md` / `ENUM_REFERENCE.md` (v3 catalog).
 * - `ERROR_CATALOG.md` (`Identity.Forbidden` retired — denials on the
 *   re-centralized endpoints are plain framework `403`s).
 * - `LOCALIZATION_CONTRACT.md`, `PAGINATION_CONVENTION.md`,
 *   `PAYMENT_INTEGRATION_NOTES.md` (no contract change for S3).
 *
 * Audited backend delta (vs Supplement S2 — reads stay delegated):
 * - Removed permissions: `users.manage`, `admins.create`. Resulting
 *   catalog v3 (9 values): `orders.read`, `orders.cancel`,
 *   `orders.refund`, `payments.read`, `payments.stats`,
 *   `inventory.read`, `inventory.manage`, `catalog.manage`,
 *   `users.read`. The `Admin` role still grants nothing — every
 *   permission is granted manually; grants apply on the next
 *   login/refresh; `SuperAdmin` bypasses every gate.
 * - Re-centralized to `SuperAdmin`: `POST /auth/register-admin`
 *   (still creates permission-less admins), `POST
 *   /admin/users/{id}/roles`, `POST /admin/users/{id}/unlock`,
 *   `POST /admin/users/{id}/permissions`, `DELETE
 *   /admin/users/{id}/permissions/{permission}`, `GET
 *   /admin/users/permissions`.
 * - Stayed delegated (`users.read`): `GET /admin/users` (paged +
 *   `status/role/search`, newest-first), `GET /admin/users/counts`,
 *   `GET /admin/users/{id}`, `GET
 *   /admin/users/{id}/permissions` (readable for display).
 * - Moved gate (dashboard `users` section): `SuperAdmin` role →
 *   `users.read` (drill-down renders with the section present).
 * - Retired wire code: `Identity.Forbidden` (no localization key, no
 *   table entry anymore). Status-first 403 handling and the
 *   single-refresh-then-locked discipline are unchanged.
 * - No new paginated surface, no new filters, no new sorts, no DTO
 *   shape changes (paths and bodies are byte-identical — only gates
 *   moved).
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - Canonical wire mirrors stay the single declaration site
 *   (`identity`, `orders`, `payments`, `inventory`, `dashboard`,
 *   `../common/enums`, `../common/shared-types`). This module aliases
 *   nothing structurally and re-declares no wire shape — delta audit
 *   tables only — so no contract drift is possible. (S3.2 lands the
 *   canonical v3 catalog in `../common/enums` and the marker updates
 *   in `libs/api`; S1/S2 audit modules stay frozen as historical
 *   records.)
 * - This module owns the audit-only additions: the v3 catalog pin,
 *   the retired-permission pin, the SuperAdmin-only write table, the
 *   delegated-read table, the moved section gate, the route pins, the
 *   grant-visibility rule, the gap pins. Failure classification reuses
 *   the S2 status-first classifiers (still valid — 403 semantics did
 *   not change).
 *
 * Backend-authoritative data rule (this step's core constraint):
 * this module performs NO permission derivation, NO totals computation,
 * NO status inference, NO customer-identity resolution, NO saga
 * orchestration, NO webhook handling, and NO idempotency-key minting.
 * Client-side state is never treated as domain truth.
 *
 * Explicitly out of scope (later steps, must not appear here):
 * - S3.2 — no `domains/*` edits, no `api-endpoints.ts` edits, no
 *   `IdentityApiService` methods.
 * - S3.3–S3.4 — no dashboard/users pages, states, forms, guards,
 *   or navigation.
 * - S3.5 — no interceptor changes (already 401-only by contract).
 * - No `@Injectable()` store, no signals/computeds, no `HttpClient`.
 *
 * This file is pure types + pure functions: no Angular imports, no
 * `HttpClient`, no browser APIs, no `localStorage`. Every helper is
 * SSR-safe, throws nothing, and performs no HTTP.
 *
 * File naming note: this module is `supplement-s3-audit.ts` (not
 * `*-admin-…`) because the workspace ESLint `**admin**` import guard
 * matches any specifier containing that substring — even a
 * library-internal filename — and would false-positive (same reason as
 * the S1/S2 audit modules and ADR-027/029). Exported symbol names keep
 * the descriptive wording; only the filename avoids the substring.
 */

import type { Guid } from '../common/shared-types';

// ---------------------------------------------------------------------------
// Permission catalog v3 (API_CONTRACT.md §0.5, ENUM_REFERENCE.md Permissions)
// ---------------------------------------------------------------------------

/**
 * Action-level permission catalog v3 (backend removal of
 * `users.manage` + `admins.create`, JWT claim type `"permission"` —
 * one claim per grant). Only `users.read` remains of the users
 * family. The `Admin` role grants nothing — every permission is
 * granted manually afterwards; grants apply on the next
 * login/refresh; `SuperAdmin` bypasses every gate without holding
 * permissions.
 *
 * Audit pin: the canonical declaration lives in `../common/enums`
 * (`PERMISSION_CATALOG`) and is migrated there in S3.2 — this table
 * is the S3.1 reference the migration is verified against. Pure data.
 */
export const SUPPLEMENT_S3_PERMISSION_CATALOG = [
  'orders.read',
  'orders.cancel',
  'orders.refund',
  'payments.read',
  'payments.stats',
  'inventory.read',
  'inventory.manage',
  'catalog.manage',
  'users.read',
] as const;

/** One v3 action-level permission value. */
export type SupplementS3Permission = (typeof SUPPLEMENT_S3_PERMISSION_CATALOG)[number];

/**
 * Whether `value` names a v3 catalog permission. Pure — throws nothing.
 */
export function isSupplementS3Permission(value: unknown): value is SupplementS3Permission {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S3_PERMISSION_CATALOG as readonly string[]).includes(value)
  );
}

/**
 * Removed in v3: `users.manage` and `admins.create` no longer gate
 * anything. Any remaining reference outside historical ADRs/reports/
 * frozen audits is an S3.2 migration miss. Pure data.
 */
export const SUPPLEMENT_S3_RETIRED_PERMISSIONS = ['users.manage', 'admins.create'] as const;

/** One permission value removed by v3 (migration-hygiene check). */
export type SupplementS3RetiredPermission = (typeof SUPPLEMENT_S3_RETIRED_PERMISSIONS)[number];

/**
 * Whether `value` names a permission retired by v3. Pure — throws
 * nothing.
 */
export function isSupplementS3RetiredPermission(
  value: unknown,
): value is SupplementS3RetiredPermission {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S3_RETIRED_PERMISSIONS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Re-centralized writes (SuperAdmin-only) + delegated reads (users.read)
// ---------------------------------------------------------------------------

/**
 * Users endpoints re-centralized to `SuperAdmin`
 * (`API_CONTRACT.md` §1.2/§1.12–§1.15/§1.17). Backend paths verbatim.
 * Enforcement failure → plain framework `403` (no `extensions.code`
 * — match `status` + endpoint context). Pure data — throws nothing.
 */
export const SUPPLEMENT_S3_SUPERADMIN_WRITES = [
  'POST /auth/register-admin',
  'POST /admin/users/{id}/roles',
  'POST /admin/users/{id}/unlock',
  'POST /admin/users/{id}/permissions',
  'DELETE /admin/users/{id}/permissions/{permission}',
  'GET /admin/users/permissions',
] as const;

/** One SuperAdmin-only users endpoint. */
export type SupplementS3SuperAdminWrite = (typeof SUPPLEMENT_S3_SUPERADMIN_WRITES)[number];

/**
 * Whether `value` names a SuperAdmin-only users endpoint. Pure —
 * throws nothing.
 */
export function isSupplementS3SuperAdminWrite(
  value: unknown,
): value is SupplementS3SuperAdminWrite {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S3_SUPERADMIN_WRITES as readonly string[]).includes(value)
  );
}

/**
 * Users endpoints staying delegated under `users.read`
 * (`API_CONTRACT.md` §1.16/§1.19–§1.21). Backend paths verbatim.
 * `GET /admin/users/{id}/permissions` stays readable for display.
 * Pure data — throws nothing.
 */
export const SUPPLEMENT_S3_DELEGATED_READS = [
  'GET /admin/users',
  'GET /admin/users/counts',
  'GET /admin/users/{id}',
  'GET /admin/users/{id}/permissions',
] as const;

/** One `users.read`-delegated endpoint. */
export type SupplementS3DelegatedRead = (typeof SUPPLEMENT_S3_DELEGATED_READS)[number];

/**
 * Whether `value` names a `users.read`-delegated endpoint. Pure —
 * throws nothing.
 */
export function isSupplementS3DelegatedRead(value: unknown): value is SupplementS3DelegatedRead {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S3_DELEGATED_READS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Dashboard section gates v3 (API_CONTRACT.md §8 — only `users` moved)
// ---------------------------------------------------------------------------

/**
 * Dashboard authorization pin (unchanged): `GET /admin/dashboard`
 * takes any authenticated JWT (`401` without token; always `200`
 * otherwise — never a bare forbidden screen). Pure data.
 */
export const SUPPLEMENT_S3_DASHBOARD_AUTH = {
  endpoint: 'GET /admin/dashboard',
  auth: 'authenticated',
} as const;

/**
 * Dashboard section → entitlement gate v3. Only `users` moved
 * (SuperAdmin role → `users.read`); every other gate is unchanged
 * from S2. `orders` and `recentOrders` share the `orders.read` gate;
 * `payments` opens on either `payments.read` or `payments.stats`. A
 * `null` section (objects) or `[]` (recent orders) means not
 * entitled; `0` / `[]` on an entitled section means entitled but
 * empty. Pure data — throws nothing.
 */
export const SUPPLEMENT_S3_DASHBOARD_SECTION_GATES = {
  orders: { permissions: ['orders.read'] },
  recentOrders: { permissions: ['orders.read'] },
  payments: { permissions: ['payments.read', 'payments.stats'] },
  inventory: { permissions: ['inventory.read'] },
  catalog: { permissions: ['catalog.manage'] },
  users: { permissions: ['users.read'] },
} as const;

/** One adaptive dashboard section. */
export type SupplementS3DashboardSection = keyof typeof SUPPLEMENT_S3_DASHBOARD_SECTION_GATES;

/**
 * Whether `value` names an adaptive dashboard section. Pure — throws
 * nothing.
 */
export function isSupplementS3DashboardSection(
  value: unknown,
): value is SupplementS3DashboardSection {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(SUPPLEMENT_S3_DASHBOARD_SECTION_GATES, value)
  );
}

// ---------------------------------------------------------------------------
// Grant-visibility rule (re-centralized: SuperAdmin only)
// ---------------------------------------------------------------------------

/**
 * Re-centralized product rule: the "grant permission" affordance (and
 * the `/users/new` creation link) renders for `SuperAdmin` only,
 * fully hidden for everyone else (no disabled state, no
 * placeholder). The granted list itself stays readable for display
 * (`users.read`). Denials surface as generic status-first error
 * toasts — no wire code is depended upon. Pure — throws nothing.
 */
export function canViewSupplementS3GrantSection(
  viewer: { isSuperAdmin: boolean } | null | undefined,
): boolean {
  if (viewer === null || viewer === undefined) {
    return false;
  }
  return viewer.isSuperAdmin;
}

// ---------------------------------------------------------------------------
// Route pins (confirm with the Admin app in S3.3)
// ---------------------------------------------------------------------------

/**
 * S3 feature route gates: the `users` mount moves to
 * `permissionGuard` over `['users.read']` (OR semantics,
 * fail-closed, `SuperAdmin` bypass); the `new` child route moves to
 * `roleGuard` over `['SuperAdmin']` (creation is not delegable).
 * Pure data.
 */
export const SUPPLEMENT_S3_ROUTE_GATES = {
  usersMount: { permissions: ['users.read'] },
  usersNew: { roles: ['SuperAdmin'] },
} as const;

/**
 * Single-id route scaffolding: user details reads take an id only
 * (`GET /admin/users/{id}` takes no other params; stranger ids mask
 * as `404`). Pure types — throws nothing.
 */
export interface SupplementS3IdQuery {
  readonly id: Guid;
}

/**
 * Structural pre-check for a single-id query: a non-blank id. Pure —
 * throws nothing.
 */
export function isValidSupplementS3IdQuery(query: SupplementS3IdQuery | null | undefined): boolean {
  return (
    query !== null && query !== undefined && typeof query.id === 'string' && query.id.trim() !== ''
  );
}

// ---------------------------------------------------------------------------
// Pagination / filtering / sorting (unchanged by the removal)
// ---------------------------------------------------------------------------

/**
 * Paginated users reads (unchanged: `pageNumber >= 1`,
 * `1 <= pageSize <= 100`, defaults `1`/`20`). The dashboard snapshot
 * never paginates (`recentOrders` fixed newest 5). No new paginated
 * surface, no new filters, no new sorts in S3. Pure data.
 */
export const SUPPLEMENT_S3_PAGINATED_READS = ['userList'] as const;

/** One paginated S3 read. */
export type SupplementS3PaginatedRead = (typeof SUPPLEMENT_S3_PAGINATED_READS)[number];

/**
 * Whether the named S3 read paginates (`PagedResult` envelope). Pure
 * — throws nothing.
 */
export function isSupplementS3PaginatedRead(value: unknown): value is SupplementS3PaginatedRead {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S3_PAGINATED_READS as readonly string[]).includes(value)
  );
}

/**
 * Filter params for the users list (unchanged):
 * `status`/`role`/`search`. Sorting: no users read accepts
 * `sortBy`/`sortDirection` (fixed newest-first) — always unsupported,
 * pinned so S3.3–S3.4 cannot invent a sort control. Pure data —
 * throws nothing.
 */
export const SUPPLEMENT_S3_USER_LIST_FILTERS = ['status', 'role', 'search'] as const;

// ---------------------------------------------------------------------------
// Still-unsupported pins + recorded gaps (never fabricated)
// ---------------------------------------------------------------------------

/**
 * Operations that remain unsupported after the removal and must never
 * be implemented or simulated: no payment history/timeline endpoint,
 * no SPA webhook call, no admin-driven checkout, no client-side
 * permission derivation, no delegated user writes (the removal is
 * the point). Pure data.
 */
export const SUPPLEMENT_S3_STILL_UNSUPPORTED_OPERATIONS = [
  'payment-history',
  'payment-timeline',
  'webhook-spa-call',
  'checkout-from-admin',
  'client-permission-derivation',
  'delegated-user-writes',
] as const;

/** One still-unsupported operation. */
export type SupplementS3StillUnsupportedOperation =
  (typeof SUPPLEMENT_S3_STILL_UNSUPPORTED_OPERATIONS)[number];

/**
 * Whether `value` names a still-unsupported operation. Pure — throws
 * nothing.
 */
export function isSupplementS3StillUnsupportedOperation(
  value: unknown,
): value is SupplementS3StillUnsupportedOperation {
  return (
    typeof value === 'string' &&
    (SUPPLEMENT_S3_STILL_UNSUPPORTED_OPERATIONS as readonly string[]).includes(value)
  );
}

/**
 * Recorded S3 contract notes (documented, never fabricated):
 * - `catalog-doc-superadmin-note`: the permission catalog document
 *   (`GET /admin/users/permissions`) is `SuperAdmin`-only again —
 *   whoever can grant (SuperAdmin) trivially holds it; the S2.1 gap
 *   `permission-catalog-superadmin-note` is resolved (both texts now
 *   agree).
 * - `forbidden-code-retired`: `Identity.Forbidden` has no table entry
 *   anymore; denial classification stays status-first generic 403
 *   (the S2 discipline helper remains valid).
 * - `dashboard-users-read-gate`: the dashboard `users` section (and
 *   its drill-down link) follows `users.read` — section presence is
 *   the entitlement proof, no separate role check.
 * - `user-response-permissions-authoritative`: menus and section
 *   rendering keep reading `GET /auth/me` `permissions: string[]`.
 * Pure data.
 */
export const SUPPLEMENT_S3_RECORDED_GAPS = [
  'catalog-doc-superadmin-note',
  'forbidden-code-retired',
  'dashboard-users-read-gate',
  'user-response-permissions-authoritative',
] as const;

/** One recorded S3 contract note. */
export type SupplementS3RecordedGap = (typeof SUPPLEMENT_S3_RECORDED_GAPS)[number];

/**
 * Whether `value` names a recorded S3 contract note. Pure — throws
 * nothing.
 */
export function isSupplementS3RecordedGap(value: unknown): value is SupplementS3RecordedGap {
  return (
    typeof value === 'string' && (SUPPLEMENT_S3_RECORDED_GAPS as readonly string[]).includes(value)
  );
}
