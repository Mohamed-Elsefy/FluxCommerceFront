/**
 * Feature-owned Payment state for Sub-Phase 9.4 — Payment State &
 * Lifecycle.
 *
 * Scope: `docs/phases/PHASE_9_PAYMENTS.md` §9.4 (state model and
 * lifecycle only — no API execution, no provider integration, no UI).
 *
 * Source of truth: `docs/phases/PHASE_9_PAYMENTS.md` §9.4 (lifecycle
 * diagram), the Sub-Phase 9.1 audit module (`@flux/models`
 * `payment-contract`: `PaymentStatus`, terminal/payable classifiers),
 * and `docs/frontend-contract/PAYMENT_INTEGRATION_NOTES.md` (backend
 * owns verification — client-side outcomes are never finality).
 *
 * State strategy (`ARCHITECTURE.md` §9 — smallest appropriate scope):
 *
 * ```text
 * PaymentPage / PaymentResultPage (9.2 shells — orchestration in 9.6+)
 *     ↓ PaymentState (this file — feature-owned, local Signals)
 *     ↓ PaymentApiService (../data-access — feature data access, §9.3)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Payments API
 * ```
 *
 * Locality rules enforced here (same convention as `CheckoutState`,
 * Phase 8.3, and `CartState`, Phase 7.3):
 * - `@Injectable()` WITHOUT `providedIn` — the state is feature-scoped
 *   and must be provided at the payments route level (route providers
 *   in `../payments.routes`). It is never a root singleton and never
 *   global state (no NgRx, no SignalStore, no shared library). Each
 *   payment route subtree gets its own instance.
 * - API state and UI state are separate signals by construction:
 *   `paymentStatus`/`statusError` hold backend facts only (set from API
 *   or provider outcomes by later sub-phases — this file never fetches);
 *   `lifecycle` drives shell visibility only and is moved solely
 *   through the guarded actions below. Neither side implicitly drives
 *   the other.
 * - The state never touches `HttpClient`, never builds URLs, never
 *   imports the §9.3 service (execution belongs to 9.6+ — this file
 *   stores outcomes, never produces them), and never imports Stripe or
 *   provider types.
 * - The `clientSecret` lives in a plain in-memory signal only — never
 *   persisted, never logged, never placed in URLs (the §9.1
 *   `FORBIDDEN_CLIENT_SECRET_SINKS` rule). No `localStorage`,
 *   `sessionStorage`, `TransferState`, `window`, or `document` anywhere
 *   in this file.
 * - Money is never derived here: backend amounts echo verbatim inside
 *   the §9.1 `Payment` payload (read in later sub-phases), never as
 *   state math.
 * - SSR-safe: signals only — no browser APIs.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.5 — no Stripe SDK, no Elements, no provider abstraction.
 * - 9.6 — no initialization execution (no service calls, no Elements
 *   mounting), no page orchestration.
 * - 9.7+ — no confirmation execution, polling, retry execution, or
 *   result handling.
 */

import { computed, Injectable, signal, type Signal } from '@angular/core';
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
 * - `succeeded` — backend-confirmed paid (`Succeeded`).
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
 * lives in 9.6/9.9. Terminal success resets only (`succeeded` has no
 * outgoing edge — a paid order must never re-enter the machine).
 */
export const PAYMENT_LIFECYCLE_TRANSITIONS: Record<PaymentLifecycle, readonly PaymentLifecycle[]> =
  {
    idle: ['initializing'],
    initializing: ['ready', 'failed'],
    ready: ['processing', 'failed'],
    processing: ['succeeded', 'failed', 'pending', 'cancelled'],
    succeeded: [],
    failed: ['initializing'],
    pending: ['succeeded', 'failed'],
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
 *   until initialization provides it; in-memory only, see file header).
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
 * Feature-scoped payment state. Provide at the payments route level —
 * never at root. All selectors are readonly signals; all transitions
 * are explicit guarded action calls driven by later sub-phases (9.6+).
 * Every action returns whether the transition was accepted — rejected
 * calls leave the state untouched (no partial writes, no silent
 * re-fires).
 */
@Injectable()
export class PaymentState {
  private readonly lifecycleStore = signal<PaymentLifecycle>('idle');
  private readonly orderIdStore = signal<string | null>(null);
  private readonly paymentIdStore = signal<string | null>(null);
  private readonly clientSecretStore = signal<string | null>(null);
  private readonly paymentStatusStore = signal<PaymentStatus | null>(null);
  private readonly statusErrorStore = signal<ApiError | null>(null);

  /** Lifecycle stage driving shell visibility (never set directly). */
  readonly lifecycle: Signal<PaymentLifecycle> = this.lifecycleStore.asReadonly();
  /** Created order being paid, if entered (`null` before entry). */
  readonly orderId: Signal<string | null> = this.orderIdStore.asReadonly();
  /** Payment identity for status reads, if initialized. */
  readonly paymentId: Signal<string | null> = this.paymentIdStore.asReadonly();
  /**
   * Runtime-only confirmation secret, if initialized. In-memory only —
   * never persisted, logged, or placed in URLs (see file header).
   */
  readonly clientSecret: Signal<string | null> = this.clientSecretStore.asReadonly();
  /** Backend payment status facts, if known (never client-side claims). */
  readonly paymentStatus: Signal<PaymentStatus | null> = this.paymentStatusStore.asReadonly();
  /** Normalized failure, if any. */
  readonly statusError: Signal<ApiError | null> = this.statusErrorStore.asReadonly();

