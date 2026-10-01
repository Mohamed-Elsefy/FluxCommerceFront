/**
 * Dashboard contract mirrors for Supplement S1, Step S1.2.
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
 *   never re-declared).
 * - `recentOrders` is newest-first, fixed at 5 (full paging via the
 *   `[Route admin/orders]` list in Step S1.8).
 * - Requires `dashboard.read` (SuperAdmin passes); negative
 *   `lowStockThreshold` → `400 ValidationFailed`.
 * - First failing section's error surfaces (`400`/`404` as mapped).
 */

import type { AdminOrderCountsResponse, OrderSummaryResponse } from './orders';
import type { PaymentAdminStatsResponse } from './payments';
import type { InventoryCountsResponse } from './inventory';
import type { UserAdminCountsResponse } from './identity';

/**
 * `GET /admin/dashboard` payload: per-module overviews plus the newest 5
 * orders for the drill-down widget.
 */
export interface AdminDashboardResponse {
  orders: AdminOrderCountsResponse;
  payments: PaymentAdminStatsResponse;
  inventory: InventoryCountsResponse;
  users: UserAdminCountsResponse;
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
