/**
 * Admin Dashboard feature models for Supplement S1, Step S1.10 — Admin
 * Dashboard (Real API).
 *
 * Scope: canonical wire aliases for the dashboard snapshot only. The
 * single declaration site stays `@flux/models` (S1.2 `dashboard`
 * mirrors) — aliases here, never re-declarations, so no contract drift
 * is possible.
 *
 * Backend-authoritative data rule (binds every later slice): every
 * section echoes verbatim for display (never an input to math, never
 * recomputed client-side), money echoes verbatim (no totals math),
 * order `status` never implies payment `status` (and vice versa), and
 * `recentOrders` drill-down links route to the existing admin order
 * details (`/orders/:id`) — no parallel detail view ships. Pure types +
 * pure functions: no Angular, no HTTP, no browser APIs — SSR-safe.
 */

import type {
  AdminDashboardResponse,
  AdminOrderCountsResponse,
  CatalogCountsResponse,
  DashboardQuery,
  InventoryCountsResponse,
  OrderSummaryResponse,
  PaymentAdminStatsResponse,
  UserAdminCountsResponse,
} from '@flux/models';

export type {
  AdminDashboardResponse,
  AdminOrderCountsResponse,
  CatalogCountsResponse,
  DashboardQuery,
  InventoryCountsResponse,
  OrderSummaryResponse,
  PaymentAdminStatsResponse,
  UserAdminCountsResponse,
};

/**
 * One dashboard snapshot (`GET /admin/dashboard`, adaptive: any
 * authenticated JWT, nullable per-permission sections — `null` means
 * not entitled, `0` / `[]` means entitled but empty).
 */
export type DashboardSnapshot = AdminDashboardResponse;

/** One recent order behind the drill-down widget (newest 5, verbatim). */
export type DashboardRecentOrder = OrderSummaryResponse;

/**
 * Whether the snapshot carries recent orders to drill into. Pure —
 * throws nothing.
 */
export function hasRecentOrders(snapshot: DashboardSnapshot | null | undefined): boolean {
  return (snapshot?.recentOrders.length ?? 0) > 0;
}

/**
 * Whether the snapshot carries recent payments to drill into
 * (`payments.read` holders only — stats-only viewers get `[]`).
 * Pure — throws nothing.
 */
export function hasRecentPayments(snapshot: DashboardSnapshot | null | undefined): boolean {
  return (snapshot?.recentPayments.length ?? 0) > 0;
}

/**
 * Whether the snapshot carries recent users to drill into
 * (`users.read` holders only). Pure — throws nothing.
 */
export function hasRecentUsers(snapshot: DashboardSnapshot | null | undefined): boolean {
  return (snapshot?.recentUsers.length ?? 0) > 0;
}

/**
 * Whether the snapshot carries any daily-series points. Pure —
 * throws nothing.
 */
export function hasDailySeries(snapshot: DashboardSnapshot | null | undefined): boolean {
  return (snapshot?.dailySeries.length ?? 0) > 0;
}

/**
 * Whether the snapshot carries at least one entitled section (the
 * honest-empty-dashboard gate: all sections `null` / absent renders
 * the empty state instead of the grid). Pure — throws nothing.
 */
export function hasEntitledSections(snapshot: DashboardSnapshot | null | undefined): boolean {
  if (snapshot === null || snapshot === undefined) {
    return false;
  }
  return [
    snapshot.orders,
    snapshot.payments,
    snapshot.inventory,
    snapshot.catalog,
    snapshot.users,
  ].some((section) => section !== null && section !== undefined);
}
