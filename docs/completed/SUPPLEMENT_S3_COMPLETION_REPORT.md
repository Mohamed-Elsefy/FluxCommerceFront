# Supplement S3 — Users Write Re-centralization: Completion Report

Status: **Complete**.

Supplement S3 implements the frontend for the backend removal of the
`users.manage` and `admins.create` action-level permissions (user
writes are not delegable — only `SuperAdmin` performs them) as an
optional addendum with the same standing as Supplements S1/S2. The
core roadmap (Phases 0–14 complete, Phase 15 — Final QA &
Optimization next) is unaffected. Steps are numbered `S3.1–S3.7` so
they never collide with core, S1, or S2 numbering. Supplements S1 and
S2 stay frozen as historical records; nothing in them was rewritten.

Related references: `docs/PROJECT_CONTEXT.md` (§43),
`docs/ARCHITECTURE.md` (as-built notes in §§4, 22),
`docs/phases/SUPPLEMENT_S3_USERS_WRITE_RECENTRALIZATION.md`,
`docs/adr/035-supplement-s3-contract-delta.md`.

The final boundary holds: the frontend presents the re-centralized
contract surface and owns permission presentation, feature state, and
navigation; the backend owns permission grants, user state,
verification, transitions, validation, authorization, and ownership.
No permission, endpoint, DTO, filter, sort, history record, mutation,
threshold, or response model was invented — every contract gap stays
pinned in code, docs, or tests instead of fabricated.

---

## 1. Sub-phase summary

```text
S3.1 Contract Delta Re-audit Gate
     Audited the exact removal boundary before any UI code: the
     9-value permission catalog v3, the six SuperAdmin-only writes,
     the four users.read-delegated reads, the moved dashboard users
     gate (SuperAdmin role → users.read), the retired
     Identity.Forbidden code (generic status-first 403 stays), and
     the recorded notes. Delivered as `supplement-s3-audit.ts` +
     specs in `libs/models` (pure types + pure functions, no feature
     code) and ADR-035. No unresolved API assumptions remain.

S3.2 Shared Models & Endpoints
     Landed the v3 contract shapes in shared infrastructure
     (`PERMISSION_CATALOG` 9 values, endpoint markers back to
     `super-admin` for writes/catalog, reads stay `users.read`,
     dashboard stays `authenticated`, service/domain comments
     corrected, `registerAdmin` still 1:1 — paths and bodies are
     byte-identical, only gates moved) with unit-tested
     mappings/classifiers/pre-checks. No feature imports contract
     shapes from `docs/` directly.

S3.3 Routes & Navigation
     Migrated the `users` mount to `permissionGuard(['users.read'])`
     (SuperAdmin bypass) and the `new` child route to
     `roleGuard(SuperAdmin)`; navigation users entry filtered on
     `users.read` (no creation child — catalog convention). Guards
     stay UX-only; the backend stays authoritative.

S3.4 Pages
     Grant/revoke affordances render for `SuperAdmin` only (granted
     list stays readable); creation link hidden for non-SuperAdmin
     (no dead links); dashboard users drill-down renders with the
     section present; permission-less creation copy kept (still
     correct); 409 handling kept; generic status-first error toasts
     (no wire code depended upon).

S3.5 403 Discipline Verification
     Proved the frontend still obeys the 403 guidance: the
     interceptor admits only 401 into recovery; no RxJS retry
     operators anywhere in the touched scope; every fail path
     resolves to shared error states with retry as the explicit
     user action; submissions never auto-retry; no path logs out on
     403. Verification-only step — no code changes required.

S3.6 E2E: Updated & Extended Suites
     Rewrote the three delegated journeys as re-centralized flows
     (SuperAdmin grant/revoke/creation, users.read browsing without
     grant UI or creation link, direct `/users/new` → `/forbidden`,
     generic 403 toast without logout, users.read dashboard card +
     link) with French + RTL chrome, then re-verified the full
     suite green.

S3.7 Hardening, Verification & Documentation (this sub-phase)
     Full matrix green (below); zero new i18n keys (values only),
     zero CSS changes; parity/leakage/RTL coverage intact; ARIA +
     focus preserved; ADR-035 extended with the integration record;
     this report; DoD checkboxes; PROJECT_CONTEXT/ARCHITECTURE sync.
```

---

## 2. Test coverage

```text
Unit/component (executed):
  admin        756 passed (S3.3 routes/navigation, S3.4 grant gate,
                 creation-link gate, dashboard link gate)
  libs         73 files / 564 passed (S3.1 delta audit + S3.2 v3
                 domains/endpoints/services + contract matrices)
  storefront   1433 passed (untouched by S3; re-verified)

Architecture: 106/106 checks passed (no script changes needed in
              Supplement S3 — audit delta stays pure types + pure
              functions; no `libs/ui` additions; no cross-feature
              imports; no new global stores)

E2E (playwright, mocked transports, executed):
  updated S3 suites     25 passed (dashboard 10: users.read card +
                        link, partial, empty, drill-down, error/retry,
                        forbidden, French + RTL chrome; users 15:
                        re-centralized creation/grant/revoke, denied
                        403 toast, read-only browsing, hidden creation
                        link, forbidden creation, French + RTL chrome)
  admin re-verify       68 passed (auth, smoke, catalog, orders,
                        payments — updated navigation/fixtures)
  storefront re-verify  86 passed, 7 skipped (provider-gated and
                        SSR-neutrality skips, pre-existing pattern)
  firefox/webkit smoke  covered by CI (chromium mirrors executed
                        here)

Production builds: storefront SSR + 15/15 prerendered routes;
  admin CSR with per-page lazy chunks; zero budget warnings.
```

