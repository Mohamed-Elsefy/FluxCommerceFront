/**
 * Payment lifecycle machine for Sub-Phase 9.4 — Lifecycle Model
 * (extracted from `payment-state.ts`, Refactoring Phase E: pure
 * transition table + guard + context shapes, no signals, no transport).
 *
 * Source of truth: `docs/phases/PHASE_9_PAYMENTS.md` §§9.4/9.7
 * (lifecycle diagram, outcome mapping). The `PaymentState` class owns
 * the signals and guarded actions; everything here is the
 * table-driven permission layer it consults (`canTransition…` fails
 * closed; every action returns acceptance). Pure — throws nothing, no
 * Angular, no HTTP, SSR-safe.
 */

import type { ApiError } from '@flux/api';
import type { PaymentStatus } from '@flux/models';

/**
 * Payment lifecycle stage for the UI. Every stage the §9.4 diagram
 * names, plus `cancelled`:
 *
 * - `idle` — never entered, blocked at entry, or fully reset.
 * - `initializing` — initialization requested, backend intent not yet
 *   available (9.6 drives the §9.3 service around this stage).
 * - `ready` — initialized with intent context (payment id + runtime
 *   secret); submission allowed. NEVER payment success (see the
 *   `Initialized ≠ Succeeded` rule below).
 * - `processing` — confirmation submitted, outcome outstanding.
 * - `succeeded` — provider-reported payment success (Stripe-side
 *   fact — never FluxCommerce order finality, which arrives via 9.8
 *   status reads).
 * - `failed` — terminal failure (init, confirmation, or pending
 *   resolution).
 * - `pending` — non-terminal wait (async saga/webhook lag, 3-DS
 *   indirection); resolves to `succeeded` or `failed`.
 * - `cancelled` — terminal cancellation (customer or provider).
 */
export type PaymentLifecycle =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'pending'
  | 'cancelled';

/**
 * Valid lifecycle edges. The §9.4 core chain
 * (`idle → initializing → ready → processing → succeeded`) plus the
 * §9.4 alternative transitions, plus disciplined re-entry edges
 * (`failed → initializing`, `cancelled → initializing`) for the §9.9
 * safe-retry paths — re-entry PERMISSION lives here, retry EXECUTION
 * lives in 9.6/9.9 — plus the §9.8 backend-truth override edges
 * (`pending → cancelled`, `succeeded → failed`, `succeeded → cancelled`):
 * a provider-reported outcome is never final proof, so an authoritative
 * backend verdict always wins, even out of a terminal stage.
 */
export const PAYMENT_LIFECYCLE_TRANSITIONS: Record<PaymentLifecycle, readonly PaymentLifecycle[]> =
  {
    idle: ['initializing'],
    initializing: ['ready', 'failed'],
    ready: ['processing', 'failed'],
    processing: ['succeeded', 'failed', 'pending', 'cancelled'],
    succeeded: ['failed', 'cancelled'],
    failed: ['initializing'],
    pending: ['succeeded', 'failed', 'cancelled'],
    cancelled: ['initializing'],
  };

/**
 * Whether `to` is a legal move from `from`. Unknown stages (future
 * backend states, garbage input) are never legal — fail closed. Pure —
 * throws nothing.
 */
export function canTransitionPaymentLifecycle(
  from: PaymentLifecycle | string | null | undefined,
  to: PaymentLifecycle | string | null | undefined,
): boolean {
  if (typeof from !== 'string' || typeof to !== 'string') {
    return false;
  }
  return (PAYMENT_LIFECYCLE_TRANSITIONS[from as PaymentLifecycle] ?? []).includes(
    to as PaymentLifecycle,
  );
}

/**
 * Payment context tracked by the state (the §9.4 required set):
 * - `orderId` — the created order being paid (Phase 8 handoff).
 * - `paymentId` — the `Payment` identity for status reads (`null`
 *   until initialization provides it).
 * - `clientSecret` — runtime-only Stripe confirmation secret (`null`
 *   until initialization provides it; in-memory only).
 * - `paymentStatus` — backend facts only (`null` until a backend status
 *   is known; client-side outcomes never write here).
 * - `statusError` — normalized API/provider failure, if any.
 */
export interface PaymentStateContext {
  readonly orderId: string | null;
  readonly paymentId: string | null;
  readonly clientSecret: string | null;
  readonly paymentStatus: PaymentStatus | null;
  readonly statusError: ApiError | null;
}

/** Intent context recorded when initialization provides it (9.6 supply). */
export interface PaymentInitializationContext {
  readonly paymentId: string;
  readonly clientSecret: string;
  readonly paymentStatus: PaymentStatus;
}

/**
 * Client-synthesized code for provider-reported declines (card rejected
 * at confirmation time). A stable PascalCase single (like `NetworkError`)
 * that can never collide with dotted backend codes; the §9.10
 * localization pass maps it to user-facing copy. The provider's decline
 * text travels as the message (already displayable).
 */
export const PAYMENT_DECLINED_CODE = 'PaymentDeclined';
