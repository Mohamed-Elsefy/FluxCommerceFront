# Supplement S1 — Backend Contract Evolution (Permissions, Admin Lists, Dashboard)

> **Supplementary track — not part of the core roadmap.**
> This document is an optional addendum, separate from the original plan
> (Phases 0–14 core + Phase 15 Final QA & Optimization). It may be adopted,
> deferred, or dropped without affecting the core roadmap numbering,
> completion status, or acceptance of Phases 0–15. Steps are numbered
> `S1.1–S1.11` so they never collide with core phase numbering.

## Objective

Implement the frontend for the evolved backend contract currently staged as
uncommitted changes in `docs/frontend-contract/` (API_CONTRACT + AUTH_FLOW +
DTO_REFERENCE + ENUM_REFERENCE + ERROR_CATALOG + PAGINATION_CONVENTION +
PAYMENT_INTEGRATION_NOTES):

- Action-level permission system (Phase 21 backend, 9 permissions, JWT
  `permission[]` claims, SuperAdmin supremacy).
- Identity growth: `PUT /auth/profile`, `GET /admin/users` (paged + filters),
  `GET /admin/users/counts`, `GET /admin/users/{id}`, permission
  CRUD (`POST/DELETE/GET /admin/users/{id}/permissions`,
  `GET /admin/users/permissions`).
- Catalog authorization migration (`Admin` → `catalog.manage`) + expanded
  `UpdateProductVariantRequest` (`sku/name/unitPriceAmount/currency/status`).
- Inventory list surface: `GET /inventory` (paged + `search/maxAvailable`),
  `GET /inventory/counts`, `GET /inventory/reservations` (paged + filters),
  with `inventory.read` / `inventory.manage` split.
- Admin Orders surface `[Route admin/orders]`: `GET /admin/orders` (filters
  `status/customerId/search/from/to`), `GET /admin/orders/counts`,
  `GET /admin/orders/{id}`, `POST /admin/orders/{id}/cancel` (force-cancel),
  `POST /admin/orders/{id}/refund` (`RefundOrderRequest`).
- Customer `GET /orders?status=` + customer `GET /api/payments/mine?status=`.
- Admin Payments surface `[Route admin/payments]`: `GET /admin/payments`
  (filters), `GET /admin/payments/stats`, `GET /admin/payments/{id}`.
- Admin Dashboard: `GET /admin/dashboard` → `AdminDashboardResponse`.
- New error codes (`Identity.InvalidPermission`, `PermissionAlreadyGranted`,
  `Order.RefundConflict`, `Inventory.ValidationFailed`,
  `Payment.ValidationFailed`) and expanded pagination matrix.

The supplement must remain contract-driven. The staged `docs/frontend-contract/`
is the source of truth once committed. The frontend must not invent
permissions, endpoints, DTOs, filters, or business rules beyond it.

Scope status: adopting this supplement is **optional**. Skipping it leaves
the core plan (Phases 0–15) intact; the previously recorded contract gaps
simply remain pinned instead of implemented.

---

## S1.1 — Foundation & Backend Contract Alignment (contract gate)

### Goals

Fix the exact new integration boundary before any UI code: which endpoints
are callable, which DTOs travel where, which reads paginate/filter/sort, how
permissions gate every row, and who owns what.

### Tasks

- Commit-review the staged `docs/frontend-contract/` diff (7 files):
  `API_CONTRACT.md` §0.4/§0.5/§1.14–1.21/§2–§8, `AUTH_FLOW.md` permission
  claims + matrix, `DTO_REFERENCE.md` §1/§4–§8, `ENUM_REFERENCE.md`
  Permissions + `RefundRequestOutcome`, `ERROR_CATALOG.md` 5 new codes,
  `PAGINATION_CONVENTION.md` 6 new rows, `PAYMENT_INTEGRATION_NOTES.md`
  webhook + §4 wording.
- Produce the audited callable table: permission → endpoints (see
  `API_CONTRACT.md` §0.5), including SuperAdmin supremacy and
  next-login/refresh grant semantics.
- Define frontend aliases (never re-declared): `UpdateProfileRequest`,
  `GrantPermissionRequest`, `UserAdminResponse`, `UserAdminCountsResponse`,
  `AdminOrderCountsResponse`, `RefundOrderRequest`, `InventoryCountsResponse`,
  `PaymentAdminResponse`, `PaymentAdminStatsResponse`, `AdminDashboardResponse`
  + admin query shapes (paging-only transport + structural pre-checks).
