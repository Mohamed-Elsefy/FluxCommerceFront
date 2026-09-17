/**
 * Payment contract & architecture audit for Sub-Phase 9.1.
 *
 * Scope: `docs/phases/PHASE_9_PAYMENTS.md` §9.1 (contracts and boundaries
 * only — no feature structure, no API service, no state store, no Stripe
 * SDK, no components, no routes).
 *
 * Source of truth:
 * - `docs/frontend-contract/API_CONTRACT.md` §6 (payments endpoints).
 * - `docs/frontend-contract/DTO_REFERENCE.md` §6 (payment shapes).
 * - `docs/frontend-contract/ENUM_REFERENCE.md` §5 (payment statuses).
 * - `docs/frontend-contract/ERROR_CATALOG.md` §6 (payment error codes).
 * - `docs/frontend-contract/PAYMENT_INTEGRATION_NOTES.md` (SPA rules,
 *   order-poll proxy, client-secret blocker).
 *
 * Audited backend surface (the complete HTTP contract today):
 * - `GET /api/payments/{paymentId}` → `ApiResponse<PaymentResponse>`
 *   (anonymous object server-side; `status` is a STRING). Authenticated +
 *   ownership (foreign ids mask as `404`). This is the ONLY payment
 *   endpoint the SPA may call.
 * - `POST /api/payments/webhook` → raw body + `Stripe-Signature`, `200`
 *   empty on processed AND duplicate, `400` empty on bad signature. Never
 *   called by the SPA; never replicated.
 * - No client-secret HTTP endpoint exists today (blocker — see
 *   `PAYMENT_INIT_HTTP_AVAILABLE`). The intent result
 *   (`PaymentIntentResult{StripePaymentIntentId,Status,ClientSecret}`) is
 *   an application-layer model returned to the saga consumer only; the
 *   duplicate-intent path returns `ClientSecret: null` by design (single
 *   intent per `OrderId`). The initialization shapes below are therefore
 *   documented as the FUTURE contract the SPA will consume once the
 *   backend exposes it — they are never posted to today.
 *
 * Ownership (`ARCHITECTURE.md` §5 — feature-based architecture):
 * - Canonical wire mirrors stay the single declaration site:
 *   `PaymentResponse` lives in `./payments`, order shapes in `./orders`,
 *   `PaymentStatus`/`OrderStatus` in `../common/enums`. This module
 *   aliases them (`Payment`, `PaymentOrder`) — never re-declares — so no
 *   contract drift is possible.
 * - This module owns the audit-only additions: the initialization
 *   request/result shapes, the status-query shape, the provider
 *   confirmation expectations, the `PaymentAttempt` observation record,
 *   the responsibility-boundary tables, the sensitive-data pins, and pure
 *   structural classifiers (status-first, never message-text-based, per
 *   `ERROR_CATALOG.md` §0).
 *
 * Backend-authoritative data rule (this sub-phase's core constraint):
 * this module performs NO payment verification, NO order-state
 * transitions, NO inventory coordination, NO saga orchestration, NO
 * webhook handling, NO idempotency-key minting, and NO amount/currency
 * computation — no `unitPrice * quantity`, no totals, no float-math money
 * helpers. Amounts on `PaymentResponse` echo verbatim for display only.
 * Client-side success (a provider confirmation) is never treated as
 * order finality — only `GET /orders/{id}` (`Confirmed | Cancelled`) and
 * `GET /api/payments/{id}` speak authoritatively.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 9.2 — no `features/payments/` folder, pages, components, routes.
 * - 9.3 — no API service, no `HttpClient`, no envelope mapping, no
 *   `ApiClient` usage, no request cancellation.
 * - 9.4 — no `@Injectable()` store, no signals/computeds, no state
 *   machine implementation (expectation tables only).
 * - 9.5 — no Stripe SDK import, no Elements mounting, no provider
 *   implementation (abstraction expectations only, browser-touching code
 *   stays out for SSR safety).
 *
 * This file is pure types + pure functions: no Angular imports, no
 * `HttpClient`, no browser APIs, no `localStorage`, no Stripe imports.
 * Every helper is SSR-safe, throws nothing, and performs no HTTP.
 */

