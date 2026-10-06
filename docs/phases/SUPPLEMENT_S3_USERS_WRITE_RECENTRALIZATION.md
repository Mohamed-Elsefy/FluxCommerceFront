# Supplement S3 — Users Write Re-centralization (Backend Permission Removal)

> **Supplementary track — same standing as Supplements S1 and S2.**
> This document is an optional addendum, separate from the core roadmap
> (Phases 0–15 core + Supplements S1/S2 adopted). It may be adopted,
> deferred, or dropped without affecting core numbering, completion
> status, or acceptance of Phases 0–15 and Supplements S1/S2. Steps are
> numbered `S3.1–S3.7` so they never collide with core, S1, or S2
> numbering. Supplements S1 and S2 stay frozen as historical records;
> nothing in them is rewritten.

## Objective

Implement the frontend for the backend change that removes the
`users.manage` and `admins.create` action-level permissions: creating
admins and granting/revoking permissions is not delegable work, so
only `SuperAdmin` performs it. The documented contract in
`docs/frontend-contract/` already reflects the new reality and is the
source of truth:

- Permission catalog v3 (9 values): `orders.read`, `orders.cancel`,
  `orders.refund`, `payments.read`, `payments.stats`,
  `inventory.read`, `inventory.manage`, `catalog.manage`,
  `users.read`. (`users.manage`, `admins.create`, and (previously)
  `dashboard.read` do not exist.)
- `POST /auth/register-admin` gated by `SuperAdmin` (creates
  permission-less admins, as before).
- `/admin/users` reads (`GET` list/counts/get/per-user-permissions)
  stay delegated under `users.read`.
- `/admin/users` writes (role assign, unlock, grant, revoke) and the
  permission catalog document (`GET /admin/users/permissions`) are
  `SuperAdmin`-only again.
- Adaptive `GET /admin/dashboard` is unchanged (any authenticated JWT,
  always `200`, nullable per-permission sections), except the `users`
  section gate moves from the `SuperAdmin` role to `users.read`.
- `Identity.Forbidden` no longer exists on the wire (removed from
  `ERROR_CATALOG.md`): denials on the re-centralized endpoints are
  plain framework `403`s. Status-first 403 handling and the
  single-refresh-then-locked discipline are unchanged.

The supplement must remain contract-driven. `docs/frontend-contract/`
is the source of truth. The frontend must not invent permissions,
endpoints, DTOs, filters, or business rules beyond it.

**Recorded product decisions (approved):**

1. Delegated reads stay: `users.read` holders keep browsing
   (list/counts/details), per the amended contract.
2. The dashboard `users` drill-down link renders whenever the `users`
   section is present (section presence is itself the entitlement
   proof) — no separate role check.
3. New supplement S3: S1/S2 audit modules, reports, and ADRs stay
   frozen; this change gets its own audit, ADR, and report.
4. The `/users/new` creation link hides for non-`SuperAdmin` viewers
   (no dead links into `/forbidden`); the `new` child route is
   guarded by `roleGuard(SuperAdmin)`.

**Resolved S2.1 gap:** the recorded gap
`permission-catalog-superadmin-note` (Objective text vs. contract on
the catalog document gate) is resolved — both now agree it is
`SuperAdmin`-only.

---

## S3.1 — Contract Delta Re-audit Gate

### Goals

Fix the exact new integration boundary before any UI code: the v3
catalog, the re-centralized write gates, the moved dashboard `users`
gate, and the retired `Identity.Forbidden` code.

### Tasks

- Review the amended `docs/frontend-contract/` diff:
  `API_CONTRACT.md` §0.5/§1/§8, `AUTH_FLOW.md` matrix,
  `DTO_REFERENCE.md` (v3 catalog), `ENUM_REFERENCE.md` (v3 catalog),
  `ERROR_CATALOG.md` (`Identity.Forbidden` removed),
  `LOCALIZATION_CONTRACT.md`, `PAYMENT_INTEGRATION_NOTES.md`.