- Pin status-first failure classifiers for the 5 new error codes (never
  message-text-based).
- Record remaining gaps (if any) instead of fabricating them.
- Deliver as `libs/models` pure types + pure functions + specs (no Angular,
  no HttpClient — SSR-safe), plus ADR-031.

### Completion Criteria

- The Supplement S1 implementation boundary is explicitly aligned with the staged
  backend contract.
- All planned API interactions are backed by real contracts.
- Any unsupported capability is documented instead of fabricated.

---

## S1.2 — Shared Models & API Endpoints

### Goals

Land the contract shapes in shared infrastructure so features consume them.

### Tasks

- Extend `libs/models/.../domains/identity.ts`: `permissions: string[]` on
  `UserResponse`, new admin/request types, `Permission` union +
  `PERMISSION_CATALOG` (9 values).
- Extend `catalog.ts` (`UpdateProductVariantRequest` + paired
  amount+currency validator), `orders.ts`, `payments.ts`, `inventory.ts`,
  new `dashboard.ts`.
- Extend `libs/api/.../api-endpoints.ts`: `updateProfile`,
  `listUsers/userCounts/getUser/*permissions`, `adminOrders/*`,
  `adminPayments/*`, `paymentsMine`, `inventoryList/counts/reservationList`,
  `dashboard`.
- Extend `IdentityApiService` (including currently table-only
  `assignRole/unlockUser`) with typed methods for every new endpoint.
- Unit-test every mapping/classifier/pre-check.

### Completion Criteria

- No feature imports contract shapes from `docs/` directly.
- `tsc` (libs + spec) green.

---

## S1.3 — Permission Authorization Infrastructure

### Goals

Replace role-only admin gating with permission-aware gating.

### Tasks

- Extend `CurrentUser` + `AuthService`: `permissions: Signal<string[]>`,
  `hasPermission()`, `isSuperAdmin`, populated from `GET /auth/me`.
- Create `permissionGuard` (reads `route.data['permissions']`, OR semantics,
  fail-closed, SuperAdmin bypass, denial → `/forbidden`).
- Keep `roleGuard` for compatibility; document guards as UX-only (backend
  authoritative).
- Migrate admin shell + feature routes: catalog → `catalog.manage`,
  inventory reads → `inventory.read` / writes → `inventory.manage`,
  orders → `orders.read/cancel/refund`, payments → `payments.read/stats`,
  dashboard → `dashboard.read`, users → `SuperAdmin`.
- Hide/show navigation destinations by permissions (menu rendering from
  `permissions[]`).

### Completion Criteria

- A demoted admin keeps rights only until token expiry (verified by test).
- Missing permission → `403`-equivalent UX (forbidden page).
- Audit `106/106` unchanged or extended by sanctioned additions only.

---

## S1.4 — Profile Editing (Storefront)

### Goals

Make `PUT /auth/profile` usable: nullable semantics (`null` keeps, empty
clears optional phone/avatar).

### Tasks

- Add `updateProfile` to data-access + route-provided state.
- Convert `/account/profile` from read-only to typed Reactive Form
  (`firstName/lastName/phoneNumber/avatarUrl/preferredLanguage/timeZone`).
- Sync `preferredLanguage/timeZone` with `CultureService` hints (no hard
  coupling).
- Handle `400 Validation` (field-error projection), `401`, `404`
  (deleted-between-login).
- Localize, RTL-verify, focus-manage.

### Completion Criteria

- Profile edits round-trip against the real contract.
- Read-only comment removed; no unvalidated client math.

---

## S1.5 — Admin Users & Permissions (SuperAdmin)

### Goals

Deliver `/admin/users` management: list, counts, details, grant/revoke.

### Tasks

- Feature `features/users/` (pages/data-access/state/models/routes) under
  guarded shell with `SuperAdmin`-only chain.
- List: paged table + `status/role/search` filters (case-insensitive,
  unknown → `400`), response-effective pager, fixed newest-first.
- Counts cards from `GET /admin/users/counts`.
- Details: `UserAdminResponse` facts (lockout, attempts, permissions).
- Grant (`POST .../permissions` → `409 PermissionAlreadyGranted`),
  revoke (`DELETE .../{permission}` idempotent), list, catalog read.
- Reuse Phase 12 primitives (table/pager/filter/dialog/notifications); no
  `libs/ui` additions (closed set, ADR-026).

### Completion Criteria

