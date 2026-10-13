/**
 * Inventory contract mirrors for Sub-Phase 1.1.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §5 and
 * `docs/frontend-contract/DTO_REFERENCE.md` §5
 * (`FluxCommerce.Modules.Inventory.Contracts`,
 * `[Route inventory][Authorize]` — reads require `inventory.read`, writes
 * (`POST /`, `PATCH /{sku}`) require `inventory.manage` (evolved from a
 * single `AdminPolicy` in Supplement S1; route guards migrate in S1.3).
 * SuperAdmin passes both.
 *
 * Notes:
 * - Reads require `inventory.read`; all endpoints below are permission-
 *   gated (prevents customer IDOR on reservations).
 * - Requests DO use `DataAnnotations` (SKU required/≤64, quantities ranged).
 * - SKU is normalized trimmed + uppercased, `^[A-Z0-9-_.]+$`.
 * - `AdjustStockRequest` is additive-only (no manual decrement; consumption
 *   happens via reservation commit).
 * - `reservationId` is named `ReservationId`, not `Id`.
 * - Timestamps are `DateTimeOffset` (ISO-8601 strings).
 */

import type { Guid, IsoDateString } from '../common/shared-types';
import type { PageQuery } from '../common/shared-types';
import { isValidPageQuery } from '../common/shared-types';
import type { InventoryReservationStatus } from '../common/enums';

/** `POST /inventory` body. */
export interface CreateInventoryItemRequest {
  sku: string;
  onHandQuantity: number;
}

/** `PATCH /inventory/{sku}` body — additive only. */
export interface AdjustStockRequest {
  quantity: number;
}

/** Stock payload — `availableQuantity = onHand - reserved` (computed). */
export interface InventoryItemResponse {
  sku: string;
  onHandQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  updatedAtUtc: IsoDateString;
}

/** `GET /inventory/reservations/{id}` payload (ids never enumerable). */
export interface InventoryReservationResponse {
  reservationId: Guid;
  orderId: Guid;
  sku: string;
  quantity: number;
  status: InventoryReservationStatus;
  expiresAt: IsoDateString;
  createdAtUtc: IsoDateString;
  updatedAtUtc: IsoDateString;
}

/**
 * `GET /inventory/counts` payload (`inventory.read`, all `int`;
 * `lowStockThreshold?` defaults to 5, inclusive available ceiling).
 */
export interface InventoryCountsResponse {
  totalItems: number;
  totalOnHand: number;
  totalReserved: number;
  lowStockItems: number;
  pendingReservations: number;
  committedReservations: number;
  releasedReservations: number;
  expiredReservations: number;
}

/**
 * `GET /inventory` query (`inventory.read`): paging + `search?` (SKU
 * substring, case-insensitive) + `maxAvailable?` (available-quantity
 * ceiling). Ordered by SKU. Negative `maxAvailable` → `400`.
 */
export interface InventoryListQuery extends PageQuery {
  search?: string;
  maxAvailable?: number;
}

/**
 * Structural pre-check for an inventory-list query. Pure — throws nothing.
 */
export function isValidInventoryListQuery(query: InventoryListQuery | null | undefined): boolean {
  if (!isValidPageQuery(query)) {
    return false;
  }
  if (query === null || query === undefined) {
    return true;
  }
  if (query.search !== undefined && query.search !== null && query.search.trim() === '') {
    return false;
  }
  if (query.maxAvailable !== undefined && query.maxAvailable !== null) {
    if (!Number.isInteger(query.maxAvailable) || query.maxAvailable < 0) {
      return false;
    }
  }
  return true;
}

/** Reservation statuses accepted as the `status` filter. */
export const RESERVATION_STATUS_FILTER_VALUES: readonly string[] = [
  'Pending',
  'Committed',
  'Released',
  'Expired',
];

/**
 * `GET /inventory/reservations` query (`inventory.read`): paging +
 * `status?/sku?/orderId?` (newest-first). Unknown `status`, bad SKU, or
 * empty orderId → `400`.
 */
export interface ReservationListQuery extends PageQuery {
  status?: string;
  sku?: string;
  orderId?: Guid;
}

/**
 * Structural pre-check for a reservation-list query. Pure — throws nothing.
 */
export function isValidReservationListQuery(
  query: ReservationListQuery | null | undefined,
): boolean {
  if (!isValidPageQuery(query)) {
    return false;
  }
  if (query === null || query === undefined) {
    return true;
  }
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    const known = RESERVATION_STATUS_FILTER_VALUES.some(
      (s) => s.toLowerCase() === String(query.status).toLowerCase(),
    );
    if (!known) {
      return false;
    }
  }
  if (query.sku !== undefined && query.sku !== null && query.sku.trim() === '') {
    return false;
  }
  if (query.orderId !== undefined && query.orderId !== null && query.orderId.trim() === '') {
    return false;
  }
  return true;
}
