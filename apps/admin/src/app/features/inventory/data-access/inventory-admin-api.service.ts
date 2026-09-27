/**
 * Admin Inventory data-access service for Sub-Phase 13.8 — Inventory
 * Feature Foundation.
 *
 * Scope: the complete four-endpoint inventory surface (the contract has
 * no more surface than this — there is no stock list, no reservation
 * list, no search, no pagination). Stock, reservation, and adjustment
 * UX (forms, states, pages) arrive with the slices that own them
 * (Sub-Phases 13.9–13.10); this service is the transport seam they
 * build on.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §5 (every
 * endpoint is `Admin`-only, including reads) and the 13.1 audit
 * (`libs/models/.../catalog-inventory-contract.ts`).
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * Inventory States (../state, 13.9+ — route-provided)
 *         ↓ InventoryAdminApiService (this file — thin typed façade)
 *     ApiClient (Phase 1, the ONLY HttpClient user)
 *         ↓ HttpClient → interceptors → ASP.NET Core API
 * ```
 *
 * Contract fidelity rules enforced here (same convention as
 * `CatalogAdminApiService`):
 * - Request/response types come from `@flux/models` — no local
 *   re-declarations, so no contract drift is possible.
 * - Route templates come from `INVENTORY_ENDPOINTS` — no scattered
 *   string literals.
 * - The service never unwraps `ApiResponse.data`, never catches or
 *   remaps errors, and never attaches tokens: envelopes stay intact
 *   for feature state to map, failures flow untouched to the Phase 1
 *   error normalizer, and `Authorization` stays owned by the
 *   interceptor pipeline.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 13.9–13.10 — no forms, states, pages, or UX of any kind.
 * - No inventory math, no reservation lifecycle, no saga handling.
 */

import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AdjustStockRequest,
  CreateInventoryItemRequest,
  InventoryItemResponse,
  InventoryReservationResponse,
} from '@flux/models';
import {
  ApiClient,
  INVENTORY_ENDPOINTS,
  type ApiRequestOptions,
  type ApiResponseWithData,
} from '@flux/api';

/**
 * Thin typed façade over the admin Inventory contract. Each method maps
 * 1:1 to one endpoint (same name, same params, same envelope); there is
 * no mapping here because feature state owns envelope handling.
 *
 * Feature-scoped (no `providedIn`): provided at the inventory route
 * level — never a root singleton (Phase 12.8 pins the root-provided
 * admin allowlist; this service is not on it).
 */
@Injectable()
export class InventoryAdminApiService {
  private readonly api = inject(ApiClient);

  /**
   * `POST /inventory` — creates a stock item (`Admin` only). SKU
   * normalizes backend-side (trimmed + uppercased, `^[A-Z0-9-_.]+$`,
   * at most 64 chars); duplicates surface as `409`.
   * Success: `201 ApiResponse<InventoryItemResponse>` + `Location`.
   * Failures: `400` validation, `401`/`403`, `409` duplicate SKU.
   */
  createItem(
    body: CreateInventoryItemRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<InventoryItemResponse>> {
    return this.api.post<ApiResponseWithData<InventoryItemResponse>>(
      INVENTORY_ENDPOINTS.createItem.path,
      body,
      options,
    );
  }

  /**
   * `GET /inventory/{sku}` — single stock read (`Admin` only).
   * Success: `200 ApiResponse<InventoryItemResponse>`.
   * Failures: `400` invalid SKU, `401`/`403`, `404` unknown SKU.
   */
  getItem(
    sku: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<InventoryItemResponse>> {
    return this.api.get<ApiResponseWithData<InventoryItemResponse>>(
      INVENTORY_ENDPOINTS.getItem.path,
      { ...options, pathParams: { sku, ...(options.pathParams ?? {}) } },
    );
  }

  /**
   * `PATCH /inventory/{sku}` — additive stock adjustment (`Admin`
   * only). Additive ONLY (`1..max`): consumption happens via
   * reservation commit, manual decrements do not exist.
   * Success: `200 ApiResponse<InventoryItemResponse>`.
   * Failures: `400` validation, `401`/`403`, `404` unknown SKU.
   */
  adjustStock(
    sku: string,
    body: AdjustStockRequest,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<InventoryItemResponse>> {
    return this.api.patch<ApiResponseWithData<InventoryItemResponse>>(
      INVENTORY_ENDPOINTS.adjustStock.path,
      body,
      { ...options, pathParams: { sku, ...(options.pathParams ?? {}) } },
    );
  }

  /**
   * `GET /inventory/reservations/{id}` — single reservation read
   * (`Admin` only). Reservation ids are never enumerable: callers hold
   * an id from elsewhere, never browse.
   * Success: `200 ApiResponse<InventoryReservationResponse>`.
   * Failures: `400` invalid id, `401`/`403`, `404` unknown reservation.
   */
  getReservation(
    id: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<InventoryReservationResponse>> {
    return this.api.get<ApiResponseWithData<InventoryReservationResponse>>(
      INVENTORY_ENDPOINTS.getReservation.path,
      { ...options, pathParams: { id, ...(options.pathParams ?? {}) } },
    );
  }
}
