# ADR 028 — Admin Catalog & Inventory Feature Integration

Status: Accepted (2026-09-27, Phase 13 Sub-Phases 13.2–13.11; contract
alignment in ADR-027).

## Context

Phases 13.2–13.10 mount the first business features on the Phase 12
admin foundation (shell, table, pagination, filters, forms, dialog,
notifications). Five integration questions recurred and needed one
deliberate answer each: where feature transport/state live, how writes
split across slices, how tables support row navigation and row actions
without forking, where image/specification management lives, how
inventory reads work without list endpoints, and how backend field
errors reach form controls without per-form mapping tables.

## Decision

### 1. Route-provided transport seam and states, no root singletons

`CatalogAdminApiService`, `InventoryAdminApiService`, and every
feature state (`CatalogOverviewState`, `ProductListState`,
`ProductDetailsState`, `CategoryLookupState`, `CategoryListState`,
`CategoryDetailsState`, `VariantListState`, `VariantDetailsState`,
`StockState`, `ReservationState`) are `@Injectable()` WITHOUT
`providedIn`, provided once at the feature-route root. Adjustment
submission state stays page-local (the smallest appropriate scope —
no shared store justifies a stateless, single-shot form). The Phase
12.8 root-provided allowlist is unchanged (still two services) and the
audit stays 106/106.

### 2. Reads land in the foundation, writes land with their slices

The 13.2/13.8 foundation services carry the read surface the landing
pages need; every write (product/variant/category/image/spec/stock
calls) arrives with the slice that owns its form. No slice imports
another slice's internals — details pages reuse their own state slots
for edit population, and the inventory feature never imports catalog
code.

### 3. Shared table grows by extension, never by fork

`AdminDataTable` gained two additive, business-free capabilities,
each pinned by specs: per-column row links (13.3, deep-linkable
anchors) and a projected row-actions column (`actionsTemplate` with
`$implicit: row` plus `index`, under an owner-localized header; 13.6).
The component still owns no behavior, no HTTP, and no business
knowledge — features pass templates, the table reserves the cell.

### 4. Image/specification management lives inline on product details

Variants and categories earned dedicated pages (complex records with
their own details views); images and specifications — flat URL and
name/value records — are managed inline on the product details page
through dialogs (add/edit), direct actions (set-primary, reorder
moves), and confirms (deletion). No image/spec routes exist, and none
are needed: the sections reload settled truth after every mutation.

### 5. Lookup-only inventory reads, verbatim quantities

The backend exposes no stock list, no reservation list, no paging,
filtering, sorting, or search — so the portal offers single-SKU and
single-id lookups instead of inventing list UX (13.9/13.10). Displayed
quantities echo verbatim (`availableQuantity` is never derived, no
threshold badge is invented), SKU normalization is transport hygiene
(trim + upper, idempotent with the backend), and metadata round-trips
untouched through image updates (no metadata editor exists — sending
`null` would wipe unseen data).

### 6. Form control names mirror DTO camelCase

`toFormErrorPath` lowercases each `errors{}` segment, so controls
named after the DTO (`imageUrl`, `displayOrder`, `unitPriceAmount`,
`parentId`) receive backend field errors with no per-form table.
Abbreviated control names (`url`, `order`, `price`) silently dropped
those errors — caught by specs in 13.6 and renamed. The rule is now:
form control names mirror DTO camelCase; view-model shapes may differ.

## Consequences

- Sub-Phases 13.2–13.10 build on pinned, tested seams; 13.11 verified
  the whole flow end to end (13 Playwright journeys, mocked
  transports) plus the full matrix (unit, typecheck, lint, audit,
  both builds).
- `verify-architecture.mjs` needed no changes in Phase 13 (the 13.2
  translation-dictionary exemption from the 3.7 word guard already
  covered nav-label growth).
- Phase 14 reuses the same patterns for orders/payments; any new
  shared-primitive capability requires the same extension treatment
  (deliberate, spec-pinned, no forks).