- SuperAdmin can manage users + permissions end-to-end (mocked-transport E2E).
- `Identity.InvalidPermission 400` handled status-first.

---

## S1.6 — Catalog Authorization Migration + Variant Update

### Goals

Migrate writes to `catalog.manage` and unlock price/status editing on
variants.

### Tasks

- Update route guards + docs comments (`writes need Admin role` →
  `catalog.manage`).
- Extend `toUpdateVariantRequest` + form: optional `unitPriceAmount/currency`
  (paired — both or neither), `currency ^[A-Z]{3}$`, `status Active/Inactive`.
- Keep sellability display (`variantStatusDisplay`) as source; no invented
  lifecycle beyond the contract.
- Regression-test existing catalog/inventory E2E.

### Completion Criteria

- Variant price + status edits round-trip (`204`).
- Old `{sku,name}`-only comment removed.

---

## S1.7 — Inventory Lists & Counts

### Goals

Replace single-lookup-only inventory with the new list surface (largest UI
in this phase).

### Tasks

- `InventoryAdminApiService`: `listItems(search/maxAvailable)`,
  `getCounts(lowStockThreshold=5)`, `listReservations(status/sku/orderId)` —
  all paged `1/20 max 100`, fixed sorts (SKU / newest-first).
- New states/pages: stock list + counts cards + reservation list; keep
  single-lookup pages as deep-link targets.
- `Inventory.ValidationFailed 400` (bad pagination/status/SKU/negative
  threshold) handled explicitly.
- `InventoryCountsResponse` cards
  (`totalItems/totalOnHand/totalReserved/lowStockItems` + reservation
  buckets).

### Completion Criteria

- Stock + reservation browsing works paged/filtered (E2E).
- `ADMIN_CALLABLE_INVENTORY_ENDPOINTS` updated; `no list` comments removed.

---

## S1.8 — Admin Orders Upgrade + Storefront Status Filter

### Goals

Move admin orders from caller-owned `GET /orders` to the real admin surface.

### Tasks

- `OrdersAdminApiService`: switch to `GET /admin/orders` (+ filters),
  `GET /admin/orders/counts` (replace `pageSize=1` hack),
  `GET /admin/orders/{id}` (no ownership scoping),
  `POST .../cancel` (force-cancel any Pending),
  `POST .../refund {reason 1..500}`.
- Flip `supportsAdminOrdersFiltering` to matrix-driven true; add filter bar
  (`status/customerId/search/from/to`, `from>to → 400`).
- `Order.RefundConflict 409` (incl. idempotent in-flight duplicate → `200`)
  + `CancelConflict` handling; refund stays page-local submission.
- Storefront `GET /orders?status=` filter (customer list).
- Update `UNSUPPORTED_ADMIN_ORDER_OPERATIONS` pins.

### Completion Criteria

- Admin sees platform-wide orders, counts, force-cancel, refund (E2E).
- No caller-owned fallback remains in admin code.

---

## S1.9 — Payments: Mine + Admin + Stats

### Goals

Deliver the missing payment lists on both apps.

### Tasks

- `libs/models`: `PaymentAdminResponse` (explicit contract, replaces
  anonymous-object comment), `PaymentAdminStatsResponse`,
  `PaymentCurrencyTotalResponse`.
- Storefront: `GET /api/payments/mine?status?` list (caller-owned).
- Admin: `GET /admin/payments` (+ `status/orderId/customerId/from/to`),
  `GET /admin/payments/stats` (totals + `totalsByCurrency`),
  `GET /admin/payments/{id}`.
- `Payment.ValidationFailed 400` handling; keep `clientSecret` discard at
  mapping boundary (admin never confirms cards).
- Flip `UNSUPPORTED_ADMIN_PAYMENT_OPERATIONS` pins
  (`payment-list`, `payment-status-filter` supported; history stays
  unsupported).

### Completion Criteria

- Customer + admin payment lists + stats render (E2E).
- No history UI invented.

---

## S1.10 — Admin Dashboard (Real API)

### Goals

Replace the static dashboard with `GET /admin/dashboard`.

### Tasks

- `dashboard-api.service + DashboardState` over
  `GET /admin/dashboard?lowStockThreshold=5`.
- Cards: `orders (AdminOrderCountsResponse)`, `payments
  (PaymentAdminStatsResponse)`, `inventory (InventoryCountsResponse)`,
  `users (UserAdminCountsResponse)` + `recentOrders[5]` drill-down widget.
