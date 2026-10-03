/**
 * Admin Payments data-access service for Supplement S1, Step S1.9 —
 * Payments: Mine + Admin + Stats (admin slice).
 *
 * Scope: the `[Route admin/payments]` surface (platform-wide paged list
 * with filters, stats snapshot, unscoped details read). Read-only: no
 * Stripe calls, no payment mutations, no webhook (Stripe→API only, never
 * called by the SPA), no history (no such endpoint — see
 * `PAYMENT_HISTORY_SUPPORTED` in `../models/payments-admin.models`).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §6.5
 * (permission-gated admin payments: `payments.read` for list/details,
 * `payments.stats` for stats) and the S1.1 audit
 * (`libs/models/.../contract-evolution-audit` + `orders-payments-contract`).
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * Payments States (../state, route-provided)
 *         ↓ PaymentsAdminApiService (this file — thin typed façade)
 *     ApiClient (Phase 1, the ONLY HttpClient user)
 *         ↓ HttpClient → interceptors → ASP.NET Core API
 * ```
 *
 * Contract fidelity rules enforced here (same convention as
 * `OrdersAdminApiService`):
 * - Request/response types come from `@flux/models` — no local
 *   re-declarations, so no contract drift is possible.
 * - Route templates come from `ADMIN_PAYMENTS_ENDPOINTS` — no scattered
 *   string literals.
 * - Query objects convert through the single `toQueryParams` funnel —
 *   never hand-built query strings.
 * - The service never unwraps `ApiResponse.data`, never catches or
 *   remaps errors, and never attaches tokens: envelopes stay intact
 *   for feature state to map, failures flow untouched to the Phase 1
 *   error normalizer, and `Authorization` stays owned by the
 *   interceptor pipeline.
 *
 * Explicitly out of scope (must not appear here):
 * - Payment history (no such endpoint), payment mutations (none exist),
 *   webhook (Stripe→API only), client-secret handling (no secret travels
 *   on the admin reads — and any live secret is discarded at the state
 *   mapping boundary by construction).
 * - No checkout (customer flow), no totals math, no status derivation.
 */

import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  AdminPaymentListQuery,
  PaymentAdminResponse,
  PaymentAdminStatsResponse,
} from '@flux/models';
import {
  ApiClient,
  ADMIN_PAYMENTS_ENDPOINTS,
  toQueryParams,
  type ApiRequestOptions,
  type ApiResponseWithData,
  type PagedApiResponse,
} from '@flux/api';

/**
 * Thin typed façade over the admin Payments contract. Each method maps
 * 1:1 to one endpoint (same name, same params, same envelope); there is
 * no mapping here because feature state owns envelope handling.
 *
 * Feature-scoped (no `providedIn`): provided at the payments route level
 * alongside the payments states — never a root singleton (Phase 12.8
 * pins the root-provided admin allowlist; this service is not on it).
 */
@Injectable()
export class PaymentsAdminApiService {
  private readonly api = inject(ApiClient);

  /**
   * `GET /admin/payments` — paged platform-wide payment list,
   * newest-first. Filters: `status?` (`Pending|Processing|Succeeded|
   * Failed|Cancelled|Refunded`), `orderId?`, `customerId?`, `from?`/
   * `to?` (unknown status or `from > to` → `400
   * Payment.ValidationFailed`). No ownership scoping — the caller sees
   * every customer's payments.
   * Success: `200 ApiResponse<PagedResult<PaymentAdminResponse>>`.
   * Failures: `400` validation, `401` anonymous, `403` missing
   * `payments.read`.
   */
  listPayments(
    query: AdminPaymentListQuery = {},
    options: ApiRequestOptions = {},
  ): Observable<PagedApiResponse<PaymentAdminResponse>> {
    return this.api.get<PagedApiResponse<PaymentAdminResponse>>(
      ADMIN_PAYMENTS_ENDPOINTS.listAdminPayments.path,
      { ...options, params: toQueryParams(query) },
    );
  }

  /**
   * `GET /admin/payments/stats` — payment counters snapshot (`total`,
   * per-status buckets, `totalsByCurrency` with per-currency succeeded
   * counts and amounts).
   * Success: `200 ApiResponse<PaymentAdminStatsResponse>`.
   * Failures: `401` anonymous, `403` missing `payments.stats`.
   */
  paymentStats(
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<PaymentAdminStatsResponse>> {
    return this.api.get<ApiResponseWithData<PaymentAdminStatsResponse>>(
      ADMIN_PAYMENTS_ENDPOINTS.paymentStats.path,
      options,
    );
  }

  /**
   * `GET /admin/payments/{paymentId}` — single payment read model
   * (amount, currency, provider, intent reference, status — all
   * backend-issued, display only). No ownership scoping (unlike the
   * customer read, strangers do not mask as `404` here — unknown ids
   * do).
   * Success: `200 ApiResponse<PaymentAdminResponse>`.
   * Failures: `401` anonymous, `403` missing `payments.read`, `404`
   * unknown payment.
   */
  getPayment(
    paymentId: string,
    options: ApiRequestOptions = {},
  ): Observable<ApiResponseWithData<PaymentAdminResponse>> {
    return this.api.get<ApiResponseWithData<PaymentAdminResponse>>(
      ADMIN_PAYMENTS_ENDPOINTS.getAdminPayment.path,
      { ...options, pathParams: { paymentId, ...(options.pathParams ?? {}) } },
    );
  }
}
