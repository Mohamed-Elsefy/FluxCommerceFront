/**
 * Admin Inventory data-access service for Sub-Phase 13.8 — Inventory
 * Feature Foundation — plus Supplement S1, Step S1.7 (list/counts
 * surface).
 *
 * Scope: the seven-endpoint inventory surface (single reads, creation,
 * adjustment, plus the paged stock list, the counts snapshot, and the
 * paged reservation list). Stock, reservation, and adjustment UX
 * (forms, states, pages) arrive with the slices that own them
 * (Sub-Phases 13.9–13.10, Supplement S1.7); this service is the
 * transport seam they build on.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §5 (reads
 * require `inventory.read`, writes require `inventory.manage`) and the
 * 13.1 audit (`libs/models/.../catalog-inventory-contract.ts`).
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
  InventoryCountsResponse,
  InventoryItemResponse,
  InventoryReservationResponse,
} from '@flux/models';
import {
  ApiClient,
  INVENTORY_ENDPOINTS,
  toQueryParams,
  type ApiRequestOptions,
  type ApiResponseWithData,
  type PagedApiResponse,
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
   * `POST /inventory` — creates a stock item (`inventory.manage`). SKU
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
   * `GET /inventory/{sku}` — single stock read (`inventory.read`).
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
   * `PATCH /inventory/{sku}` — additive stock adjustment
   * (`inventory.manage`). Additive ONLY (`1..max`): consumption happens
   * via reservation commit, manual decrements do not exist.
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
   * (`inventory.read`). Reservation ids are enumerable through the
   * paged reservation list; direct ids still resolve here.
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

  /**
   * `GET /inventory` — paged stock list (`inventory.read`), ordered by
   * SKU. Filters: `search?` (SKU substring, case-insensitive),
   * `maxAvailable?` (available-quantity ceiling).
   * Success: `200 ApiResponse<PagedResult<InventoryItemResponse>>`.
   * Failures: `400` validation (paging bounds, negative `maxAvailable`),
   * `401`/`403`.
   */
  listItems(
    query: { pageNumber?: number; pageSize?: number; search?: string; maxAvailable?: number } = {},
    options: ApiRequestOptions = {},
  ): Observable<PagedApiResponse<InventoryItemResponse>> {
    return this.api.get<PagedApiResponse<InventoryItemResponse>>(
      INVENTORY_ENDPOINTS.listItems.path,
      { ...options, params: toQueryParams(query) },
    );
  }

  /**
   * `GET /inventory/counts` — inventory overview snapshot
   * (`inventory.read`). `lowStockThreshold?` defaults to 5 (inclusive
   * available ceiling for the low-stock bucket).
   * Success: `200 ApiResponse<InventoryCountsResponse>`.
   * Failures: `400` validation (negative threshold), `401`/`403`.
   */
  itemCounts(
    query: { lowStockThreshold?: number } = {},
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<InventoryCountsResponse>> {
    return this.api.get<ApiResponseWithData<InventoryCountsResponse>>(
      INVENTORY_ENDPOINTS.itemCounts.path,
      { ...options, params: toQueryParams(query) },
    );
  }

  /**
   * `GET /inventory/reservations` — paged reservation list
   * (`inventory.read`), newest-first. Filters: `status?`
   * (`Pending|Committed|Released|Expired`), `sku?` (exact, normalized),
   * `orderId?`.
   * Success: `200 ApiResponse<PagedResult<InventoryReservationResponse>>`.
   * Failures: `400` validation (paging bounds, unknown status, bad SKU,
   * empty order id), `401`/`403`.
   */
  listReservations(
    query: {
      pageNumber?: number;
      pageSize?: number;
      status?: string;
      sku?: string;
      orderId?: string;
    } = {},
    options: ApiRequestOptions = {},
  ): Observable<PagedApiResponse<InventoryReservationResponse>> {
    return this.api.get<PagedApiResponse<InventoryReservationResponse>>(
      INVENTORY_ENDPOINTS.listReservations.path,
      { ...options, params: toQueryParams(query) },
    );
  }
}
