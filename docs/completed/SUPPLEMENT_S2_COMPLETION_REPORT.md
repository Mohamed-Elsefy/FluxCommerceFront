# Supplement S2 — Adaptive Dashboard & Delegated Admin: Completion Report

Status: **Complete**.

Supplement S2 implements the frontend for the Phase 22 backend
evolution (amended 2026-10-04, audited in `docs/frontend-contract/`)
as an optional addendum with the same standing as Supplement S1. The
core roadmap (Phases 0–14 complete, Phase 15 — Final QA &
Optimization next) is unaffected. Steps are numbered `S2.1–S2.7` so
they never collide with core or S1 numbering.

Related references: `docs/PROJECT_CONTEXT.md` (§42),
`docs/ARCHITECTURE.md` (as-built notes in §§4, 22),
`docs/phases/SUPPLEMENT_S2_ADAPTIVE_DASHBOARD_AND_DELEGATED_ADMIN.md`,
`docs/adr/034-supplement-s2-contract-alignment.md`.

The final boundary holds: the frontend presents the evolved contract
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
S2.1 Contract Re-audit Gate
     Audited the exact Phase 22 integration boundary before any UI
     code: the 11-value permission catalog v2 (`dashboard.read`
     removed; `users.read`, `users.manage`, `admins.create` added),
     the v2 permission→endpoint matrix (`admins.create` →
     `POST /auth/register-admin`, `users.read` → users reads,
     `users.manage` → users writes + permission catalog read),
     the adaptive dashboard section gates, the `CatalogCountsResponse`
     and nullable-dashboard aliases, status-first `Identity.Forbidden`
     classifiers with the single-refresh-then-locked 403 discipline,
     and the recorded gaps. Delivered as `supplement-s2-audit.ts` +
     specs in `libs/models` (pure types + pure functions, no feature
     code) and ADR-034. No unresolved API assumptions remain.

S2.2 Shared Models & Endpoints
     Landed the v2 contract shapes in shared infrastructure
     (`PERMISSION_CATALOG` v2, nullable dashboard sections +
     `CatalogCountsResponse`, S1 audit frozen as a historical record,
     orders/payments matrix verified unchanged, `api-endpoints.ts`
     markers to `users.read` / `users.manage` / `admins.create` / any
     authenticated JWT, `IdentityApiService.registerAdmin` verified
     1:1 against §1.2 with permission-less creation comments) with
     unit-tested mappings/classifiers/pre-checks. No feature imports
     contract shapes from `docs/` directly.

S2.3 Adaptive Dashboard Landing
     Kept `/dashboard` the post-login landing for everyone: dropped
     `permissionGuard` from the mount (shell `roleGuard` remains),
     dropped the `dashboard.read` navigation filter, kept envelope
     handling unchanged, render non-`null` sections only with the new
     catalog card (`totalProducts/activeProducts/totalCategories/
     totalVariants` → `/catalog/products`), honest empty state when
     all sections are absent, `recentOrders` empty state unchanged,
     users drill-down still `isSuperAdmin`-gated. 5-culture
     `dashboard.*` catalog + empty-state keys with parity, leakage,
     and RTL specs.

S2.4 Delegated Users Management
     Moved `/users` from `SuperAdmin`-only to permission-gated reads
     and delegated writes: mount migrated to `permissionGuard` over
     `['users.read', 'users.manage', 'admins.create']` (OR), `new`
     child route guarded by `admins.create`, permission-filtered
     navigation (no separate creation child — catalog convention),
     grant section visible to SuperAdmin + `users.manage` holders
     only (fully hidden otherwise), `Identity.Forbidden` 403 as error
     toasts, corrected permission-less creation copy in 5 cultures,
     duplicate-email 409 handling kept. List reads unchanged.

S2.5 403 Discipline Verification
     Proved the frontend obeys the 403 guidance everywhere: the
     interceptor admits only 401 into recovery (pinned by existing
     specs); no RxJS retry operators anywhere in apps/libs; every
     S2 fail path resolves to shared error/locked states with retry
     as the explicit user action; grant/revoke/create never
     auto-retry on 403/409; no path logs out on 403. Verification-only
     step — no code changes required.

