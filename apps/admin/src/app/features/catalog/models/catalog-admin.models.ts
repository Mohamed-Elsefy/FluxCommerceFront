/**
 * Admin Catalog feature models for Sub-Phases 13.2–13.6 — Catalog
 * Foundation + Product + Variant + Category + Image/Specification
 * Management.
 *
 * Scope: foundation view models (13.2) plus the product-slice view models
 * (13.3: form value, wire mappers, category options, server-error paths,
 * status/visibility display) plus the variant-slice view models (13.4:
 * form value, wire mappers, status display) plus the category-slice view
 * models (13.5: form value, wire mappers, status display) plus the
 * image/specification view models (13.6: form values, wire mappers with
 * metadata round-tripping, reorder projection).
 *
 * Source of truth: `docs/frontend-contract/DTO_REFERENCE.md` §2 (catalog
 * shapes) via `@flux/models` (the single declaration site — aliases here,
 * never re-declarations, so no contract drift is possible) and
 * `docs/frontend-contract/PAGINATION_CONVENTION.md` (the `totalCount`
 * semantics below).
 *
 * The overview derives backend-issued facts only: `totalCount` echoes
 * verbatim for display (never an input to math, never recomputed
 * client-side). Pricing, availability, and inventory math do not exist in
 * this module. Pure types + pure functions: no Angular, no HTTP, no
 * browser APIs — SSR-safe.
 */

import type { PagedResult } from '@flux/api';
import type {
  AddProductImageRequest,
  CategoryResponse,
  CategoryStatus,
  CreateCategoryRequest,
  CreateProductRequest,
  CreateProductSpecificationRequest,
  CreateProductVariantRequest,
  ProductImageResponse,
  ProductResponse,
  ProductSpecificationResponse,
  ProductStatus,
  ProductVisibility,
  UpdateCategoryRequest,
  UpdateProductImageRequest,
  UpdateProductRequest,
  UpdateProductSpecificationRequest,
  UpdateProductVariantRequest,
  VariantResponse,
  VariantStatus,
} from '@flux/models';

/** One admin product row (canonical wire shape, never re-declared). */
export type AdminProductRow = ProductResponse;

/** One admin category row (canonical wire shape, never re-declared). */
export type AdminCategoryRow = CategoryResponse;

/** Paged admin product result (`GET /catalog/products`). */
export type AdminProductPage = PagedResult<AdminProductRow>;

/** Paged admin category result (`GET /catalog/categories`). */
export type AdminCategoryPage = PagedResult<AdminCategoryRow>;

/**
 * Catalog overview: the backend-issued totals behind the admin landing
 * page. Both counts echo `totalCount` verbatim (total matches across all
 * pages, never page-relative).
 */
export interface CatalogOverview {
  readonly productTotal: number;
  readonly categoryTotal: number;
}

/** Zero overview (no catalog data yet). */
export function emptyCatalogOverview(): CatalogOverview {
  return { productTotal: 0, categoryTotal: 0 };
}

/**
 * Projects the overview out of two settled pages. Pure — throws nothing,
 * performs no HTTP, derives no domain truth.
 */
export function toCatalogOverview(
  products: AdminProductPage,
  categories: AdminCategoryPage,
): CatalogOverview {
  return { productTotal: products.totalCount, categoryTotal: categories.totalCount };
}

/**
 * Whether the overview is empty (both totals at zero — the landing page
 * renders its empty state instead of zeroed section cards). Pure — throws
 * nothing.
 */
export function isCatalogOverviewEmpty(overview: CatalogOverview | null): boolean {
  return overview === null || (overview.productTotal <= 0 && overview.categoryTotal <= 0);
}

// ---------------------------------------------------------------------------
// Product form value + wire mappers (13.3)
// ---------------------------------------------------------------------------

/**
 * Flat product-form value (what the typed `product-form` edits). Strings
 * stay raw (trimming happens at the wire boundary); `visibility` travels
 * as its wire string because the shared `admin-select` binds
 * `FormControl<string | null>`; `seoKeywords` is the comma-separated
 * editor text for the `string[] | null` wire shape.
 */