import type { Guid, IsoDateString } from '../common/shared-types';
import type { OrderStatus, PaymentStatus } from '../common/enums';
import type { CheckoutResponse, OrderDetailsResponse } from './orders';
import type { PaymentResponse } from './payments';

// ---------------------------------------------------------------------------
// Frontend domain models (aliases — the wire stays canonical)
// ---------------------------------------------------------------------------

/**
 * Frontend `Payment` model. Alias of the canonical `PaymentResponse`
 * (`GET /api/payments/{id}` payload) — re-exported, not re-declared, so
 * the anonymous backend object keeps one declaration site.
 */
export type Payment = PaymentResponse;

/**
 * Frontend `Order` model for the payment boundary. Alias of the canonical
 * `OrderDetailsResponse` (`GET /orders/{id}` payload) — re-exported, not
 * re-declared. Payment reads the order read-only (status + totals for
 * display); it never writes order state.
 */
export type PaymentOrder = OrderDetailsResponse;

/**
 * Order creation handoff into payment (`POST /orders/checkout` payload).
 * Alias of the canonical `CheckoutResponse` — the Phase 8 → Phase 9 seam:
 * payment entry requires the `orderId` from this shape and nothing else.
 */
export type PaymentOrderEntry = CheckoutResponse;

// ---------------------------------------------------------------------------
// Payment initialization contract (audited; HTTP path BLOCKED today)
// ---------------------------------------------------------------------------

/**
 * Payment initialization input: the created order being paid for.
 * Mirrors the backend-internal `CreatePaymentIntentCommand{OrderId}`.
 * No idempotency key, no amount, no currency travels from the SPA —
 * pricing is Catalog-authoritative and idempotency is server-side
 * (`intent_{OrderId}_{PaymentId}_{Version}`).
 */
export interface PaymentInitializationRequest {
  readonly orderId: Guid;
}

/**
 * Payment initialization output the SPA expects once the backend exposes
 * a client-secret path (e.g. `GET /api/payments/by-order/{orderId}` or an
 * `OrderDetails` extension — backend decision, not SPA's). Maps the
 * backend-internal `PaymentIntentResult`:
 * - `paymentId` — the `Payment` identity for status queries.
 * - `clientSecret` — runtime-only Stripe confirmation secret (see the
 *   sensitive-data pins below; never persisted, never logged).
 * - `paymentReference` — the provider intent id (`pi_*`,
 *   `ProviderPaymentIntentId`); opaque to the SPA, echoed for support
 *   correlation only.
 * - `status` — the backend payment status at initialization (expect
 *   `Pending`; never treated as success).
 */
export interface PaymentInitializationResult {
  readonly paymentId: Guid;
  readonly orderId: Guid;
  readonly clientSecret: string;
  readonly paymentReference: string | null;
  readonly status: PaymentStatus;
}

/**
 * Whether an HTTP path returns the client secret today: `false`. Pinned
 * so Sub-Phases 9.2+ cannot wire `stripe.confirmCardPayment` against a
 * missing endpoint. The SPA must not work around this by calling Stripe
 * directly (no intent id/secret) or by expecting `SecretKey`.
 */
export const PAYMENT_INIT_HTTP_AVAILABLE = false as const;

/**
 * Whether payment initialization over HTTP is available. Always `false`
 * in the current contract — callers must use the order-poll proxy
 * (`GET /orders/{id}`) until the backend lands the endpoint. Pure —
 * throws nothing.
 */
export function isPaymentInitializationAvailable(): false {
  return PAYMENT_INIT_HTTP_AVAILABLE;
}

