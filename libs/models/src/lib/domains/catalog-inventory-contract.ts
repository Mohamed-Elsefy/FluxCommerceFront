/**
 * Admin Catalog & Inventory contract audit for Sub-Phase 13.1 —
 * Foundation & Backend Contract Alignment.
 *
 * Scope: `docs/phases/PHASE_13_ADMIN_CATALOG_AND_INVENTORY.md` §13.1
 * (contracts and boundaries only — no feature structure, no API service,
 * no state store, no components, no routes, no pages).
 *
 * Source of truth:
 * - `docs/frontend-contract/API_CONTRACT.md` §2 (catalog) + §5 (inventory).
 * - `docs/frontend-contract/DTO_REFERENCE.md` §2 (catalog) + §5 (inventory).
 * - `docs/frontend-contract/ENUM_REFERENCE.md` §2 (catalog) + §4 (inventory).
 * - `docs/frontend-contract/ERROR_CATALOG.md` §2 (catalog) + §5 (inventory).
 * - `docs/frontend-contract/PAGINATION_CONVENTION.md` (which lists paginate).
 *
 * Audited backend surface (the complete HTTP contract today):
 * - Catalog reads are `[AllowAnonymous]`; every catalog write needs the
 *   `Admin` role (controller default `[Authorize]`).
 * - Inventory is entirely `Admin`-only, including reads (prevents customer
 *   IDOR on reservations).
 * - Writes: create → `201 ApiResponse<Guid|Guid[]>` + `Location`; lifecycle/
 *   assign/update/delete → `204` empty. Reads: `200 ApiResponse<...>`.
 * - Catalog enums are NUMBERS on the wire in JSON bodies and responses
 *   (no `JsonStringEnumConverter`); query strings accept names or numbers.
 * - Inventory timestamps are `DateTimeOffset`; catalog timestamps are
 *   `DateTime` (both arrive as ISO-8601 strings).
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - Canonical wire mirrors stay the single declaration site:
 *   `ProductResponse`/`CategoryResponse`/`VariantResponse`/image/spec/
 *   attribute shapes live in `./catalog`, inventory shapes in
 *   `./inventory`, enums in `../common/enums`. This module aliases them
 *   (`AdminProduct`, `AdminStockItem`, ...) — never re-declares — so no
 *   contract drift is possible.
 * - This module owns the audit-only additions: the supported-operation
 *   tables, the explicit unsupported-operation pins (no invented CRUD),
 *   the pagination/filtering/sorting capability matrix, the image-mechanism
 *   pin, the lifecycle-action unions, the admin query shapes, the admin
 *   route-convention pins, the responsibility-boundary tables, and pure
 *   structural classifiers (status-first, never message-text-based, per
 *   `ERROR_CATALOG.md` §0).
 *
 * Backend-authoritative data rule (this sub-phase's core constraint):
 * this module performs NO inventory computation (no
 * `available = onHand - reserved` derivation — `availableQuantity` echoes
 * verbatim for display only), NO SKU-uniqueness/price/stock/variant-validity
 * rules, NO reservation-lifecycle transitions, NO saga orchestration, and
 * NO money computation — no `unitPrice * quantity`, no totals, no
 * float-math money helpers. Amounts echo verbatim for display only.
 * Client-side state is never treated as domain truth — only the backend
 * response speaks authoritatively.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 13.2 — no `features/catalog/` folder, pages, components, routes.
 * - 13.3–13.6 — no product/variant/category/image/spec UI or forms.
 * - 13.8–13.10 — no `features/inventory/` folder, stock pages,
 *   reservation pages, adjustment forms.
 * - No API service, no `HttpClient`, no envelope mapping, no `ApiClient`
 *   usage, no request cancellation.
 * - No `@Injectable()` store, no signals/computeds, no state machine
 *   implementation (expectation tables only).
 *
 * This file is pure types + pure functions: no Angular imports, no
 * `HttpClient`, no browser APIs, no `localStorage`. Every helper is
 * SSR-safe, throws nothing, and performs no HTTP.
 */