export interface ProductFormValue {
  readonly name: string | null;
  readonly slug: string | null;
  readonly description: string | null;
  readonly categoryId: string | null;
  /** Wire string of the numeric `ProductVisibility` (`'0'`/`'1'`). */
  readonly visibility: string | null;
  readonly seoTitle: string | null;
  readonly seoDescription: string | null;
  /** Comma-separated editor text for `SeoRequest.keywords`. */
  readonly seoKeywords: string | null;
}

/** Blank form value for the create page. */
export function emptyProductFormValue(): ProductFormValue {
  return {
    name: null,
    slug: null,
    description: null,
    categoryId: null,
    visibility: null,
    seoTitle: null,
    seoDescription: null,
    seoKeywords: null,
  };
}

/**
 * Projects a loaded product into the form value (edit population).
 * Keywords join with `', '`; enums render as their wire strings. Pure —
 * throws nothing.
 */
export function productToFormValue(product: ProductResponse): ProductFormValue {
  return {
    name: product.name,
    slug: product.slug,
    description: product.description ?? null,
    categoryId: product.categoryId,
    visibility: String(product.visibility),
    seoTitle: product.seo?.title ?? null,
    seoDescription: product.seo?.description ?? null,
    seoKeywords: (product.seo?.keywords ?? []).join(', '),
  };
}

function nullIfBlank(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function keywordsOrNull(editorText: string | null | undefined): string[] | null {
  if (editorText === null || editorText === undefined) {
    return null;
  }
  const keywords = editorText
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword !== '');
  return keywords.length === 0 ? null : keywords;
}

function seoOrNull(value: ProductFormValue): CreateProductRequest['seo'] {
  const title = nullIfBlank(value.seoTitle);
  const description = nullIfBlank(value.seoDescription);
  const keywords = keywordsOrNull(value.seoKeywords);
  if (title === null && description === null && keywords === null) {
    return null;
  }
  return { title, description, keywords };
}

/**
 * Projects the form value into the create body. Blank strings become
 * `null` (the wire uses `string | null`); `visibility` parses to its
 * numeric wire enum. Pure — throws nothing, validates nothing (validators
 * live on the form; the backend stays authoritative).
 */
export function toCreateProductRequest(value: ProductFormValue): CreateProductRequest {
  return {
    name: nullIfBlank(value.name),
    slug: nullIfBlank(value.slug),
    description: nullIfBlank(value.description),
    categoryId: (value.categoryId ?? '') as CreateProductRequest['categoryId'],
    visibility: Number(value.visibility) as ProductVisibility,
    seo: seoOrNull(value),
  };
}

/**
 * Projects the form value into the update body (same shape as create —
 * `UpdateProductRequest` is the identical record). Pure — throws nothing.
 */
export function toUpdateProductRequest(value: ProductFormValue): UpdateProductRequest {
  return toCreateProductRequest(value);
}

// ---------------------------------------------------------------------------
// Category options (13.3)
// ---------------------------------------------------------------------------

/** Category select option: submitted id plus visible name. */
export interface CategoryOption {
  readonly value: string;
  readonly label: string;
}

/**
 * Projects category rows into select options (response order preserved —
 * the backend defines no ordering, so the SPA invents none). Pure —
 * throws nothing.
 */
export function toCategoryOptions(categories: readonly CategoryResponse[]): CategoryOption[] {
  return categories.map((category) => ({ value: category.id, label: category.name }));
}

/**
 * Resolves a category name for display (list table, details header);
 * falls back to the raw id when the lookup does not cover it (lookup
 * pages cap at 100 — never fabricate a name). Pure — throws nothing.
 */
export function categoryNameOf(
  categories: readonly CategoryResponse[],
  categoryId: string,
): string {
  return categories.find((category) => category.id === categoryId)?.name ?? categoryId;
}

// ---------------------------------------------------------------------------
// Server field-error paths (13.3)
// ---------------------------------------------------------------------------

/**
 * Maps a backend `errors{}` key (C#/DTO property names, e.g. `Name`,
 * `CategoryId`, `Seo.Title`) to the dotted form-control path (e.g.
 * `name`, `categoryId`, `seo.title`). Each segment lowercases its first
 * letter; unknown shapes pass through lowercased so the caller — not this
 * mapper — decides what is applicable. Pure — throws nothing.
 */
