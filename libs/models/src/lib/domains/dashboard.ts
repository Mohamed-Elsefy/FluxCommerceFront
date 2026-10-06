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
import type { PaymentAdminResponse, PaymentAdminStatsResponse } from './payments';
import type { InventoryCountsResponse } from './inventory';
import type { UserAdminResponse, UserAdminCountsResponse } from './identity';

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
 * Daily revenue slice inside one `dailySeries` point (host-local
 * composition): Succeeded-only per-currency amounts. Refunds stay in
 * `payments.refundedTotalsByCurrency`, never netted server-side.
 */
export interface DailyRevenueResponse {
  currency: string;
  amount: number;
}

/**
 * One trailing-day point of `dailySeries` (host-local composition):
 * UTC `"yyyy-MM-dd"` date (invariant — never localized), order count,
 * and Succeeded-only revenue. Points run oldest-first, zero-filled.
 */
export interface DailySeriesPointResponse {
  date: string;
  orders: number;
  revenue: DailyRevenueResponse[];
}

/**
 * `GET /admin/dashboard` payload: per-module overviews plus the newest
 * 5 drill-down widgets plus the trailing-`days` series. Object
 * sections are nullable — render only non-`null` sections (S2.3).
 * `recentPayments` needs `payments.read` (stats-only viewers get the
 * stats but no list); `recentUsers` needs `users.read`; `dailySeries`
 * is empty unless `orders.read` or `payments.read`/`stats` (the
 * unauthorized side is zeroed, shape stable).
 */
export interface AdminDashboardResponse {
  orders?: AdminOrderCountsResponse | null;
  payments?: PaymentAdminStatsResponse | null;
  inventory?: InventoryCountsResponse | null;
  catalog?: CatalogCountsResponse | null;
  users?: UserAdminCountsResponse | null;
  recentOrders: OrderSummaryResponse[];
  recentPayments: PaymentAdminResponse[];
  recentUsers: UserAdminResponse[];
  dailySeries: DailySeriesPointResponse[];
}

/**
 * `GET /admin/dashboard` query: `lowStockThreshold?` (default 5,
 * inclusive available ceiling for the inventory section) and `days?`
 * (default 30, trailing calendar days for the series, `1..90`).
 * Negative threshold or out-of-range `days` → `400` (rejected
 * regardless of entitlement).
 */
export interface DashboardQuery {
  readonly lowStockThreshold?: number;
  readonly days?: number;
}

/**
 * Structural pre-check for a dashboard query. Pure — throws nothing.
 */
export function isValidDashboardQuery(query: DashboardQuery | null | undefined): boolean {
  if (query === null || query === undefined) {
    return true;
  }
  const { lowStockThreshold, days } = query;
  if (lowStockThreshold !== undefined && lowStockThreshold !== null) {
    if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
      return false;
    }
  }
  if (days !== undefined && days !== null) {
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      return false;
    }
  }
  return true;
}
