# Supplement S1 — Backend Contract Evolution: Completion Report

Status: **Complete**.

Supplement S1 implements the frontend for the evolved backend contract
(permissions, admin lists, dashboard) as an optional addendum to the
core roadmap. The core plan (Phases 0–14 complete, Phase 15 — Final QA
& Optimization next) is unaffected. Steps are numbered `S1.1–S1.11` so
they never collide with core phase numbering.

Related references: `docs/PROJECT_CONTEXT.md` (§41),
`docs/ARCHITECTURE.md` (as-built notes in §§4, 22),
`docs/phases/SUPPLEMENT_S1_BACKEND_CONTRACT_EVOLUTION.md`,
`docs/adr/031–032`.

The final boundary holds: the frontend presents the new contract
surface and owns permission presentation, feature state, and
navigation; the backend owns permission grants, order/payment/
inventory/user state, verification, transitions, pricing, saga,
compensation, webhooks, idempotency, validation, authorization, and
ownership. No permission, endpoint, DTO, filter, sort, history record,
mutation, threshold, or response model was invented — every contract
gap stays pinned in code, docs, or tests instead of fabricated.

---

## 1. Sub-phase summary

```text
S1.1 Foundation & Backend Contract Alignment (contract gate)
     Audited the exact new integration boundary before any UI code:
     the 9-value permission catalog, 8 new Identity endpoints, catalog
     authorization migration, expanded variant update, admin
     orders/payments/dashboard surfaces, inventory list surfaces, 5 new
     error codes, and the expanded pagination matrix. Delivered as
     `contract-evolution-audit.ts` + specs in `libs/models` (pure types
     + pure functions, no feature code) and ADR-031. No unresolved API
     assumptions remain.

S1.2 Shared Models & API Endpoints
     Landed the contract shapes in shared infrastructure
     (`libs/models` domains + `libs/api` endpoint tables + typed
     `IdentityApiService` methods) with unit-tested
     mappings/classifiers/pre-checks. No feature imports contract
     shapes from `docs/` directly.

S1.3 Permission Authorization Infrastructure
     Replaced role-only admin gating with permission-aware gating:
     `permissions` signal + `hasPermission()` + `isSuperAdmin` on
     `AuthService`, `permissionGuard` (OR semantics, fail-closed,
     SuperAdmin bypass, denial → `/forbidden`), `roleGuard` kept for
     compatibility, admin shell + feature routes migrated
     (`catalog.manage`, `inventory.read`/`manage`, `orders.read`,
     `payments.read`/`stats`, `dashboard.read`, users → `SuperAdmin`),
     navigation destinations permission-filtered. A demoted admin keeps
     rights only until token expiry (test-pinned).

S1.4 Profile Editing (Storefront)
     Made `PUT /auth/profile` usable with nullable semantics (`null`
     keeps, empty clears optional phone/avatar): typed Reactive Form on
     `/account/profile` (previously read-only), `preferredLanguage`/
     `timeZone` hints synced with `CultureService`, `400` field-error
     projection, `404` deleted-between-login handling, 5-culture copy
     with RTL-safe rendering and focus management.

S1.5 Admin Users & Permissions (SuperAdmin)
     Delivered `/admin/users` management under the guarded shell:
     paged table (`status`/`role`/`search`), counts cards, details
     facts (lockout, attempts, permissions), grant (`409
     PermissionAlreadyGranted`) / revoke (idempotent) / list /
     catalog. Phase 12 primitives reused; no `libs/ui` additions.

S1.6 Catalog Authorization Migration + Variant Update
     Migrated writes to `catalog.manage`; extended the variant form
     with paired `unitPriceAmount`+`currency` and `status`
     (`Active`/`Inactive`). Sellability still renders from the existing
     `variantStatusDisplay` map; no invented lifecycle.

S1.7 Inventory Lists & Counts
     Replaced single-lookup-only inventory with the list surface:
     stock list (`search`/`maxAvailable`), counts cards, reservation
     list (`status`/`sku`/`orderId`) — all paged `1/20 max 100` with
     fixed sorts; single-lookup pages kept as deep-link targets.
     `Inventory.ValidationFailed 400` handled explicitly.

S1.8 Admin Orders Upgrade + Storefront Status Filter
     Moved admin orders from caller-owned `GET /orders` to the real
     admin surface: platform-wide list with filters, real counts
     (replacing the `pageSize=1` hack), unscoped details, force-cancel
     (`Pending`), refund with `reason` (page-local submission).
     `RefundConflict` (incl. idempotent in-flight `200`) +
     `CancelConflict` handled status-first. Storefront gained the
     `status` filter on `GET /orders`. No caller-owned fallback remains
     in admin code.

S1.9 Payments: Mine + Admin + Stats
     Delivered the missing payment lists on both apps: storefront
     `GET /api/payments/mine?status?` (`/payment/mine` with status
     filter + pager), admin `GET /admin/payments` (+ filters),
     `GET /admin/payments/stats` (totals + `totalsByCurrency`),
     `GET /admin/payments/{id}`. `Payment.ValidationFailed 400`
     handled; `clientSecret` discard kept at the mapping boundary;
     `payment-list`/`payment-status-filter` pins flipped; history stays
     unsupported (`*_HISTORY_SUPPORTED = false`).

S1.10 Admin Dashboard (Real API)
     Replaced the static dashboard with `GET /admin/dashboard`:
     `DashboardApiService` + `DashboardState` over
     `?lowStockThreshold=5`; four verbatim count sections plus the
     `recentOrders[5]` drill-down into the existing admin order
     details; first-failing-section error surfacing; static
     `UPCOMING_MODULES` placeholders removed (with the now-unused
     `DashboardCard`); session card kept; guarded by `dashboard.read`;
     users drill-down gated on `isSuperAdmin`.

S1.11 Hardening, E2E & Documentation (this sub-phase)
     Full matrix green (below); RTL unit coverage added for the S1
     slices that lacked it (users/inventory/profile/variant pages);
     RTL E2E added for users and inventory lists; 5 pre-existing files
     reformatted to the Prettier baseline; ADR-031/032 recorded; this
     report; DoD checkboxes; PROJECT_CONTEXT/ARCHITECTURE sync.
```

