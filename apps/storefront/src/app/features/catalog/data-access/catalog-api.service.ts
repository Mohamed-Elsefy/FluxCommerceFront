/**
 * Catalog data-access service for Sub-Phase 5.1 — Catalog Feature Foundation.
 *
 * Scope: `docs/phases/PHASE_5_CATALOG.md` §5.1 (read-only storefront subset).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §2 (all `GET`
 * endpoints are `[AllowAnonymous]`; writes need the `Admin` role and belong
 * to the Admin portal — Phase 13 — never to the storefront).
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * Catalog State (./state, Sub-Phase 5.1 foundation)
 *         ↓ CatalogApiService (this file — thin typed façade)
 *     ApiClient (Phase 1, the ONLY HttpClient user)
 *         ↓ HttpClient → interceptors → ASP.NET Core API
 * ```
 *
 * Contract fidelity rules enforced here (same convention as
 * `IdentityApiService`, Phase 2.1):
 * - Request/response types come from `@flux/models` (the Phase 1 §1.1
 *   mirrors) — no local re-declarations, so no contract drift is possible.
 * - Route templates come from `CATALOG_ENDPOINTS` (the Phase 1 §1.1 route
 *   table) — no scattered string literals.
 * - Query objects convert through the single `toQueryParams` funnel —
 *   never hand-built query strings.
 * - The service never unwraps `ApiResponse.data`, never catches or remaps
 *   errors, and never attaches tokens: envelopes stay intact for feature
 *   state to map, failures flow untouched to the Phase 1 error normalizer,
 *   and `Authorization` stays owned by the interceptor pipeline.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - Admin writes (create/update/lifecycle/assign/delete → Phase 13).
 * - Variants/images/attributes/specifications detail reads (Phase 6).
 * - DTO→view-model mapping beyond envelope passthrough (feature state).
 */

import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CatalogProductListItem, CategoryResponse, ProductResponse } from '@flux/models';
import {
  ApiClient,
  CATALOG_ENDPOINTS,
  toQueryParams,
  type ApiRequestOptions,
  type ApiResponseWithData,
  type PagedApiResponse,
  type PaginationRequest,
} from '@flux/api';
import type { CatalogQuery } from '../models/catalog.models';

/**
 * Thin typed façade over the storefront Catalog read contract. Each method
 * maps 1:1 to one endpoint (same name, same params, same envelope); there
 * is no mapping here because feature state owns envelope handling.
 */
@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private readonly api = inject(ApiClient);

  /**
   * `GET /catalog/products/{id}` — anonymous. Single product read model.
   * Success: `200 ApiResponse<ProductResponse>`.
   * Failures: `400` validation, `404` unknown product.
   */
  getProduct(
    id: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<ProductResponse>> {
    return this.api.get<ApiResponseWithData<ProductResponse>>(CATALOG_ENDPOINTS.getProduct.path, {
      ...options,
      pathParams: { id, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `GET /catalog/products` — anonymous. Paged admin-shaped product list
   * (`ProductResponse` items, non-deleted only, no sorting/filtering).
   * Success: `200 ApiResponse<PagedResult<ProductResponse>>`.
   * Failures: `400` validation (`pageNumber >= 1`, `1 <= pageSize <= 100`).
   */
  listProducts(
    query: PaginationRequest = {},
    options: ApiRequestOptions = {},
  ): Observable<PagedApiResponse<ProductResponse>> {
    return this.api.get<PagedApiResponse<ProductResponse>>(CATALOG_ENDPOINTS.listProducts.path, {
      ...options,
      params: toQueryParams(query),
    });
  }

  /**
   * `GET /catalog` — anonymous storefront search. Supports
   * `searchTerm/categoryId/status/visibility` filters, `sortBy/sortDirection`
   * sorting, and paging; nulls mean "no filter/sort" (server default).
   * Success: `200 ApiResponse<PagedResult<CatalogProductListItem>>`.
   * Failures: `400` validation.
   */
  searchCatalog(
    query: CatalogQuery = {},
    options: ApiRequestOptions = {},
  ): Observable<PagedApiResponse<CatalogProductListItem>> {
    return this.api.get<PagedApiResponse<CatalogProductListItem>>(
      CATALOG_ENDPOINTS.searchCatalog.path,
      { ...options, params: toQueryParams(query) },
    );
  }

  /**
   * `GET /catalog/categories/{id}` — anonymous. Single category read model.
   * Success: `200 ApiResponse<CategoryResponse>`.
   * Failures: `400` validation, `404` unknown category.
   */
  getCategory(
    id: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<CategoryResponse>> {
    return this.api.get<ApiResponseWithData<CategoryResponse>>(CATALOG_ENDPOINTS.getCategory.path, {
      ...options,
      pathParams: { id, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `GET /catalog/categories` — anonymous. Paged category list (no
   * sorting/filtering on the backend).
   * Success: `200 ApiResponse<PagedResult<CategoryResponse>>`.
   * Failures: `400` validation.
   */
  listCategories(
    query: PaginationRequest = {},
    options: ApiRequestOptions = {},
  ): Observable<PagedApiResponse<CategoryResponse>> {
    return this.api.get<PagedApiResponse<CategoryResponse>>(CATALOG_ENDPOINTS.listCategories.path, {
      ...options,
      params: toQueryParams(query),
    });
  }
}
