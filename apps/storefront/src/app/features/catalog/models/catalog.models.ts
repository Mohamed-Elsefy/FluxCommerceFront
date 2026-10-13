/**
 * Storefront Catalog feature models for Sub-Phase 5.1 — Catalog Feature Foundation.
 *
 * Scope: `docs/phases/PHASE_5_CATALOG.md` §5.1.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §2 and
 * `docs/frontend-contract/DTO_REFERENCE.md` §2
 * (`FluxCommerce.Modules.Catalog.Contracts` records). Wire casing is
 * `camelCase`; enums are numbers on the wire except where the contract says
 * otherwise — this file declares nothing new on the wire.
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - Contract mirrors live in `@flux/models` (Phase 1 §1.1) and stay the
 *   single declaration site — no field is re-declared here, so no contract
 *   drift is possible.
 * - This module only aliases the storefront-readable subset (`Product`,
 *   `Category`, `ProductListItem`, `ProductList`, `CategoryList`), the
 *   storefront search query (`CatalogQuery`), and pure helpers (defaults,
 *   query funnel, envelope mapping). Feature-specific view models for cards,
 *   grids, and filters arrive with Sub-Phases 5.2–5.6 — not here.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 5.2 — no pages, no category discovery UI.
 * - 5.3 — no product cards or grids.
 * - Phase 6 — no variants, SKUs, quantities, or add-to-cart.
 *
 * The coherent query state of 5.4 lives in `state/catalog-query-state`
 * and builds on the `CatalogQuery` shape and helpers below.
 */

import { normalizePagination, toQueryParams, type PagedResult, type QueryParams } from '@flux/api';
import type {
  CatalogProductListItem,
  CatalogSearchQuery,
  CategoryResponse,
  ProductResponse,
  ProductStatus,
} from '@flux/models';

/** Single product read model (`GET /catalog/products/{id}`). */
export type Product = ProductResponse;

/** Single category read model (`GET /catalog/categories/{id}`). */
export type Category = CategoryResponse;

/** Storefront search list item (`GET /catalog`). */
export type ProductListItem = CatalogProductListItem;

/**
 * Card item: list shape plus an optional backend status for the sticker
 * (`ProductResponse` items are structurally assignable — they carry every
 * list field plus `status`).
 */
export type ProductCardItem = ProductListItem & { readonly status?: ProductStatus | null };

/**
 * Paged product result. `GET /catalog` yields `CatalogProductListItem`
 * entries; `GET /catalog/products` yields the richer `ProductResponse`
 * entries (same list fields plus `status`/`visibility`/`primaryImage`).
 */
export type ProductList = PagedResult<CatalogProductListItem | ProductResponse>;

/** Paged category result (`GET /catalog/categories`). */
export type CategoryList = PagedResult<CategoryResponse>;

/**
 * Storefront catalog query (`GET /catalog` query string, DTO_REFERENCE §2.6).
 * Re-exported — not re-declared — so the backend query shape stays canonical.
 */
export type CatalogQuery = CatalogSearchQuery;

/** Backend paging defaults for catalog reads (`pageNumber 1`, `pageSize 20`). */
export const DEFAULT_CATALOG_PAGE_NUMBER = 1;
export const DEFAULT_CATALOG_PAGE_SIZE = 20;

/** Empty page fallback used when the envelope carries no data. */
export function emptyProductList(pageSize: number = DEFAULT_CATALOG_PAGE_SIZE): ProductList {
  return { items: [], totalCount: 0, pageNumber: DEFAULT_CATALOG_PAGE_NUMBER, pageSize };
}

/** Empty category page fallback used when the envelope carries no data. */
export function emptyCategoryList(pageSize: number = DEFAULT_CATALOG_PAGE_SIZE): CategoryList {
  return { items: [], totalCount: 0, pageNumber: DEFAULT_CATALOG_PAGE_NUMBER, pageSize };
}

/** Default storefront query: first page, backend page size, no filters. */
export function defaultCatalogQuery(): CatalogQuery {
  return { pageNumber: DEFAULT_CATALOG_PAGE_NUMBER, pageSize: DEFAULT_CATALOG_PAGE_SIZE };
}

/**
 * Normalizes a feature query into contract paging (`pageNumber >= 1`,
 * `1 <= pageSize <= 100`) while preserving search/filter/sort fields
 * untouched. Delegates to the Phase 1 `normalizePagination` primitive —
 * no duplicated clamping logic.
 */
export function normalizeCatalogQuery(query: CatalogQuery = {}): CatalogQuery {
  return { ...query, ...normalizePagination(query) };
}

/**
 * Converts a typed catalog query into `QueryParams` for `ApiClient`.
 * Single sanctioned funnel (`toQueryParams`): `null`/`undefined` omit the
 * key so backend defaults apply — never hand-built query strings.
 */
export function toCatalogQueryParams(query: CatalogQuery): QueryParams {
  return toQueryParams(normalizeCatalogQuery(query));
}

/**
 * Maps a `PagedResult` envelope payload onto a `ProductList`, falling back
 * to an empty page when `data` is `null`/`undefined`. Pure — performs no
 * HTTP and throws nothing; dataless envelopes are handled by data-access.
 */
export function toProductList(
  data: PagedResult<CatalogProductListItem | ProductResponse> | null | undefined,
  pageSize: number = DEFAULT_CATALOG_PAGE_SIZE,
): ProductList {
  return data ?? emptyProductList(pageSize);
}

/**
 * Maps a `PagedResult` envelope payload onto a `CategoryList`, falling back
 * to an empty page when `data` is `null`/`undefined`. Pure — performs no
 * HTTP and throws nothing.
 */
export function toCategoryList(
  data: PagedResult<CategoryResponse> | null | undefined,
  pageSize: number = DEFAULT_CATALOG_PAGE_SIZE,
): CategoryList {
  return data ?? emptyCategoryList(pageSize);
}
