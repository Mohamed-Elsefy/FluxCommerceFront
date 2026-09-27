# Phase 13 — Admin Catalog & Inventory: Completion Report

Status: **Complete** — 2026-09-27.

Phase 13 turns the Admin Portal from a stable management shell into a
functional Commerce Management Interface for Catalog and Inventory
operations, built on the Phase 12 foundation and its shell,
navigation, tables, pagination, filters, forms, dialogs,
notifications, localization, RTL/LTR, theming, authorization, and
testing infrastructure. All eleven sub-phases (13.1–13.11) are done in
dependency order. The baseline is ready for **Phase 14 — Admin Orders
& Payments**.

Related references: `docs/PROJECT_CONTEXT.md` (§34),
`docs/ARCHITECTURE.md` (as-built notes in §§4–5, 9, 22),
`docs/phases/PHASE_13_ADMIN_CATALOG_AND_INVENTORY.md`,
`docs/adr/027–028`.

The final boundary holds: the Admin Portal submits commands and
displays the resulting backend state; the backend owns business truth,
orchestration, authorization, and ownership. No endpoint, CRUD
operation, upload mechanism, list, filter, sort, threshold, or
response model was invented — every contract gap stays pinned in code
and docs instead of fabricated.

---

## 1. Sub-phase summary

```text
13.1 Foundation & Backend Contract Alignment
     Audited the exact Admin/Backend boundary before any business code:
     the complete catalog + inventory endpoint tables (methods, DTOs,
     pagination/filter/sort capabilities, validation, auth), the four
     inventory endpoints as the ENTIRE inventory surface (no stock or
     reservation list exists), URL-only image references (no upload
     endpoint), numeric wire enums, and the admin route conventions.
     Delivered as `catalog-inventory-contract.ts` + 26 specs in
     `libs/models` (pure types + pure functions, no feature code) and
     ADR-027. No unresolved API assumptions remain.

13.2 Admin Catalog Feature Foundation
     Created `features/catalog/` (pages/components/data-access/state/
     models/`catalog.routes.ts`), the `CatalogAdminApiService` read
     façade, route-provided `CatalogOverviewState`, the landing page
     with backend-issued totals, the `catalog` lazy boundary under the
     guarded shell, sidebar entry, and `layout.nav.catalog` in five
     cultures. No business UI yet — routable, authorized, connected.

13.3 Product Management
     End-to-end products on the real contract: paged table (status,
     visibility, category names) with response-effective pager; typed
     create/edit forms (SEO included) with client validators plus
     backend field-error projection; details (metadata, badges,
     variant/image/spec sections, deletion stamp); all five lifecycle
     transitions behind confirms with backend-owned validity (`409`
     surfaces, never predicted). No server sort/filter/search exists
     on product rows — omitted by design, documented in code.

13.4 Product Variants Management
     Variant list/details/create/edit/delete within the product
     context. Create carries price + currency (the single pricing
     moment); edit locks them read-only (the update endpoint accepts
     `sku` + `name` only). SKU uniqueness, price, stock, and validity
     rules stay backend-owned and surface as field/conflict feedback.
     No variant lifecycle exists — deletion is the only removal op.
     Availability display deferred to Inventory (13.9+).

13.5 Category Management
     Category list/details/create/edit/delete with the flat backend
     model (per-row `parentId` references, no tree widget — no tree
     endpoint exists): parent select with top-level option, self
     excluded on edit, raw-id fallback outside the lookup. Lifecycle
     is activate/deactivate/soft-delete/restore (no `archive` for
     categories). No search/filter/sort exists on the endpoint —
     omitted by design.

13.6 Product Images & Specifications
     Inline management on the product details page (no new routes):
     image add/edit/delete, set-primary (idempotent, no confirm),
     reorder (exact settled id-set swaps committed per move);
     specification add/edit/delete. URL references only; stored
     `metadata` round-trips untouched through updates. Shared table
     extended with a projected row-actions column (no fork). Form
     control names mirror DTO camelCase so backend field errors map
     with no per-form table (fixed a latent variant price gap).

13.7 Catalog Integration & Hardening
     Full review pass: fixed lookup staleness (settled snapshots now
     refetch every visit), surfaced lookup failures on all four
     category-consuming forms, added translation key-coverage specs
     (every `catalog.*` key and nav label resolves in all cultures),
     added the product deletion-stamp row. No new business behavior.

13.8 Inventory Feature Foundation
     Created `features/inventory/` with the four-endpoint transport
     seam, canonical wire aliases, the static landing page (no theater
     states — no list endpoint backs data), the `inventory` lazy
     boundary, sidebar entry, and `layout.nav.inventory` in five
     cultures. States and UX deferred to 13.9–13.10 by design.

13.9 Stock & Inventory Status
     Single-SKU lookup over `GET /inventory/{sku}` (the only stock
     read — no list/pagination/filter/sort/search exists):
     backend-issued on-hand/reserved/available verbatim (never
     derived), no invented status or thresholds, no product-name
     resolution (no such endpoint). Caught and fixed a real defect:
     `(ngSubmit)` without `[formGroup]` never fires.

13.10 Reservations & Inventory Adjustments
      Single-id reservation lookup (ids never enumerable) with
      unknown-safe status badges — lifecycle stays backend-owned;
      additive adjustment form (SKU + positive whole quantity, no
      reason field exists) with confirmation dialog, submit locks,
      field-error projection, and the backend-returned updated record
      rendered as the result. Landing cards link their live routes.
      Testing caught a real defect: the confirm message derived
      non-signal form values through a culture-only computed and
      rendered stale — snapshotted at submit time.

13.11 Phase Verification, E2E & Documentation (this sub-phase)
      13 Playwright journeys (`e2e/admin-catalog.spec.ts`, mocked
      transports) green; pre-existing admin E2E re-verified green;
      full matrix green (below); ADR-028; this report; DoD
      checkboxes; PROJECT_CONTEXT/ARCHITECTURE sync.
```