/**
 * Structural pre-check for an initialization request: a non-blank
 * `orderId`. Never a substitute for backend validation — it only keeps
 * unusable input from reaching the future call. Pure — throws nothing.
 */
export function isValidPaymentInitializationRequest(
  request: PaymentInitializationRequest | null | undefined,
): boolean {
  return (
    request !== null &&
    request !== undefined &&
    typeof request.orderId === 'string' &&
    request.orderId.trim() !== ''
  );
}

// ---------------------------------------------------------------------------
// Payment status query contract (the SPA-callable read)
// ---------------------------------------------------------------------------

/**
 * Payment status query input: the payment identity. The `paymentId` is
 * NOT returned by checkout and `OrderDetails` carries no payment fields —
 * status polling is only possible when the id is known (initialization
 * result once §9.6 lands; until then the order-poll proxy applies).
 */
export interface PaymentStatusQuery {
  readonly paymentId: Guid;
}

/** Route template of the SPA-callable payment read. */
export const PAYMENT_STATUS_PATH = '/api/payments/{paymentId}' as const;

/**
 * Structural pre-check for a status query: a non-blank `paymentId`.
 * Pure — throws nothing.
 */
export function isValidPaymentStatusQuery(query: PaymentStatusQuery | null | undefined): boolean {
  return (
    query !== null &&
    query !== undefined &&
    typeof query.paymentId === 'string' &&
    query.paymentId.trim() !== ''
  );
}

/**
 * Projects the status out of a payment payload. Pure — throws nothing,
 * performs no HTTP.
 */
export function paymentStatusOf(payment: Payment | null | undefined): PaymentStatus | null {
  return payment?.status ?? null;
}

// ---------------------------------------------------------------------------
// Payment confirmation expectations (provider boundary, §9.5 seam)
// ---------------------------------------------------------------------------

/**
 * Input the provider confirmation takes: the runtime-only client secret
 * from `PaymentInitializationResult`. No amounts, no card data shapes —
 * raw card data never crosses the SPA's own models (Stripe Elements owns
 * it inside the §9.5 boundary).
 */
export interface PaymentConfirmationInput {
  readonly clientSecret: string;
}

/**
 * Provider confirmation outcomes the SPA must handle (Stripe.js
 * `confirmCardPayment` surface, audited from
 * `PAYMENT_INTEGRATION_NOTES.md` §4). `requiresAction` is the 3-D Secure
 * path Stripe.js manages internally; `unknown` is the sent-but-unread
 * case (e.g. network failure after submit) that must NEVER blind-retry —
 * it resolves via `PaymentStatusQuery` first.
 */
export type ProviderConfirmationOutcome =
  'succeeded' | 'failed' | 'cancelled' | 'requiresAction' | 'pending' | 'unknown';

/** Closed outcome set: every future branch names one of these. */
export const PROVIDER_CONFIRMATION_OUTCOMES: readonly ProviderConfirmationOutcome[] = [
  'succeeded',
  'failed',
  'cancelled',
  'requiresAction',
  'pending',
  'unknown',
];

/**
 * Whether `value` names a provider confirmation outcome. Pure — throws
 * nothing.
 */
export function isProviderConfirmationOutcome(
  value: unknown,
): value is ProviderConfirmationOutcome {
  return (
    typeof value === 'string' &&
    (PROVIDER_CONFIRMATION_OUTCOMES as readonly string[]).includes(value)
  );
}

/**
 * Structural pre-check for a confirmation input: a non-blank client
 * secret. Pure — throws nothing.
 */
export function isValidPaymentConfirmationInput(
  input: PaymentConfirmationInput | null | undefined,
): boolean {
  return (
    input !== null &&
    input !== undefined &&
    typeof input.clientSecret === 'string' &&
    input.clientSecret.trim() !== ''
  );
}

// ---------------------------------------------------------------------------
// PaymentAttempt observation record (frontend-side, never a wire DTO)
// ---------------------------------------------------------------------------

