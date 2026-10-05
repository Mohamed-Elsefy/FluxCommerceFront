/**
 * Dashboard contract mirrors for Supplement S2, Step S2.2 (adaptive
 * dashboard — Phase 22 evolution).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §8 and
 * `docs/frontend-contract/DTO_REFERENCE.md` §8
 * (`FluxCommerce.Api.Models` host composition — no new persistence).
 *
 * Notes:
 * - `GET /admin/dashboard` composes the per-module contracts; every
 *   section shape is defined in its owning module section
 *   (`AdminOrderCountsResponse`, `PaymentAdminStatsResponse`,
 *   `InventoryCountsResponse`, `UserAdminCountsResponse` — aliased here,
 *   never re-declared) except `CatalogCountsResponse`, which is
 *   declared here (its only wire site).
 * - `recentOrders` is newest-first, fixed at 5 (full paging via the
 *   admin orders list); `[]` when unauthorized.
 * - Any authenticated JWT receives `200` (never a bare forbidden
 *   screen); every object section is `null` / absent when
 *   unauthorized (`null` = not entitled, `0` / `[]` = entitled but
 *   empty). Section gates: `orders` + `recentOrders` ← `orders.read`;
 *   `payments` ← `payments.read` or `payments.stats`; `inventory` ←
 *   `inventory.read`; `catalog` ← `catalog.manage`; `users` ←
 *   `SuperAdmin` role directly.
 * - Negative `lowStockThreshold` → `400 ValidationFailed`.
 * - First failing entitled section's error surfaces (`400`/`404` as
 *   mapped).
 */

import type { AdminOrderCountsResponse, OrderSummaryResponse } from './orders';
import type { PaymentAdminStatsResponse } from './payments';
import type { InventoryCountsResponse } from './inventory';
import type { UserAdminCountsResponse } from './identity';

/**
 * `GET /admin/dashboard` catalog section
 * (`DTO_REFERENCE.md` §8: all `int`, display only).
 */
export interface CatalogCountsResponse {
  totalProducts: number;
  activeProducts: number;
  totalCategories: number;
  totalVariants: number;
}

/**
 * `GET /admin/dashboard` payload: per-module overviews plus the newest 5
 * orders for the drill-down widget. Object sections are nullable —
 * render only non-`null` sections (S2.3).
 */
export interface AdminDashboardResponse {
  orders?: AdminOrderCountsResponse | null;
  payments?: PaymentAdminStatsResponse | null;
  inventory?: InventoryCountsResponse | null;
  catalog?: CatalogCountsResponse | null;
  users?: UserAdminCountsResponse | null;
  recentOrders: OrderSummaryResponse[];
}

/**
 * `GET /admin/dashboard` query: `lowStockThreshold?` (default 5,
 * inclusive available ceiling for the inventory section). Negative →
 * `400`.
 */
export interface DashboardQuery {
  readonly lowStockThreshold?: number;
}

/**
 * Structural pre-check for a dashboard query. Pure — throws nothing.
 */
export function isValidDashboardQuery(query: DashboardQuery | null | undefined): boolean {
  if (query === null || query === undefined) {
    return true;
  }
  const { lowStockThreshold } = query;
  if (lowStockThreshold === undefined || lowStockThreshold === null) {
    return true;
  }
  return Number.isInteger(lowStockThreshold) && lowStockThreshold >= 0;
}