---

## 2. Test coverage

```text
Unit/component (ng-test builders, executed):
  admin        74 files / 389 passed (13.2–13.10 slices: catalog
               foundation through adjustments, plus 13.7
               key-coverage + lookup-failure specs)
  libs         59 files /  423 passed (13.1 audit module + spec;
               nothing else touched)
  storefront   119 files / 1363 passed (Phase 11 baseline, untouched
               by Phase 13 — re-verified green in 13.11)

Architecture: 106/106 checks passed (no script changes needed in
              Phase 13 — the 13.2 translation-dictionary exemption
              already covered nav-label growth)

E2E (playwright, mocked transports, executed):
  admin-catalog           13 passed (product list/create/edit,
                          variants, categories + soft-delete,
                          images/specs, unknown-product error,
                          stock + reservation lookups, adjustment
                          with updated-state verification,
                          customer→forbidden, French chrome)
  admin-auth              15 passed (access control + 12.10 journeys,
                          re-verified with extended navigation)
  admin smoke             1 passed (chromium)

Production builds: storefront SSR + 15/15 prerendered routes;
  admin CSR with per-page lazy chunks (catalog + inventory);
  zero budget warnings.
```

---

## 3. Verification results

```text
verify-architecture         106/106 checks passed
typecheck                   storefront, admin, libs, specs — 0 errors
lint (prettier + eslint)    0 errors
build:storefront            SSR + 15 prerendered routes — 0 errors
build:admin                 CSR, all lazy route chunks — 0 errors
test:unit                   100% pass (admin 389, libs 423,
                            storefront 1363)
test:e2e (admin scope)      29 passed (13 catalog/inventory + 16
                            pre-existing), mocked transports
responsive probes           scroll-safe tables, auto-fit grids,
                            wrapping rows, bounded dialog (90dvh),
                            token-only logical CSS; audit-enforced
```

---

## 4. Definition of Done (Phase 13 §DoD — item-by-item)

```text
Catalog
[x] Products (13.3: list/create/edit/details/lifecycle)
[x] Product Variants (13.4: list/details/create/edit/delete)
[x] Categories (13.5: list/details/create/edit/lifecycle, flat model)
[x] Product Images (13.6: add/edit/delete/set-primary/reorder, URL-only)
[x] Product Specifications (13.6: add/edit/delete)

Inventory
[x] Stock (13.9: single-SKU lookup, verbatim quantities)
[x] Inventory Status (13.9: backend-provided state, no invented thresholds)
[x] Reservations (13.10: single-id lookup, lifecycle backend-owned)
[x] Inventory Adjustments (13.10: additive form + confirm + backend-returned result)

Engineering Quality
[x] Real backend contracts are used. (13.1 audit; no invented endpoints)
[x] Authorization is enforced. (shell guards + Admin-only endpoints; customer→forbidden E2E)
[x] Loading/empty/error states are implemented. (resource slots + shared async UI; error and empty paths unit- and E2E-covered)
[x] Typed Reactive Forms are used where applicable. (product/variant/category/image/spec/adjustment forms)
[x] Backend validation errors are displayed correctly. (field projection + form notices; unit-covered per form)
[x] Duplicate submissions are prevented. (submit/transition/media locks + dialog dismissal)
[x] Existing Phase 12 shared primitives are reused. (table/pagination/filters/forms/dialog/notifications)
[x] Feature boundaries remain clean. (audit 106/106; no cross-feature imports)
[x] Backend business rules are not duplicated. (validity, transitions, math, lifecycle backend-owned)
[x] Localization is supported. (5 cultures; key-coverage specs; French E2E)
[x] RTL/LTR is supported. (logical CSS only; audit-enforced; pre-existing RTL E2E)
[x] Responsive behavior is verified. (patterns + audit; mobile drawer E2E pre-existing)
[x] Accessibility is verified. (labels, badges, focus trap, aria, native controls; audit 3.11)
[x] Unit/component tests are complete. (§2)
[x] Critical Playwright E2E scenarios are complete. (§2)
[x] Architecture verification passes. (106/106)
[x] Documentation is updated. (13.11)
```

