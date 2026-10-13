/**
 * Storefront post-payment synchronization models for Sub-Phase 10.6 —
 * Order History & Post-Payment Synchronization.
 *
 * Scope: `docs/phases/PHASE_10_ORDERS_CUSTOMER_ACCOUNT.md` §10.6.2
 * (polling budget and failure classification only — no timers, no HTTP,
 * no state implementation).
 *
 * Source of truth: the saga-owned eventual consistency behind
 * `POST /orders/checkout` (`Pending` → `Confirmed | Cancelled`
 * asynchronously — poll `GET /orders/{id}`) and
 * `docs/frontend-contract/PAYMENT_INTEGRATION_NOTES.md` §2 (the
 * order-poll proxy). Polling is REQUIRED backend behavior, not
 * speculation: payment completion and order finalization are never
 * observable as a single synchronous operation.
 *
 * Budget (`ORDER_SYNC_POLL_INTERVAL_MS` × `ORDER_SYNC_MAX_ATTEMPTS`):
 * first read immediate, then one read per interval — a bounded,
 * overlapping-free cadence (single in-flight request via `exhaustMap`
 * in the state). Exhaustion is NOT failure: the last settled order
 * stays on screen with a manual recheck affordance.
 *
 * Failure classification (status-first, never message text — the wire
 * carries no codes):
 * - stopping — backend decisions a retry cannot change within this
 *   flow: `401` (anonymous/expired session → unauthorized view),
 *   `403` (denied → forbidden view), `404` (unknown-or-foreign id →
 *   not-found view). Surfaced into the order error slot at once.
 * - transient — transport loss, overload, and server faults: the tick
 *   is skipped and polling continues with the last settled order left
 *   untouched.
 *
 * Pure types + pure functions: no Angular, no HTTP, no storage —
 * SSR-safe.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.6.1 history — no backend history contract exists (see
 *   `ORDERS_HISTORY_SUPPORTED`), so no timeline shape lives here.
 * - 10.7 — no routing or guard changes.
 */

import { isTerminalOrder } from './orders.models';

/**
 * Sync tick interval: one order re-read per 2s (matches the §9.9
 * payment readiness cadence — gentle on the backend, responsive
 * enough for saga timing measured in seconds).
 */
export const ORDER_SYNC_POLL_INTERVAL_MS = 2000 as const;

/**
 * Maximum sync ticks per `startSync` entry (first read immediate, then
 * one per interval — 60s total budget). Exhaustion stops the loop and
 * surfaces the manual recheck; it never fabricates a terminal state.
 */
export const ORDER_SYNC_MAX_ATTEMPTS = 30 as const;

/**
 * Whether a settled order needs synchronization: known and
 * non-terminal (`Pending`). Unknown future strings count as
 * non-terminal (keep polling — see `ENUM_REFERENCE.md` §8); terminal
 * states (`Cancelled | Confirmed`) never poll. Pure — throws nothing.
 */
export function needsOrderSync(status: string): boolean {
  return !isTerminalOrder(status);
}

/**
 * Whether a sync failure must stop the loop at once (`401 | 403 |
 * `404` — auth, denial, missing). Everything else (transport loss,
 * overload, server faults, non-`ApiError` throwables) is transient:
 * the tick is skipped and polling continues. Pure — throws nothing,
 * performs no HTTP.
 */
export function isSyncStoppingFailure(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }
  const status = readStatus(error);
  return status === 401 || status === 403 || status === 404;
}

/** Whether the value is a non-null object (failure-shape probe). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Best-effort numeric `status` read off a failure shape (`NaN` when absent). */
function readStatus(failure: Record<string, unknown>): number {
  return typeof failure['status'] === 'number' ? failure['status'] : NaN;
}
