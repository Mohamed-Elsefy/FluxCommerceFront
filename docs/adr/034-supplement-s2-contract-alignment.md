# ADR 034 — Supplement S2 Contract Alignment (Phase 22 Backend Evolution, Step S2.1)

Status: Accepted (2026-10-05, Supplement S2 step S2.1).

Numbering note: `docs/phases/SUPPLEMENT_S2_ADAPTIVE_DASHBOARD_AND_DELEGATED_ADMIN.md`
references "ADR-033" for this supplement, but ADR-033 is already taken
(`033-admin-shell-navigation-logout.md`, accepted). This alignment is
therefore recorded as ADR-034; the phase document's reference is stale
wording, not a second decision.

## Context

The backend amended the contract as uncommitted changes in
`docs/frontend-contract/` (7 files): permission catalog v2 (Phase 22 —
`dashboard.read` removed; `users.read`, `users.manage`, `admins.create`
added; the `Admin` role grants nothing), `POST /auth/register-admin`
gated by `admins.create`, `/admin/users/**` migrated from
`SuperAdmin`-only to `users.read` (reads) / `users.manage` (writes,
under anti-escalation guards), adaptive `GET /admin/dashboard` (any
authenticated JWT, nullable per-permission sections, new
`CatalogCountsResponse`), new `Identity.Forbidden` 403 (delegation
guard), and the 403 single-refresh-then-locked discipline
(`AUTH_FLOW.md` admin-fetch guidance). Step S2.1 must fix the exact
frontend/backend boundary before any UI in S2.3–S2.4 is built.

## Decision

### 1. Audited contract (the complete changed HTTP surface)

- Permissions (§0.5): `orders.read | orders.cancel | orders.refund |
payments.read | payments.stats | inventory.read | inventory.manage |
catalog.manage | users.read | users.manage | admins.create`. JWT
  carries one `permission` claim per grant; `UserResponse` carries
  `permissions: string[]` for menu rendering (authoritative);
  `SuperAdmin` passes every gate; failure → `403` with no
  `extensions.code`.
- Identity (§1): `POST /auth/register-admin` (`admins.create`,
  creates permission-less admins); `GET /admin/users` (paged +
  `status/role/search`, newest-first), `GET /admin/users/counts`,
  `GET /admin/users/{id}`, `GET /admin/users/{id}/permissions`
  (`users.read`); `POST /admin/users/{id}/roles`,
  `POST /admin/users/{id}/unlock`,
  `POST /admin/users/{id}/permissions` (`409
PermissionAlreadyGranted`), `DELETE
/admin/users/{id}/permissions/{permission}` (idempotent),
  `GET /admin/users/permissions` (`users.manage` — whoever can grant
  must be able to list what is grantable).
- Dashboard (§8): `GET /admin/dashboard?lowStockThreshold=5` → any
  authenticated JWT, always `200`; nullable sections per gate
  (`orders` + `recentOrders` ← `orders.read`; `payments` ←
  `payments.read` or `payments.stats`; `inventory` ← `inventory.read`;
  `catalog` ← `catalog.manage` with new `CatalogCountsResponse`;
  `users` ← `SuperAdmin` role directly); `recentOrders[5]`
  newest-first, `[]` when unauthorized.
- Errors: `Identity.Forbidden` 403 (no localization key — English
  fallback; display `detail` as-is). All failure branching is
  status-first, never message-text-based.
- 403 discipline: one refresh is legitimate (fresh grants land on the
  next login/refresh); a second 403 renders the inline locked state.
  Never a retry loop, never a forced logout (the interceptor admits
  only 401 into recovery — already compliant, no change).
- Pagination/filter/sort: unchanged from S1 (users reads paged
  `1/20 max 100` with `status/role/search`; dashboard never
  paginates — `recentOrders` fixed 5; no S2 read accepts sort
  params).

### 2. Frontend aliases (never re-declared)

- `RegisterAdminRequest` stays canonical in `domains/identity`
  (aliased as `SupplementS2RegisterAdminRequest` for the S2
  boundary).
- `CatalogCountsResponse` shape and the nullable dashboard snapshot
  are pinned as S2.1 audit types (`SupplementS2CatalogCounts`,
  `SupplementS2DashboardSnapshot`); S2.2 lands the canonical
  declarations in `domains/dashboard` and the v2 catalog in
  `common/enums`.

### 3. Recorded gaps (documented, never fabricated)

- `permission-catalog-superadmin-note`: the S2 Objective text says
  only the permission catalog document stays `SuperAdmin`-only, but
  the amended contract (§1.17 + matrix + S2.1 task list) gates it by
  `users.manage`. The contract wins; the Objective sentence is stale.
- `dashboard-users-section-role-gated`: the dashboard `users`
  section (and its drill-down) stays `isSuperAdmin`-gated even for
  `users.read` holders.
- `user-response-permissions-authoritative`: menus/sections render
  from `GET /auth/me` permissions; JWT claims are never trusted for
  display beyond the token lifetime.

### 4. Grant-visibility rule (recorded product decision)

The grant affordance is visible to `SuperAdmin` and `users.manage`
holders only, fully hidden otherwise (no disabled state).
Anti-escalation races surface as `Identity.Forbidden` error toasts
(`canViewSupplementS2GrantSection` pins the rule).

## Consequences

- S2.2 migrates `PERMISSION_CATALOG`, `dashboard.ts`,
  `contract-evolution-audit.ts` / `orders-payments-contract.ts`
  notes, and `api-endpoints.ts` markers against this audit; any
  `dashboard.read` reference outside historical ADRs/reports after
  S2.2 is a migration miss.
- No UI in S2.3–S2.4 may exceed the audited callable tables. If the
  backend adds surface mid-supplement, re-run S2.1 first.
- Verification: `libs/models` unit specs for every
  mapping/classifier/pre-check; `tsc` (libs + spec); architecture
  audit unchanged (pure types + pure functions, no Angular, no
  `HttpClient`, SSR-safe).

## Integration record (steps S2.2–S2.6, added S2.7)

Single-ADR supplement (the phase document's "ADR-033" covers
alignment + integration as one decision; recorded here as 034).

- S2.2 landed the v2 shapes canonically (`PERMISSION_CATALOG` v2,
  nullable dashboard + `CatalogCountsResponse`, endpoint markers,
  1:1 `registerAdmin` verification); the S1 audit module was frozen
  as a historical record instead of rewritten.
- S2.3 kept `/dashboard` the open landing (shell roles only) with
  per-entitlement cards, the catalog card, and the honest empty
  state; envelope handling unchanged.
- S2.4 migrated `/users` to delegated gates (mount OR-trio, `new`
  under `admins.create`, navigation filtered, grant UI hidden
  otherwise, permission-less creation copy).
- S2.5 verified 403 discipline with no code changes (401-only
  interceptor, no retry operators, no logout-on-403, manual retry
  only).
- S2.6 proved the slices with mocked-transport E2E (25 new/updated
  journeys; 68 admin + 86 storefront re-verified green) and fixed
  two pre-existing blockers found along the way (overlapping
  Playwright `testMatch` patterns; one S1.8-broken storefront
  assertion).