---

## 5. Known limitations

- Stock, reservation, and adjustment UX is lookup/form-based only:
  the backend exposes no stock list, no reservation list, no paging,
  filtering, sorting, or search — single-resource reads plus the
  additive adjustment are the complete supported surface (pinned in
  ADR-027 and page docs, not gaps in the frontend).
- Product/category rows offer no server search, sort, or filter for
  the same reason (the search endpoint returns thin rows without
  status); lists page through the full admin-shaped endpoints.
- Image metadata has no editor: it round-trips untouched through
  updates by design (sending `null` would wipe unseen data).
- Variant price and currency are creation-only (no update endpoint
  exists); the edit form locks them read-only rather than hiding them.
- Category names outside the first hundred fall back to raw ids in
  product/category displays (lookup pages cap at 100, no search).
- Product/variant names never resolve on stock records (the payload
  carries the SKU alone; no lookup-by-SKU endpoint exists).
- `POST /inventory` (item creation) is wired in the transport seam
  but has no onboarding UI: neither 13.9 nor 13.10 scopes item
  creation (adjustments presuppose an existing SKU and surface
  `404` otherwise).
- The dashboard upcoming-module grid still labels Catalog and
  Inventory "upcoming": it is a static Phase 12 placeholder with no
  links by design; Phase 14 decides its fate with the home route.

---

## 6. Deferred work (explicit non-goals)

```text
Phase 14 — Admin Orders & Payments: order/payment lists, details,
           status, history (same foundations: route-provided
           transport + state, shared table/pager/forms/dialog,
           5-culture bundles, mocked-transport E2E)
Phase 15 — Final QA & Optimization: system-wide matrix, live-backend
           confirmation, final performance/bundle review
Backend    — stock/reservation lists, product search with status,
           variant price updates, image metadata editing, inventory
           item onboarding UI contract (all absent from the HTTP
           surface; frontend must not invent them)
```

---

## 7. Documentation changes in this phase

```text
docs/completed/PHASE_13_COMPLETION_REPORT.md   created (this file)
docs/PROJECT_CONTEXT.md                       §34 marked Complete
docs/ARCHITECTURE.md                          §§4–5, 9, 22 as-built
docs/adr/027-...-contract-alignment.md        created (13.1)
docs/adr/028-...-integration.md               created (13.2–13.10)
docs/phases/PHASE_13_ADMIN_CATALOG_AND_INVENTORY.md
                                              DoD checkboxes marked
e2e/admin-catalog.spec.ts                     13 journeys (13.11)
playwright.config.ts                          admin-catalog-chromium
                                              project (13.11)
apps/admin (features/catalog, features/inventory, shared,
            navigation, layout bundle)        built across 13.2–13.10
apps/admin/.../shared/data-table              row links (13.3) +
                                              projected row actions
                                              (13.6) extensions
scripts/verify-architecture.mjs               unchanged in Phase 13
```

---

## 8. Phase 14 handoff

```text
The Admin Portal now manages products, variants, categories, images,
specifications, stock, reservations, and adjustments end to end
against the real backend contracts — all verified:
  - admin app builds and tests green (389 unit + 29 E2E); audit 106/106
  - shared libs untouched except the additive 13.1 audit module
  - data-table extensions are the sanctioned pattern for future
    row-level needs (extend with specs, never fork)
  - open items for later: dashboard/home-route fate, notification
    expiry policy per feature, order/payment linkage contract,
    inventory item onboarding UI, live-backend confirmations
    (Phase 15)
Next: Phase 14 — Admin Orders & Payments.
```

(End of file — total lines vary)
