/**
 * Inventory contract mirrors for Sub-Phase 1.1.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §5 and
 * `docs/frontend-contract/DTO_REFERENCE.md` §5
 * (`FluxCommerce.Modules.Inventory.Contracts`,
 * `[Route inventory][Authorize(AdminPolicy)]` — Admin only).
 *
 * Notes:
 * - All endpoints are Admin-only (prevents customer IDOR on reservations).
 * - Requests DO use `DataAnnotations` (SKU required/≤64, quantities ranged).
 * - SKU is normalized trimmed + uppercased, `^[A-Z0-9-_.]+$`.
 * - `AdjustStockRequest` is additive-only (no manual decrement; consumption
 *   happens via reservation commit).
 * - `reservationId` is named `ReservationId`, not `Id`.
 * - Timestamps are `DateTimeOffset` (ISO-8601 strings).
 */

import type { Guid, IsoDateString } from '../common/shared-types';
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
