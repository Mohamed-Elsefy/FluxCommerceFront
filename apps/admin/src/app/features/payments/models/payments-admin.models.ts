/**
 * Admin Payments feature models for Supplement S1, Step S1.9 —
 * Payments: Mine + Admin + Stats (admin slice).
 *
 * Scope: canonical wire aliases plus the admin list/stats/details
 * projections only. The single declaration site stays `@flux/models`
 * (S1.1/S1.2 audit mirrors) — aliases here, never re-declarations, so
 * no contract drift is possible.
 *
 * Backend-authoritative data rule (binds every later slice):
 * `totalCount` echoes verbatim for display (never an input to math,
 * never recomputed client-side), money echoes verbatim (no totals math,
 * no float-math helpers), payment `status` never implies order `status`
 * (and vice versa), and no customer-identity resolution exists (no
 * `userId`/email on the payment payload — `customerId` is an opaque
 * filter key only). Pure types + pure functions: no Angular, no HTTP,
 * no browser APIs — SSR-safe.
 */

import type { PagedResult } from '@flux/api';
import type {
  AdminPaymentListQuery,
  PaymentAdminResponse,
  PaymentAdminStatsResponse,
} from '@flux/models';
import type { BadgeVariant } from '@flux/ui';

/** One admin payment row (canonical wire shape, never re-declared). */
export type AdminPaymentRow = PaymentAdminResponse;

/**
 * One admin payment details record (canonical wire shape, never
 * re-declared). Details state and UI read through this alias; the
 * mapping boundary carries no `clientSecret` (no such field exists on
 * the admin reads — and any live secret is never stored, rendered, or
 * logged anywhere in this feature).
 */
export type AdminPaymentDetailsRecord = PaymentAdminResponse;

/** Paged admin payment result (`GET /admin/payments`, platform-wide, newest-first). */
export type AdminPaymentPage = PagedResult<AdminPaymentRow>;

/**
 * Payments overview: the backend-issued stats behind the admin landing
 * page (`GET /admin/payments/stats`). Every bucket echoes verbatim for
 * display (never an input to math).
 */
export type PaymentsOverview = PaymentAdminStatsResponse;

/**
 * Admin payment-list query. `GET /admin/payments` accepts ONLY paging
 * plus the contract filters (`status`/`orderId`/`customerId`/`from`/
 * `to` — no `sortBy`, no other filters). Unknown `status` or `from >
 * to` → backend `400 Payment.ValidationFailed`. Nulls/omission mean
 * "server default" (`pageNumber 1`, `pageSize 20`).
 */
export type AdminPaymentsQuery = AdminPaymentListQuery;

// ---------------------------------------------------------------------------
// Payment status display (S1.9)
// ---------------------------------------------------------------------------

/** Translation key + badge variant behind one payment status value. */
export interface AdminPaymentBadgeDisplay {
  /** Key into the payments bundle (`payments.status.*`). */
  readonly labelKey: string;
  /** Badge emphasis (maps 1:1 onto the shared `flux-badge` variants). */
  readonly variant: BadgeVariant;
}

/**
 * Display behind a payment status wire value (`Pending | Processing |
 * Succeeded | Failed | Cancelled | Refunded` — strings on the wire, see
 * `ENUM_REFERENCE.md` §5). Unknown future values fall back to the
 * `unknown` entry (render the raw value verbatim with the `neutral`
 * tone — see `ENUM_REFERENCE.md` §8). Order-only values (e.g.
 * `Confirmed`) map to nothing here and fall back the same way: order
 * and payment statuses stay independent, and nothing infers one from
 * the other. The single mapping site for admin payment status — no
 * scattered string comparisons elsewhere. Pure — throws nothing.
 *
 * Failure presentation rule (S1.9 — the core constraint): the backend
 * exposes no failure reason, message, or code on the payment payload —
 * the `Failed` status itself is the complete backend-supplied failure
 * information. This map renders `Failed` with the `danger` tone and
 * never invents a reason.
 */
export function adminPaymentStatusDisplay(status: string): AdminPaymentBadgeDisplay {
  switch (status) {
    case 'Pending':
      return { labelKey: 'payments.status.pending', variant: 'info' };
    case 'Processing':
      return { labelKey: 'payments.status.processing', variant: 'info' };
    case 'Succeeded':
      return { labelKey: 'payments.status.succeeded', variant: 'success' };
    case 'Failed':
      return { labelKey: 'payments.status.failed', variant: 'danger' };
    case 'Cancelled':
      return { labelKey: 'payments.status.cancelled', variant: 'neutral' };
    case 'Refunded':
      return { labelKey: 'payments.status.refunded', variant: 'warning' };
    default:
      return { labelKey: 'payments.status.unknown', variant: 'neutral' };
  }
}

// ---------------------------------------------------------------------------
// Payment history support (still unsupported — S1.9 pin)
// ---------------------------------------------------------------------------

/**
 * Whether the backend exposes a payment-history capability: always
 * `false` in the current contract. No history, timeline, or
 * transition-log endpoint exists, and no payment payload carries
 * transition records — so there is nothing to integrate and no history
 * UI ships.
 *
 * Consequences (pinned, test-guarded):
 * - No history-shaped data-access method exists (see the read-only
 *   boundary spec in `payments-admin-api.service.spec.ts`).
 * - No history is simulated from unrelated frontend state.
 * - A future backend history endpoint flips this pin and owns its own
 *   slice — until then, later work must not invent one.
 */
export const ADMIN_PAYMENT_HISTORY_SUPPORTED = false as const;

/**
 * Whether payment history can be displayed. Always `false` today — see
 * `ADMIN_PAYMENT_HISTORY_SUPPORTED`. Pure — throws nothing.
 */
export function isAdminPaymentHistorySupported(): false {
  return ADMIN_PAYMENT_HISTORY_SUPPORTED;
}