S2.6 E2E: New & Extended Suites
     New mocked-transport suites green alongside extended
     pre-existing ones — `admin-dashboard` (partial catalog-only,
     empty dashboard, drill-down, error/retry, French + RTL chrome),
     `admin-users` (`users.read` browsing without grant UI,
     `users.manage` grant/revoke incl. `Identity.Forbidden` toast,
     `admins.create` creation flow, customer→forbidden, French + RTL
     chrome). Pre-existing admin + storefront suites re-verified
     green. Drive-by fixes required for a green full suite:
     anchored three overlapping Playwright `testMatch` patterns
     (`catalog`/`orders`/`payments` projects also matched their
     `admin-*` files against the wrong baseURL — proven via
     `--list`, pre-existing), and scoped one storefront assertion
     broken by the S1.8 status filter.

S2.7 Hardening, Verification & Documentation (this sub-phase)
     Full matrix green (below); zero hardcoded strings in touched UI;
     5-culture parity + key-leakage assertions for every
     new/changed key; logical-properties-only CSS; RTL render tests
     for touched pages; ARIA + focus management preserved;
     ADR-034 extended with the integration record; this report; DoD
     checkboxes; PROJECT_CONTEXT/ARCHITECTURE sync.
```

---

## 2. Test coverage

```text
Unit/component (executed):
  admin        115 files / 756 passed (S2.3 dashboard landing,
                 S2.4 delegated users, guards + navigation, shell)
  libs          72 files / 552 passed (S2.1 audit module + S2.2 v2
                 domains/endpoints/services + contract matrices)
  storefront 126 files / 1433 passed (untouched by S2; re-verified)

Architecture: 106/106 checks passed (no script changes needed in
              Supplement S2 — audit modules stay pure types + pure
              functions; no `libs/ui` additions; no cross-feature
              imports; no new global stores)

E2E (playwright, mocked transports, executed):
  new/updated S2 suites   25 passed (dashboard 9: partial, empty,
                          drill-down, error/retry, forbidden, French
                          + RTL chrome; users 16: delegated browsing,
                          manage grant/revoke, Forbidden toast,
                          creation, conflict, French + RTL chrome)
  admin re-verify         68 passed (auth, smoke, catalog, orders,
                          payments — extended navigation)
  storefront re-verify    86 passed, 7 skipped (catalog, details,
                          cart, checkout, orders, payments, mine,
                          storefront, auth, culture ×2 — provider-gated
                          and SSR-neutrality skips, pre-existing)
  firefox/webkit smoke    covered by CI (chromium mirrors executed
                          here)

Production builds: storefront SSR + 15/15 prerendered routes;
  admin CSR with per-page lazy chunks; zero budget warnings.
```

---

## 3. Verification results

```text
typecheck (tsc --noEmit)  storefront, admin, libs (7 projects), specs — 0 errors
lint (prettier --check)   0 errors (bulk-edit drifts reformatted in S2.6)
lint (eslint .)           0 errors
verify-architecture       106/106 checks passed
test:unit                 100% pass (admin 756, libs 552, storefront 1433)
test:e2e (executed)       179 passed, 8 skipped (provider-gated/SSR, pre-existing)
build:storefront          SSR + 15 prerendered routes — 0 errors
build:admin               CSR, all lazy route chunks — 0 errors
responsive probes         auto-fit grids, wrapping facts, token-only logical CSS;
                          audit-enforced
```

---

## 4. Definition of Done (Supplement S2 checklist — item-by-item)

```text
Contract
[x] Amended frontend-contract diff committed & reviewed (S2.1 audit + ADR-034)
[x] Permission catalog v2 (11 values, no `dashboard.read`) pinned in models
[x] `admins.create` + `users.read`/`users.manage` endpoints verified
[x] Nullable dashboard sections + `CatalogCountsResponse` verified
[x] `Identity.Forbidden` mapped status-first; 403 discipline pinned
[x] Section-gate table (orders/payments/inventory/catalog/users) pinned

AuthZ
[x] Dashboard mount relaxed (shell roles only)
[x] Users mount migrated (reads/writes/create permissions)
[x] `new` user route guarded by `admins.create`
[x] Navigation permission-filtered (dashboard open, users gated)
[x] SuperAdmin supremacy verified (incl. dashboard users section)

