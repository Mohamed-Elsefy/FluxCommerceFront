# ADR 032 — Permission-Gated Admin Integration (Supplement S1, steps S1.3–S1.11)

Status: Accepted (2026-10-01, Supplement S1 steps S1.3–S1.11).

## Context

Steps S1.3–S1.11 turn the ADR-031 audit into working UI: permission
guards, profile editing, users management, catalog migration, inventory
lists, admin orders upgrade, payments lists, live dashboard, hardening and
E2E. Every slice builds inside the audited boundary instead of around it.

## Decision

### 1. Permission guards are UX-only, backend remains the boundary

`permissionGuard` reads `route.data['permissions']` (OR semantics,
fail-closed, SuperAdmin bypass, denial → `/forbidden`). `roleGuard` is
kept for compatibility. `AuthService` exposes `permissions()`,
`hasPermission()`, `isSuperAdmin` from `GET /auth/me`. Navigation
destinations filter by permissions. A demoted admin keeps rights only
until token expiry — pinned by test.

### 2. Profile editing honors nullable semantics

`PUT /auth/profile`: `null` keeps, empty clears optional fields. The
storefront form is typed Reactive; `preferredLanguage/timeZone` sync as
hints to `CultureService` without hard coupling. `404` (deleted between
login and call) renders the shared error state.

### 3. Users management is SuperAdmin-only

`features/users/` under the guarded shell: paged table
(`status/role/search`), counts cards, details facts, grant (409 on
duplicate) / revoke (idempotent) / list / catalog. Reuses Phase 12
primitives; no `libs/ui` additions (closed set, ADR-026).

### 4. Catalog migrates to `catalog.manage`, variant update expands

Route chain requires `catalog.manage`; variant form adds paired
`unitPriceAmount+currency` and `status`. Sellability renders from the
existing `variantStatusDisplay` map. No invented lifecycle.

### 5. Inventory grows by lists, single lookups stay as targets

`listItems/listReservations/getCounts` with response-effective pagers and
fixed sorts; `ValidationFailed` handled explicitly. Counts cards render
`InventoryCountsResponse` verbatim. No invented thresholds beyond the
`lowStockThreshold` query param.

### 6. Admin orders move to the platform-wide surface

`GET /admin/orders` + filters, real `counts`, force-cancel, refund with
`reason` (page-local submission, duplicate-submit prevention).
`RefundConflict` (incl. idempotent in-flight `200`) handled status-first.
Storefront gains `status` filter on `GET /orders`. Caller-owned fallback
is removed from admin code.

### 7. Payments stay read-only in admin, mine for customers

Customer `GET /api/payments/mine?status?`; admin `GET /admin/payments` +
`stats` + `GET /{id}` over `PaymentAdminResponse`. The live
`clientSecret` is discarded at the mapping boundary (spec-pinned); admin
never confirms cards. History stays unsupported (`PAYMENT_HISTORY_SUPPORTED
= false` unchanged).

### 8. Dashboard becomes a live snapshot

`dashboard-api.service + DashboardState` over `GET /admin/dashboard`:
four count sections verbatim + `recentOrders[5]` drill-down. First
failing section surfaces. Static `UPCOMING_MODULES` placeholders removed.
Guarded by `dashboard.read`.

### 9. Placement (scope discipline)

All users code in `features/users/`; orders/payments/inventory/dashboard
extend their owning features; shared table grows by extension never by
fork (sanctioned ADR-028/030 pattern). No global stores, no `libs/ui`
additions, no cross-feature imports — audit stays green.

## Consequences

- Admin unit/E2E suites grow (users, extended orders/payments/inventory,
  dashboard, profile edit); pre-existing suites re-verified green; both
  builds green.
- Former `UNSUPPORTED_*` pins flip to supported where the contract now
  covers them; remaining gaps (payment history, if any) stay pinned in
  code/docs/tests instead of fabricated.
- Verification: `tsc` (both apps, models lib, spec project), `vitest`,
  `eslint`, `prettier`, `verify-architecture.mjs`, `ng build storefront`
  (SSR) + `ng build admin` (CSR), Playwright admin + storefront scopes —
  all green with 0 errors.
