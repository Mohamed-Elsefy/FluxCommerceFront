# Supplement S2 — Adaptive Dashboard & Delegated Admin (Phase 22 Backend Evolution)

> **Supplementary track — same standing as Supplement S1.**
> This document is an optional addendum, separate from the core roadmap
> (Phases 0–15 core + Supplement S1 adopted). It may be adopted,
> deferred, or dropped without affecting core numbering, completion
> status, or acceptance of Phases 0–15 and Supplement S1. Steps are
> numbered `S2.1–S2.7` so they never collide with core or S1 numbering.

## Objective

Implement the frontend for the Phase 22 backend evolution (amended
2026-10-04, audited in `docs/frontend-contract/`):

- Action-level permission catalog v2 (11 values): `dashboard.read`
  removed; `users.read`, `users.manage`, `admins.create` added. The
  `Admin` role grants nothing — every permission is granted manually.
- `POST /auth/register-admin` gated by `admins.create` (creates
  permission-less admins).
- `/admin/users/**` moved from `SuperAdmin`-only to `users.read`
  (reads) / `users.manage` (role assign, unlock, grant, revoke, under
  anti-escalation guards); only the permission catalog document
  (`GET /admin/users/permissions`) stays `SuperAdmin`-only. The
  per-user permission read stays readable for display.
- Adaptive `GET /admin/dashboard`: any authenticated JWT receives
  `200` always; sections are per-permission (`orders`+`recentOrders` ←
  `orders.read`; `payments` ← `payments.read` or `payments.stats`;
  `inventory` ← `inventory.read`; `catalog` ← `catalog.manage` (new
  `CatalogCountsResponse`); `users` ← `SuperAdmin` role directly),
  `null`/absent when unauthorized, `[]` recent orders when
  unauthorized. `null` = not entitled, `0`/`[]` = entitled but empty.
- New `Identity.Forbidden` 403 (delegation guard); 403 discipline:
  one refresh is legitimate, then an inline locked state — never a
  retry loop, never a forced logout (the interceptor already complies:
  only 401 enters recovery).

The supplement must remain contract-driven. `docs/frontend-contract/`
is the source of truth. The frontend must not invent permissions,
endpoints, DTOs, filters, or business rules beyond it.

**Recorded product decision (grant-button visibility):** the "grant
permission" affordance is **visible to SuperAdmin and to holders of
`users.manage`, fully hidden for everyone else** (no disabled state,
no placeholder). Denials that still occur (anti-escalation races)
surface as error toasts via `Identity.Forbidden`.

---

## S2.1 — Contract Re-audit Gate

### Goals

Fix the exact new integration boundary before any UI code: which
endpoints are callable under the v2 catalog, which dashboard sections
exist and their gates, which reads paginate, and who owns what.

### Tasks

- Review the amended `docs/frontend-contract/` diff (7 files):
  `API_CONTRACT.md` §0.5/§1/§8 + appendices, `AUTH_FLOW.md`
  permission matrix + 403/admin-fetch guidance, `DTO_REFERENCE.md`
  (catalog, `CatalogCountsResponse`, nullable dashboard),
  `ENUM_REFERENCE.md` (v2 catalog), `ERROR_CATALOG.md`
  (`Identity.Forbidden`), `LOCALIZATION_CONTRACT.md`,
  `PAYMENT_INTEGRATION_NOTES.md`.
- Produce the audited callable table: permission → endpoints,
  including `admins.create` → `POST /auth/register-admin`,
  `users.read` → users reads, `users.manage` → users writes +
  permission catalog read, dashboard section gates, and the removed
  `dashboard.read` (no remaining references).
- Define frontend aliases (never re-declared):
  `CatalogCountsResponse`, nullable `AdminDashboardResponse`
  sections, `RegisterAdminRequest` (already canonical).
- Pin status-first failure classifiers for `Identity.Forbidden`
  403 (never message-text-based) and the single-refresh-then-locked
  403 discipline.
- Record remaining gaps (if any) instead of fabricating them.
- Deliver as `libs/models` pure types + pure functions + specs (no
  Angular, no HttpClient — SSR-safe), plus ADR-033.

### Completion Criteria

- The Supplement S2 implementation boundary is explicitly aligned with
  the amended backend contract.
- All planned API interactions are backed by real contracts.
- Any unsupported capability is documented instead of fabricated.

---

## S2.2 — Shared Models & Endpoints

### Goals

Land the v2 contract shapes in shared infrastructure so features
consume them.

### Tasks

- `libs/models/.../common/enums.ts`: drop `dashboard.read` from
  `PERMISSION_CATALOG`; add `users.read`, `users.manage`,
  `admins.create`; update specs.
- `libs/models/.../domains/dashboard.ts`: nullable sections +
  `CatalogCountsResponse` (+ specs).