import type { Guid } from '../common/shared-types';
import type {
  AttributeDefinitionResponse,
  CatalogImageSummary,
  CatalogProductListItem,
  CategoryResponse,
  CreateAttributeDefinitionRequest,
  CreateCategoryRequest,
  CreateProductRequest,
  CreateProductSpecificationRequest,
  CreateProductVariantRequest,
  CreateProductVariantsRequest,
  ProductAttributeValueResponse,
  ProductImageResponse,
  ProductResponse,
  ProductSpecificationResponse,
  UpdateProductVariantRequest,
  VariantResponse,
} from './catalog';
import type {
  AdjustStockRequest,
  CreateInventoryItemRequest,
  InventoryItemResponse,
  InventoryReservationResponse,
} from './inventory';

// ---------------------------------------------------------------------------
// Frontend domain models (aliases — the wire stays canonical)
// ---------------------------------------------------------------------------

/** Frontend `AdminProduct` model. Alias of the canonical `ProductResponse`. */
export type AdminProduct = ProductResponse;

/** Frontend admin category model. Alias of `CategoryResponse`. */
export type AdminCategory = CategoryResponse;

/** Frontend admin variant model. Alias of `VariantResponse`. */
export type AdminVariant = VariantResponse;

/** Frontend admin image model. Alias of `ProductImageResponse`. */
export type AdminProductImage = ProductImageResponse;

/** Frontend admin specification model. Alias of `ProductSpecificationResponse`. */
export type AdminProductSpecification = ProductSpecificationResponse;

/** Frontend admin attribute-value model. Alias of `ProductAttributeValueResponse`. */
export type AdminAttributeValue = ProductAttributeValueResponse;

/** Frontend admin attribute-definition model. Alias of `AttributeDefinitionResponse`. */
export type AdminAttributeDefinition = AttributeDefinitionResponse;

/** Frontend admin stock model. Alias of `InventoryItemResponse`. */
export type AdminStockItem = InventoryItemResponse;

/**
 * Frontend admin reservation model. Alias of `InventoryReservationResponse`
 * (`reservationId` is named `ReservationId`, not `Id` — see DTO_REFERENCE §5).
 */
export type AdminReservation = InventoryReservationResponse;

/** Storefront search row reused by the admin list when it needs a lightweight row. */
export type AdminCatalogSearchRow = CatalogProductListItem;

/** Primary-image summary embedded in `AdminCatalogSearchRow`. */
export type AdminCatalogImageSummary = CatalogImageSummary;

// ---------------------------------------------------------------------------
// Supported catalog operations (audited — API_CONTRACT.md §2)
// ---------------------------------------------------------------------------

/**
 * Product lifecycle actions. Each maps to
 * `POST /catalog/products/{id}/<action>` → `204` (`Admin` only).
 * There is NO `DELETE /catalog/products/{id}` — removal is `soft-delete`
 * (+ `restore`); there is NO hard delete and NO `PUT` status field
 * (create/update carry `visibility` only, never `status`).
 */
export const PRODUCT_LIFECYCLE_ACTIONS = [
  'activate',
  'deactivate',
  'archive',
  'soft-delete',
  'restore',
] as const;

/** One product lifecycle action. */
export type ProductLifecycleAction = (typeof PRODUCT_LIFECYCLE_ACTIONS)[number];

/**
 * Category lifecycle actions. Each maps to
 * `POST /catalog/categories/{id}/<action>` → `204` (`Admin` only).
 * There is NO `DELETE /catalog/categories/{id}` and NO `archive` for
 * categories (products only).
 */
export const CATEGORY_LIFECYCLE_ACTIONS = [
  'activate',
  'deactivate',
  'soft-delete',
  'restore',
] as const;

/** One category lifecycle action. */
export type CategoryLifecycleAction = (typeof CATEGORY_LIFECYCLE_ACTIONS)[number];

/**
 * Attribute-definition lifecycle actions. Each maps to
 * `POST /catalog/attribute-definitions/{id}/<action>` → `204`
 * (`Admin` only). Same four as categories — no `archive`.
 */
export const ATTRIBUTE_DEFINITION_LIFECYCLE_ACTIONS = [
  'activate',
  'deactivate',
  'soft-delete',
  'restore',
] as const;