---

## 2. Test coverage

```text
Unit/component (executed):
  admin        116 files / 735 passed (S1.3–S1.11 slices: permission
                guards + navigation, users, catalog migration,
                inventory lists, orders upgrade, payments, dashboard,
                plus S1.11 RTL hardening)
  libs          70 files /  520 passed (S1.1 audit module + S1.2
                domains/endpoints/services + contract matrices)
  storefront  126 files / 1433 passed (S1.4 profile editing, S1.8
                orders status filter, S1.9 payments mine, S1.11
                profile RTL)

Architecture: 106/106 checks passed (no script changes needed in
              Supplement S1 — table extensions follow the sanctioned
              ADR-028/030 extend-never-fork pattern; no `libs/ui`
              additions; no cross-feature imports; no new global
              stores)

E2E (playwright, mocked transports, executed):
  full suite            201 passed, 7 skipped (provider-gated skips,
                        pre-existing pattern)
  incl. new S1 suites:  admin-users (incl. French + RTL chrome),
                        extended admin-orders (platform-wide list +
                        filters + counts + force-cancel + refund),
                        admin-payments (12: stats, list/pager/details,
                        filters, empty/error/retry, failed status,
                        forbidden, French + RTL chrome),
                        payments-mine (5: list, status filter, empty,
                        error/retry, anonymous redirect),
                        admin-dashboard (7: live counts, drill-down,
                        empty, error/retry, users-link gating,
                        forbidden, French + RTL chrome),
                        inventory lists (stock/reservation filters +
                        RTL chrome), profile editing

Production builds: storefront SSR + 15/15 prerendered routes;
  admin CSR with per-page lazy chunks (incl. payments + dashboard);
  zero budget warnings.
```

---

## 3. Verification results

