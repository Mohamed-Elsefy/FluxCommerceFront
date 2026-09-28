/**
 * Admin Orders feature models for Sub-Phase 14.2 — Admin Orders Feature
 * Foundation.
 *
 * Scope: canonical wire aliases plus the landing-page overview
 * projection only (no list/detail/payment view models yet — the orders
 * list, filters, details, and payment presentation arrive with the
 * slices that own their pages in Sub-Phases 14.3–14.8, which own their
 * mappers). The single declaration site stays `@flux/models` (14.1
 * audit mirrors) — aliases here, never re-declarations, so no contract
 * drift is possible.
 *
 * Backend-authoritative data rule (binds every later slice):
 * `totalCount` echoes verbatim for display (never an input to math,
 * never recomputed client-side), money echoes verbatim (no `unitPrice *
 * quantity`, no subtotal math, no float-math helpers), order `status`
 * never implies payment `status` (and vice versa), and no
 * customer-identity resolution exists (no `userId`/`customerId`/email
 * on any order payload). Pure types + pure functions: no Angular, no
 * HTTP, no browser APIs — SSR-safe.
 */

import type { PagedResult } from '@flux/api';
import type { OrderDetailsResponse, OrderSummaryResponse } from '@flux/models';

/** One admin order row (canonical wire shape, never re-declared). */
export type AdminOrderRow = OrderSummaryResponse;

/**
 * One admin order details record (canonical wire shape, never
 * re-declared). Details state and UI arrive with Sub-Phase 14.5; the
 * alias pins the mapping boundary for the `getOrder` transport seam.
 */
export type AdminOrderDetailsRecord = OrderDetailsResponse;

/** Paged admin order result (`GET /orders`, caller-owned, newest-first). */
export type AdminOrderPage = PagedResult<AdminOrderRow>;

/**
 * Orders overview: the backend-issued total behind the admin landing
 * page. The count echoes `totalCount` verbatim (total caller-visible
 * matches across all pages, never page-relative — there is no
 * platform-wide admin list, see the 14.1 audit).
 */
export interface OrdersOverview {
  readonly orderTotal: number;
}

/** Zero overview (no caller-visible order data yet). */
export function emptyOrdersOverview(): OrdersOverview {
  return { orderTotal: 0 };
}

/**
 * Projects the overview out of a settled page. Pure — throws nothing,
 * performs no HTTP, derives no domain truth.
 */
export function toOrdersOverview(page: AdminOrderPage): OrdersOverview {
  return { orderTotal: page.totalCount };
}

/**
 * Whether the overview is empty (zero total — the landing page renders
 * its empty state instead of a zeroed overview card). Pure — throws
 * nothing.
 */
export function isOrdersOverviewEmpty(overview: OrdersOverview | null): boolean {
  return overview === null || overview.orderTotal <= 0;
}