export function toFormErrorPath(key: string): string {
  return key
    .split('.')
    .map((segment) =>
      segment.length === 0 ? segment : segment[0].toLowerCase() + segment.slice(1),
    )
    .join('.');
}

// ---------------------------------------------------------------------------
// Status / visibility display (13.3)
// ---------------------------------------------------------------------------

/** Translation key + badge variant behind one status/visibility value. */
export interface ProductBadgeDisplay {
  /** Key into the catalog bundle (`catalog.status.*` / `catalog.visibility.*`). */
  readonly labelKey: string;
  /** Badge emphasis. */
  readonly variant: 'neutral' | 'success' | 'warning' | 'info';
}

/**
 * Display behind a product status wire value. Unknown future values fall
 * back to the `unknown` entry (render `Unknown (<n>)`, hide gated actions
 * — see `ENUM_REFERENCE.md` §8). Pure — throws nothing.
 */
export function productStatusDisplay(status: ProductStatus | number): ProductBadgeDisplay {
  switch (status) {
    case 0:
      return { labelKey: 'catalog.status.draft', variant: 'info' };
    case 1:
      return { labelKey: 'catalog.status.active', variant: 'success' };
    case 2:
      return { labelKey: 'catalog.status.inactive', variant: 'warning' };
    case 3:
      return { labelKey: 'catalog.status.archived', variant: 'neutral' };
    default:
      return { labelKey: 'catalog.status.unknown', variant: 'neutral' };
  }
}

/**
 * Display behind a product visibility wire value (unknown → `unknown`
 * entry, same rule as status). Pure — throws nothing.
 */
export function productVisibilityDisplay(
  visibility: ProductVisibility | number,
): ProductBadgeDisplay {
  switch (visibility) {
    case 0:
      return { labelKey: 'catalog.visibility.visible', variant: 'success' };
    case 1:
      return { labelKey: 'catalog.visibility.hidden', variant: 'warning' };
    default:
      return { labelKey: 'catalog.visibility.unknown', variant: 'neutral' };
  }
}

// ---------------------------------------------------------------------------
// Variant form value + wire mappers (13.4)
// ---------------------------------------------------------------------------

/** One admin variant row (canonical wire shape, never re-declared). */
export type AdminVariantRow = VariantResponse;

/**
 * Flat variant-form value (what the typed `variant-form` edits). `price`
 * stays editor text (parsed to a JSON decimal at the wire boundary);
 * `currency` stays raw (uppercased + trimmed at the wire boundary per
 * the ISO-4217 `^[A-Z]{3}$` contract shape).
 */
export interface VariantFormValue {
  readonly sku: string | null;
  readonly name: string | null;
  readonly price: string | null;
  readonly currency: string | null;
}

/** Blank form value for the variant create page. */
export function emptyVariantFormValue(): VariantFormValue {
  return { sku: null, name: null, price: null, currency: null };
}

/**
 * Projects a loaded variant into the form value (edit population).
 * Price renders with its full decimal text (never rounded — display
 * only); currency echoes verbatim. Pure — throws nothing.
 */
export function variantToFormValue(variant: VariantResponse): VariantFormValue {
  return {
    sku: variant.sku,
    name: variant.name,
    price: String(variant.unitPriceAmount),
    currency: variant.currency,
  };
}

/**
 * Projects the form value into the create body. Blanks become `null`
 * (the wire uses `string | null`); price parses to a JSON decimal;
 * currency uppercases (the contract shape is upper ISO-4217). Pure —
 * throws nothing, validates nothing (validators live on the form; SKU
 * uniqueness, price rules, and variant validity stay backend-owned).
 */
export function toCreateVariantRequest(value: VariantFormValue): CreateProductVariantRequest {
  return {
    sku: nullIfBlank(value.sku),
    name: nullIfBlank(value.name),
    unitPriceAmount: Number((value.price ?? '').trim()),
    currency: (value.currency ?? '').trim().toUpperCase(),
  };
}

/**
 * Projects the form value into the update body — `sku` + `name` ONLY.
 * Price and currency never travel here (no backend endpoint accepts
 * them after creation); the edit form locks those controls as
 * read-only display. Pure — throws nothing.
 */
