/**
 * Admin Catalog feature models for Sub-Phases 13.2–13.3 — Catalog
 * Foundation + Product Management.
 *
 * Scope: foundation view models (13.2) plus the product-slice view models
 * (13.3: form value, wire mappers, category options, server-error paths,
 * status/visibility display). Variant/image/specification management
 * models arrive with Sub-Phases 13.4–13.6.
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
  CategoryResponse,
  CreateProductRequest,
  ProductResponse,
  ProductStatus,
  ProductVisibility,
  UpdateProductRequest,
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
