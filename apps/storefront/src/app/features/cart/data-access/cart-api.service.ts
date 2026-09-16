/**
 * Cart data-access service for Sub-Phase 7.2 — Cart API & Data Access.
 *
 * Scope: `docs/phases/PHASE_7_SHOPPING_CART.md` §7.2 (data access only —
 * no state implementation, no UI).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §3 and
 * `docs/frontend-contract/DTO_REFERENCE.md` §3
 * (`FluxCommerce.Modules.Cart.Contracts` records, `[Route cart]`).
 * Every cart endpoint returns `ApiResponse<CartResponse>`; cart lines
 * carry NO `lineTotal` and the cart carries NO totals object. Guest
 * routes (`AllowAnonymous`) carry the opaque `cartId`; authenticated
 * routes resolve the user from the JWT session (no id in the route).
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * CartState (7.3 — not this sub-phase; feature-owned local Signals)
 *         ↓ CartApiService (this file — thin typed façade)
 *     ApiClient (Phase 1, the ONLY HttpClient user)
 *         ↓ HttpClient → interceptors → ASP.NET Core API
 * ```
 *
 * Contract fidelity rules enforced here (same convention as
 * `CatalogApiService`, Phase 5.1, and `ProductDetailsApiService`,
 * Phase 6.1–6.7):
 * - Request/response types come from `@flux/models` plus the §7.1
 *   `Cart` alias (`../models`) — no local re-declarations, so no
 *   contract drift is possible.
 * - Route templates come from `CART_ENDPOINTS` — no scattered string
 *   literals.
 * - The service never unwraps `ApiResponse.data`, never catches or
 *   remaps errors, and never attaches tokens: envelopes stay intact for
 *   feature state (7.3) to map, validation and business failures
 *   (`400` range/length violations, `VariantNotFound`/`Unavailable`,
 *   `QuantityLimitExceeded`, `404` missing carts/items, `409`
 *   concurrency conflicts) flow untouched through the Observable error
 *   channel to the Phase 1 error normalizer, and `Authorization` stays
 *   owned by the interceptor pipeline.
 * - The service performs no business logic: no quantity clamping, no
 *   totals math, no merge algorithm, no persistence.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 7.3 — no feature state, no signals, no `loadCart`/`addItem` store
 *   implementations.
 * - 7.4 — no pages, no components, no routes.
 * - 7.5/7.7 — no `localStorage` persistence, no merge triggering or
 *   merge-effect guards (the `mergeGuestCart` transport here is
 *   invoked by later wiring, never self-triggered).
 * - Phase 8 — no checkout, payment, or order logic.
 */

import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AddCartItemRequest,
  MergeCartRequest,
  UpdateCartItemQuantityRequest,
} from '@flux/models';
import {
  ApiClient,
  CART_ENDPOINTS,
  type ApiRequestOptions,
  type ApiResponseWithData,
} from '@flux/api';
import type { Cart } from '../models/cart.models';

/**
 * Thin typed façade over the Cart contract. Each method maps 1:1 to one
 * endpoint (same name, same params, same envelope); there is no mapping
 * here because feature state owns envelope handling.
 */
@Injectable({ providedIn: 'root' })
export class CartApiService {
  private readonly api = inject(ApiClient);

  /**
   * `POST /cart/guest` — anonymous. Creates a guest cart and returns it
   * (the `cartId` names every later guest call). Body is the empty
   * `CreateGuestCartRequest {}` record — the record carries no fields,
   * so it has no `@flux/models` mirror and `{}` is sent verbatim.
   * Success: `201 ApiResponse<CartResponse>` + `Location` header.
   * Failures: `400` validation.
   */
  createGuestCart(options: ApiRequestOptions = {}): Observable<ApiResponseWithData<Cart>> {
    return this.api.post<ApiResponseWithData<Cart>>(
      CART_ENDPOINTS.createGuestCart.path,
      {},
      options,
    );
  }

