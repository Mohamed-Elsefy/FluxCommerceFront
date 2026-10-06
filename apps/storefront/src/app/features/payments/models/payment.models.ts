/**
 * Storefront Payments feature models for Sub-Phases 9.2 (feature
 * foundation) and 9.9 (recovery decision tables).
 *
 * Scope: `docs/phases/PHASE_9_PAYMENTS.md` §§9.2/9.9 (routing shapes
 * plus the pure failure/recovery classifiers — no API execution, no
 * state implementation, no provider integration, no UI behavior).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §6 (payment
 * endpoints), `docs/frontend-contract/PAYMENT_INTEGRATION_NOTES.md` (the
 * order-poll proxy), and the Sub-Phase 9.1 audit module
 * (`@flux/models` `payment-contract`: `Payment`, `PaymentOrder`,
 * `PaymentStatus`).
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - Canonical wire mirrors stay in `@flux/models` — this module owns
 *   only the feature-local routing shapes: the `:orderId` route params,
 *   the entry/result path builders, and structural guards. Pure types +
 *   pure functions, no Angular runtime, no HTTP.
 * - Route paths served (mounted at `payment` in `app.routes.ts`, see
 *   `./payments.routes`): `/payment/:orderId` (payment page) and
 *   `/payment/:orderId/result` (payment result page), per §9.10.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.3 — no API client/service, no `HttpClient`, no envelope mapping.
 * - 9.4 — no `@Injectable()` store, no signals/computeds, no lifecycle.
 * - 9.5 — no Stripe SDK, no Elements, no provider abstraction.
 * - 9.6+ — no initialization, confirmation, result polling, or retry
 *   execution (the §9.9 tables classify recovery — execution lives in
 *   state and pages).
 */

import type { ParamMap } from '@angular/router';
import type { ProviderConfirmationOutcome } from '@flux/models';

/**
 * Route parameter naming the order being paid
 * (`/payment/:orderId`, `/payment/:orderId/result`).
 */
export const PAYMENT_ORDER_ID_PARAM = 'orderId' as const;

/**
 * Child path serving the payment result
 * (`/payment/:orderId/result`).
 */
export const PAYMENT_RESULT_PATH_SUFFIX = 'result' as const;

/**
 * Payment route params: the created order being paid for. The `orderId`
 * is the Phase 8 → Phase 9 handoff (`CheckoutResponse.orderId`) — the
 * only order context the payment entry requires.
 */
export interface PaymentRouteParams {
  readonly orderId: string;
}

/**
 * Whether `value` is a usable order id: a non-blank string. Structural
 * pre-check only — order existence and ownership stay backend-owned
 * (`GET /orders/{id}` masks foreign ids as `404`). Pure — throws
 * nothing.
 */