/** One attribute-definition lifecycle action. */
export type AttributeDefinitionLifecycleAction =
  (typeof ATTRIBUTE_DEFINITION_LIFECYCLE_ACTIONS)[number];

/**
 * Whether `value` names a product lifecycle action. Pure — throws nothing.
 */
export function isProductLifecycleAction(value: unknown): value is ProductLifecycleAction {
  return (
    typeof value === 'string' && (PRODUCT_LIFECYCLE_ACTIONS as readonly string[]).includes(value)
  );
}

/**
 * Whether `value` names a category lifecycle action. Pure — throws nothing.
 */
export function isCategoryLifecycleAction(value: unknown): value is CategoryLifecycleAction {
  return (
    typeof value === 'string' && (CATEGORY_LIFECYCLE_ACTIONS as readonly string[]).includes(value)
  );
}

/**
 * Whether `value` names an attribute-definition lifecycle action.
 * Pure — throws nothing.
 */
export function isAttributeDefinitionLifecycleAction(
  value: unknown,
): value is AttributeDefinitionLifecycleAction {
  return (
    typeof value === 'string' &&
    (ATTRIBUTE_DEFINITION_LIFECYCLE_ACTIONS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Explicitly unsupported operations (no invented CRUD — §13.1 constraint)
// ---------------------------------------------------------------------------

/**
 * Catalog operations that DO NOT exist in the backend contract and must
 * never be implemented in the admin UI. Pinned so later sub-phases cannot
 * invent them (e.g. a product hard-delete button, a variant price editor,
 * or a stock decrement field).
 */
export const UNSUPPORTED_CATALOG_OPERATIONS = [
  'product-hard-delete',
  'product-status-write',
  'variant-price-update',
  'variant-status-update',
  'variant-lifecycle',
  'category-archive',
  'image-file-upload',
  'image-isPrimary-update',
  'attribute-value-attributeDefinitionId-update',
] as const;

/** One explicitly unsupported catalog operation. */
export type UnsupportedCatalogOperation = (typeof UNSUPPORTED_CATALOG_OPERATIONS)[number];

/**
 * Inventory operations that DO NOT exist in the backend contract and must
 * never be implemented in the admin UI. The inventory surface is exactly
 * four endpoints (`INVENTORY_*` below) — there is no stock list, no
 * reservation list, no stock search/filter/sort/pagination, no manual
 * decrement, no item delete, and no reservation mutation from the SPA.
 */
export const UNSUPPORTED_INVENTORY_OPERATIONS = [
  'stock-list',
  'stock-search',
  'stock-pagination',
  'stock-filtering',
  'stock-sorting',
  'stock-decrement',
  'stock-delete',
  'reservation-list',
  'reservation-create',
  'reservation-update',
  'reservation-delete',
  'reservation-commit',
  'reservation-release',
] as const;

/** One explicitly unsupported inventory operation. */
export type UnsupportedInventoryOperation = (typeof UNSUPPORTED_INVENTORY_OPERATIONS)[number];

/**
 * Whether `value` names an explicitly unsupported catalog operation.
 * Pure — throws nothing.
 */
export function isUnsupportedCatalogOperation(
  value: unknown,
): value is UnsupportedCatalogOperation {
  return (
    typeof value === 'string' &&
    (UNSUPPORTED_CATALOG_OPERATIONS as readonly string[]).includes(value)
  );
}

/**
 * Whether `value` names an explicitly unsupported inventory operation.
 * Pure — throws nothing.
 */
export function isUnsupportedInventoryOperation(
  value: unknown,
): value is UnsupportedInventoryOperation {
  return (
    typeof value === 'string' &&
    (UNSUPPORTED_INVENTORY_OPERATIONS as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// Pagination / filtering / sorting capability matrix
// ---------------------------------------------------------------------------

/**
 * Which admin-consumed catalog reads paginate. Only three do
 * (`PAGINATION_CONVENTION.md` §2): the product list, the category list, and
 * the storefront search. Every sub-resource list (variants, images,
 * attributes, specifications, attribute definitions) returns a full `T[]`
 * with no pager — they must never be wrapped in pager logic.
 */
export const PAGINATED_ADMIN_CATALOG_READS = [
  'listProducts',
  'listCategories',
  'searchCatalog',
] as const;

/** One paginated admin catalog read. */
export type PaginatedAdminCatalogRead = (typeof PAGINATED_ADMIN_CATALOG_READS)[number];

/**
 * Admin-consumed catalog reads that return full collections (`T[]`,
 * no `PagedResult` wrapper): variants, attribute definitions, attribute
 * values, images (server-ordered by `displayOrder`), specifications.
 */
export const NON_PAGINATED_ADMIN_CATALOG_READS = [
  'listVariants',
  'listAttributeDefinitions',
  'listAttributeValues',
  'listProductImages',
  'listSpecifications',
] as const;

/** One non-paginated admin catalog read. */
export type NonPaginatedAdminCatalogRead = (typeof NON_PAGINATED_ADMIN_CATALOG_READS)[number];

/**
 * Whether the named admin catalog read paginates (`PagedResult` envelope).
 * Pure — throws nothing.
 */
export function isPaginatedAdminCatalogRead(value: unknown): value is PaginatedAdminCatalogRead {
  return (
    typeof value === 'string' &&
    (PAGINATED_ADMIN_CATALOG_READS as readonly string[]).includes(value)
  );
}

/**
 * Sorting support: ONLY `searchCatalog` accepts `sortBy`/`sortDirection`
 * (`Name|CreatedAtUtc` × `Ascending|Descending`). `listProducts` and
 * `listCategories` accept NO sort params; no inventory endpoint accepts
 * sort params. Pure — throws nothing.
 */
export function supportsAdminCatalogSorting(read: string | null | undefined): boolean {
  return read === 'searchCatalog';
}

/**
 * Filtering support: ONLY `searchCatalog` accepts filters
 * (`searchTerm`/`categoryId`/`status`/`visibility`). `listProducts`
 * returns non-deleted items only (implicit, no params); `listCategories`
 * has no filter params; no inventory endpoint accepts filter params.
 * Pure — throws nothing.
 */
export function supportsAdminCatalogFiltering(read: string | null | undefined): boolean {
  return read === 'searchCatalog';
}

/**
 * Paging bounds shared by every paginated read
 * (`pageNumber >= 1`, `1 <= pageSize <= 100`, defaults `1`/`20`).
 * Structural pre-check only — never a substitute for the backend
 * `400 ValidationProblemDetail` on violation. Pure — throws nothing.
 */
export function isValidAdminPagingQuery(
  query: { pageNumber?: number | null; pageSize?: number | null } | null | undefined,
): boolean {
  if (query === null || query === undefined) {
    return true;
  }
  const { pageNumber, pageSize } = query;
  if (pageNumber !== undefined && pageNumber !== null) {
    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      return false;
    }
  }
  if (pageSize !== undefined && pageSize !== null) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Admin query shapes (transport only — no backend logic)
// ---------------------------------------------------------------------------

/**
 * Admin product-list query. `GET /catalog/products` accepts ONLY paging
 * (no `sortBy`/`sortDirection`, no filters) — sorting/filtering belongs to
 * `searchCatalog` (`AdminCatalogSearchQuery`). Nulls/omission mean
 * "server default" (`pageNumber 1`, `pageSize 20`).
 */
export interface AdminProductListQuery {
  readonly pageNumber?: number;
  readonly pageSize?: number;
}

/**
 * Admin category-list query. `GET /catalog/categories` accepts ONLY paging
 * (no sorting/filtering on the backend). The response is a flat paged list
 * — hierarchy (if any) is expressed per row via nullable `parentId` only;
 * there is NO tree endpoint, so no tree shape travels here.
 */
export interface AdminCategoryListQuery {
  readonly pageNumber?: number;
  readonly pageSize?: number;
}

/**
 * Admin catalog-search query. `GET /catalog` is the ONLY read with
 * `searchTerm`/`categoryId`/`status`/`visibility` filters plus
 * `sortBy`/`sortDirection` sorting. Enums travel as NUMBERS in JSON but
 * the query binder also accepts case-insensitive names
 * (`?status=Active` ≡ `?status=1`).
 */
export interface AdminCatalogSearchQuery extends AdminProductListQuery {
  readonly searchTerm?: string;
  readonly categoryId?: Guid;
  readonly status?: number;
  readonly visibility?: number;
  readonly sortBy?: number;
  readonly sortDirection?: number;
}

/**
 * Admin variant-list query: the product scope only
 * (`GET /catalog/products/{productId}/variants` takes no paging params —
 * the full `VariantResponse[]` returns at once).
 */
export interface AdminVariantListQuery {
  readonly productId: Guid;
}

/**
 * Admin stock-lookup query: the SKU only (`GET /inventory/{sku}` takes no
 * paging/filter/sort params — single-resource read, `Admin` only).
 */
export interface AdminStockLookupQuery {
  readonly sku: string;
}

/**
 * Admin reservation-lookup query: the reservation id only
 * (`GET /inventory/reservations/{id}` takes no other params — ids are never
 * enumerable, `Admin` only).
 */
export interface AdminReservationLookupQuery {
  readonly reservationId: Guid;
}

/**
 * Structural pre-check for a stock-lookup query: a non-blank SKU.
 * Shape only — SKU normalization (`trimmed + uppercased`,
 * `^[A-Z0-9-_.]+$`, `≤ 64`) and existence stay backend-owned.
 * Pure — throws nothing.
 */
export function isValidAdminStockLookupQuery(
  query: AdminStockLookupQuery | null | undefined,
): boolean {
  return (
    query !== null &&
    query !== undefined &&
    typeof query.sku === 'string' &&
    query.sku.trim() !== ''
  );
}

/**
 * Structural pre-check for a reservation-lookup query: a non-blank id.
 * Pure — throws nothing.
 */
export function isValidAdminReservationLookupQuery(
  query: AdminReservationLookupQuery | null | undefined,
): boolean {
  return (
    query !== null &&
    query !== undefined &&
    typeof query.reservationId === 'string' &&
    query.reservationId.trim() !== ''
  );
}

/**
 * Structural pre-check for a stock-adjustment body: a positive integer
 * quantity (`AdjustStockRequest{quantity}` is additive-only, `1..max` —
 * consumption happens via reservation commit, never via this call).
 * Never a substitute for backend validation. Pure — throws nothing.
 */
export function isValidAdminAdjustmentQuantity(quantity: unknown): quantity is number {
  return (
    typeof quantity === 'number' &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= 2147483647
  );
}

// ---------------------------------------------------------------------------
// Image / upload mechanism pin (§13.1: confirm before implementing)
// ---------------------------------------------------------------------------

/**
 * The confirmed product-image mechanism: URL-based references only.
 * `AddProductImageRequest{imageUrl, altText, isPrimary, displayOrder,
 * metadata}` carries a URL string — there is NO multipart/file-upload
 * endpoint, NO base64 body, NO external-storage handshake, and NO
 * presigned-URL flow. `metadata` is exactly a nullable string→string
 * dictionary. `isPrimary` is set ONLY at add time or via the dedicated
 * `set-primary` action (never via `PUT .../images/{imageId}`, whose body
 * carries no `isPrimary`); ordering changes ONLY via `reorder`
 * (`orderedImageIds` must match the existing set). Reads return
 * `ProductImageResponse[]` ordered server-side by `displayOrder`.
 */
export const ADMIN_IMAGE_MECHANISM = 'url-reference' as const;

/** The confirmed image mechanism (only this value exists). */
export type AdminImageMechanism = typeof ADMIN_IMAGE_MECHANISM;

/**
 * Whether `value` names the confirmed image mechanism. Any file-upload,
 * multipart, base64, or presigned-URL design returns `false` and must not
 * be implemented. Pure — throws nothing.
 */
export function isConfirmedAdminImageMechanism(value: unknown): value is AdminImageMechanism {
  return value === ADMIN_IMAGE_MECHANISM;
}

// ---------------------------------------------------------------------------
// Admin request bodies (aliases — canonical DTOs, never re-declared)
// ---------------------------------------------------------------------------

/** `POST /catalog/products` / `PUT /catalog/products/{id}` body. */
export type AdminProductWrite = CreateProductRequest;

/** `POST /catalog/categories` / `PUT /catalog/categories/{id}` body. */
export type AdminCategoryWrite = CreateCategoryRequest;

/**
 * `POST /catalog/products/{productId}/variants` body. `currency` is
 * non-nullable (ISO-4217 upper); `unitPriceAmount` is a JSON number
 * (decimal — never float-math client-side).
 */
export type AdminVariantCreate = CreateProductVariantRequest;

/** `POST .../variants/batch` body — nullable wrapper. */
export type AdminVariantBatchCreate = CreateProductVariantsRequest;

/**
 * `PUT .../variants/{variantId}` body — ONLY `sku` + `name`.
 * No price, no currency, no status: those fields cannot be edited.
 */
export type AdminVariantUpdate = UpdateProductVariantRequest;

/**
 * `POST .../specifications` / `PUT .../specifications/{id}` body —
 * simple `name`/`value` pair, no typing.
 */
export type AdminSpecificationWrite = CreateProductSpecificationRequest;

/** `POST /catalog/attribute-definitions` / `PUT .../{id}` body. */
export type AdminAttributeDefinitionWrite = CreateAttributeDefinitionRequest;

/** `POST /inventory` body (`DataAnnotations`: SKU required/≤64, qty ≥ 0). */
export type AdminStockCreate = CreateInventoryItemRequest;

/** `PATCH /inventory/{sku}` body — additive only (`1..max`). */
export type AdminStockAdjust = AdjustStockRequest;

// ---------------------------------------------------------------------------
// Admin route & naming conventions (§13.1: confirm with the Admin app)
// ---------------------------------------------------------------------------

/**
 * Admin feature route segments for Phase 13, mounted as lazy children of
 * the guarded portal shell (`apps/admin/.../features/<feature>/`,
 * `loadChildren` boundaries, `Admin`/`SuperAdmin` via the existing
 * `authGuard` + `roleGuard` chain from `ADMIN_PORTAL_ROLES` — no separate
 * admin auth system; backend authorization stays authoritative).
 * Business pages (13.2+) arrive with their sub-phases; this table pins the
 * segments so later work cannot invent parallel top-level paths.
 */
export const ADMIN_PHASE_13_ROUTES = {
  catalog: 'catalog',
  inventory: 'inventory',
} as const;

/** One Phase 13 admin feature route segment. */
export type AdminPhase13Route = (typeof ADMIN_PHASE_13_ROUTES)[keyof typeof ADMIN_PHASE_13_ROUTES];

/**
 * Planned catalog child segments (13.3–13.6 arrive with their sub-phases;
 * listed here so the information architecture is settled in 13.1):
 * products, variants (within the product context), categories, images and
 * specifications (within the product context).
 */
export const ADMIN_CATALOG_CHILD_SEGMENTS = ['products', 'categories'] as const;

/** One planned catalog child segment. */
export type AdminCatalogChildSegment = (typeof ADMIN_CATALOG_CHILD_SEGMENTS)[number];

/**
 * Planned inventory child segments (13.9–13.10 arrive with their
 * sub-phases): stock (single-SKU lookup — no list endpoint exists),
 * reservations (single-id lookup — ids never enumerable), adjustments
 * (additive-only form over `PATCH /inventory/{sku}`).
 */
export const ADMIN_INVENTORY_CHILD_SEGMENTS = ['stock', 'reservations', 'adjustments'] as const;

/** One planned inventory child segment. */
export type AdminInventoryChildSegment = (typeof ADMIN_INVENTORY_CHILD_SEGMENTS)[number];

/**
 * Feature-folder convention (per `ARCHITECTURE.md` §5, as built for the
 * storefront in Phases 5–10 and for admin shared UI in Phase 12):
 * `pages/`, `components/`, `data-access/`, `state/`, `models/`,
 * `<feature>.routes.ts` — feature-owned, Signals-only state, dumb
 * presentational components over the Phase 12 admin shared primitives
 * (table, pagination, filters, forms, dialog, notifications), never new
 * global stores and never `libs/ui` additions (closed set, ADR-026).
 */
export const ADMIN_FEATURE_FOLDERS = [
  'pages',
  'components',
  'data-access',
  'state',
  'models',
] as const;

/** One admin feature folder. */
export type AdminFeatureFolder = (typeof ADMIN_FEATURE_FOLDERS)[number];

/**
 * Whether `value` names a Phase 13 admin feature route segment.
 * Pure — throws nothing.
 */
export function isAdminPhase13Route(value: unknown): value is AdminPhase13Route {
  return (
    typeof value === 'string' &&
    (Object.values(ADMIN_PHASE_13_ROUTES) as readonly string[]).includes(value)
  );
}

// ---------------------------------------------------------------------------
// SPA-callable endpoint pins (admin surface only)
// ---------------------------------------------------------------------------

/**
 * SPA-callable admin catalog path templates (writes require the `Admin`
 * role; reads are anonymous but the portal always sends its JWT).
 * Mirrors `CATALOG_ENDPOINTS` in `@flux/api` (the canonical route table) —
 * listed here so the audit pins exactly which surface the admin consumes.
 */
export const ADMIN_CALLABLE_CATALOG_ENDPOINTS = [
  '/catalog/products',
  '/catalog/products/{id}',
  '/catalog/products/{id}/activate',
  '/catalog/products/{id}/deactivate',
  '/catalog/products/{id}/archive',
  '/catalog/products/{id}/soft-delete',
  '/catalog/products/{id}/restore',
  '/catalog',
  '/catalog/categories',
  '/catalog/categories/{id}',
  '/catalog/categories/{id}/activate',
  '/catalog/categories/{id}/deactivate',
  '/catalog/categories/{id}/soft-delete',
  '/catalog/categories/{id}/restore',
  '/catalog/products/{productId}/variants',
  '/catalog/products/{productId}/variants/batch',
  '/catalog/products/{productId}/variants/{variantId}',
  '/catalog/attribute-definitions',
  '/catalog/attribute-definitions/{id}',
  '/catalog/attribute-definitions/{id}/activate',
  '/catalog/attribute-definitions/{id}/deactivate',
  '/catalog/attribute-definitions/{id}/soft-delete',
  '/catalog/attribute-definitions/{id}/restore',
  '/catalog/products/{productId}/attributes',
  '/catalog/products/{productId}/attributes/{attributeDefinitionId}',
  '/catalog/products/{productId}/images',
  '/catalog/products/{productId}/images/{imageId}',
  '/catalog/products/{productId}/images/{imageId}/set-primary',
  '/catalog/products/{productId}/images/reorder',
  '/catalog/products/{productId}/specifications',
  '/catalog/products/{productId}/specifications/{specificationId}',
] as const;

/**
 * SPA-callable admin inventory path templates — the COMPLETE inventory
 * surface (four endpoints, all `Admin`-only). Anything not listed here
 * does not exist and must not be called.
 */
export const ADMIN_CALLABLE_INVENTORY_ENDPOINTS = [
  '/inventory',
  '/inventory/{sku}',
  '/inventory/reservations/{id}',
] as const;

/**
 * Whether the SPA may call the given admin path template. `true` only for
 * a listed catalog or inventory template. Pure — throws nothing.
 */
export function isAdminCallableCatalogOrInventoryEndpoint(
  path: string | null | undefined,
): boolean {
  if (typeof path !== 'string') {
    return false;
  }
  return (
    (ADMIN_CALLABLE_CATALOG_ENDPOINTS as readonly string[]).includes(path) ||
    (ADMIN_CALLABLE_INVENTORY_ENDPOINTS as readonly string[]).includes(path)
  );
}

// ---------------------------------------------------------------------------
// Error-code classifiers (status-first, ERROR_CATALOG.md §§2/5)
// ---------------------------------------------------------------------------

/**
 * Minimal normalized-failure view this module classifies: an HTTP `status`
 * plus the best-effort `code`. Compatible with the Phase 1 `ApiError`
 * without importing it (keeps this module free of class-valued imports —
 * types only). Note the wire reality (`ERROR_CATALOG.md` §0): business
 * errors carry NO machine `code` on the wire (`extensions: {}`) — only
 * the localized `detail` — so every classifier below branches on `status`
 * first and treats `code` as a development-time hint.
 */
export interface AdminCatalogInventoryFailure {
  readonly status: number;
  readonly code?: string;
}

/**
 * Whether the failure is a missing entity (`404` — unknown product,
 * category, variant, image, spec, attribute value, SKU, or reservation id;
 * other-owner ids mask as `404` where ownership applies). Never probe ids
 * on this path. Pure — throws nothing.
 */
export function isAdminNotFoundFailure(
  failure: AdminCatalogInventoryFailure | null | undefined,
): boolean {
  return failure?.status === 404;
}

/**
 * Whether the failure is a domain conflict (`409` — duplicate
 * name/slug/SKU, deleted-entity mutation, illegal lifecycle transition,
 * insufficient stock, key reuse). Recovery is input change, never blind
 * retry. Pure — throws nothing.
 */
export function isAdminConflictFailure(
  failure: AdminCatalogInventoryFailure | null | undefined,
): boolean {
  return failure?.status === 409;
}

/**
 * Whether the failure is a validation failure (`400` with an
 * `errors{field:[msg]}` map — Fluent/domain for catalog, `DataAnnotations`
 * + domain for inventory/cart-shaped inputs). Field keys are DTO property
 * names; display `detail` + the map, never raw codes. Pure — throws
 * nothing.
 */
export function isAdminValidationFailure(
  failure: AdminCatalogInventoryFailure | null | undefined,
): boolean {
  return failure?.status === 400;
}

/**
 * Whether the failure is an authorization failure (`401` anonymous/expired
 * JWT → login/refresh; `403` non-admin role → `/forbidden`). Guards stay
 * UX-only; the backend stays authoritative. Pure — throws nothing.
 */
export function isAdminAuthFailure(
  failure: AdminCatalogInventoryFailure | null | undefined,
): boolean {
  return failure?.status === 401 || failure?.status === 403;
}

// ---------------------------------------------------------------------------
// Responsibility boundary (Admin UX vs. Backend Truth)
// ---------------------------------------------------------------------------

/**
 * Frontend-owned admin concerns (Phase 13 principle: Angular submits
 * commands and displays the resulting backend state). Presentation,
 * forms, feature state, and navigation only — no truth, no orchestration.
 */
export const FRONTEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES = [
  'catalog-ux',
  'inventory-ux',
  'typed-forms',
  'feature-state',
  'loading-error-handling',
  'navigation',
  'notifications',
  'confirmation-dialogs',
] as const;

/** One frontend-owned admin concern. */
export type FrontendAdminCatalogInventoryResponsibility =
  (typeof FRONTEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES)[number];

/**
 * Backend-owned catalog/inventory concerns (Phase 13 principle: the
 * backend owns business truth and orchestration). The SPA must never
 * duplicate any of these — no SKU-uniqueness/price/stock/variant-validity
 * rules, no inventory math, no reservation lifecycle, no saga handling.
 */
export const BACKEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES = [
  'product-state',
  'category-state',
  'variant-validity',
  'sku-uniqueness',
  'price-rules',
  'stock-state',
  'reservation-state',
  'reservation-lifecycle',
  'inventory-coordination',
  'saga-orchestration',
  'validation',
  'authorization',
] as const;

/** One backend-owned admin concern. */
export type BackendAdminCatalogInventoryResponsibility =
  (typeof BACKEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES)[number];

/**
 * Whether `value` names a frontend-owned admin concern. Pure — throws
 * nothing.
 */
export function isFrontendAdminCatalogInventoryResponsibility(
  value: unknown,
): value is FrontendAdminCatalogInventoryResponsibility {
  return (
    typeof value === 'string' &&
    (FRONTEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES as readonly string[]).includes(value)
  );
}

/**
 * Whether `value` names a backend-owned admin concern — and therefore
 * something the SPA must never implement. Pure — throws nothing.
 */
export function isBackendAdminCatalogInventoryResponsibility(
  value: unknown,
): value is BackendAdminCatalogInventoryResponsibility {
  return (
    typeof value === 'string' &&
    (BACKEND_ADMIN_CATALOG_INVENTORY_RESPONSIBILITIES as readonly string[]).includes(value)
  );
}
