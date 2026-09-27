/**
 * Admin Inventory feature models for Sub-Phase 13.8 — Inventory Feature
 * Foundation.
 *
 * Scope: canonical wire aliases only (no view models yet — stock,
 * reservation, and adjustment views arrive with Sub-Phases 13.9–13.10,
 * which own their mappers). The single declaration site stays
 * `@flux/models` (13.1 audit mirrors) — aliases here, never
 * re-declarations, so no contract drift is possible.
 *
 * Backend-authoritative data rule (binds every later slice):
 * `availableQuantity` echoes verbatim for display (never an input to
 * math, never recomputed client-side as `onHand - reserved`), money
 * never appears on this surface, and reservation ids are never
 * enumerable (single-resource lookups only — there is no stock list
 * and no reservation list endpoint). Pure types: no Angular, no HTTP,
 * no browser APIs — SSR-safe.
 */

import type {
  AdjustStockRequest,
  AdminReservation,
  AdminReservationLookupQuery,
  AdminStockItem,
  AdminStockLookupQuery,
  CreateInventoryItemRequest,
  InventoryItemResponse,
  InventoryReservationResponse,
  InventoryReservationStatus,
} from '@flux/models';

/** One admin stock row (canonical wire shape, never re-declared). */
export type AdminStockRow = InventoryItemResponse;

/** One admin reservation record (canonical wire shape, never re-declared). */
export type AdminReservationRow = InventoryReservationResponse;

/** `POST /inventory` body (canonical wire shape, never re-declared). */
export type AdminStockCreateBody = CreateInventoryItemRequest;

/**
 * `PATCH /inventory/{sku}` body — additive only (`1..max`; consumption
 * happens via reservation commit, never via this call).
 */
export type AdminStockAdjustBody = AdjustStockRequest;

/** Single-SKU lookup query (no paging/filter/sort params exist). */
export type AdminStockQuery = AdminStockLookupQuery;

/** Single-reservation lookup query (ids never enumerable). */
export type AdminReservationQuery = AdminReservationLookupQuery;

/** Canonical stock payload (backend-issued facts, display only). */
export type AdminStockPayload = AdminStockItem;

/** Canonical reservation payload (backend-issued facts, display only). */
export type AdminReservationPayload = AdminReservation;

// ---------------------------------------------------------------------------
// SKU input normalization (13.9)
// ---------------------------------------------------------------------------

/**
 * Normalizes raw SKU editor text for transport (trimmed + uppercased,
 * mirroring the documented backend normalization so lookups are
 * deterministic regardless of casing or padding). Transport hygiene
 * only: the backend normalizes again idempotently and stays
 * authoritative for shape rules (`^[A-Z0-9-_.]+$`, at most 64 chars)
 * and existence. Pure — throws nothing.
 */
export function normalizeSkuInput(value: string | null | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// Reservation status display (13.10)
// ---------------------------------------------------------------------------

/** Translation key + badge variant behind one reservation status value. */
export interface ReservationBadgeDisplay {
  /** Key into the inventory bundle (`inventory.reservationStatus.*`). */
  readonly labelKey: string;
  /** Badge emphasis. */
  readonly variant: 'neutral' | 'success' | 'warning' | 'info';
}

/**
 * Display behind a reservation status wire value (`Pending |
 * Committed | Released | Expired`, numbers on the wire). Unknown future
 * values fall back to the `unknown` entry (render `Unknown (<n>)` —
 * see `ENUM_REFERENCE.md` §8). The lifecycle itself stays entirely
 * backend-owned: this mapper names states for display only and never
 * gates transitions. Pure — throws nothing.
 */
export function reservationStatusDisplay(
  status: InventoryReservationStatus | number,
): ReservationBadgeDisplay {
  switch (status) {
    case 0:
      return { labelKey: 'inventory.reservationStatus.pending', variant: 'info' };
    case 1:
      return { labelKey: 'inventory.reservationStatus.committed', variant: 'success' };
    case 2:
      return { labelKey: 'inventory.reservationStatus.released', variant: 'neutral' };
    case 3:
      return { labelKey: 'inventory.reservationStatus.expired', variant: 'warning' };
    default:
      return { labelKey: 'inventory.reservationStatus.unknown', variant: 'neutral' };
  }
}

// ---------------------------------------------------------------------------
// Adjustment body mapper (13.10)
// ---------------------------------------------------------------------------

/**
 * Projects editor quantity text into the additive adjustment body.
 * No range is enforced here beyond parsing: `1..max` stays
 * backend-owned (`400` on violation surfaces through the form
 * channels). Pure — throws nothing.
 */
export function toAdjustStockRequest(quantity: string | null | undefined): AdjustStockRequest {
  return { quantity: Number((quantity ?? '').trim()) };
}
