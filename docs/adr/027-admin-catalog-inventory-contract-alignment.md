# ADR 027 — Admin Catalog & Inventory Contract Alignment (Sub-Phase 13.1)

Status: Accepted (2026-09-26, Phase 13 Sub-Phase 13.1).

## Context

Sub-Phase 13.1 must fix the exact Admin/Backend integration boundary
before any Catalog or Inventory business functionality exists: which
endpoints the portal consumes, which DTOs travel where, which list
operations paginate, which image mechanism the backend exposes, which
admin routes the portal will mount, and who owns what. The audit
sources are `docs/frontend-contract/API_CONTRACT.md` §§2/5,
`DTO_REFERENCE.md` §§2/5, `ENUM_REFERENCE.md` §§2/4, `ERROR_CATALOG.md`
§§2/5, and `PAGINATION_CONVENTION.md`.

## Decision

### 1. Audited contract (the complete HTTP surface today)

- Catalog reads are `[AllowAnonymous]`; every catalog write needs the
  `Admin` role. Inventory is entirely `Admin`-only, including reads.
  Mirrored canonically in `libs/models/.../domains/catalog.ts` and
  `inventory.ts`; aliased as `AdminProduct`/`AdminStockItem`/… in the new
  `catalog-inventory-contract.ts` audit module, never re-declared.
- Product lifecycle is `activate/deactivate/archive/soft-delete/restore`
  (`POST …→204`); categories and attribute definitions have the same
  four minus `archive`. There is NO product/category hard delete and NO
  status field on product writes (`visibility` only).
- Variant update carries ONLY `sku` + `name` — price, currency, and
  status cannot be edited; variants have no lifecycle actions.
- Inventory is exactly four endpoints (`POST /inventory`,
  `GET /inventory/{sku}`, `PATCH /inventory/{sku}` additive-only,
  `GET /inventory/reservations/{id}`). There is NO stock list, NO
  reservation list, NO stock search/filter/sort/pagination, NO manual
  decrement, NO item delete, and NO reservation mutation from the SPA —
  all pinned in `UNSUPPORTED_INVENTORY_OPERATIONS` so Sub-Phases
  13.9–13.10 build lookup + adjustment UX instead of list UX.
- Pagination exists ONLY on `listProducts`/`listCategories`/`searchCatalog`
  (`pageNumber ≥ 1`, `1 ≤ pageSize ≤ 100`, defaults `1`/`20`); sorting and
  filtering exist ONLY on `searchCatalog`. Sub-resource lists (variants,
  images, attributes, specifications, attribute definitions) are full
  `T[]` collections, never paged.
- Image mechanism is URL references only (`ADMIN_IMAGE_MECHANISM =
'url-reference'`): no multipart/file upload, no base64, no
  presigned-URL flow. `isPrimary` is set at add time or via `set-primary`
  (never via image `PUT`); ordering changes only via `reorder`.
- Catalog enums are NUMBERS on the wire in JSON bodies and responses;
  query strings accept names or numbers. `availableQuantity` echoes
  verbatim for display — the SPA never derives `onHand − reserved`.

### 2. Frontend models

- `AdminProduct`/`AdminCategory`/`AdminVariant`/`AdminProductImage`/
  `AdminProductSpecification`/`AdminAttributeValue`/
  `AdminAttributeDefinition` → aliases of the canonical catalog responses;
  `AdminStockItem`/`AdminReservation` → aliases of the canonical
  inventory responses; write bodies (`AdminProductWrite`,
  `AdminVariantCreate`, `AdminStockAdjust`, …) → aliases of the canonical
  request DTOs.
- Admin query shapes are transport-only: `AdminProductListQuery`/
  `AdminCategoryListQuery` (paging only), `AdminCatalogSearchQuery` (the
  only filtered/sorted read), `AdminVariantListQuery` (product scope),
  `AdminStockLookupQuery`/`AdminReservationLookupQuery` (single-resource
  lookups), plus structural pre-checks (`isValidAdminPagingQuery`,
  `isValidAdminStockLookupQuery`, `isValidAdminAdjustmentQuantity`) that
  are never substitutes for backend validation.
- Failure classifiers are status-first (`isAdminNotFoundFailure`/
  `isAdminConflictFailure`/`isAdminValidationFailure`/`isAdminAuthFailure`),
  never message-text-based, per `ERROR_CATALOG.md` §0 (business errors
  carry no machine `code` on the wire).

### 3. Responsibility boundary

Frontend owns `catalog-ux, inventory-ux, typed-forms, feature-state,
loading-error-handling, navigation, notifications, confirmation-dialogs`.
Backend owns `product-state, category-state, variant-validity,
sku-uniqueness, price-rules, stock-state, reservation-state,
reservation-lifecycle, inventory-coordination, saga-orchestration,
validation, authorization`. The two sets are disjoint by construction
(test-pinned) — zero business-logic duplication.

### 4. Route and placement conventions (settled in 13.1, built in 13.2+)

- Phase 13 mounts lazy `catalog` and `inventory` children under the
  guarded portal shell (`ADMIN_PHASE_13_ROUTES`), with planned child
  segments `products`/`categories` and `stock`/`reservations`/`adjustments`
  respectively; guards stay the existing `authGuard` + `roleGuard` chain
  over `ADMIN_PORTAL_ROLES`.
- Features follow `pages/components/data-access/state/models/
<feature>.routes.ts` with Signals-only state over the Phase 12 admin
  shared primitives; no global stores, no `libs/ui` additions (closed
  set, ADR-026).

### 5. Placement (scope discipline)

The audit lives in `libs/models` (shared contracts), NOT in
`features/catalog/` or `features/inventory/` — no feature structure
(13.2/13.8), no API service, no signal store, no components/routes were
created. The module is pure types + pure functions: no Angular, no
`HttpClient`, no browser APIs — SSR-safe.

File naming note: the module is `catalog-inventory-contract.ts` (not
`admin-…`) because the workspace ESLint `**admin**` import guard matches
any specifier containing that substring — even a library-internal
filename — and would false-positive. Exported symbol names keep the
`Admin*` prefix; only the filename avoids the substring.

## Consequences

- Sub-Phases 13.2+ build on pinned, tested shapes instead of assumptions;
  the inventory no-list limitation and the URL-only image mechanism are
  explicit rather than discovered mid-UI.
- `libs/models` gains `catalog-inventory-contract.ts` +
  `catalog-inventory-contract.spec.ts` (26 tests: lifecycle tables,
  unsupported-operation pins, paging/sort/filter matrix, lookup
  pre-checks, image-mechanism pin, route/folder conventions, endpoint
  pins, status-first classifiers, disjoint responsibility sets); no admin
  feature code exists yet.
- Verification: `tsc` (models lib + spec project), `vitest` (64/64
  models tests), `eslint`, `prettier`, and
  `node scripts/verify-architecture.mjs` all green with 0 errors.