---

## 3. Verification results

```text
typecheck (tsc --noEmit)  storefront, admin, libs (7 projects), specs — 0 errors
lint (prettier --check)   0 errors
lint (eslint .)           0 errors
verify-architecture       106/106 checks passed
test:unit                 100% pass (admin 756, libs 564, storefront 1433)
test:e2e (executed)       179 passed, 7 skipped (provider-gated/SSR, pre-existing)
build:storefront          SSR + 15 prerendered routes — 0 errors
build:admin               CSR, all lazy route chunks — 0 errors
responsive probes         auto-fit grids, wrapping facts, token-only logical CSS;
                          audit-enforced (no CSS changes in S3)
```

---

## 4. Definition of Done (Supplement S3 checklist — item-by-item)

```text
Contract
[x] Amended frontend-contract diff reviewed (S3.1 delta audit + ADR-035)
[x] Permission catalog v3 (9 values) pinned in models
[x] Writes + permission catalog document verified SuperAdmin-only
[x] Reads verified users.read (list/counts/get/per-user-perms)
[x] Register-admin verified SuperAdmin (permission-less creation kept)
[x] Dashboard users section gate move verified (users.read)
[x] Identity.Forbidden retirement recorded; generic 403 discipline pinned

AuthZ
[x] Users mount on permissionGuard(['users.read']) (SuperAdmin bypass)
[x] new user route guarded by roleGuard(SuperAdmin)
[x] Navigation users entry on users.read
[x] Creation link hidden for non-SuperAdmin
[x] SuperAdmin supremacy verified

Features
[x] Users reads delegated (list/counts/details browsable with users.read)
[x] Grant UI visible to SuperAdmin only, hidden otherwise
[x] Generic 403 toast path covered (no wire code depended upon)
[x] Admin creation SuperAdmin-only via /users/new
[x] Dashboard users card + drill-down link for users.read holders
[x] Honest empty/partial dashboard states preserved

UX
[x] Localization complete (5 cultures, changed values only, no new keys)
[x] RTL/LTR verified (no CSS changes; existing render specs green)
[x] Responsive verified (untouched layouts)
[x] Accessibility verified (gates hide affordances instead of disabling)
[x] Loading/empty/error/locked states verified

Testing
[x] Unit + component specs added/updated
[x] Guard + mapping specs updated
[x] E2E updated/extended suites green
[x] Pre-existing suites re-verified green
[x] Architecture audit green
[x] Both builds green

Architecture & Documentation
[x] No direct component API access
[x] No libs/ui additions
[x] No cross-feature violations
[x] S1/S2 records frozen (not rewritten)
[x] ADR-035 recorded (delta S3.1 + integration S3.2–S3.6)
[x] PROJECT_CONTEXT.md updated (§43; core numbering untouched)
[x] ARCHITECTURE.md updated (as-built notes)
[x] Supplement S3 completion note written (S3.7, this file)
```

---

## 5. Known limitations

- The dashboard `users` section follows `users.read` (backend design,
  pinned `dashboard-users-read-gate`); unentitled callers see `null`
  sections and the honest empty state when none apply.
- `Identity.Forbidden` has no table entry anymore; denial
  classification is status-first generic 403 (pinned
  `forbidden-code-retired`).
- Grants apply on next login/refresh: a demoted admin keeps rights
  until the current token expires (contract behavior, test-pinned —
  not a defect).
- Payment history/timeline still does not exist anywhere on the HTTP
  surface (carried over from S1/S2, still test-pinned).
- Firefox/WebKit E2E projects mirror the executed Chromium suites
  and are covered by CI.

---

## 6. Deferred work (explicit non-goals)

```text
Phase 15 — Final QA & Optimization: system-wide matrix, live-backend
           confirmation, final performance/bundle review (core roadmap
           continues here; Supplement S3 changes nothing about it)
Backend    — payment history/timeline (absent from the HTTP surface;
           the frontend must not invent it)
```

---

## 7. Documentation changes in this supplement

```text
docs/completed/SUPPLEMENT_S3_COMPLETION_REPORT.md   created (this file, S3.7)
docs/PROJECT_CONTEXT.md                             §43 supplement adoption (S3.7)
docs/ARCHITECTURE.md                                §§4, 22 as-built (S3.7)
docs/adr/035-...-delta.md                           created S3.1, extended S3.7
docs/phases/SUPPLEMENT_S3_...                       plan + DoD checkboxes (S3.7)
libs/models (supplement-s3-audit +                  S3.1 delta audit + S3.2 v3
  domains/*, api-endpoints, IdentityApiService)     domains + endpoints + services
libs/auth                                           unchanged in Supplement S3
apps/admin (routes, navigation,                    S3.3–S3.4
  users pages, dashboard link)
e2e/admin-dashboard, admin-users (updated),        S3.6
  admin fixtures (v3 catalog)
scripts/verify-architecture.mjs                     unchanged in Supplement S3
```

---

## 8. Phase 15 handoff

```text
The Admin Portal now serves delegated users reads (users.read) with
SuperAdmin-only writes and creation, plus the adaptive dashboard
whose users section follows users.read — all against the real
re-centralized backend contracts and all verified:
  - unit/component green (admin 756, libs 564, storefront 1433);
    audit 106/106; both builds green; E2E 179 passed
  - shared tables grow by extension, never by fork (extend with specs)
  - S1/S2 records stay frozen as history
  - open items for later: live-backend confirmations (Phase 15)
Next: Phase 15 — Final QA & Optimization.
```

(End of file)