- Produce the audited delta table: v3 catalog (9 values), writes +
  catalog document → `SuperAdmin`, reads → `users.read`, dashboard
  section gates (only `users` moved: SuperAdmin role →
  `users.read`), retired-code note for `Identity.Forbidden`
  (generic status-first 403 handling stays).
- Define frontend deltas (never re-declared): v3 catalog pin,
  SuperAdmin-only write table, moved section gate.
- Pin the unchanged disciplines: status-first failure classifiers
  and the single-refresh-then-locked 403 rule.
- Record remaining gaps (if any) instead of fabricating them.
- Deliver as `libs/models` pure types + pure functions + specs (no
  Angular, no HttpClient — SSR-safe), plus ADR-035.

### Completion Criteria

- The Supplement S3 implementation boundary is explicitly aligned with
  the amended backend contract.
- All planned API interactions are backed by real contracts.
- Any unsupported capability is documented instead of fabricated.

---

## S3.2 — Shared Models & Endpoints

### Goals

Land the v3 contract shapes in shared infrastructure so features
consume them.

### Tasks

- `libs/models/.../common/enums.ts`: drop `users.manage` and
  `admins.create` from `PERMISSION_CATALOG` (9 values); update specs.
- `libs/models/.../domains/identity.ts` and
  `libs/api/.../identity-api.service.ts`: comments back to
  `SuperAdmin` for register-admin/assign/unlock/grant/revoke/catalog
  (HTTP paths and bodies unchanged — verify 1:1, no behavior change).
- `libs/api/.../api-endpoints.ts`: `registerAdmin`,
  `assignRole`, `unlockUser`, `grantPermission`,
  `revokePermission`, `permissionCatalog` markers back to
  `super-admin`; reads stay `users.read`; dashboard stays
  `authenticated`; update endpoint specs.
- Leave the S1/S2 audit modules frozen (historical records); the S3
  delta module from S3.1 is the current reference.
- Unit-test every mapping/classifier/pre-check.

### Completion Criteria

- No feature imports contract shapes from `docs/` directly.
- `tsc` (libs + spec) green; `users.manage`/`admins.create` have zero
  remaining references outside historical ADRs/reports/audits.

---

## S3.3 — Routes & Navigation

### Goals

Gate the users surface by the new reality: reads for `users.read`
holders (SuperAdmin passes via guard bypass), writes for SuperAdmin.

### Tasks

- Mount: `permissionGuard` over `['users.read']` (OR semantics,
  fail-closed, `SuperAdmin` bypass). Update `app.routes.ts` docs
  comment + `app.routes.spec.ts`.
- `new` child route: `roleGuard` over `['SuperAdmin']` (creation is
  not delegable). Update `users.routes.spec.ts`.
- Navigation: users entry `permissions: ['users.read']` (SuperAdmin
  bypass keeps it visible); no creation child (catalog convention —
  reached from the list page). Update `admin-navigation.spec.ts`.
- Guards stay UX-only; the backend stays authoritative.

### Completion Criteria

- A `users.read`-only admin browses users but can never reach
  `/users/new` (guarded → `/forbidden`).
- A non-admin (Customer) still lands on `/forbidden`.
- `SuperAdmin` flows unchanged (supremacy).

---

## S3.4 — Pages

### Goals

Reflect the re-centralized writes in the two touched pages without
changing the read experience.

### Tasks

- Details page: `canManagePermissions` becomes `isSuperAdmin()`
  only (drop the `users.manage` branch); the granted list stays
  readable for display; grant/revoke submissions keep the generic
  status-first error toasts (the 403 test is reworded from
  `Identity.Forbidden` to generic delegation-denied 403 — no wire
  code exists anymore). Update `user-details-page.spec.ts`.
- List page: creation link hidden unless `isSuperAdmin`
  (decision 4); reads unchanged. Update `users-list-page.spec.ts`.
- Create page: drop the `admins.create` context from the header
  comment (permission-less copy stays correct); 409 handling kept.