export function toUpdateVariantRequest(value: VariantFormValue): UpdateProductVariantRequest {
  return { sku: nullIfBlank(value.sku), name: nullIfBlank(value.name) };
}

// ---------------------------------------------------------------------------
// Variant status display (13.4)
// ---------------------------------------------------------------------------

/**
 * Display behind a variant status wire value (`Active | Inactive` —
 * there is no Draft/Archived for variants). Unknown future values fall
 * back to the `unknown` entry (render `Unknown (<n>)`, hide gated
 * actions — see `ENUM_REFERENCE.md` §8). Pure — throws nothing.
 */
export function variantStatusDisplay(status: VariantStatus | number): ProductBadgeDisplay {
  switch (status) {
    case 0:
      return { labelKey: 'catalog.variantStatus.active', variant: 'success' };
    case 1:
      return { labelKey: 'catalog.variantStatus.inactive', variant: 'warning' };
    default:
      return { labelKey: 'catalog.variantStatus.unknown', variant: 'neutral' };
  }
}

// ---------------------------------------------------------------------------
// Category form value + wire mappers (13.5)
// ---------------------------------------------------------------------------

/**
 * Flat category-form value (what the typed `category-form` edits).
 * `parentId` is the nullable wire id (`''` in the select means
 * top-level — mapped to `null` at the wire boundary).
 */
export interface CategoryFormValue {
  readonly name: string | null;
  readonly slug: string | null;
  readonly description: string | null;
  readonly parentId: string | null;
}

/** Blank form value for the category create page. */
export function emptyCategoryFormValue(): CategoryFormValue {
  return { name: null, slug: null, description: null, parentId: null };
}

/**
 * Projects a loaded category into the form value (edit population).
 * A `null` parent stays `null` (the select renders its empty option).
 * Pure — throws nothing.
 */
export function categoryToFormValue(category: CategoryResponse): CategoryFormValue {
  return {
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    parentId: category.parentId ?? null,
  };
}

/**
 * Projects the form value into the create body. Blank strings become
 * `null` (the wire uses `string | null`); the empty parent selection
 * becomes `null` (top-level). Pure — throws nothing, validates nothing
 * (validators live on the form; name/slug uniqueness, own-parent
 * cycles, and deleted-parent rules stay backend-owned).
 */
export function toCreateCategoryRequest(value: CategoryFormValue): CreateCategoryRequest {
  const parentId = nullIfBlank(value.parentId);
  return {
    name: nullIfBlank(value.name),
    slug: nullIfBlank(value.slug),
    description: nullIfBlank(value.description),
    parentId,
  };
}

/**
 * Projects the form value into the update body (same shape as create —
 * `UpdateCategoryRequest` is the identical record). Pure — throws
 * nothing.
 */
export function toUpdateCategoryRequest(value: CategoryFormValue): UpdateCategoryRequest {
  return toCreateCategoryRequest(value);
}

// ---------------------------------------------------------------------------
// Category status display (13.5)
// ---------------------------------------------------------------------------

/**
 * Display behind a category status wire value (`Active | Inactive` —
 * there is no Draft/Archived for categories). Unknown future values
 * fall back to the `unknown` entry (same rule as product status).
 * Pure — throws nothing.
 */
export function categoryStatusDisplay(status: CategoryStatus | number): ProductBadgeDisplay {
  switch (status) {
    case 0:
      return { labelKey: 'catalog.categoryStatus.active', variant: 'success' };
    case 1:
      return { labelKey: 'catalog.categoryStatus.inactive', variant: 'warning' };
    default:
      return { labelKey: 'catalog.categoryStatus.unknown', variant: 'neutral' };
  }
}

// ---------------------------------------------------------------------------
// Image form value + wire mappers (13.6)
// ---------------------------------------------------------------------------

/** One admin image row (canonical wire shape, never re-declared). */
export type AdminImageRow = ProductImageResponse;

/**
 * Flat image-form value (what the typed `image-form` edits). URL-based
 * references only (confirmed in 13.1 — no file input exists anywhere):
 * `url` carries the URL string, `order` stays editor text (parsed to an
 * int at the wire boundary), `primary` travels on create only.
 */
