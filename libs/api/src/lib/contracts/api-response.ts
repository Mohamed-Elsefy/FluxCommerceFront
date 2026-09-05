/**
 * Transport envelopes for Sub-Phase 1.1 — API Contract Integration Foundation.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §0.1/§0.3 and
 * `docs/frontend-contract/PAGINATION_CONVENTION.md`
 * (`BuildingBlocks.Web.Responses.ApiResponse<T>`,
 * `BuildingBlocks.Application.Results.PagedResult<T>`).
 *
 * Success envelopes:
 * - `200 OK` → `ApiResponse<T>` (`{ isSuccess, message, data }`)
 * - `200 OK` (no data, e.g. logout) → `ApiResponse` (`{ isSuccess, message }`)
 * - `201 Created` → `ApiResponse<T>` + `Location` header
 * - `204 No Content` → empty body (all Catalog writes except create)
 *
 * Wire casing is `camelCase` by ASP.NET Core default (`isSuccess/message/data`,
 * `items/totalCount/pageNumber/pageSize`); the interfaces below already use it.
 * Default message: `"Operation completed successfully."`.
 *
 * Pagination rules (PAGINATION_CONVENTION):
 * - `items` is this page only (`[]` means empty result or out-of-range page,
 *   still `200` — never an error).
 * - `totalCount` is total matches across all pages, never page-relative.
 * - `pageNumber`/`pageSize` echo the EFFECTIVE values after defaults — render
 *   pager state from them, not from the request values.
 * - Backend sends no `totalPages`/`hasNext`/`hasPrev` — compute client-side
 *   with the helpers below.
 */

import type { PaginationRequest } from '../runtime/query';

/** Success envelope without data (`200 ApiResponse`, e.g. logout). */
export interface ApiResponse {
  isSuccess: boolean;
  message?: string | null;
}

/** Success envelope with data (`200`/`201 ApiResponse<T>`). */
export interface ApiResponseWithData<T> extends ApiResponse {
  data?: T | null;
}

/**
 * Standard paging envelope. Wrapped in `ApiResponseWithData` on the wire:
 * `ApiResponseWithData<PagedResult<T>>`.
 */
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
}

/** Convenience alias for a paged success body. */
export type PagedApiResponse<T> = ApiResponseWithData<PagedResult<T>>;

/**
 * Paging query shared by every paginated endpoint
 * (`GET /catalog/products`, `GET /catalog`, `GET /catalog/categories`,
 * `GET /orders`). Both optional, 1-based: `pageNumber >= 1`,
 * `1 <= pageSize <= 100`, defaults `1/20`. Never send `pageSize=0` for "all" —
 * repeat with `pageSize=100` instead.
 *
 * Kept as an alias of the canonical 1.8 `PaginationRequest` (same shape);
 * prefer `PaginationRequest` + `normalizePagination` in new code.
 */
export type PagingQuery = PaginationRequest;

/** `1`-based page count. `0` when `totalCount` is `0`. */
export function totalPagesOf(page: PagedResult<unknown>): number {
  if (page.totalCount <= 0 || page.pageSize <= 0) {
    return 0;
  }
  return Math.ceil(page.totalCount / page.pageSize);
}

/** Whether a next page exists (backend sends no `hasNext`). */
export function hasNextPage(page: PagedResult<unknown>): boolean {
  return page.pageNumber < totalPagesOf(page);
}

/** Whether a previous page exists (backend sends no `hasPrev`). */
export function hasPreviousPage(page: PagedResult<unknown>): boolean {
  return page.pageNumber > 1;
}

/**
 * Next-page query, or `null` when the current page is the last one.
 * Out-of-range pages arrive as `200` with `items: []` — callers should clamp
 * the UI back to the last page instead of treating them as errors.
 */
export function nextPageQuery(page: PagedResult<unknown>): PagingQuery | null {
  if (!hasNextPage(page)) {
    return null;
  }
  return { pageNumber: page.pageNumber + 1, pageSize: page.pageSize };
}