export function isValidPaymentOrderId(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Reads payment route params out of a route `ParamMap`. Returns `null`
 * for a missing or blank `:orderId` (nothing to initialize — entry stays
 * blocked, never a fabricated id). Pure — throws nothing, performs no
 * HTTP.
 */
export function readPaymentRouteParams(
  paramMap: ParamMap | null | undefined,
): PaymentRouteParams | null {
  const orderId = paramMap?.get(PAYMENT_ORDER_ID_PARAM) ?? null;
  if (!isValidPaymentOrderId(orderId)) {
    return null;
  }
  return { orderId };
}

/**
 * Builds the payment entry path for a created order
 * (`/payment/:orderId`). Pure — throws nothing.
 */
export function paymentPath(orderId: string): string {
  return `/payment/${orderId}`;
}

/**
 * Builds the payment result path for a created order
 * (`/payment/:orderId/result`). Pure — throws nothing.
 */
export function paymentResultPath(orderId: string): string {
  return `/payment/${orderId}/${PAYMENT_RESULT_PATH_SUFFIX}`;
}

/**
 * Distinguished payment failure categories (Sub-Phase 9.9 — the §9.9
 * decision table, stage-first, never message text):
 * - `initialization-failure` — failed before any provider verdict
 *   exists (no `confirmationOutcome` recorded): setup, transport, and
 *   initialization errors (including exhausted readiness polls). Safe
 *   retry = fresh `initializePayment` (idempotent server-side by order).
 * - `confirmation-failure` — failed WITH a provider verdict recorded
 *   (decline, provider error, backend override): the attempt completed
 *   and must never resume — safe retry = fresh `initializePayment` for
 *   a NEW attempt (the backend dedupes by order, so no duplicate
 *   charge is possible).
 */
export type PaymentFailureKind = 'initialization-failure' | 'confirmation-failure';

/**
 * Classifies a `failed` lifecycle by whether a provider verdict
 * exists. Returns `null` outside `failed` (nothing to classify).
 * Pure — throws nothing.
 */
export function classifyPaymentFailure(
  stage: string | null | undefined,
  outcome: ProviderConfirmationOutcome | null | undefined,
): PaymentFailureKind | null {
  if (stage !== 'failed') {
    return null;
  }
  return outcome === null || outcome === undefined
    ? 'initialization-failure'
    : 'confirmation-failure';
}

/**
 * Recovery actions the UX offers (Sub-Phase 9.9 — deliberate,
 * state-aware, duplicate-safe):
 * - `retry-initialization` — explicit fresh `initializePayment`
 *   (`failed`/`cancelled` only — the machine gate drops everything
 *   else, so re-entry can never double-fire).
 * - `check-status` — explicit single-shot `refreshStatus` FIRST, with
 *   every other user action locked meanwhile (`pending`, plus
 *   `processing` holding an `unknown` outcome — sent-but-unread must
 *   resolve through backend truth, never a blind retry).
 * - `none` — active flow stages and resolved success offer no recovery
 *   action.
 */
export type PaymentRecovery = 'retry-initialization' | 'check-status' | 'none';

/**
 * Resolves the recovery action for a lifecycle stage and provider
 * outcome. Pure — throws nothing.
 */
export function paymentRecoveryFor(
  stage: string | null | undefined,
  outcome: ProviderConfirmationOutcome | null | undefined,
): PaymentRecovery {
  if (stage === 'failed' || stage === 'cancelled') {
    return 'retry-initialization';
  }
  if (stage === 'pending') {
    return 'check-status';
  }
  if (stage === 'processing' && outcome === 'unknown') {
    return 'check-status';
  }
  return 'none';
}

/**
 * Bounded readiness-poll budget for `PaymentState.initializePayment`.
 * The backend creates the payment intent asynchronously after checkout
 * (eventual consistency), so the first `by-order` reads may legitimately
 * miss. Attempts start immediately, repeat on a fixed interval, and stop
 * at the cap — exhaustion records the last failure (manual retry stays
 * available through the `failed → initializing` edge).
 */
export const INIT_POLL_INTERVAL_MS = 2000 as const;

/** Maximum `by-order` attempts per `initializePayment` entry (see above). */
export const INIT_POLL_MAX_ATTEMPTS = 15 as const;

/**
 * Whether an initialization failure is worth another `by-order` tick
 * inside the poll budget (status-first, never message text):
 * - retryable — transient or not-yet states: transport loss (`status
 *   0`), rate/overload (`408`/`429`/`5xx`), provider outage (`400
 *   Payment.ProviderUnavailable` — `Failure` default branch, retry per
 *   contract; the only other `400` on this bodiless endpoint is
 *   `OrderIdRequired` for an empty guid, which the UI flow can never
 *   send since the id comes from checkout), saga lag (`404` of any
 *   code, including codeless and masked-ownership reads), and `409`
 *   ONLY with code `Payment.NotReady`.
 * - terminal — backend decisions that a retry cannot change:
 *   `401`/`403` auth, any other `409` (notably
 *   `Payment.NotPayable`), and non-`ApiError` throwables (programming
 *   errors — never spin the budget on a bug).
 *
 * The 15-attempt budget bounds every retryable path, so a surprising
 * `400` can waste ticks but never loop.
 *
 * Pure — throws nothing, performs no HTTP.
 */
export function isRetryableInitializationFailure(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }
  const status = readStatus(error);
  if (status === 0 || status === 400 || status === 408 || status === 429 || status >= 500) {
    return true;
  }
  if (status === 404) {
    return true;
  }
  if (status === 409) {
    return readCode(error) === 'Payment.NotReady';
  }
  return false;
}

/** Whether the value is a non-null object (failure-shape probe). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Best-effort numeric `status` read off a failure shape (`NaN` when absent). */
function readStatus(failure: Record<string, unknown>): number {
  return typeof failure['status'] === 'number' ? failure['status'] : NaN;
}

/** Best-effort string `code` read off a failure shape (`null` when absent). */
function readCode(failure: Record<string, unknown>): string | null {
  return typeof failure['code'] === 'string' ? failure['code'] : null;
}
