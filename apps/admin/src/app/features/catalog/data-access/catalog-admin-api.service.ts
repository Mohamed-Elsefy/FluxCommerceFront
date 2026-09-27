/**
 * Admin Catalog data-access service for Sub-Phases 13.2–13.4 — Catalog
 * Foundation + Product + Variant Management.
 *
 * Scope: the foundation READ surface (paginated product/category lists,
 * single product/category reads, storefront search) plus the 13.3 product
 * slice (create/update/lifecycle writes and the details-section reads for
 * variants, images, and specifications) plus the 13.4 variant slice
 * (variant CRUD — the batch endpoint has no management UI and stays
 * uncalled). Image/specification/attribute WRITES arrive with the slices
 * that own their forms (Sub-Phases 13.5–13.6).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §2 (catalog
 * reads are `[AllowAnonymous]`, but the portal always sends its Admin JWT;
 * writes need the `Admin` role) and the 13.1 audit
 * (`libs/models/.../catalog-inventory-contract.ts`).
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * Catalog States (../state, route-provided)
 *         ↓ CatalogAdminApiService (this file — thin typed façade)
 *     ApiClient (Phase 1, the ONLY HttpClient user)
 *         ↓ HttpClient → interceptors → ASP.NET Core API
 * ```
 *
 * Contract fidelity rules enforced here (same convention as the
 * storefront `CatalogApiService`, Phase 5.1):
 * - Request/response types come from `@flux/models` — no local
 *   re-declarations, so no contract drift is possible.
 * - Route templates come from `CATALOG_ENDPOINTS` — no scattered string
 *   literals.
 * - Query objects convert through the single `toQueryParams` funnel —
 *   never hand-built query strings.
 * - The service never unwraps `ApiResponse.data`, never catches or remaps
 *   errors, and never attaches tokens: envelopes stay intact for feature
 *   state to map, failures flow untouched to the Phase 1 error normalizer,
 *   and `Authorization` stays owned by the interceptor pipeline.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 13.4–13.6 — no variant/image/specification/attribute writes, no image
 *   uploads (URL references only, confirmed in 13.1), no attribute writes.
 */

import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  CatalogProductListItem,
  CatalogSearchQuery,
  CategoryResponse,
  CreateProductRequest,
  CreateProductVariantRequest,
  ProductImageResponse,
  ProductLifecycleAction,
  ProductResponse,
  ProductSpecificationResponse,
  UpdateProductRequest,
  UpdateProductVariantRequest,
  VariantResponse,
} from '@flux/models';
import {
  ApiClient,
  CATALOG_ENDPOINTS,
  toQueryParams,
  type ApiRequestOptions,
  type ApiResponseWithData,
  type PagedApiResponse,
  type PaginationRequest,
} from '@flux/api';

/**
 * Thin typed façade over the admin Catalog read contract. Each method
 * maps 1:1 to one endpoint (same name, same params, same envelope); there
 * is no mapping here because feature state owns envelope handling.
 *
 * Feature-scoped (no `providedIn`): provided at the catalog route level
 * alongside the overview state — never a root singleton (Phase 12.8
 * pins the root-provided admin allowlist; this service is not on it).
 */
@Injectable()
export class CatalogAdminApiService {
  private readonly api = inject(ApiClient);

  /**
   * `GET /catalog/products` — paged admin-shaped product list
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
   * `GET /catalog/products/{id}` — single product read model.
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
   * `GET /catalog/categories` — paged category list (no
   * sorting/filtering on the backend; hierarchy travels per row via
   * nullable `parentId` only).
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

  /**
   * `GET /catalog/categories/{id}` — single category read model.
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
   * `GET /catalog` — storefront search (the ONLY read with
   * `searchTerm/categoryId/status/visibility` filters and
   * `sortBy/sortDirection` sorting); nulls mean "no filter/sort" (server
   * default). Consumed by the admin for lookup-style queries until the
   * 13.3+ slices define their own needs.
   * Success: `200 ApiResponse<PagedResult<CatalogProductListItem>>`.
   * Failures: `400` validation.
   */
  searchCatalog(
    query: CatalogSearchQuery = {},
    options: ApiRequestOptions = {},
  ): Observable<PagedApiResponse<CatalogProductListItem>> {
    return this.api.get<PagedApiResponse<CatalogProductListItem>>(
      CATALOG_ENDPOINTS.searchCatalog.path,
      { ...options, params: toQueryParams(query) },
    );
  }