  /** Whether confirmation is outstanding (duplicate-submit guard). */
  readonly isProcessing: Signal<boolean> = computed(() => this.lifecycleStore() === 'processing');

  /**
   * Whether the lifecycle reached a terminal stage (`succeeded`,
   * `failed`, `cancelled`). `pending` is NOT terminal — polling or
   * resolution continues.
   */
  readonly isTerminal: Signal<boolean> = computed(() => {
    const stage = this.lifecycleStore();
    return stage === 'succeeded' || stage === 'failed' || stage === 'cancelled';
  });

  /** Whole feature snapshot (API facts + UI stage, kept separate below). */
  readonly context: Signal<PaymentStateContext> = computed(() => ({
    orderId: this.orderIdStore(),
    paymentId: this.paymentIdStore(),
    clientSecret: this.clientSecretStore(),
    paymentStatus: this.paymentStatusStore(),
    statusError: this.statusErrorStore(),
  }));

  /**
   * Enters initialization for the named order (`idle → initializing`,
   * plus the `failed`/`cancelled` re-entry edges). Records the order id
   * and clears intent context, backend facts, and errors — a fresh entry
   * never inherits a previous secret, status, or failure. Rejected from
   * every other stage (initialization already underway or payment
   * already resolved — `reset` first).
   */
  beginInitialization(orderId: string): boolean {
    if (!canTransitionPaymentLifecycle(this.lifecycleStore(), 'initializing')) {
      return false;
    }
    this.orderIdStore.set(orderId);
    this.paymentIdStore.set(null);
    this.clientSecretStore.set(null);
    this.paymentStatusStore.set(null);
    this.statusErrorStore.set(null);
    this.lifecycleStore.set('initializing');
    return true;
  }

  /**
   * Records a provided initialization (`initializing → ready`). Stores
   * the payment id, the runtime-only secret, and the backend status —
   * and NOTHING more.
   *
   * `Initialized ≠ Succeeded` (the §9.4 critical rule, enforced
   * structurally): this is the ONLY writer of the `ready` stage, and it
   * can never produce `succeeded` — success requires the backend-confirmed
   * `markSucceeded` path. Rejected from every stage but `initializing`.
   */
  markReady(context: PaymentInitializationContext): boolean {
    if (!canTransitionPaymentLifecycle(this.lifecycleStore(), 'ready')) {
      return false;
    }
    this.paymentIdStore.set(context.paymentId);
    this.clientSecretStore.set(context.clientSecret);
    this.paymentStatusStore.set(context.paymentStatus);
    this.lifecycleStore.set('ready');
    return true;
  }

  /**
   * Submits confirmation (`ready → processing`). The duplicate-submit
   * guard: rejected unless `ready` (in-flight, resolved, or unentered
   * payments never re-submit). Execution belongs to 9.7 — this moves
   * the stage only.
   */
  beginProcessing(): boolean {
    if (!canTransitionPaymentLifecycle(this.lifecycleStore(), 'processing')) {
      return false;
    }
    this.lifecycleStore.set('processing');
    return true;
  }

  /**
   * Records backend-confirmed payment (`processing|pending →
   * `succeeded`) with the authoritative status. The ONLY path to
   * `succeeded` — provider-side claims without backend confirmation
   * must never call this (see `markPending` for outstanding outcomes).
   */
  markSucceeded(paymentStatus: PaymentStatus): boolean {
    if (!canTransitionPaymentLifecycle(this.lifecycleStore(), 'succeeded')) {
      return false;
    }
    this.paymentStatusStore.set(paymentStatus);
    this.lifecycleStore.set('succeeded');
    return true;
  }

  /**
   * Records a terminal failure (`initializing|ready|processing|pending
   * → failed`) with the normalized error. Backend facts and intent
   * context are preserved for diagnosis and safe retry (9.9); use
   * `reset` to wipe.
   */
  markFailed(error: ApiError): boolean {
    if (!canTransitionPaymentLifecycle(this.lifecycleStore(), 'failed')) {
      return false;
    }
    this.statusErrorStore.set(error);
    this.lifecycleStore.set('failed');
    return true;
  }

  /**
   * Records a non-terminal wait (`processing → pending`). Backend facts
   * stay as last known; resolution arrives via `markSucceeded` or
   * `markFailed` (unknown outcomes never blind-retry — 9.9 checks the
   * backend status first).
   */
  markPending(): boolean {
    if (!canTransitionPaymentLifecycle(this.lifecycleStore(), 'pending')) {
      return false;
    }
    this.lifecycleStore.set('pending');
    return true;
  }

  /**
   * Records cancellation (`processing → cancelled`). Terminal — re-entry
   * requires `beginInitialization` anew (fresh intent context, never the
   * cancelled attempt's secret).
   */
  markCancelled(): boolean {
    if (!canTransitionPaymentLifecycle(this.lifecycleStore(), 'cancelled')) {
      return false;
    }
    this.lifecycleStore.set('cancelled');
    return true;
  }

  /**
   * Clears the failure slot without moving the lifecycle or wiping
   * context (edit-path recovery — the stage still records where the
   * failure happened until re-entry or reset).
   */
  clearError(): void {
    this.statusErrorStore.set(null);
  }

  /** Restores the initial shape: `idle`, no context, no facts, no error. */
  reset(): void {
    this.lifecycleStore.set('idle');
    this.orderIdStore.set(null);
    this.paymentIdStore.set(null);
    this.clientSecretStore.set(null);
    this.paymentStatusStore.set(null);
    this.statusErrorStore.set(null);
  }
}
