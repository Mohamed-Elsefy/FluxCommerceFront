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
import type {
  OrderDetailsResponse,
  OrderSummaryResponse,
  PaymentInitializationResult,
  PaymentResponse,
} from '@flux/models';
import type { BadgeVariant } from '@flux/ui';

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

// ---------------------------------------------------------------------------
// Order status display (14.4)
// ---------------------------------------------------------------------------

/** Translation key + badge variant behind one order status value. */
export interface OrderBadgeDisplay {
  /** Key into the orders bundle (`orders.status.*`). */
  readonly labelKey: string;
  /** Badge emphasis (maps 1:1 onto the shared `flux-badge` variants). */
  readonly variant: BadgeVariant;
}

/**
 * Display behind an order status wire value (`Pending | Cancelled |
 * Confirmed` — strings on the wire, see `ENUM_REFERENCE.md` §3).
 * Unknown future values fall back to the `unknown` entry (render the raw
 * value verbatim with the `neutral` tone — see `ENUM_REFERENCE.md` §8).
 * Payment-only values (e.g. `Succeeded`) map to nothing here and fall
 * back the same way: order and payment statuses stay independent, and
 * nothing infers one from the other. The single mapping site for admin
 * order status — no scattered string comparisons elsewhere. Pure —
 * throws nothing.
 */
export function orderStatusDisplay(status: string): OrderBadgeDisplay {
  switch (status) {
    case 'Pending':
      return { labelKey: 'orders.status.pending', variant: 'info' };
    case 'Confirmed':
      return { labelKey: 'orders.status.confirmed', variant: 'success' };
    case 'Cancelled':
      return { labelKey: 'orders.status.cancelled', variant: 'danger' };
    default:
      return { labelKey: 'orders.status.unknown', variant: 'neutral' };
  }
}

// ---------------------------------------------------------------------------
// Order payment view (14.6)
// ---------------------------------------------------------------------------

/**
 * Admin order payment view: the backend-supported payment facts behind
 * the order details payment section. Display only — no verification
 * semantics, no lifecycle, no provider interaction.
 *
 * Sensitive-data rule (binds every later slice): this shape carries NO
 * `clientSecret`. The by-order read returns a live confirmation secret,
 * but the admin never confirms cards (no Stripe.js, no provider
 * integration — the secret exists for the customer checkout only), so
 * the mapper below drops it at the boundary: never stored, never
 * rendered, never logged.
 */
export interface OrderPaymentView {
  /** Backend payment status string verbatim (badge arrives in 14.7). */
  readonly status: string;
  /** Provider intent id (`pi_*`) for support correlation, when present. */
  readonly reference: string | null;
  /** Payment provider name (e.g. `stripe`), when present. */
  readonly provider: string | null;
  /** Backend-issued amount (display only — never an input to math). */
  readonly amount: number;
  /** Backend-issued ISO-4217 currency (display only). */
  readonly currency: string;
}

/**
 * Projects the two-step payment read (by-order initialization plus the
 * single payment read it links to) into the admin view. The
 * `clientSecret` is discarded here — the resulting object has no such
 * field by construction. Reference prefers the payment read's intent id
 * with the initialization reference as fallback. Pure — throws nothing,
 * performs no HTTP, verifies nothing.
 */
export function toOrderPaymentView(
  payment: PaymentResponse,
  init: PaymentInitializationResult,
): OrderPaymentView {
  return {
    status: payment.status,
    reference: payment.providerPaymentIntentId ?? init.paymentReference ?? null,
    provider: payment.provider ?? null,
    amount: payment.amount,
    currency: payment.currency,
  };
}
