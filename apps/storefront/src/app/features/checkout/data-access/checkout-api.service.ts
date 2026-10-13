/**
 * Checkout data-access service for Sub-Phase 8.2 — Checkout Feature &
 * Data Access.
 *
 * Scope: `docs/phases/PHASE_8_CHECKOUT.md` §8.2 (data access only — no
 * state implementation, no forms, no UI).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §4 and
 * `docs/frontend-contract/DTO_REFERENCE.md` §4
 * (`FluxCommerce.Modules.Orders.Contracts`, `[Route orders][Authorize]`).
 * `POST /orders/checkout` takes `CheckoutRequest { cartId,
 * shippingAddress, billingAddress }` plus the REQUIRED `Idempotency-Key`
 * header (1..128 chars, trimmed, header — never in the body) and returns
 * `ApiResponse<CheckoutResponse>` (`Pending`; the saga moves it to
 * `Confirmed | Cancelled` asynchronously — poll `GET /orders/{id}`,
 * owned by Phase 10, not here).
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * CheckoutState (8.3 — not this sub-phase; feature-owned local Signals)
 *         ↓ CheckoutApiService (this file — thin typed façade + key mint)
 *     ApiClient (Phase 1, the ONLY HttpClient user)
 *         ↓ HttpClient → interceptors → ASP.NET Core API
 * ```
 *
 * Contract fidelity rules enforced here (same convention as
 * `CartApiService`, Phase 7.2):
 * - Request/response types come from `@flux/models` plus the §8.1
 *   `CreateOrderRequest`/`CreateOrderResponse` aliases (`../models`) — no
 *   local re-declarations, so no contract drift is possible.
 * - The route template comes from `ORDERS_ENDPOINTS` — no scattered
 *   string literals.
 * - The service never unwraps `ApiResponse.data`, never catches or
 *   remaps errors, and never attaches tokens: the envelope stays intact
 *   for feature state (8.3) to map, validation and business failures
 *   (`400` invalid key/empty cart/bad address, `401` anonymous, `403`
 *   foreign cart, `404` unknown cart, `409` key reuse/unavailable or
 *   duplicate variant/currency mix) flow untouched through the Observable
 *   error channel to the Phase 1 error normalizer, and `Authorization`
 *   stays owned by the interceptor pipeline.
 * - The service performs no business logic: no address normalization, no
 *   totals math, no retry policy, no duplicate-submission guard (the
 *   8.3 `isCheckoutSubmitting` flag is the client-side guard; the
 *   `Idempotency-Key` header is the server-side backstop).
 * - Cancellation travels through `ApiRequestOptions.signal` (Phase 1
 *   `cancelOnAbort` completes pre-aborted/in-flight aborts silently —
 *   never as errors). The service forwards the signal; lifecycle
 *   ownership (`destroySignal(destroyRef)`) belongs to the 8.3 caller.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 8.3 — no feature state, no signals, no `submitOrder`/reset store
 *   implementations.
 * - 8.4 — no pages, no components, no Reactive Forms, no routes.
 * - Phase 9 — no payment, Stripe, or client-secret logic.
 */

import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import {
  ApiClient,
  newCorrelationId,
  ORDERS_ENDPOINTS,
  type ApiRequestOptions,
  type ApiResponseWithData,
} from '@flux/api';
import type { CreateOrderRequest, CreateOrderResponse } from '../models/checkout.models';

/**
 * Mints a fresh `Idempotency-Key` value (UUID v4, 36 chars — within the
 * contract's 1..128 bounds). Delegates to the Phase 1 SSR-safe generator
 * (`globalThis.crypto.randomUUID()` with a `Math.random` fallback — never
 * `window`/`document`). Mint once per checkout attempt; reuse the same
 * key + body on retry/network failure; mint a new key for a new payload
 * (same key + different body → `409 IdempotencyConflict`). Pure —
 * performs no HTTP and throws nothing.
 */
export function newIdempotencyKey(): string {
  return newCorrelationId();
}

/**
 * Thin typed façade over the checkout contract. Each method maps 1:1 to
 * one endpoint (same name, same params, same envelope); there is no
 * mapping here because feature state owns envelope handling.
 */
@Injectable({ providedIn: 'root' })
export class CheckoutApiService {
  private readonly api = inject(ApiClient);

  /**
   * `POST /orders/checkout` — authenticated (JWT via the interceptor
   * pipeline). Creates the order for the named cart with the two
   * customer-entered addresses.
   *
   * `idempotencyKey` travels as request `context` (the interceptor
   * pipeline sets the `Idempotency-Key` header from it) — never in the
   * body. It passes through verbatim: structural validity
   * (`isValidIdempotencyKey`, §8.1 models) is the caller's check, and
   * minting (`newIdempotencyKey`, above) is the caller's supply.
   *
   * `options.signal` aborts the call silently (Phase 1 `cancelOnAbort`);
   * any other `options` (correlation, culture) merge alongside the key.
   *
   * Success: `200 ApiResponse<CheckoutResponse>` (`Pending` — poll for
   * the terminal status in Phase 10).
   * Failures: `400` invalid key/empty cart/bad address, `401`
   * anonymous, `403` foreign cart, `404` unknown cart, `409` key
   * reuse/unavailable or duplicate variant/currency mix — all propagate
   * untouched through the error channel.
   */
  createOrder(
    body: CreateOrderRequest,
    idempotencyKey: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<CreateOrderResponse>> {
    return this.api.post<ApiResponseWithData<CreateOrderResponse>>(
      ORDERS_ENDPOINTS.checkout.path,
      body,
      {
        ...options,
        context: { ...options.context, idempotencyKey },
      },
    );
  }
}