Features
[x] Dashboard renders per-entitlement sections + catalog card
[x] Honest empty dashboard (no sections entitled)
[x] Grant UI visible to SuperAdmin + `users.manage`, hidden otherwise
[x] `Identity.Forbidden` toast path covered
[x] Admin creation copy corrected (permission-less) + `admins.create` E2E
[x] `me.permissions` re-read honored after grant flows (no stale UI)

UX
[x] Localization complete (5 cultures, new/changed keys)
[x] RTL/LTR verified
[x] Responsive verified
[x] Accessibility verified
[x] Loading/empty/error/locked states verified

Testing
[x] Unit + component specs added/updated
[x] Guard + mapping specs updated
[x] E2E new/extended suites green
[x] Pre-existing suites re-verified green
[x] Architecture audit green
[x] Both builds green

Architecture & Documentation
[x] No direct component API access
[x] No `libs/ui` additions
[x] No cross-feature violations
[x] ADR-034 recorded (alignment S2.1 + integration S2.2–S2.6)
[x] `PROJECT_CONTEXT.md` updated (§42 supplement adoption; core numbering untouched)
[x] `ARCHITECTURE.md` updated (as-built notes)
[x] Supplement S2 completion note written (S2.7, this file)
```

---

## 5. Known limitations

- The dashboard `users` section (and its drill-down) stays
  `SuperAdmin`-role sourced even for `users.read` holders (backend
  design, pinned `dashboard-users-section-role-gated`).
- The permission catalog document wording differs between the S2
  Objective text (`SuperAdmin`-only) and the amended contract
  (`users.manage`); the contract wins (pinned
  `permission-catalog-superadmin-note`).
- Grants apply on next login/refresh: a demoted admin keeps rights
  until the current token expires (contract behavior, test-pinned —
  not a defect).
- Payment history/timeline still does not exist anywhere on the HTTP
  surface (carried over from S1, still test-pinned).
- Firefox/WebKit E2E projects mirror the executed Chromium suites
  and are covered by CI.

---

## 6. Deferred work (explicit non-goals)

```text
Phase 15 — Final QA & Optimization: system-wide matrix, live-backend
           confirmation, final performance/bundle review (core roadmap
           continues here; Supplement S2 changes nothing about it)
Backend    — payment history/timeline, dashboard users-section
           permission gating (role-gated by design today)
```

---

## 7. Documentation changes in this supplement

```text
docs/completed/SUPPLEMENT_S2_COMPLETION_REPORT.md   created (this file, S2.7)
docs/PROJECT_CONTEXT.md                             §42 supplement adoption (S2.7)
docs/ARCHITECTURE.md                                §§4, 22 as-built (S2.7)
docs/adr/034-...-alignment.md                       created S2.1, extended S2.7
docs/phases/SUPPLEMENT_S2_...                       DoD checkboxes marked (S2.7)
libs/models (supplement-s2-audit +                  S2.1 audit module + S2.2 v2
  domains/*, api-endpoints, IdentityApiService)     domains + endpoints + services
apps/admin (routes, navigation,                    S2.3–S2.4
  dashboard landing, delegated users)
e2e/admin-dashboard, admin-users (new),             S2.6
  admin-auth/catalog/orders/payments (fixtures),
  orders (assertion scoping)
playwright.config.ts                                anchored overlapping
                                                    testMatch patterns (S2.6)
scripts/verify-architecture.mjs                     unchanged in Supplement S2
```

---

## 8. Phase 15 handoff

```text
The Admin Portal now serves an adaptive per-entitlement dashboard
(incl. the catalog card and the honest empty state) and delegated
users management (reads, grant/revoke, permission-less creation)
against the real Phase 22 backend contracts — all verified:
  - unit/component green (admin 756, libs 552, storefront 1433);
    audit 106/106; both builds green; E2E 179 passed
  - shared tables grow by extension, never by fork (extend with specs)
  - open items for later: live-backend confirmations (Phase 15)
Next: Phase 15 — Final QA & Optimization.
```

(End of file)
