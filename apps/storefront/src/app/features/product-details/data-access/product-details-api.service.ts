/**
 * Product Details data-access service for Sub-Phase 6.1 — Product Details
 * Foundation.
 *
 * Scope: `docs/phases/PHASE_6_PRODUCT_DETAILS.md` §6.1 (foundation only —
 * single-product read).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §2.1
 * (`GET /catalog/products/{id:guid}` is `[AllowAnonymous]`).
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
 * - The route template comes from `CATALOG_ENDPOINTS` — no scattered string
 *   literals.
 * - The service never unwraps `ApiResponse.data`, never catches or remaps
 *   errors, and never attaches tokens: envelopes stay intact for feature
 *   state to map, failures flow untouched to the Phase 1 error normalizer,
 *   and `Authorization` stays owned by the interceptor pipeline.
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 6.4+ — no variant/attribute/image/specification detail reads.
 * - 6.7 — no cart API usage.
 * - Phase 7 — no cart state or cart management.
 */

import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type { ProductResponse } from '@flux/models';
import {
  ApiClient,
  CATALOG_ENDPOINTS,
  type ApiRequestOptions,
  type ApiResponseWithData,
} from '@flux/api';

/**
 * Thin typed façade over the Product Details read contract. Each method maps
 * 1:1 to one endpoint (same name, same params, same envelope); there is no
 * mapping here because feature state owns envelope handling.
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
}
