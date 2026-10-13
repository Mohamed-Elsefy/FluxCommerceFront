/**
 * Feature-owned Payment state for Sub-Phases 9.4 (lifecycle model),
 * 9.6 (initialization execution), 9.7 (confirmation execution), and 9.8
 * (backend-truth verification reads).
 *
 * Scope: `docs/phases/PHASE_9_PAYMENTS.md` §§9.4/9.6–9.8 (state model,
 * initialization, confirmation, and single-shot status verification —
 * no provider internals, no UI, no polling).
 *
 * Source of truth: `docs/phases/PHASE_9_PAYMENTS.md` §§9.4/9.7
 * (lifecycle diagram, outcome mapping), the Sub-Phase 9.1 audit module
 * (`@flux/models` `payment-contract`: `PaymentStatus`,
 * `ProviderConfirmationOutcome`, terminal/payable classifiers), and
 * `docs/frontend-contract/PAYMENT_INTEGRATION_NOTES.md` (backend owns
 * verification — provider-reported success is never order finality;
 * order truth arrives via status reads in 9.8).
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
 *   `paymentStatus`/`statusError` hold Stripe- and backend-reported
 *   facts only (set from service envelopes or provider outcomes — this
 *   file never fetches and never verifies); `lifecycle` drives shell
 *   visibility only and is moved solely through the guarded actions
 *   below. Neither side implicitly drives the other.
 * - The state never touches `HttpClient`, never builds URLs, and never
 *   imports Stripe SDK shapes: the service executes transport (9.3/9.6)
 *   and the `PaymentProvider` abstraction executes confirmation (9.5 —
 *   injected here as the token only, never the concrete adapter). This
 *   file stores outcomes, never produces provider behavior.
 * - Orchestration boundary (the §9.7 critical rule): this state records
 *   provider outcomes and moves its own lifecycle — it NEVER confirms
 *   orders, updates inventory, or triggers sagas. Those remain backend
 *   responsibilities; order truth arrives via status reads in 9.8.
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
 * - 9.5 impl — no Stripe SDK, no Elements, no loader (the page drives
 *   provider setup around this state — never the reverse).
 * - 9.9 — no verification polling loops, no failure-category handling
 *   beyond the init classifier, no recovery algorithms
 *   (`refreshStatus` is single-shot by design; the ONLY loop allowed is
 *   the bounded `by-order` readiness poll inside `initializePayment`).
 * - 9.10 — no localized copy, no navigation.
 */