export interface ImageFormValue {
  readonly url: string | null;
  readonly altText: string | null;
  readonly order: string | null;
  readonly primary: boolean;
}

/** Blank form value for the image add dialog. */
export function emptyImageFormValue(): ImageFormValue {
  return { url: null, altText: null, order: null, primary: false };
}

/**
 * Projects a loaded image into the form value (edit population).
 * `primary` always renders `false`: the update endpoint accepts no
 * primary flag (primary moves through `set-primary` only), so the edit
 * form never implies otherwise. Pure — throws nothing.
 */
export function imageToFormValue(image: ProductImageResponse): ImageFormValue {
  return {
    url: image.imageUrl,
    altText: image.altText ?? null,
    order: String(image.displayOrder),
    primary: false,
  };
}

/**
 * Projects the form value into the add body. Blanks become `null` (the
 * wire uses `string | null`); order parses to an int; `metadata` is
 * `null` (no metadata editor exists — creation starts metadata-free).
 * Pure — throws nothing, validates nothing (URL/order rules stay
 * backend-owned).
 */
export function toAddImageRequest(value: ImageFormValue): AddProductImageRequest {
  return {
    imageUrl: nullIfBlank(value.url),
    altText: nullIfBlank(value.altText),
    isPrimary: value.primary,
    displayOrder: Number((value.order ?? '').trim()),
    metadata: null,
  };
}

/**
 * Projects the form value into the update body — URL, alt text, and
 * order ONLY (no `isPrimary`: the update endpoint rejects it). The
 * stored `metadata` round-trips untouched: the UI shows no metadata
 * editor, so sending `null` would wipe backend data the user never saw.
 * Pure — throws nothing.
 */
export function toUpdateImageRequest(
  value: ImageFormValue,
  existing: ProductImageResponse,
): UpdateProductImageRequest {
  return {
    imageUrl: nullIfBlank(value.url),
    altText: nullIfBlank(value.altText),
    displayOrder: Number((value.order ?? '').trim()),
    metadata: existing.metadata ?? null,
  };
}

/**
 * Projects a reorder move into the wire body: the settled id list with
 * two entries swapped. The result always carries the exact existing set
 * (same length, same members — the backend rejects anything else), so
 * callers pass settled ids only. Out-of-range moves return the list
 * unchanged. Pure — throws nothing, performs no HTTP.
 */
export function moveImageIds(ids: readonly string[], index: number, direction: -1 | 1): string[] {
  const next = [...ids];
  const target = index + direction;
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) {
    return next;
  }
  const [moved] = next.splice(index, 1);
  next.splice(target, 0, moved as string);
  return next;
}

// ---------------------------------------------------------------------------
// Specification form value + wire mappers (13.6)
// ---------------------------------------------------------------------------

/** One admin specification row (canonical wire shape, never re-declared). */
export type AdminSpecRow = ProductSpecificationResponse;

/**
 * Flat specification-form value (what the typed `spec-form` edits): a
 * simple `name`/`value` pair, both backend-required
 * (`SpecificationNameRequired` / `SpecificationValueRequired`).
 */
export interface SpecFormValue {
  readonly name: string | null;
  readonly value: string | null;
}

/** Blank form value for the specification add dialog. */
export function emptySpecFormValue(): SpecFormValue {
  return { name: null, value: null };
}

/**
 * Projects a loaded specification into the form value (edit
 * population). Pure — throws nothing.
 */
export function specToFormValue(spec: ProductSpecificationResponse): SpecFormValue {
  return { name: spec.name, value: spec.value };
}

/**
 * Projects the form value into the create body. Blanks become `null`
 * (the wire uses `string | null`). Pure — throws nothing, validates
 * nothing (name/value rules and duplicate names stay backend-owned).
 */
export function toCreateSpecRequest(value: SpecFormValue): CreateProductSpecificationRequest {
  return { name: nullIfBlank(value.name), value: nullIfBlank(value.value) };
}

/**
 * Projects the form value into the update body (same shape as create —
 * `UpdateProductSpecificationRequest` is the identical record). Pure —
 * throws nothing.
 */
export function toUpdateSpecRequest(value: SpecFormValue): UpdateProductSpecificationRequest {
  return toCreateSpecRequest(value);
}
