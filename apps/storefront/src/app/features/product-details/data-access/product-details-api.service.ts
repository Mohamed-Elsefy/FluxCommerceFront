/**
 * Product Details data-access service for Sub-Phases 6.1–6.7 — Foundation
 * + Page & Information + Image Gallery + Variant Selection + SKU Binding +
 * Quantity Selection + Add to Cart Integration.
 *
 * Scope: `docs/phases/PHASE_6_PRODUCT_DETAILS.md` §§6.1–6.7 (product +
 * specifications + images + variants reads, plus the Product Details →
 * Cart submission boundary).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §§2–3 (catalog
 * `GET`s and cart `POST`s; every cart `POST` body is `AddCartItemRequest`
 * with caller-supplied price snapshot — see the integration note in
 * `../models`).
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * ProductDetailsState (../state — feature-owned local Signals)
 *         ↓ ProductDetailsApiService (this file — thin typed façade)
 *     ApiClient (Phase 1, the ONLY HttpClient user)
 *         ↓ HttpClient → interceptors → ASP.NET Core API
 * ```
 *
 * Contract fidelity rules enforced here (same convention as
 * `CatalogApiService`, Phase 5.1):
 * - Request/response types come from `@flux/models` — no local
 *   re-declarations, so no contract drift is possible.
 * - Route templates come from `*_ENDPOINTS` — no scattered string
 *   literals.
 * - The service never unwraps `ApiResponse.data`, never catches or remaps
 *   errors, and never attaches tokens: envelopes stay intact for feature
 *   state to map, failures flow untouched to the Phase 1 error normalizer,
 *   and `Authorization` stays owned by the interceptor pipeline.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - Phase 7 — no cart reads, cart pages/state, guest persistence, or merge.
 */

import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AddCartItemRequest,
  CartResponse,
  ProductImageResponse,
  ProductResponse,
  ProductSpecificationResponse,
  VariantResponse,
} from '@flux/models';
import {
  ApiClient,
  CART_ENDPOINTS,
  CATALOG_ENDPOINTS,
  type ApiRequestOptions,
  type ApiResponseWithData,
} from '@flux/api';

/**
 * Thin typed façade over the Product Details read contract plus the
 * Product Details → Cart submission boundary. Each method maps 1:1 to one
 * endpoint (same name, same params, same envelope); there is no mapping
 * here because feature state owns envelope handling.
 */
@Injectable({ providedIn: 'root' })
export class ProductDetailsApiService {
  private readonly api = inject(ApiClient);

  /**
   * `GET /catalog/products/{id}` — anonymous. Single product read model.
   * Success: `200 ApiResponse<ProductResponse>`.
   * Failures: `400` validation (malformed id), `404` unknown product.
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
   * `GET /catalog/products/{productId}/specifications` — anonymous.
   * Specification list (`name`/`value`, both non-null); no pagination,
   * sorting, or filtering on the backend.
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
   * `GET /catalog/products/{productId}/images` — anonymous. Image list
   * ordered by `displayOrder` server-side.
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
   * `GET /catalog/products/{productId}/variants` — anonymous. Flat variant
   * list (`id`/`sku`/`name`, backend-issued `unitPriceAmount` + `currency`,
   * `status`, no option dimensions); no pagination, sorting, or filtering
   * on the backend.
   * Success: `200 ApiResponse<VariantResponse[]>`.
   * Failures: `400` validation, `404` unknown product.
   */
  listProductVariants(
    productId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<VariantResponse[]>> {
    return this.api.get<ApiResponseWithData<VariantResponse[]>>(
      CATALOG_ENDPOINTS.listVariants.path,
      { ...options, pathParams: { productId, ...(options.pathParams ?? {}) } },
    );
  }

  /**
   * `POST /cart/guest/{cartId}/items` — anonymous with the opaque guest
   * `cartId` in the route. Adds one line (`variantId` + price snapshot +
   * `quantity`) to that guest cart.
   * Success: `200 ApiResponse<CartResponse>`.
   * Failures: `400` validation (`VariantNotFound/Unavailable`,
   * `QuantityLimitExceeded`), `404` unknown cart.
   *
   * Boundary: this façade sends; cartId lifecycle and persistence belong
   * to Phase 7 and are never managed here.
   */
  addGuestCartItem(
    cartId: string,
    body: AddCartItemRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<CartResponse>> {
    return this.api.post<ApiResponseWithData<CartResponse>>(
      CART_ENDPOINTS.addGuestItem.path,
      body,
      {
        ...options,
        pathParams: { cartId, ...(options.pathParams ?? {}) },
      },
    );
  }

  /**
   * `POST /cart/items` — authenticated (JWT via the interceptor pipeline,
   * no id in the route). Adds one line (`variantId` + price snapshot +
   * `quantity`) to the caller's cart.
   * Success: `200 ApiResponse<CartResponse>`.
   * Failures: `400` validation, `401` anonymous.
   *
   * Boundary: this façade sends; cart reads/pages/state belong to
   * Phase 7 and are never managed here.
   */
  addAuthenticatedCartItem(
    body: AddCartItemRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<CartResponse>> {
    return this.api.post<ApiResponseWithData<CartResponse>>(
      CART_ENDPOINTS.addItem.path,
      body,
      options,
    );
  }
}