- Dashboard page: users drill-down link renders whenever the
  `users` section is present (decision 2); card rendering unchanged.
  Update `dashboard-page.spec.ts` (users.read viewer sees card +
  link).
- i18n: no new keys expected (visibility is structural); parity +
  RTL specs extended only if copy changes.

### Completion Criteria

- A `users.read`-only admin browses users and sees granted
  permissions but never sees grant UI or the creation link.
- A `SuperAdmin` grants/revokes/creates end-to-end (mocked-transport
  E2E in S3.6).
- A `users.read` holder sees the dashboard users card + drill-down
  link when the section is present.

---

## S3.5 — 403 Discipline Verification

### Goals

Prove the frontend still obeys the 403 guidance after the
re-centralization (expected: no code changes).

### Tasks

- Verify `authRecoveryInterceptor` still admits only 401 (pin with
  the existing specs).
- Audit every feature `fail()`/retry path touched by S3 for
  403-blind-retry or logout-on-403 behavior; pages must render the
  shared error/locked state with retry as the explicit user action.
- Grant/revoke/create submissions: no auto-retry on 403/409.

### Completion Criteria

- No code path retries 403 automatically more than the single
  contract-legitimate refresh, and no path logs out on 403.

---

## S3.6 — E2E: Updated & Extended Suites

### Goals

Prove the re-centralization as shippable slices with mocked
transports, then re-verify the pre-existing suites.

### Tasks

- `admin-users`: rewrite the three delegated journeys as
  SuperAdmin flows (grant/revoke end-to-end, creation with the
  permission-less toast); `users.read` browsing without grant UI
  (kept, catalog 403 stays); `users.read` viewer never sees the
  creation link; direct `/users/new` navigation as `users.read`
  lands on `/forbidden`; customer→forbidden; French + RTL chrome.
- `admin-dashboard`: `users.read` viewer sees the users card +
  drill-down link (section present); partial/empty/error suites
  unchanged; French + RTL chrome.
- Re-verify pre-existing suites with the updated navigation and
  fixtures (v3 catalog: drop the two removed values everywhere).
- No new Playwright projects (filename patterns already cover).

### Completion Criteria

- New + extended suites green; full suite green with only
  provider-gated skips.

---

## S3.7 — Hardening, Verification & Documentation

### Goals

Close the supplement with the full matrix green and synchronized
docs.

### Tasks

- Zero hardcoded strings in touched UI; 5-culture parity +
  key-leakage assertions for every new/changed key (none expected —
  verify).
- Logical-properties-only CSS; RTL render tests for touched pages;
  `overflow-wrap: anywhere` on ids/references.
- ARIA + focus management preserved on touched flows.
- Docs: ADR-035 (delta alignment + integration — single ADR, same
  convention as ADR-034), this report
  (`docs/completed/SUPPLEMENT_S3_COMPLETION_REPORT.md` on adoption),
  `PROJECT_CONTEXT.md` (§43, core numbering untouched),
  `ARCHITECTURE.md` (as-built notes), DoD checkboxes below.
- Verification matrix: `tsc` (both apps + libs + spec), unit tests,
  `eslint`, `prettier`, `verify-architecture.mjs`, both builds,
  Playwright.

### Completion Criteria

- Full matrix green, 0 errors; the core roadmap (Phase 15 — Final
  QA) is unaffected whether this supplement is adopted or not.

---

# Supplement S3 Completion Checklist

## Contract

- [ ] Amended frontend-contract diff reviewed (S3.1 delta audit)
- [ ] Permission catalog v3 (9 values) pinned in models
- [ ] Writes + permission catalog document verified SuperAdmin-only
- [ ] Reads verified `users.read` (list/counts/get/per-user-perms)
- [ ] Register-admin verified SuperAdmin (permission-less creation kept)
- [ ] Dashboard `users` section gate move verified (`users.read`)
- [ ] `Identity.Forbidden` retirement recorded; generic 403 discipline pinned

## AuthZ