import { computed, inject, Injectable, signal, type Signal } from '@angular/core';
import {
  catchError,
  EMPTY,
  EmptyError,
  exhaustMap,
  first,
  from,
  Subscription,
  take,
  throwError,
  timer,
} from 'rxjs';
import { ApiError, isApiError, UNKNOWN_ERROR_CODE, type ApiResponseWithData } from '@flux/api';
import type {
  OrderDetailsResponse,
  PaymentInitializationResult,
  PaymentStatus,
  ProviderConfirmationOutcome,
} from '@flux/models';
import { PaymentApiService } from '../data-access/payment-api.service';
import {
  canTransitionPaymentLifecycle,
  PAYMENT_DECLINED_CODE,
  PAYMENT_LIFECYCLE_TRANSITIONS,
  type PaymentInitializationContext,
  type PaymentLifecycle,
  type PaymentStateContext,
} from './payment-lifecycle';
import {
  INIT_POLL_INTERVAL_MS,
  INIT_POLL_MAX_ATTEMPTS,
  isRetryableInitializationFailure,
} from '../models/payment.models';
import {
  PAYMENT_PROVIDER,
  type ConfirmPaymentOptions,
  type PaymentProvider,
  type ProviderConfirmationResult,
} from '../integrations/payment-provider';

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
  private readonly paymentApi = inject(PaymentApiService);
  private readonly provider = inject(PAYMENT_PROVIDER);

  private readonly lifecycleStore = signal<PaymentLifecycle>('idle');
  private readonly orderIdStore = signal<string | null>(null);
  private readonly paymentIdStore = signal<string | null>(null);
  private readonly clientSecretStore = signal<string | null>(null);
  private readonly paymentStatusStore = signal<PaymentStatus | null>(null);
  private readonly statusErrorStore = signal<ApiError | null>(null);
  private readonly confirmationOutcomeStore = signal<ProviderConfirmationOutcome | null>(null);
  private readonly orderDetailsStore = signal<OrderDetailsResponse | null>(null);
  private readonly orderLoadingStore = signal(false);

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
  /** Stripe/backend-reported payment status, if known (never client-side derivations). */
  readonly paymentStatus: Signal<PaymentStatus | null> = this.paymentStatusStore.asReadonly();
  /** Normalized failure, if any. */
  readonly statusError: Signal<ApiError | null> = this.statusErrorStore.asReadonly();
  /**
   * Latest provider confirmation outcome, if any (`null` before the
   * first confirmation and after entry/reset). Preserves the
   * requires-action vs. pending vs. unknown distinction for the 9.8
   * result handling — the lifecycle alone cannot carry it.
   */
  readonly confirmationOutcome: Signal<ProviderConfirmationOutcome | null> =
    this.confirmationOutcomeStore.asReadonly();
  /**
   * Backend order facts for the payment UI summary (`null` until
   * loaded). Display only — backend-issued lines and totals, never
   * inputs to math.
   */
  readonly orderDetails: Signal<OrderDetailsResponse | null> = this.orderDetailsStore.asReadonly();
  /** Whether the order display read is in flight. */
  readonly isOrderLoading: Signal<boolean> = this.orderLoadingStore.asReadonly();

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
    if (this.orderIdStore() !== orderId) {
      this.orderDetailsStore.set(null);
    }
    this.orderLoadingStore.set(false);
    this.orderIdStore.set(orderId);
    this.paymentIdStore.set(null);
    this.clientSecretStore.set(null);
    this.paymentStatusStore.set(null);
    this.statusErrorStore.set(null);
    this.confirmationOutcomeStore.set(null);
    this.lifecycleStore.set('initializing');
    return true;
  }

  /**
   * Executes payment initialization for the named order (Sub-Phase 9.6 —
   * the 9.4 `beginInitialization` gate plus the §9.3 service call, with a
   * bounded readiness poll).
   *
   * Flow: `beginInitialization(orderId)` moves `idle|failed|cancelled →
   * initializing` (rejected calls return `Subscription.EMPTY` with no
   * HTTP — this is the duplicate-initialization guard: an active or
   * resolved flow never re-fires, including while a poll is running);
   * then `GET /api/payments/by-order/{orderId}` is attempted immediately
   * and retried on a fixed interval (single request in flight via
   * `exhaustMap`) while failures stay retryable per
   * `isRetryableInitializationFailure` (`404` saga lag of any code,
   * `409 Payment.NotReady`, transport loss, overload).
   *
   * Resolution: the first envelope carrying intent data resolves to
   * `markReady` (intent context stored in-memory only); a terminal
   * failure (`401`, `400`, `409 Payment.NotPayable`, …) rejects to
   * `markFailed` at once; budget exhaustion (`INIT_POLL_MAX_ATTEMPTS`
   * ticks with no intent) rejects with the LAST observed failure, so the
   * manual retry affordance (`failed → initializing`) stays meaningful.
   * Dataless `200` envelopes are skipped as poll ticks (the next tick
   * re-reads). Non-`ApiError` throwables are normalized, never re-thrown.
   * The caller owns teardown (unsubscribe on destroy stops the timer —
   * no state writes after teardown).
   *
   * Provider setup and Elements mounting are NOT here — the owning page
   * drives the `PaymentProvider` around this state once `ready` (9.6
   * page orchestration), and confirmation belongs to 9.7.
   */
  initializePayment(orderId: string): Subscription {
    if (!this.beginInitialization(orderId)) {
      return Subscription.EMPTY;
    }
    let lastError: unknown = null;
    return timer(0, INIT_POLL_INTERVAL_MS)
      .pipe(
        take(INIT_POLL_MAX_ATTEMPTS),
        exhaustMap(() =>
          this.paymentApi.initializePayment({ orderId }).pipe(
            catchError((error: unknown) => {
              lastError = error;
              return isRetryableInitializationFailure(error) ? EMPTY : throwError(() => error);
            }),
          ),
        ),
        first(
          (envelope: ApiResponseWithData<PaymentInitializationResult>) =>
            envelope.data !== null && envelope.data !== undefined,
        ),
      )
      .subscribe({
        next: (envelope: ApiResponseWithData<PaymentInitializationResult>) => {
          const data = envelope.data;
          if (data === null || data === undefined) {
            this.markFailed(
              new ApiError({
                status: 200,
                code: UNKNOWN_ERROR_CODE,
                message: 'The server returned an empty response.',
              }),
            );
            return;
          }
          this.markReady({
            paymentId: data.paymentId,
            clientSecret: data.clientSecret,
            paymentStatus: data.status,
          });
        },
        error: (error: unknown) => {
          // `first()` with no matching envelope raises `EmptyError` when
          // the budget runs out — report the last observed failure
          // instead (it carries the real backend code for i18n + retry).
          const terminal = error instanceof EmptyError ? lastError : error;
          this.markFailed(
            isApiError(terminal)
              ? terminal
              : new ApiError({
                  status: 0,
                  code: UNKNOWN_ERROR_CODE,
                  message: 'Payment initialization failed.',
                }),
          );
        },
      });
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
   * Executes payment confirmation through the provider boundary
   * (Sub-Phase 9.7 — the 9.4 `beginProcessing` gate plus the §9.5
   * provider call).
   *
   * Flow: `beginProcessing` moves `ready → processing` (rejected calls
   * return `Subscription.EMPTY` with no provider contact — this is the
   * submit lock: in-flight, resolved, or unentered payments never
   * re-submit); the provider result then maps to an explicit outcome
   * (see `applyProviderResult`). Provider rejections (misuse, transport
   * loss inside the SDK call) normalize to `markFailed` — never
   * re-thrown. The caller owns teardown (unsubscribe on destroy;
   * unsubscribing cannot recall the provider call but stops
   * post-destroy state writes).
   *
   * Orchestration boundary: this action records the provider's result
   * and moves its own lifecycle — it NEVER confirms the order, updates
   * inventory, or triggers sagas. Finality stays backend-owned (9.8
   * reads); `succeeded` here means provider-reported success.
   */
  confirmPayment(options: ConfirmPaymentOptions = {}): Subscription {
    if (!this.beginProcessing()) {
      return Subscription.EMPTY;
    }
    const confirmParams = options.returnUrl === undefined ? {} : { returnUrl: options.returnUrl };
    return from(this.provider.confirmPayment(confirmParams)).subscribe({
      next: (result: ProviderConfirmationResult) => this.applyProviderResult(result),
      error: (error: unknown) => {
        this.markFailed(
          isApiError(error)
            ? error
            : new ApiError({
                status: 0,
                code: UNKNOWN_ERROR_CODE,
                message: 'Payment confirmation failed.',
              }),
        );
      },
    });
  }

  /**
   * Maps a provider confirmation result into explicit application
   * state (the §9.7 outcome table):
   *
   * - `succeeded` → `markSucceeded` (immediate success, Stripe-side
   *   fact — never order finality, see `markSucceeded`).
   * - `failed` → `markFailed` with `PAYMENT_DECLINED_CODE` and the
   *   displayable decline text (fallback diagnostic when absent).
   * - `cancelled` → `markCancelled` (terminal — re-entry needs a fresh
   *   initialization, never the cancelled attempt's context).
   * - `requiresAction` / `pending` → `markPending` (non-terminal wait —
   *   9.8 resolves via the backend status read).
   * - `unknown` → lifecycle HOLDS `processing` with the submit lock on
   *   (sent-but-unread: 9.9 checks the backend status first — never a
   *   blind retry, never a silent failure).
   *
   * The outcome bucket is always recorded (`confirmationOutcome`) so
   * 9.8 can distinguish action-required from plain pending. Pure
   * mapping over guarded transitions — performs no I/O.
   */
  applyProviderResult(result: ProviderConfirmationResult): void {
    const outcome: ProviderConfirmationOutcome = result?.outcome ?? 'unknown';
    this.confirmationOutcomeStore.set(outcome);
    switch (outcome) {
      case 'succeeded':
        this.markSucceeded('Succeeded');
        break;
      case 'failed':
        this.markFailed(
          new ApiError({
            status: 0,
            code: PAYMENT_DECLINED_CODE,
            message:
              typeof result?.message === 'string' && result.message.trim() !== ''
                ? result.message
                : 'Payment was declined.',
          }),
        );
        break;
      case 'cancelled':
        this.markCancelled();
        break;
      case 'requiresAction':
      case 'pending':
        this.markPending();
        break;
      case 'unknown':
        break;
    }
  }

  /**
   * Records provider-reported payment success (`processing|pending →
   * `succeeded`) with the reported status. The ONLY path to `succeeded`.
   *
   * `Initialized ≠ Succeeded` still holds structurally (`markReady` can
   * never produce `succeeded`); equally, this path records the
   * PROVIDER's result only — Stripe-intent success is a Stripe-side
   * fact, not FluxCommerce order finality. Order truth (`Confirmed`)
   * stays backend-owned and arrives via status reads in 9.8 — this
   * action never confirms orders, touches inventory, or triggers sagas.
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
   * → failed`, plus the §9.8 backend-truth override from `succeeded`)
   * with the normalized error. Backend facts and intent context are
   * preserved for diagnosis and safe retry (9.9); use `reset` to wipe.
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
   * Records cancellation (`processing|pending → cancelled`, plus the
   * §9.8 backend-truth override from `succeeded`). Terminal — re-entry
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
   * Reads the authoritative backend payment status once (Sub-Phase 9.8 —
   * backend truth before final presentation).
   *
   * Single-shot by design: one explicit read per call, no timers, no
   * intervals, no automatic retries (polling and recovery algorithms
   * belong to 9.9). The owning page triggers it on result entry (for
   * `succeeded`/`pending` claims) and from the pending manual-check
   * affordance.
   *
   * Guards (call ignored, no HTTP): no `paymentId` yet, or the
   * lifecycle is outside `pending|processing|succeeded` (nothing
   * outstanding or already terminally resolved by the backend).
   *
   * Resolution (`resolveBackendStatus`): `Succeeded`/`Failed`/
   * `Cancelled` verdicts override the lifecycle — including OUT of
   * `succeeded` (provider-reported success is never final proof);
   * `Processing`/`Pending`/`Refunded` update the facts and hold the
   * stage. A successful read clears a previous check error; a failed
   * read records the error and HOLDS the stage (transport loss is not
   * payment failure — 9.9 owns recovery, the caller simply re-invokes).
   * A dataless envelope is a contract violation surfacing as `error`.
   */
  refreshStatus(): Subscription {
    const paymentId = this.paymentIdStore();
    const stage = this.lifecycleStore();
    if (
      paymentId === null ||
      (stage !== 'pending' && stage !== 'processing' && stage !== 'succeeded')
    ) {
      return Subscription.EMPTY;
    }
    return this.paymentApi.getPaymentStatus(paymentId).subscribe({
      next: (envelope) => {
        const data = envelope.data;
        if (data === null || data === undefined) {
          this.statusErrorStore.set(
            new ApiError({
              status: 200,
              code: UNKNOWN_ERROR_CODE,
              message: 'The server returned an empty response.',
            }),
          );
          return;
        }
        this.statusErrorStore.set(null);
        this.resolveBackendStatus(data.status);
      },
      error: (error: unknown) => {
        this.statusErrorStore.set(
          isApiError(error)
            ? error
            : new ApiError({
                status: 0,
                code: UNKNOWN_ERROR_CODE,
                message: 'Payment status check failed.',
              }),
        );
      },
    });
  }

  /**
   * Applies an authoritative backend verdict to lifecycle and facts
   * (the §9.8 enforcement point — backend truth always wins):
   *
   * - `Succeeded` → `markSucceeded` (confirms the provider claim, or
   *   resolves a pending/processing wait).
   * - `Failed` → `markFailed` with the `Payment.Failed` backend verdict
   *   (overrides even provider-reported success — client confirmation
   *   is never final proof).
   * - `Cancelled` → `markCancelled` (terminal — re-entry needs a fresh
   *   initialization).
   * - `Processing` / `Pending` / `Refunded` → facts recorded, stage
   *   held (the wait continues; 9.9 owns further resolution).
   */
  resolveBackendStatus(status: PaymentStatus): void {
    if (status === 'Succeeded') {
      this.markSucceeded(status);
      return;
    }
    if (status === 'Failed') {
      this.paymentStatusStore.set(status);
      this.markFailed(
        new ApiError({
          status: 200,
          code: 'Payment.Failed',
          message: 'The backend reports the payment as failed.',
        }),
      );
      return;
    }
    if (status === 'Cancelled') {
      this.paymentStatusStore.set(status);
      this.markCancelled();
      return;
    }
    this.paymentStatusStore.set(status);
  }

  /**
   * Clears the failure slot without moving the lifecycle or wiping
   * context (edit-path recovery — the stage still records where the
   * failure happened until re-entry or reset).
   */
  clearError(): void {
    this.statusErrorStore.set(null);
  }

  /** Restores the initial shape: `idle`, no context, no facts, no error, no outcome, no order. */
  reset(): void {
    this.lifecycleStore.set('idle');
    this.orderIdStore.set(null);
    this.paymentIdStore.set(null);
    this.clientSecretStore.set(null);
    this.paymentStatusStore.set(null);
    this.statusErrorStore.set(null);
    this.confirmationOutcomeStore.set(null);
    this.orderDetailsStore.set(null);
    this.orderLoadingStore.set(false);
  }

  /**
   * Loads the backend order facts for the payment UI summary
   * (Sub-Phase 9.10 — display only).
   *
   * Best-effort by design: failures clear the slot to `null` (the
   * summary hides) WITHOUT touching the payment lifecycle or the
   * failure slot — the order read is independent of the payment flow
   * and must never fail it. Already-loaded orders skip re-fetching
   * (dedupe by `orderId` — remounts reuse the facts).
   */
  loadOrder(orderId: string): Subscription {
    if (this.orderDetailsStore()?.orderId === orderId) {
      return Subscription.EMPTY;
    }
    this.orderLoadingStore.set(true);
    return this.paymentApi.getOrderDetails(orderId).subscribe({
      next: (envelope) => {
        this.orderDetailsStore.set(envelope.data ?? null);
        this.orderLoadingStore.set(false);
      },
      error: () => {
        this.orderDetailsStore.set(null);
        this.orderLoadingStore.set(false);
      },
    });
  }
}