  /**
   * `POST /catalog/products` — creates a product (`Admin` only).
   * Success: `201 ApiResponse<Guid(productId)>` + `Location`.
   * Failures: `400` validation (field map in `errors{}`), `401`/`403`,
   * `404` unknown category, `409` duplicate name/slug.
   */
  createProduct(
    body: CreateProductRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<string>> {
    return this.api.post<ApiResponseWithData<string>>(
      CATALOG_ENDPOINTS.createProduct.path,
      body,
      options,
    );
  }

  /**
   * `PUT /catalog/products/{id}` — replaces product fields (`Admin` only).
   * Carries `visibility` only, never `status` (status moves through the
   * lifecycle actions below).
   * Success: `204` empty. Failures: `400` validation, `401`/`403`, `404`,
   * `409` duplicate name/slug.
   */
  updateProduct(
    id: string,
    body: UpdateProductRequest,
    options: ApiRequestOptions = {},
  ): Observable<void> {
    return this.api.put<void>(CATALOG_ENDPOINTS.updateProduct.path, body, {
      ...options,
      pathParams: { id, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `POST /catalog/products/{id}/<action>` — lifecycle transition
   * (`activate | deactivate | archive | soft-delete | restore`, `Admin`
   * only). The backend owns transition validity: illegal moves surface as
   * `409` for the caller to display, never for the SPA to predict.
   * Success: `204` empty. Failures: `400`, `401`/`403`, `404`, `409`.
   */
  transitionProduct(
    id: string,
    action: ProductLifecycleAction,
    options: ApiRequestOptions = {},
  ): Observable<void> {
    return this.api.post<void>(PRODUCT_LIFECYCLE_ENDPOINTS[action].path, undefined, {
      ...options,
      pathParams: { id, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `GET /catalog/products/{productId}/variants` — full variant list (no
   * pagination on the backend).
   * Success: `200 ApiResponse<VariantResponse[]>`.
   * Failures: `400` validation, `404` unknown product.
   */
  listVariants(
    productId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<VariantResponse[]>> {
    return this.api.get<ApiResponseWithData<VariantResponse[]>>(
      CATALOG_ENDPOINTS.listVariants.path,
      { ...options, pathParams: { productId, ...(options.pathParams ?? {}) } },
    );
  }

  /**
   * `GET /catalog/products/{productId}/images` — full image list,
   * server-ordered by `displayOrder`.
   * Success: `200 ApiResponse<ProductImageResponse[]>`.
   * Failures: `400` validation, `404` unknown product.
   */
  listProductImages(
    productId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<ProductImageResponse[]>> {
    return this.api.get<ApiResponseWithData<ProductImageResponse[]>>(
      CATALOG_ENDPOINTS.listProductImages.path,
      { ...options, pathParams: { productId, ...(options.pathParams ?? {}) } },
    );
  }

  /**
   * `GET /catalog/products/{productId}/specifications` — full
   * specification list (no pagination on the backend).
   * Success: `200 ApiResponse<ProductSpecificationResponse[]>`.
   * Failures: `400` validation, `404` unknown product.
   */
  listSpecifications(
    productId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<ProductSpecificationResponse[]>> {
    return this.api.get<ApiResponseWithData<ProductSpecificationResponse[]>>(
      CATALOG_ENDPOINTS.listSpecifications.path,
      { ...options, pathParams: { productId, ...(options.pathParams ?? {}) } },
    );
  }

  /**
   * `GET /catalog/products/{productId}/variants/{variantId}` — single
   * variant read model.
   * Success: `200 ApiResponse<VariantResponse>`.
   * Failures: `400` validation, `404` unknown product or variant.
   */
  getVariant(
    productId: string,
    variantId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<VariantResponse>> {
    return this.api.get<ApiResponseWithData<VariantResponse>>(CATALOG_ENDPOINTS.getVariant.path, {
      ...options,
      pathParams: { productId, variantId, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `POST /catalog/products/{productId}/variants` — creates a variant
   * (`Admin` only). Price and currency travel only here: the update
   * endpoint accepts no money fields, so creation is the single pricing
   * moment — the form says so explicitly.
   * Success: `201 ApiResponse<Guid(variantId)>` + `Location`.
   * Failures: `400` validation (SKU/price/currency rules backend-owned),
   * `401`/`403`, `404` unknown product, `409` duplicate SKU.
   */
  createVariant(
    productId: string,
    body: CreateProductVariantRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<string>> {
    return this.api.post<ApiResponseWithData<string>>(CATALOG_ENDPOINTS.createVariant.path, body, {
      ...options,
      pathParams: { productId, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `PUT /catalog/products/{productId}/variants/{variantId}` — renames a
   * variant (`Admin` only). Carries `sku` + `name` ONLY: price, currency,
   * and status cannot be edited through any backend endpoint, so the
   * edit form locks them as read-only display.
   * Success: `204` empty. Failures: `400` validation, `401`/`403`,
   * `404`, `409` duplicate SKU.
   */
  updateVariant(
    productId: string,
    variantId: string,
    body: UpdateProductVariantRequest,
    options: ApiRequestOptions = {},
  ): Observable<void> {
    return this.api.put<void>(CATALOG_ENDPOINTS.updateVariant.path, body, {
      ...options,
      pathParams: { productId, variantId, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `DELETE /catalog/products/{productId}/variants/{variantId}` —
   * deletes a variant (`Admin` only). The backend exposes no
   * disable/lifecycle transition for variants: deletion is the only
   * removal operation, always behind confirmation.
   * Success: `204` empty. Failures: `401`/`403`, `404`.
   */
  deleteVariant(
    productId: string,
    variantId: string,
    options: ApiRequestOptions = {},
  ): Observable<void> {
    return this.api.delete<void>(CATALOG_ENDPOINTS.deleteVariant.path, {
      ...options,
      pathParams: { productId, variantId, ...(options.pathParams ?? {}) },
    });
  }
}

/**
 * Lifecycle action → canonical route template (one entry per
 * `PRODUCT_LIFECYCLE_ACTIONS` member — no scattered literals at call
 * sites, no invented transitions).
 */
const PRODUCT_LIFECYCLE_ENDPOINTS: Record<ProductLifecycleAction, { readonly path: string }> = {
  activate: CATALOG_ENDPOINTS.activateProduct,
  deactivate: CATALOG_ENDPOINTS.deactivateProduct,
  archive: CATALOG_ENDPOINTS.archiveProduct,
  'soft-delete': CATALOG_ENDPOINTS.softDeleteProduct,
  restore: CATALOG_ENDPOINTS.restoreProduct,
};
