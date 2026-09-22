/**
 * Storefront status presentation models for Sub-Phase 10.5 — Order &
 * Payment Status Experience.
 *
 * Scope: `docs/phases/PHASE_10_ORDERS_CUSTOMER_ACCOUNT.md` §10.5 (pure
 * status → tone mappings only — no components, no labels, no pages).
 *
 * Source of truth: `docs/frontend-contract/ENUM_REFERENCE.md` §§3/5
 * (`OrderStatus` and `PaymentStatus` travel as STRINGS on the wire).
 * Backend values stay authoritative: these maps assign PRESENTATION
 * tones only — never transitions, never derivations. Unknown or future
 * backend strings fall back to the `neutral` tone with the raw value
 * rendered verbatim by the badge components (forward compatibility,
 * `ENUM_REFERENCE.md` §8).
 *
 * Decoupling rule (§10.5 — the core constraint): order and payment
 * statuses are INDEPENDENT concepts with SEPARATE maps. A payment-only
 * value (e.g. `Succeeded`) maps to nothing on the order side (falls
 * back to `neutral`), and an order-only value (e.g. `Confirmed`) maps
 * to nothing on the payment side. Nothing here reads both concepts,
 * and nothing infers one status from the other.
 *
 * Pure types + pure functions: no Angular, no HTTP, no storage —
 * SSR-safe.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.6 — no history timeline or post-payment polling state.
 */

import type { OrderStatus, PaymentStatus } from './orders.models';

/**
 * Presentation tones for status badges. Visual semantics only — they
 * carry no business meaning and must never drive workflow decisions:
 * - `neutral` — unknown/future values and inherently neutral states.
 * - `info` — in-flight states (serve the spinner-adjacent reading).
 * - `success` — terminal success states.
 * - `warning` — compensation states needing customer attention.
 * - `danger` — terminal failure states.
 */
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

/**
 * Order status → presentation tone. Covers the full backend set
 * (`Pending | Cancelled | Confirmed`); anything else falls back to
 * `neutral` via `orderStatusToneOf`.
 */
export const ORDER_STATUS_TONES: Record<OrderStatus, StatusTone> = {
  Pending: 'info',
  Cancelled: 'danger',
  Confirmed: 'success',
};

/**
 * Payment status → presentation tone. Covers the full backend set
 * (`Pending`, `Processing`, `Succeeded`, `Failed`, `Cancelled`,
 * `Refunded`); anything else falls back to `neutral` via
 * `paymentStatusToneOf`.
 */
export const PAYMENT_STATUS_TONES: Record<PaymentStatus, StatusTone> = {
  Pending: 'info',
  Processing: 'info',
  Succeeded: 'success',
  Failed: 'danger',
  Cancelled: 'neutral',
  Refunded: 'warning',
};

/**
 * Resolves an order status string to its presentation tone. Unknown or
 * future backend values (including payment-only values such as
 * `Succeeded`) resolve to `neutral` — never to another concept's tone.
 * Pure — throws nothing.
 */
export function orderStatusToneOf(status: string): StatusTone {
  return (ORDER_STATUS_TONES as Record<string, StatusTone>)[status] ?? 'neutral';
}

/**
 * Resolves a payment status string to its presentation tone. Unknown or
 * future backend values (including order-only values such as
 * `Confirmed`) resolve to `neutral` — never to another concept's tone.
 * Pure — throws nothing.
 */
export function paymentStatusToneOf(status: string): StatusTone {
  return (PAYMENT_STATUS_TONES as Record<string, StatusTone>)[status] ?? 'neutral';
}