/**
 * Where a payment observation came from. The backend exposes no
 * `PaymentAttempt` DTO — attempts are saga/webhook internals — so this
 * record is a frontend-side observation for display and safe-retry
 * decisions, never sent to any endpoint.
 */
export type PaymentAttemptSource = 'status-query' | 'provider-confirmation' | 'order-poll';

/**
 * One observed payment attempt: the status seen plus how it was seen.
 * `providerReference` echoes `ProviderPaymentIntentId` (`pi_*`) for
 * support correlation only. Pure data — no verification semantics.
 */
export interface PaymentAttempt {
  readonly orderId: Guid;
  readonly paymentId: Guid | null;
  readonly status: PaymentStatus;
  readonly providerReference: string | null;
  readonly source: PaymentAttemptSource;
  readonly observedAtUtc: IsoDateString;
}

/**
 * Records a payment-attempt observation from a status payload. Returns
 * `null` for a missing payload (nothing observed is nothing recorded).
 * Pure — throws nothing, performs no HTTP, verifies nothing.
 */
export function toPaymentAttempt(
  payment: Payment | null | undefined,
  source: PaymentAttemptSource,
  observedAtUtc: IsoDateString,
): PaymentAttempt | null {
  if (!payment) {
    return null;
  }
  return {
    orderId: payment.orderId,
    paymentId: payment.id,
    status: payment.status,
    providerReference: payment.providerPaymentIntentId ?? null,
    source,
    observedAtUtc,
  };
}

/**
 * Records an order-poll observation as a payment-attempt proxy (the
 * no-client-secret path): the order status stands in for payment truth
 * until the payment id is known. `Confirmed` proxies paid, `Cancelled`
 * proxies not-paid, `Pending` proxies in-flight. Returns `null` for a
 * missing order. Pure — throws nothing, verifies nothing.
 */
export function toPaymentAttemptFromOrder(
  order: PaymentOrder | null | undefined,
  observedAtUtc: IsoDateString,
): PaymentAttempt | null {
  if (!order) {
    return null;
  }
  const status: PaymentStatus =
    order.status === 'Confirmed'
      ? 'Succeeded'
      : order.status === 'Cancelled'
        ? 'Failed'
        : 'Pending';
  return {
    orderId: order.orderId,
    paymentId: null,
    status,
    providerReference: null,
    source: 'order-poll',
    observedAtUtc,
  };
}

// ---------------------------------------------------------------------------
// PaymentStatus classifiers (display + safe-retry decisions only)
// ---------------------------------------------------------------------------

/** Terminal payment statuses: polling may stop. */
export const TERMINAL_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  'Succeeded',
  'Failed',
  'Cancelled',
  'Refunded',
];

/**
 * Whether the payment status is terminal (`Succeeded | Failed |
 * Cancelled | Refunded`). Unknown future strings count as non-terminal
 * (keep polling — see `ENUM_REFERENCE.md` §8). Pure — throws nothing.
 */
export function isTerminalPaymentStatus(status: PaymentStatus | string): boolean {
  return (TERMINAL_PAYMENT_STATUSES as readonly string[]).includes(status);
}

/**
 * Whether the status is backend-confirmed paid (`Succeeded` → order
 * `Confirmed`). The ONLY success signal — provider-side success without
 * this is not finality. Pure — throws nothing.
 */
export function isSuccessfulPaymentStatus(status: PaymentStatus | string): boolean {
  return status === 'Succeeded';
}

/**
 * Whether the status is a failure the user may retry from (`Failed |
 * Cancelled`). `Refunded` is post-pay compensation, not a retry signal.
 * Pure — throws nothing.
 */
export function isFailedPaymentStatus(status: PaymentStatus | string): boolean {
  return status === 'Failed' || status === 'Cancelled';
}

/**
 * Whether the payment can still be paid (backend `CanBePaid() =
 * Pending | Processing`). Guards duplicate confirmation attempts. Pure —
 * throws nothing.
 */
