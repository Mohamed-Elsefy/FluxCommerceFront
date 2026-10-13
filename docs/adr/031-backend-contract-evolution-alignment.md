# ADR 031 — Backend Contract Evolution Alignment (Supplement S1, steps S1.1–S1.2)

Status: Accepted (2026-10-01, Supplement S1 steps S1.1–S1.2).

## Context

The backend staged a contract evolution as uncommitted changes in
`docs/frontend-contract/` (7 files, ~319 insertions): a 9-value
action-level permission catalog (Phase 21), 8 new Identity endpoints
(§1.14–1.21), catalog authorization migration, expanded variant update,
admin orders/payments/dashboard surfaces, inventory list surfaces, 5 new
error codes, and an expanded pagination matrix. Steps S1.1–S1.2 must
fix the exact frontend/backend boundary before any UI in S1.3–S1.10 is
built. Audit sources are the staged diff of `API_CONTRACT.md`,
`AUTH_FLOW.md`, `DTO_REFERENCE.md`, `ENUM_REFERENCE.md`,
`ERROR_CATALOG.md`, `PAGINATION_CONVENTION.md`, and
`PAYMENT_INTEGRATION_NOTES.md`.

## Decision

### 1. Audited contract (the complete new HTTP surface)

- Permissions (§0.5): `orders.read | orders.cancel | orders.refund |
  payments.read | payments.stats | inventory.read | inventory.manage |
  catalog.manage | dashboard.read`. JWT carries one `permission` claim per
  grant; `UserResponse`/`UserAdminResponse` carry `permissions: string[]`
  for menu rendering; assigning `Admin` stores the full bundle; grants
  apply on next login/refresh; `SuperAdmin` passes every gate; failure →
  `403` with no `extensions.code`.
- Identity (§1.14–1.21): `POST/DELETE/GET /admin/users/{id}/permissions`,
  `GET /admin/users/permissions`, `PUT /auth/profile`
  (`UpdateProfileRequest`, all-nullable), `GET /admin/users`
  (`pageNumber/pageSize/status/role/search`, newest-first),
  `GET /admin/users/counts` (`UserAdminCountsResponse`),
  `GET /admin/users/{id}` (`UserAdminResponse` = `UserResponse` +
  `failedAccessAttemptCount/lockoutEndUtc/isLocked`).
- Catalog: all writes `[Authorize(catalog.manage)]` (was `AdminPolicy`);
  reads stay anonymous. `UpdateProductVariantRequest` gains
  `unitPriceAmount?/currency?/status?` (amount+currency paired).
- Orders: customer `GET /orders` gains `status?`; new
  `[Route admin/orders]`: `GET /admin/orders`
  (`pageNumber/pageSize/status/customerId/search/from/to`, newest-first),
  `GET /admin/orders/counts` (`AdminOrderCountsResponse`),
  `GET /admin/orders/{id}` (no ownership scoping),
  `POST /admin/orders/{id}/cancel` (force-cancel any Pending),
  `POST /admin/orders/{id}/refund` (`RefundOrderRequest{reason 1..500}`).
- Inventory: reads → `inventory.read`, writes → `inventory.manage`; new
  `GET /inventory` (`pageNumber/pageSize/search/maxAvailable`, by SKU),
  `GET /inventory/counts` (`lowStockThreshold=5`,
  `InventoryCountsResponse`), `GET /inventory/reservations`
  (`pageNumber/pageSize/status/sku/orderId`, newest-first).
- Payments: new `GET /api/payments/mine` (`pageNumber/pageSize/status?`,
  caller-owned); new `[Route admin/payments]`: `GET /admin/payments`
  (`pageNumber/pageSize/status/orderId/customerId/from/to`),
  `GET /admin/payments/stats` (`PaymentAdminStatsResponse`),
  `GET /admin/payments/{id}` (all `PaymentAdminResponse`). Webhook stays
  Stripe→API only.
- Dashboard (§8): `GET /admin/dashboard?lowStockThreshold=5` →
  `AdminDashboardResponse{orders,payments,inventory,users,recentOrders[5]}`.
- Statuses stay strings on the wire; timestamps in the new slice are
  `DateTimeOffset`; pagination `1/20 max 100`, `pageNumber ≥ 1`.
- Mirrored as aliases in `libs/models` (never re-declared); admin query
  shapes are transport-only with structural pre-checks that never
  substitute backend validation.

### 2. New error codes (status-first, never message-text)

- `Identity.InvalidPermission 400` (permission outside catalog),
  `Identity.PermissionAlreadyGranted 409` (no-op grant),
  `Order.RefundConflict 409` (non-paid refund; in-flight duplicate stays
  `200` idempotent), `Inventory.ValidationFailed 400` (bad list/count
  params), `Payment.ValidationFailed 400` (bad list params).
- Branch on normalized HTTP status + endpoint context only.

### 3. Responsibility boundary

Frontend owns `*-ux, permission-presentation, feature-state,
loading-error-handling, navigation, notifications`. Backend owns
`permission-grants, order/payment/inventory-state, verification,
transitions, pricing, saga, compensation, webhooks, idempotency,
validation, authorization, ownership`. The sets are disjoint
(test-pinned). Order status never implies payment status.

### 4. Placement (scope discipline)

The audit lives in `libs/models` (pure types + pure functions, no
Angular/HTTP/browser — SSR-safe), consumed via `libs/api`
endpoint table + typed services. No feature code in S1.1–S1.2.

File naming note: new audit modules avoid the `admin` substring in
filenames (workspace ESLint `**admin**` import guard false-positives on
library-internal specifiers — same reason as ADR-027/029); exported
symbols keep the `Admin*` prefix.

## Consequences

- Steps S1.3+ build on pinned, tested shapes instead of assumptions.
- `libs/models` + `libs/api` gain the new contracts with specs; no admin
  feature code exists yet.
- Verification: `tsc` (models lib + spec project), `vitest`, `eslint`,
  `prettier`, `verify-architecture.mjs` — all green, 0 errors.