```text
typecheck (tsc --noEmit)  storefront, admin, libs (7 projects), specs — 0 errors
lint (prettier --check)   0 errors (5 pre-existing style drifts reformatted in S1.11)
lint (eslint .)           0 errors
verify-architecture       106/106 checks passed
test:unit                 100% pass (admin 735, libs 520, storefront 1433)
test:e2e (full suite)     201 passed, 7 skipped (provider-gated), mocked transports
build:storefront          SSR + 15 prerendered routes — 0 errors
build:admin               CSR, all lazy route chunks — 0 errors
responsive probes         scroll-safe tables, auto-fit grids, wrapping facts,
                          token-only logical CSS; audit-enforced
```

---

## 4. Definition of Done (Supplement S1 checklist — item-by-item)

```text
Contract
[x] Staged frontend-contract diff committed & reviewed (S1.1 audit + ADR-031)
[x] Permission catalog (§0.5) pinned in models (PERMISSION_CATALOG + JWT claims)
[x] Identity endpoints 1.14–1.21 verified (profile, users, counts, permissions)
[x] Variant PUT expansion verified (amount+currency paired, status)
[x] Admin orders/payments/dashboard contracts verified (S1.1 audit + ADR-031)
[x] Inventory lists/counts verified (S1.1 audit + S1.7 E2E)
[x] New error codes mapped status-first (5 codes, never message-text)
[x] Pagination matrix extended (6 new rows, client-side totalPagesOf)

AuthZ
[x] `permissions` signal + `hasPermission` + `isSuperAdmin` (AuthService, tested)
[x] `permissionGuard` created & tested (OR semantics, fail-closed, SuperAdmin bypass)
[x] Shell + feature routes migrated (catalog/inventory/orders/payments/dashboard/users)
[x] Navigation permission-filtered (visibleDestinations, SuperAdmin bypass)
[x] SuperAdmin supremacy verified (guard + navigation specs)

Features
[x] Profile editing — storefront `PUT /auth/profile` round-trip (nullable semantics)
[x] Admin users & permissions — SuperAdmin end-to-end (mocked-transport E2E)
[x] Catalog `catalog.manage` + variant price/status (`204` round-trip)
[x] Inventory lists + counts (paged/filtered E2E)
[x] Admin orders — platform-wide list/counts/force-cancel/refund + filters (E2E)
[x] Storefront orders `status` filter (state + page + E2E-adjacent coverage)
[x] Payments mine + admin + stats (customer + admin lists + stats render, E2E)
[x] Dashboard live API (counts + recent orders drill-down, E2E)

UX
[x] Localization complete (users/permissions/profile/lists/counts/refund/dashboard
    bundles in 5 cultures; key-parity specs; key-leakage assertions incl. RTL)
[x] RTL/LTR verified (logical-properties-only CSS, audit-enforced; ar render specs;
    RTL E2E journeys for orders/payments/dashboard/users/inventory)
[x] Responsive verified (scroll-safe tables, auto-fit grids, wrapping facts incl.
    `overflow-wrap: anywhere` on ids/references; 375px-safe patterns)
[x] Accessibility verified (labels, badges as text, focus states incl. failure-banner
    focus management, native controls; dialog/focus coverage on grant/revoke,
    cancel/refund, retry paths)
[x] Loading states verified (resource slots + shared async UI; section-independent
    lifecycles)
[x] Empty states verified (landing/list/items/payment-404/recent-orders paths)
[x] Error states verified (400/401/403/404/409 + retry paths unit- and E2E-covered)

Testing
[x] Unit tests added (§2)
[x] Component tests added (§2)
[x] Guard + mapping specs added (permissionGuard, status displays, classifiers)
[x] E2E new suites green (§2)
[x] Pre-existing suites re-verified green (full suite: 201 passed)
[x] Architecture checks pass (106/106)
[x] Both builds green (§2)

Architecture & Documentation
[x] No direct component API access (audit-enforced; ApiClient only)
[x] No `libs/ui` additions (closed set, ADR-026; Phase 12 primitives reused)
[x] No cross-feature violations (audit 106/106; routes-only seams between features)
[x] Performance reviewed (route-level states, supersede-or-lock concurrency,
    response-effective pagers, per-page lazy chunks; no new stores, no polling loops)
[x] ADR-031 recorded (S1.1–S1.2 alignment)
[x] ADR-032 recorded (S1.3–S1.11 integration)
[x] `PROJECT_CONTEXT.md` updated (§41 supplement adoption; core numbering untouched)
[x] `ARCHITECTURE.md` updated (§§4, 22 as-built)
[x] Supplement S1 completion documented (S1.11, this file)
```