- First-failing-section error surfacing per contract.
- Remove `UPCOMING_MODULES` static placeholders; keep session card.
- Guard with `dashboard.read`.

### Completion Criteria

- Landing shows live counts + recent orders (E2E).
- `no dashboard API` comments removed.

---

## S1.11 — Localization, RTL, Responsive, Accessibility, E2E & Documentation

### Goals

Harden + verify the whole evolution as one shippable slice.

### Tasks

- Zero hardcoded strings; `*.` bundles for users/permissions/profile/
  lists/counts/refund/dashboard in 5 cultures; key-leakage assertions.
- Logical-properties-only CSS; RTL render tests; 375px overflow checks
  (`overflow-wrap: anywhere` on ids/references).
- ARIA + focus management (filter bars, dialogs, retry).
- Unit/component specs for every new mapping/guard/state; E2E new suites
  (`admin-users`, extended `admin-orders`, `admin-payments`, inventory
  lists, dashboard, profile edit) + re-verified pre-existing suites.
- Docs: ADR-031 (alignment), ADR-032 (integration), this report,
  PROJECT_CONTEXT/ARCHITECTURE sync,-DoD checkboxes.
- Verification matrix: `tsc` (both apps + libs + spec), `vitest`,
  `eslint`, `prettier`, `verify-architecture.mjs`, both builds, Playwright.

### Completion Criteria

- Full matrix green, 0 errors; the core roadmap (Phase 15 — Final QA) is unaffected whether this supplement is adopted or not.

---

# Supplement S1 Completion Checklist

## Contract

- [x] Staged frontend-contract diff committed & reviewed
- [x] Permission catalog (§0.5) pinned in models
- [x] Identity endpoints 1.14–1.21 verified
- [x] Variant PUT expansion verified
- [x] Admin orders/payments/dashboard contracts verified
- [x] Inventory lists/counts verified
- [x] New error codes mapped status-first
- [x] Pagination matrix extended

## AuthZ

- [x] `permissions` signal + `hasPermission` + `isSuperAdmin`
- [x] `permissionGuard` created & tested
- [x] Shell + feature routes migrated
- [x] Navigation permission-filtered
- [x] SuperAdmin supremacy verified

## Features

- [x] Profile editing (storefront)
- [x] Admin users & permissions (SuperAdmin)
- [x] Catalog `catalog.manage` + variant price/status
- [x] Inventory lists & counts
- [x] Admin orders (list/counts/cancel/refund + filters)
- [x] Storefront orders `status` filter
- [x] Payments mine + admin + stats
- [x] Dashboard live API

## UX

- [x] Localization complete (5 cultures)
- [x] RTL/LTR verified
- [x] Responsive verified
- [x] Accessibility verified
- [x] Loading/empty/error states verified

## Testing

- [x] Unit + component specs added
- [x] Guard + mapping specs added
- [x] E2E new suites green
- [x] Pre-existing suites re-verified green
- [x] Architecture audit green
- [x] Both builds green

## Architecture & Documentation

- [x] No direct component API access
- [x] No `libs/ui` additions
- [x] No cross-feature violations
- [x] ADR-031 + ADR-032 recorded
- [x] `PROJECT_CONTEXT.md` updated (supplement adoption noted; core numbering untouched)
- [x] `ARCHITECTURE.md` updated
- [x] Supplement S1 completion note written (only if adopted)

---

# Supplement S1 Dependency Flow

```text
S1.1 Contract Alignment (gate)
        │
        ▼
S1.2 Models & Endpoints
        │
        ├───► S1.3 Permission Guards
        │             │
        │             ├───► S1.5 Admin Users
        │             │
        │             ├───► S1.6 Catalog migration
        │             │
        │             ├───► S1.7 Inventory lists
        │             │
        │             ├───► S1.8 Admin Orders
        │             │
        │             ├───► S1.9 Payments
        │             │
        │             └───► S1.10 Dashboard
        │
        ▼
S1.4 Profile Editing (independent after S1.2)
                      │
                      ▼
              S1.11 Hardening / E2E / Docs
```

## Implementation Rule

**S1.1 is the contract gate for the entire supplement.**

No UI in S1.3–S1.10 may exceed the audited callable table. If the backend
adds further surface mid-supplement, re-run S1.1 first. The frontend never
fabricates permissions, endpoints, filters, history, or business rules.
Refund/cancel/grant/revoke submissions stay page-local with duplicate-submit
prevention; secrets (`clientSecret`) are discarded at the mapping boundary.