export function isPayablePaymentStatus(status: PaymentStatus | string): boolean {
  return status === 'Pending' || status === 'Processing';
}

/**
 * Whether the payment is in flight (`Pending | Processing` — spinner).
 * Pure — throws nothing.
 */
export function isInFlightPaymentStatus(status: PaymentStatus | string): boolean {
  return status === 'Pending' || status === 'Processing';
}

/**
 * Order-poll proxy reading for payment display while the payment id is
 * unknown: `Pending` → in-flight, `Confirmed` → paid, `Cancelled` →
 * not-paid. Backend saga timing is async (seconds) — the pending UI keeps
 * its cancel option (`POST /orders/{id}/cancel` while `Pending`). Pure —
 * throws nothing.
 */
export type OrderPaymentProxy = 'in-flight' | 'paid' | 'not-paid';

/**
 * Maps an order status to its payment proxy reading. Pure — throws
 * nothing, verifies nothing.
 */
export function orderPaymentProxyOf(status: OrderStatus | string): OrderPaymentProxy {
  if (status === 'Confirmed') {
    return 'paid';
  }
  if (status === 'Cancelled') {
    return 'not-paid';
  }
  return 'in-flight';
}

// ---------------------------------------------------------------------------
// Payment error codes (status-first classifiers, ERROR_CATALOG.md §6)
// ---------------------------------------------------------------------------

/**
 * Machine-readable payment failures the storefront branches on. Zero
 * `CodeToKey` entries exist backend-side — all fall back to English
 * descriptions — so classifiers below branch on `status` first and treat
 * `code` as a hint, never on message text.
 */
export type PaymentStatusQueryErrorCode =
  'Payment.NotFound' | 'Payment.Unauthorized' | 'Payment.InvalidRequest' | 'Payment.StripeError';

/** Closed code set: every future branch names one of these. */
export const PAYMENT_STATUS_QUERY_ERROR_CODES: readonly PaymentStatusQueryErrorCode[] = [
  'Payment.NotFound',
  'Payment.Unauthorized',
  'Payment.InvalidRequest',
  'Payment.StripeError',
];

/**
 * Whether `value` names a payment status-query error code. Pure — throws
 * nothing.
 */
export function isPaymentStatusQueryErrorCode(
  value: unknown,
): value is PaymentStatusQueryErrorCode {
  return (
    typeof value === 'string' &&
    (PAYMENT_STATUS_QUERY_ERROR_CODES as readonly string[]).includes(value)
  );
}

/**
 * Minimal normalized-failure view this module classifies: an HTTP
 * `status` plus the best-effort `code`. Compatible with the Phase 1
 * `ApiError` without importing it (keeps this module free of
 * class-valued imports — types only).
 */
export interface PaymentContractFailure {
  readonly status: number;
  readonly code?: string;
}

/**
 * Whether the failure is a missing payment (`404` — unknown `paymentId`
 * OR other-customer id, IDOR-masked with a server-side warning log).
 * Never probe ids on this path. Pure — throws nothing.
 */
export function isPaymentNotFoundFailure(
  failure: PaymentContractFailure | null | undefined,
): boolean {
  return failure?.status === 404;
}

/**
 * Whether the failure is an authentication failure (`401` — anonymous
 * status read). Recovery is login/refresh, never retry. Pure — throws
 * nothing.
 */
export function isPaymentAuthFailure(failure: PaymentContractFailure | null | undefined): boolean {
  return failure?.status === 401;
}

// ---------------------------------------------------------------------------
// Responsibility boundary (Frontend UX vs. Backend Truth)
// ---------------------------------------------------------------------------

/**
 * Frontend-owned payment concerns (Phase 9 principle: Angular owns the
 * payment experience and provider integration). Presentation, provider
 * plumbing, feature state, and navigation only — no truth, no
 * orchestration.
 */