---

## 5. Known limitations

- Payment history/timeline does not exist anywhere on the HTTP
  surface; `Failed` renders as status-only by design
  (`PAYMENT_HISTORY_SUPPORTED = false`, `ADMIN_PAYMENT_HISTORY_SUPPORTED
  = false`, `isPaymentsHistorySupported() = false` — all test-pinned).
- The admin never confirms cards: no Stripe.js, no provider
  integration, no payment mutations, no webhook calls from the SPA
  (pinned `webhook-spa-call`, `payment-confirm-admin`, and siblings in
  `UNSUPPORTED_ADMIN_PAYMENT_OPERATIONS`).
- Customer information on orders/payments stays the address echo /
  opaque ids only (no user/customer identity exists on any order or
  payment payload).
- Variant creation provisions no stock server-side (backend design);
  the admin onboards SKUs through the inventory `New item` page.
- The users drill-down on the dashboard shows for SuperAdmin only
  (the users surface stays `SuperAdmin`-only server-side too).
- Grants apply on next login/refresh: a demoted admin keeps rights
  until the current token expires (contract behavior, test-pinned —
  not a defect).

---

## 6. Deferred work (explicit non-goals)

```text
Phase 15 — Final QA & Optimization: system-wide matrix, live-backend
           confirmation, final performance/bundle review (core roadmap
           continues here; Supplement S1 changes nothing about it)
Backend    — payment history/timeline, payment method + failure reason
           fields, variant→stock auto-provisioning (all absent from the
           HTTP surface; the frontend must not invent them)
```

---

## 7. Documentation changes in this supplement

```text
docs/completed/SUPPLEMENT_S1_COMPLETION_REPORT.md   created (this file, S1.11)
docs/PROJECT_CONTEXT.md                             §41 supplement adoption (S1.11)
docs/ARCHITECTURE.md                                §§4, 22 as-built (S1.11)
docs/adr/031-...-alignment.md                       created (S1.1–S1.2)
docs/adr/032-...-integration.md                     created (S1.3–S1.11)
docs/phases/SUPPLEMENT_S1_BACKEND_CONTRACT_EVOLUTION.md
                                                    DoD checkboxes marked (S1.11)
libs/models (contract-evolution-audit +              S1.1 audit module + S1.2 domains
  domains/*, api-endpoints, IdentityApiService)     + endpoints + services
libs/auth (permissions, permissionGuard)            S1.3
apps/admin (features/users, catalog                 S1.5–S1.10
  migration, inventory lists, orders upgrade,
  features/payments, dashboard live)
apps/storefront (profile edit, orders               S1.4, S1.8–S1.9
  status filter, payments mine)
e2e/admin-users, admin-orders (extended),            S1.5–S1.11
  admin-payments, payments-mine, admin-dashboard,
  inventory RTL journeys
playwright.config.ts                                admin-payments, payments-mine,
                                                    admin-dashboard projects
scripts/verify-architecture.mjs                     unchanged in Supplement S1
```

---

## 8. Phase 15 handoff

```text
The Admin Portal now manages users, catalog, inventory, orders, and
payments end to end against the real evolved backend contracts, the
storefront edits profiles, filters orders, and lists payments, and the
dashboard snapshots the whole platform — all verified:
  - unit/component green (admin 735, libs 520, storefront 1433);
    audit 106/106; both builds green; E2E 201 passed
  - shared tables grow by extension, never by fork (extend with specs)
  - open items for later: payment history/method/reasons, variant→stock
    auto-provisioning (all backend), live-backend confirmations
    (Phase 15)
Next: Phase 15 — Final QA & Optimization.
```

(End of file)