  /**
   * `GET /cart/guest/{cartId}` — anonymous with the opaque guest
   * `cartId` in the route. Reads the guest cart.
   * Success: `200 ApiResponse<CartResponse>`.
   * Failures: `404 Cart.NotFound` (unknown or expired cart).
   */
  getGuestCart(
    cartId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<Cart>> {
    return this.api.get<ApiResponseWithData<Cart>>(CART_ENDPOINTS.getGuestCart.path, {
      ...options,
      pathParams: { cartId, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `POST /cart/guest/{cartId}/items` — anonymous with the opaque guest
   * `cartId` in the route. Adds one line (`variantId` + price snapshot
   * + `quantity`) to that guest cart.
   * Success: `200 ApiResponse<CartResponse>`.
   * Failures: `400` validation (range/length violations,
   * `VariantNotFound`/`Unavailable`, `QuantityLimitExceeded`), `404`
   * unknown cart.
   */
  addGuestCartItem(
    cartId: string,
    body: AddCartItemRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<Cart>> {
    return this.api.post<ApiResponseWithData<Cart>>(CART_ENDPOINTS.addGuestItem.path, body, {
      ...options,
      pathParams: { cartId, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `PUT /cart/guest/{cartId}/items/{variantId}` — anonymous. Updates
   * one guest line's quantity. The body carries quantity only (no
   * price/currency); the route `variantId` wins on disagreement.
   * Success: `200 ApiResponse<CartResponse>`.
   * Failures: `400` validation, `404` unknown cart or line.
   */
  updateGuestCartItemQuantity(
    cartId: string,
    variantId: string,
    body: UpdateCartItemQuantityRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<Cart>> {
    return this.api.put<ApiResponseWithData<Cart>>(CART_ENDPOINTS.updateGuestItem.path, body, {
      ...options,
      pathParams: { cartId, variantId, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `DELETE /cart/guest/{cartId}/items/{variantId}` — anonymous.
   * Removes one guest line.
   * Success: `200 ApiResponse<CartResponse>`.
   * Failures: `404` unknown cart or line.
   */
  removeGuestCartItem(
    cartId: string,
    variantId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<Cart>> {
    return this.api.delete<ApiResponseWithData<Cart>>(CART_ENDPOINTS.removeGuestItem.path, {
      ...options,
      pathParams: { cartId, variantId, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `DELETE /cart/guest/{cartId}` — anonymous. Clears the guest cart
   * (returns the emptied cart).
   * Success: `200 ApiResponse<CartResponse>`.
   * Failures: `404` unknown cart.
   */
  clearGuestCart(
    cartId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<Cart>> {
    return this.api.delete<ApiResponseWithData<Cart>>(CART_ENDPOINTS.clearGuestCart.path, {
      ...options,
      pathParams: { cartId, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `POST /cart` — authenticated (JWT via the interceptor pipeline, no
   * id in the route). Returns the caller's existing cart, or creates
   * one. The contract defines no body, so none is sent — the server
   * resolves the user from the session.
   * Success: `201 ApiResponse<CartResponse>` + `Location: /cart`.
   * Failures: `401` anonymous.
   */
  getOrCreateCart(options: ApiRequestOptions = {}): Observable<ApiResponseWithData<Cart>> {
    return this.api.post<ApiResponseWithData<Cart>>(
      CART_ENDPOINTS.getOrCreateCart.path,
      undefined,
      options,
    );
  }

  /**
   * `GET /cart` — authenticated (JWT via the interceptor pipeline, no
   * id in the route). Reads the caller's cart.
   * Success: `200 ApiResponse<CartResponse>`.
   * Failures: `401` anonymous, `404` no active cart.
   */
  getCart(options: ApiRequestOptions = {}): Observable<ApiResponseWithData<Cart>> {
    return this.api.get<ApiResponseWithData<Cart>>(CART_ENDPOINTS.getCart.path, options);
  }

  /**
   * `POST /cart/items` — authenticated (JWT via the interceptor
   * pipeline, no id in the route). Adds one line (`variantId` + price
   * snapshot + `quantity`) to the caller's cart.
   * Success: `200 ApiResponse<CartResponse>`.
   * Failures: `400` validation, `401` anonymous.
   */
  addCartItem(
    body: AddCartItemRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<Cart>> {
    return this.api.post<ApiResponseWithData<Cart>>(CART_ENDPOINTS.addItem.path, body, options);
  }

  /**
   * `PUT /cart/items/{variantId}` — authenticated. Updates one line's
   * quantity. The body carries quantity only (no price/currency); the
   * route `variantId` wins on disagreement.
   * Success: `200 ApiResponse<CartResponse>`.
   * Failures: `400` validation, `401` anonymous.
   */
  updateCartItemQuantity(
    variantId: string,
    body: UpdateCartItemQuantityRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<Cart>> {
    return this.api.put<ApiResponseWithData<Cart>>(CART_ENDPOINTS.updateItem.path, body, {
      ...options,
      pathParams: { variantId, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `DELETE /cart/items/{variantId}` — authenticated. Removes one line.
   * Success: `200 ApiResponse<CartResponse>`.
   * Failures: `401` anonymous, `404` unknown line.
   */
  removeCartItem(
    variantId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<Cart>> {
    return this.api.delete<ApiResponseWithData<Cart>>(CART_ENDPOINTS.removeItem.path, {
      ...options,
      pathParams: { variantId, ...(options.pathParams ?? {}) },
    });
  }

  /**
   * `DELETE /cart` — authenticated. Clears the caller's cart (returns
   * the emptied cart).
   * Success: `200 ApiResponse<CartResponse>`.
   * Failures: `401` anonymous.
   */
  clearCart(options: ApiRequestOptions = {}): Observable<ApiResponseWithData<Cart>> {
    return this.api.delete<ApiResponseWithData<Cart>>(CART_ENDPOINTS.clearCart.path, options);
  }

  /**
   * `POST /cart/merge` — authenticated (JWT via the interceptor
   * pipeline). Atomically merges the named guest cart into the caller's
   * cart and clears the source (backend Lua merge — the frontend never
   * implements merge behavior, duplicate handling, or consistency).
   * Call after login; invocation timing and result handling belong to
   * Sub-Phase 7.7, never here.
   * Success: `200 ApiResponse<CartResponse>` (the merged cart).
   * Failures: `400` validation, `401` anonymous, `404` guest cart
   * must exist.
   */
  mergeGuestCart(
    body: MergeCartRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<Cart>> {
    return this.api.post<ApiResponseWithData<Cart>>(CART_ENDPOINTS.mergeCarts.path, body, options);
  }
}
