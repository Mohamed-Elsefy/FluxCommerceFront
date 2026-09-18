/**
 * Storefront Payments feature models for Sub-Phase 9.2 — Payment Feature
 * Foundation.
 *
 * Scope: `docs/phases/PHASE_9_PAYMENTS.md` §9.2 (feature structure and
 * routing readiness only — no API execution, no state implementation, no
 * provider integration, no UI behavior).
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
 * - 9.6+ — no initialization, confirmation, result polling, or retry.
 */

import type { ParamMap } from '@angular/router';

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
 * Future backend confirmation correlation payload — the typed surface
 * for `PaymentApiService.confirmPayment` (Sub-Phase 9.3).
 *
 * - `paymentId` travels as the method argument, never duplicated here.
 * - Carries NO card data (Stripe Elements owns it inside the §9.5
 *   boundary), NO client secret (the provider boundary owns it in
 *   9.5/9.7 — the API service must never see secrets), and NO amounts
 *   (backend-authoritative).
 * - No HTTP endpoint consumes this shape today (the §9.1 blocker:
 *   confirmation executes provider-side via Stripe.js with backend
 *   verification arriving through the webhook) — the service
 *   short-circuits without sending until the backend lands a path.
 */
export interface ConfirmPaymentRequest {
  readonly orderId: string;
}