export const FRONTEND_PAYMENT_RESPONSIBILITIES = [
  'payment-ux',
  'provider-integration',
  'feature-state',
  'payment-result-display',
  'navigation',
  'loading-error-handling',
] as const;

/** One frontend-owned payment concern. */
export type FrontendPaymentResponsibility = (typeof FRONTEND_PAYMENT_RESPONSIBILITIES)[number];

/**
 * Backend-owned payment concerns (Phase 9 principle: the backend owns
 * payment truth and business orchestration). The SPA must never duplicate
 * any of these — no client-side verification, no saga management, no
 * webhook handling, no inventory moves, no compensation.
 */
export const BACKEND_PAYMENT_RESPONSIBILITIES = [
  'payment-creation',
  'status-verification',
  'webhook-processing',
  'order-transitions',
  'inventory-coordination',
  'saga-orchestration',
  'compensation',
  'idempotency',
] as const;

/** One backend-owned payment concern. */
export type BackendPaymentResponsibility = (typeof BACKEND_PAYMENT_RESPONSIBILITIES)[number];

/**
 * Whether `value` names a frontend-owned payment concern. Pure — throws
 * nothing.
 */
export function isFrontendPaymentResponsibility(
  value: unknown,
): value is FrontendPaymentResponsibility {
  return (
    typeof value === 'string' &&
    (FRONTEND_PAYMENT_RESPONSIBILITIES as readonly string[]).includes(value)
  );
}

/**
 * Whether `value` names a backend-owned payment concern — and therefore
 * something the SPA must never implement. Pure — throws nothing.
 */
export function isBackendPaymentResponsibility(
  value: unknown,
): value is BackendPaymentResponsibility {
  return (
    typeof value === 'string' &&
    (BACKEND_PAYMENT_RESPONSIBILITIES as readonly string[]).includes(value)
  );
}

/**
 * SPA-callable payment endpoints (path templates). Exactly one entry:
 * the status read. The webhook is Stripe→API only and initialization has
 * no HTTP path — neither appears here by design.
 */
export const SPA_CALLABLE_PAYMENT_ENDPOINTS = ['/api/payments/{paymentId}'] as const;

/**
 * Whether the SPA may call the given payment path template. `true` only
 * for the status read — the webhook and any intent-creation path return
 * `false`. Pure — throws nothing.
 */
export function isSpaCallablePaymentEndpoint(path: string | null | undefined): boolean {
  return (
    typeof path === 'string' && (SPA_CALLABLE_PAYMENT_ENDPOINTS as readonly string[]).includes(path)
  );
}

// ---------------------------------------------------------------------------
// Sensitive-data pins (clientSecret handling)
// ---------------------------------------------------------------------------

/**
 * Forbidden `clientSecret` sinks: the secret lives in memory only (the
 * §9.4 feature state slot, never persisted). Pinned so later sub-phases
 * cannot store it in `localStorage`/`sessionStorage`, leak it into URLs,
 * logs, telemetry, or persistent global state.
 */
export const FORBIDDEN_CLIENT_SECRET_SINKS = [
  'localStorage',
  'sessionStorage',
  'url',
  'logs',
  'telemetry',
  'persistent-global-state',
] as const;

/** One forbidden `clientSecret` sink. */
export type ForbiddenClientSecretSink = (typeof FORBIDDEN_CLIENT_SECRET_SINKS)[number];

/**
 * Whether `value` names a forbidden `clientSecret` sink. Pure — throws
 * nothing.
 */
export function isForbiddenClientSecretSink(value: unknown): value is ForbiddenClientSecretSink {
  return (
    typeof value === 'string' &&
    (FORBIDDEN_CLIENT_SECRET_SINKS as readonly string[]).includes(value)
  );
}

/**
 * The only Stripe key the SPA may hold: the publishable key, injected via
 * app environment — never via API, never the secret key. Pinned as a
 * named constant so no later code invents a second key slot.
 */
export const SPA_STRIPE_KEY_SLOT = 'publishable-key-from-app-env' as const;