- `libs/models/.../domains/contract-evolution-audit.ts` and
  `orders-payments-contract.ts`: v2 permission→endpoint matrix,
  dashboard section-gate table, updated pagination/filter notes
  (+ specs, incl. `supportsAdminPaymentsFiltering`-style helpers
  where they live).
- `libs/api/.../api-endpoints.ts`: dashboard `auth` marker updated
  (any authenticated JWT); users/register-admin markers updated
  (`users.read` / `users.manage` / `admins.create`); update
  endpoint specs. `IdentityApiService.registerAdmin` already exists
  (verify 1:1 against the amended §1.2).
- Unit-test every mapping/classifier/pre-check.

### Completion Criteria

- No feature imports contract shapes from `docs/` directly.
- `tsc` (libs + spec) green; `dashboard.read` has zero remaining
  references outside historical ADRs/reports.

---

## S2.3 — Adaptive Dashboard Landing

### Goals

Keep `/dashboard` the post-login landing for everyone; render data
strictly per entitlement.

### Tasks

- Route: drop `permissionGuard` from the `dashboard` mount (the shell
  `roleGuard` over `Admin`/`SuperAdmin` remains the entry gate —
  backend authorization stays authoritative). Update `app.routes.ts`
  docs comment + `app.routes.spec.ts`.
- Navigation: drop the `dashboard.read` filter from the dashboard
  destination (visible to every portal user); update
  `admin-navigation.spec.ts`.
- `DashboardState`/`DashboardApiService`: nullable-section types;
  envelope handling unchanged (dataless `200` stays a contract
  violation).
- Page: render only non-`null` sections; new catalog card
  (`totalProducts/activeProducts/totalCategories/totalVariants`);
  honest empty state when all sections are absent (new i18n keys);
  `recentOrders` empty state unchanged; users drill-down stays
  `isSuperAdmin`-gated (section is SuperAdmin-sourced — unchanged).
- i18n: `dashboard.*` catalog + empty-state keys in 5 cultures;
  key-parity + key-leakage specs; RTL render specs.
- Specs: state/API/page/i18n/routes specs updated (403 dashboard
  test replaced by partial-section tests).

### Completion Criteria

- A `catalog.manage`-only admin lands on the dashboard and sees the
  catalog card (+ session card) with no forbidden screen.
- An authorized-but-empty caller sees the honest empty state.
- E2E: partial dashboard (catalog-only), empty dashboard, drill-down,
  French + RTL chrome (see S2.6).

---

## S2.4 — Delegated Users Management

### Goals

Move `/users` from `SuperAdmin`-only to permission-gated reads and
delegated writes, per the amended matrix.

### Tasks

- Routes: migrate the `users` mount from `roleGuard(SuperAdmin)` to
  `permissionGuard` over `['users.read', 'users.manage',
'admins.create']` (OR semantics); add `permissionGuard`
  `['admins.create']` on the `new` child route. Update
  `users.routes.spec.ts` + `app.routes.spec.ts`.
- Navigation: users entry becomes permission-filtered (visible with
  any of the three); children: list (`users.read`-implied via group),
  creation is reached from the list page (no separate nav child —
  same convention as catalog `new` pages). Update
  `admin-navigation.spec.ts`.
- Details page: **grant section visible to SuperAdmin and
  `users.manage` holders only, fully hidden otherwise** (recorded
  decision — no disabled state); grant/revoke submissions handle
  `Identity.Forbidden` 403 as error toasts (anti-escalation races).
