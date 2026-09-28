/**
 * Feature-owned order payment state for Sub-Phase 14.6 — Payment
 * Integration & Order-Payment Presentation.
 *
 * Scope: the single payment slot behind the order details payment
 * section. The slot resolves through the ONLY order→payment linkage the
 * backend exposes: `GET /api/payments/by-order/{orderId}` (yields the
 * payment id) followed by `GET /api/payments/{paymentId}` (yields the
 * display facts). No order payload carries payment fields, so no
 * linkage is derived anywhere else.
 *
 * Display contract (14.1 audit — only backend-exposed data): the slot
 * carries the projected view verbatim (status, intent reference,
 * provider, amount/currency — display only). The live `clientSecret`
 * from the initialization read is discarded at the mapping boundary
 * (see `toOrderPaymentView`): never stored, never rendered, never
 * logged. No payment verification, no lifecycle, no provider
 * interaction, no status inference (order `status` never implies payment
 * `status` and vice versa).
 *
 * Failure contract (status-first, never message-text-based): the page
 * branches on the normalized HTTP status — `404` renders the empty
 * notice (missing payment or masked stranger), `409` renders the
 * retryable notice (`NotReady` saga lag and `NotPayable` terminal share
 * the status with no machine code on the wire, so both retry without
 * interpretation), anything else renders the error state with retry.
 *
 * Locality rules (same convention as the catalog states):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to `error`.
 * CSR-safe: no browser APIs anywhere in this file.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 14.7 — no `PaymentStatusBadge` mapping (presentation only).
 * - 14.8 — no payment history (no such endpoint).
 */

import { inject, Injectable, OnDestroy, type Signal } from '@angular/core';
import { map, switchMap, Subscription, type Observable } from 'rxjs';
import {
  ApiError,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiResponseWithData,
  type ResourceState,
  type ResourceStateStore,
} from '@flux/api';
import type { PaymentInitializationResult, PaymentResponse } from '@flux/models';
import { OrdersAdminApiService } from '../data-access/orders-admin-api.service';
import { toOrderPaymentView, type OrderPaymentView } from '../models/orders-admin.models';

/**
 * Feature-scoped order payment state. Provide at the orders route level
 * — never at root. All selectors are readonly signals; loads are
 * explicit calls driven by the owning page from the route id, next to
 * the details slot (independent lifecycles — a payment failure never
 * hides settled order facts).
 */
@Injectable()
export class OrderPaymentState implements OnDestroy {
  private readonly ordersApi = inject(OrdersAdminApiService);
  private loads = new Subscription();

  private readonly paymentStore: ResourceStateStore<OrderPaymentView> =
    createResourceState<OrderPaymentView>();

  /** Current order payment view (idle → loading → success | error). */
  readonly payment: Signal<ResourceState<OrderPaymentView>> = this.paymentStore.state;

  /**
   * Loads the payment slot for `orderId` (initialization read chained
   * into the payment read). A load issued while another is in flight
   * supersedes it. Blank ids are no-ops (the route always carries an
   * id).
   */
  load(orderId: string | null | undefined): void {
    if (orderId === null || orderId === undefined || orderId.trim() === '') {
      return;
    }
    this.loads.unsubscribe();
    this.loads = new Subscription();
    const request: Observable<OrderPaymentView> = this.ordersApi.paymentByOrder(orderId).pipe(
      map(requireInit),
      switchMap((init) =>
        this.ordersApi
          .getPayment(init.paymentId)
          .pipe(map((payment) => toOrderPaymentView(requirePayment(payment), init))),
      ),
    );
    this.loads.add(loadResourceState(this.paymentStore, request));
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps an initialization envelope; a dataless `200` is a violation. */
function requireInit(
  envelope: ApiResponseWithData<PaymentInitializationResult>,
): PaymentInitializationResult {
  const data = envelope.data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}

/** Unwraps a payment envelope; a dataless `200` is a violation. */
function requirePayment(envelope: ApiResponseWithData<PaymentResponse>): PaymentResponse {
  const data = envelope.data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}