- [ ] Users mount on `permissionGuard(['users.read'])` (SuperAdmin bypass)
- [ ] `new` user route guarded by `roleGuard(SuperAdmin)`
- [ ] Navigation users entry on `users.read`
- [ ] Creation link hidden for non-SuperAdmin
- [ ] SuperAdmin supremacy verified

## Features

- [ ] Users reads delegated (list/counts/details browsable with `users.read`)
- [ ] Grant UI visible to SuperAdmin only, hidden otherwise
- [ ] Generic 403 toast path covered (no wire code depended upon)
- [ ] Admin creation SuperAdmin-only via `/users/new`
- [ ] Dashboard users card + drill-down link for `users.read` holders
- [ ] Honest empty/partial dashboard states preserved

## UX

- [ ] Localization complete (5 cultures, changed keys only)
- [ ] RTL/LTR verified
- [ ] Responsive verified
- [ ] Accessibility verified
- [ ] Loading/empty/error/locked states verified

## Testing

- [ ] Unit + component specs added/updated
- [ ] Guard + mapping specs updated
- [ ] E2E updated/extended suites green
- [ ] Pre-existing suites re-verified green
- [ ] Architecture audit green
- [ ] Both builds green

## Architecture & Documentation

- [ ] No direct component API access
- [ ] No `libs/ui` additions
- [ ] No cross-feature violations
- [ ] S1/S2 records frozen (not rewritten)
- [ ] ADR-035 recorded
- [ ] `PROJECT_CONTEXT.md` updated (§43; core numbering untouched)
- [ ] `ARCHITECTURE.md` updated
- [ ] Supplement S3 completion note written (only if adopted)

---

# Supplement S3 Dependency Flow

```text
S3.1 Contract Delta Re-audit (gate)
         │
         ▼
S3.2 Models & Endpoints
         │
         ├───► S3.3 Routes & Navigation
         │
         ├───► S3.4 Pages
         │
         └───► S3.5 403 Discipline (verification, parallel)
                        │
                        ▼
                S3.6 E2E (updated + re-verify)
                        │
                        ▼
                S3.7 Hardening / Docs / Matrix
```

## Implementation Rule

**S3.1 is the contract gate for the entire supplement.**

No UI in S3.3–S3.4 may exceed the audited v3 tables. The S1/S2
audit modules, reports, and ADRs are frozen historical records and
must not be rewritten to match v3 — deltas live in S3 artifacts
only. The frontend never fabricates permissions, endpoints, filters,
history, or business rules. Grant/revoke/create submissions stay
page-local with duplicate-submit prevention.

---

# Appendix A — Backend change record (what the backend removed)

```text
Removed permissions: users.manage, admins.create
Resulting catalog (v3, 9 values):
  orders.read | orders.cancel | orders.refund |
  payments.read | payments.stats |
  inventory.read | inventory.manage |
  catalog.manage | users.read
Re-centralized to SuperAdmin:
  POST /auth/register-admin
  POST /admin/users/{id}/roles
  POST /admin/users/{id}/unlock
  POST /admin/users/{id}/permissions
  DELETE /admin/users/{id}/permissions/{permission}
  GET /admin/users/permissions
Stayed delegated (users.read):
  GET /admin/users (+ filters)
  GET /admin/users/counts
  GET /admin/users/{id}
  GET /admin/users/{id}/permissions
Moved gate (dashboard users section):
  SuperAdmin role → users.read
Retired wire code:
  Identity.Forbidden (403 business code; denials are plain 403s now)
Unchanged:
  Adaptive dashboard shape, permission-less creation semantics,
  manual grants, next-login/refresh grant semantics,
  SuperAdmin supremacy, status-first 403 handling,
  single-refresh-then-locked discipline
```

---

# Appendix B — Approved decisions (plan-mode review)

```text
1. Delegated reads stay (users.read) — only writes re-centralize.
2. Dashboard users drill-down renders with the section present.
3. New supplement S3 — S1/S2 stay frozen.
4. Creation link hidden for non-SuperAdmin (no dead links).
```

(End of file)