- User-create page: reachable under `admins.create`; fix the success
  copy — admins are created **permission-less** ("created as Admin,
  grant permissions afterwards", 5 cultures); keep duplicate-email
  409 handling.
- List page: unchanged reads (`users.read`); the creation link stays
  (route guard enforces `admins.create`).
- i18n: `users.*` grant-visibility + revised create-success keys in
  5 cultures; parity + RTL specs.

### Completion Criteria

- A `users.read`-only admin browses users but never sees grant UI.
- A `users.manage` holder grants/revokes end-to-end (mocked-transport
  E2E), including the `Identity.Forbidden` toast path.
- An `admins.create` holder (non-SuperAdmin) creates admins via
  `/users/new`.
- `SuperAdmin` flows unchanged (supremacy).

---

## S2.5 — 403 Discipline Verification

### Goals

Prove the frontend obeys the amended 403 guidance everywhere: one
refresh is legitimate for fresh grants, then an inline locked state —
never a retry loop, never a forced logout.

### Tasks

- Verify `authRecoveryInterceptor` still admits only 401 (already
  true — no change expected; pin with the existing specs).
- Audit every feature `fail()`/retry path touched by S2 for
  403-blind-retry or logout-on-403 behavior; pages must render the
  shared error/locked state with retry as the explicit user action.
- Grant/revoke/create submissions: no auto-retry on 403/409.

### Completion Criteria

- No code path retries 403 automatically more than the single
  contract-legitimate refresh, and no path logs out on 403.

---

## S2.6 — E2E: New & Extended Suites

### Goals

Prove the whole evolution as shippable slices with mocked transports,
then re-verify the pre-existing suites with the extended navigation.

### Tasks

- `admin-dashboard`: partial sections (catalog-only admin sees only
  its card), empty dashboard, drill-down, error/retry, French + RTL
  chrome (replace the old 403 dashboard test).
- `admin-users`: non-SuperAdmin `users.read` browsing (no grant UI),
  `users.manage` grant/revoke incl. `Identity.Forbidden` toast,
  `admins.create` creation flow, customer→forbidden, French + RTL
  chrome.
- Re-verify pre-existing suites with the extended navigation
  (auth, smoke, catalog, orders, payments, dashboard, users).
- New Playwright projects only where filename patterns require them.

### Completion Criteria

- New + extended suites green; full suite green with only
  provider-gated skips.

---

## S2.7 — Hardening, Verification & Documentation

### Goals

Close the supplement with the full matrix green and synchronized
docs.

### Tasks

- Zero hardcoded strings in touched UI; 5-culture parity +
  key-leakage assertions for every new/changed key.
- Logical-properties-only CSS; RTL render tests for touched pages;
  `overflow-wrap: anywhere` on ids/references.
- ARIA + focus management preserved on touched flows (filter bars,
  dialogs, retry).
- Docs: ADR-033 (this supplement: alignment + integration — single
  ADR since the backend arrived as one amended drop), this report
  (`docs/completed/SUPPLEMENT_S2_COMPLETION_REPORT.md` on adoption),
  `PROJECT_CONTEXT.md` (§42, core numbering untouched),
  `ARCHITECTURE.md` (as-built notes), DoD checkboxes below.
- Verification matrix: `tsc` (both apps + libs + spec), `vitest`,
  `eslint`, `prettier`, `verify-architecture.mjs`, both builds,
  Playwright.

### Completion Criteria

- Full matrix green, 0 errors; the core roadmap (Phase 15 — Final
  QA) is unaffected whether this supplement is adopted or not.

---

# Supplement S2 Completion Checklist

## Contract

- [x] Amended frontend-contract diff committed & reviewed
- [x] Permission catalog v2 (11 values, no `dashboard.read`) pinned in models
- [x] `admins.create` + `users.read`/`users.manage` endpoints verified
- [x] Nullable dashboard sections + `CatalogCountsResponse` verified
- [x] `Identity.Forbidden` mapped status-first; 403 discipline pinned
- [x] Section-gate table (orders/payments/inventory/catalog/users) pinned

## AuthZ

- [x] Dashboard mount relaxed (shell roles only)
- [x] Users mount migrated (reads/writes/create permissions)
- [x] `new` user route guarded by `admins.create`
- [x] Navigation permission-filtered (dashboard open, users gated)
- [x] SuperAdmin supremacy verified (incl. dashboard users section)

## Features

- [x] Dashboard renders per-entitlement sections + catalog card
- [x] Honest empty dashboard (no sections entitled)
- [x] Grant UI visible to SuperAdmin + `users.manage`, hidden otherwise
- [x] `Identity.Forbidden` toast path covered
- [x] Admin creation copy corrected (permission-less) + `admins.create` E2E
- [x] `me.permissions` re-read honored after grant flows (no stale UI)

## UX

- [x] Localization complete (5 cultures, new/changed keys)
- [x] RTL/LTR verified
- [x] Responsive verified
- [x] Accessibility verified
- [x] Loading/empty/error/locked states verified

## Testing

- [x] Unit + component specs added/updated
- [x] Guard + mapping specs updated
- [x] E2E new/extended suites green
- [x] Pre-existing suites re-verified green
- [x] Architecture audit green
- [x] Both builds green

## Architecture & Documentation

- [x] No direct component API access
- [x] No `libs/ui` additions
- [x] No cross-feature violations
- [x] ADR-033 recorded
- [x] `PROJECT_CONTEXT.md` updated (supplement adoption noted; core numbering untouched)
- [x] `ARCHITECTURE.md` updated
- [x] Supplement S2 completion note written (only if adopted)

---

# Supplement S2 Dependency Flow

```text
S2.1 Contract Re-audit (gate)
        │
        ▼
S2.2 Models & Endpoints
        │
        ├───► S2.3 Adaptive Dashboard
        │
        ├───► S2.4 Delegated Users
        │
        └───► S2.5 403 Discipline (verification, parallel)
                       │
                       ▼
               S2.6 E2E (new + re-verify)
                       │
                       ▼
               S2.7 Hardening / Docs / Matrix
```

## Implementation Rule

**S2.1 is the contract gate for the entire supplement.**

No UI in S2.3–S2.4 may exceed the audited callable table. If the
backend adds further surface mid-supplement, re-run S2.1 first. The
frontend never fabricates permissions, endpoints, filters, history, or
business rules. Grant/revoke/create submissions stay page-local with
duplicate-submit prevention.
