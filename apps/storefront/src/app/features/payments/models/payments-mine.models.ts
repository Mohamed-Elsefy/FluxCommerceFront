/**
 * Storefront Payments-Mine feature models for Supplement S1, Step S1.9 —
 * Payments: Mine + Admin + Stats (storefront slice).
 *
 * Scope: the caller-owned `GET /api/payments/mine` list only (paged,
 * newest-first, paging plus an optional `status` filter — no other
 * filters, no sorting, no history timeline).
 *
 * Source of truth (audited — see the tables below):
 * - `docs/frontend-contract/API_CONTRACT.md` §6 (`GET /api/payments/mine`).
 * - `docs/frontend-contract/DTO_REFERENCE.md` §6 (`PaymentAdminResponse`).
 * - `docs/frontend-contract/ENUM_REFERENCE.md` §5 (payment statuses,
 *   strings on the wire).
 * - `docs/frontend-contract/ERROR_CATALOG.md` §6 (`Payment.ValidationFailed`).
 * - `docs/frontend-contract/PAGINATION_CONVENTION.md` (paging envelope).
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - Canonical wire mirrors live in `@flux/models` and stay the single
 *   declaration site — `PaymentAdminResponse` and `PaymentsMineQuery` are
 *   aliases, never re-declared, so no contract drift is possible.
 * - This module owns the feature-local additions: pagination bounds, the
 *   status-filter constants, and pure structural guards.
 *
 * Backend-authoritative data rule: this module performs NO totals
 * computation, NO status derivation (payment status never implies order
 * status and vice versa), and NO business transitions — backend values
 * echo verbatim for display only.
 *
 * Explicitly out of scope (must not appear here):
 * - Payment history/timeline (no backend contract — `PAYMENTS_HISTORY_SUPPORTED`
 *   pins the gap, `false`).
 * - Payment confirmation (provider-side via Stripe.js, owned by the
 *   payment flow — the mine list never confirms cards).
 * - Admin reads (`GET /admin/payments*` — admin app only).
 *
 * This file is pure types + pure functions: no Angular imports, no
 * `HttpClient`, no browser APIs. Every helper is SSR-safe, throws
 * nothing, and performs no HTTP.
 */

import type {
  PaymentAdminResponse,
  PaymentStatus,
  PaymentsMineQuery as CanonicalPaymentsMineQuery,
} from '@flux/models';
import { isValidPaymentsMineQuery as isCanonicalPaymentsMineQuery } from '@flux/models';

/**
 * Frontend payment-mine row. Alias of the canonical
 * `PaymentAdminResponse` (`GET /api/payments/mine` page item) —
 * re-exported, not re-declared.
 */
export type PaymentMineRow = PaymentAdminResponse;

/**
 * Payments-mine list query (`GET /api/payments/mine?pageNumber=&pageSize=&status=`).
 * Paging fields optional and 1-based; omitted values resolve to backend
 * defaults (`1/20`). Fixed newest-first ordering — no sort params.
 * `status` filters caller-owned payments (case-insensitive; unknown →
 * backend `400 Payment.ValidationFailed`).
 */
export type PaymentsMineListQuery = CanonicalPaymentsMineQuery;

/** `GET /api/payments/mine` default page. */
export const PAYMENTS_MINE_DEFAULT_PAGE_NUMBER = 1;

/** `GET /api/payments/mine` default size. */
export const PAYMENTS_MINE_DEFAULT_PAGE_SIZE = 20;

/** `GET /api/payments/mine` minimum page. */
export const PAYMENTS_MINE_MIN_PAGE_NUMBER = 1;

/** `GET /api/payments/mine` minimum size. */
export const PAYMENTS_MINE_MIN_PAGE_SIZE = 1;

/** `GET /api/payments/mine` maximum size. */
export const PAYMENTS_MINE_MAX_PAGE_SIZE = 100;

/** Closed payment-status set for the mine filter (strings on the wire). */
export const PAYMENTS_MINE_STATUSES: readonly PaymentStatus[] = [
  'Pending',
  'Processing',
  'Succeeded',
  'Failed',
  'Cancelled',
  'Refunded',
];

/**
 * Whether `value` names a known payment status. Unknown future strings
 * return `false` (render raw, treat as non-terminal). Pure — throws
 * nothing.
 */
export function isPaymentsMineStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && (PAYMENTS_MINE_STATUSES as readonly string[]).includes(value);
}

/**
 * Structural pre-check for a payments-mine query against the contract
 * bounds. Never a substitute for backend validation
 * (`Payment.ValidationFailed` stays authoritative) — it only keeps
 * unusable input from reaching the call. Pure — throws nothing.
 */
export function isValidPaymentsMineListQuery(
  query: PaymentsMineListQuery | null | undefined,
): boolean {
  return isCanonicalPaymentsMineQuery(query);
}

// ---------------------------------------------------------------------------
// Payment history support pin (audited gap — no backend history contract)
// ---------------------------------------------------------------------------

/**
 * Whether the backend exposes payment history: `false`. No
 * history/timeline endpoint exists and no history fields travel on any
 * payment payload, so no timeline is fabricated. This constant pins the
 * gap so later work never invents history from frontend state changes.
 */
export const PAYMENTS_HISTORY_SUPPORTED = false as const;

/**
 * Whether payment history display is supported. Always `false` in the
 * current contract. Pure — throws nothing.
 */
export function isPaymentsHistorySupported(): false {
  return PAYMENTS_HISTORY_SUPPORTED;
}
