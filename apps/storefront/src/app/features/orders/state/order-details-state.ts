/**
 * Storefront Order details state for Sub-Phase 10.4 — Order Details.
 *
 * Scope: `docs/phases/PHASE_10_ORDERS_CUSTOMER_ACCOUNT.md` §10.4
 * (single-order resource only — no list state, no cancel orchestration,
 * no status mapping, no polling).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §4
 * (`GET /orders/{orderId}` → `ApiResponse<OrderDetailsResponse>`;
 * authenticated + ownership — foreign ids mask as `404`, never probe)
 * and `docs/frontend-contract/ERROR_CATALOG.md` §4 (`401` anonymous,
 * `404` unknown-or-foreign id; no `403` is emitted on this route, but
 * the forbidden slot stays handled defensively per §10.4).
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * OrderDetailsPage (pages/ — orchestration only)
 *     ↓ OrderDetailsState (this file — route-provided local Signals)
 *     ↓ OrdersApiService (data-access/ — §10.1 thin typed façade)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 *
 * State rules (the Catalog/Cart/Checkout/Payment pattern —
 * route-provided on the `:orderId` entry, never `providedIn`, never a
 * global store):
 * - One order resource slot (`idle → loading → success | error`,
 *   shared Phase 1 `createResourceState`/`loadResourceState`) plus the
 *   requested id. There is no `empty` outcome for a single order: a
 *   `200` without `data` is a contract breach → error, never a rendered
 *   order.
 * - Loads dedupe: a concurrent same-id load, or a repeat after success
 *   without `force`, is a safe no-op. A different id always reloads
 *   (forward/backward navigation between orders). `retry()` forces a
 *   fresh load of the requested id after errors.
 * - Cancellation travels through `options.signal` (Phase 1
 *   `cancelOnAbort` completes pre-aborted/in-flight aborts silently —
 *   never as errors; state stays untouched).
 * - No business logic in state: no totals math, no status derivation
 *   (order and payment statuses stay independent and verbatim), no
 *   transitions — backend values render as received.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.4-cancel — no cancel orchestration (transport only, §10.1).
 * - 10.5 — no status badges or localized status mapping.
 * - 10.6 — no history reads or post-payment polling.
 */

import { Injectable, inject, signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  createResourceState,
  loadResourceState,
  type ApiRequestOptions,
  type ApiResponseWithData,
} from '@flux/api';
import { OrdersApiService } from '../data-access/orders-api.service';
import type { Order } from '../models/orders.models';

/** Options for `OrderDetailsState.loadOrder`. */
export interface LoadOrderDetailsOptions extends ApiRequestOptions {
  /**
   * Reload even after a settled success on the same id (error retries
   * always reload). Defaults to `false`.
   */
  readonly force?: boolean;
}

/**
 * Feature-scoped order details state: the single settled order plus the
 * requested id. Provided on the `:orderId` route entry (one instance per
 * details entry — never a global store, no `providedIn`).
 */
@Injectable()
export class OrderDetailsState {
  private readonly ordersApi = inject(OrdersApiService);
  private readonly orderStore = createResourceState<Order>();

  /** Requested order identifier (route `:orderId`, opaque to the frontend). */
  private readonly requestedId = signal<string | null>(null);

  /** Order resource lifecycle (`idle | loading | success | error`). */
  readonly status = this.orderStore.status;

  /** Settled backend order, or `null` until the first success. */
  readonly order = this.orderStore.data;

  /** Normalized order failure (`ApiError | null`). */
  readonly error = this.orderStore.error;

  /** True while the order request is in flight. */
  readonly isLoading = this.orderStore.isLoading;

  /** True once a backend order has settled successfully. */
  readonly isSuccess = this.orderStore.isSuccess;

  /** True when the last order load failed. */
  readonly isError = this.orderStore.isError;

  /** Currently requested order id. */
  readonly orderId = this.requestedId.asReadonly();

  /**
   * Loads the backend order into the resource slot. Blank ids fail
   * locally (nothing to request — never an HTTP call); failures —
   * including a `200` without `data` — land in the error slot untouched
   * for the page to classify (`404`/`403`/`401`/generic). Returns the
   * subscription for owner-managed teardown.
   */
  loadOrder(orderId: string, options: LoadOrderDetailsOptions = {}): Subscription {
    if (orderId.trim() === '') {
      this.requestedId.set(null);
      this.orderStore.setError(new Error('Order details requested without an order id.'));
      return Subscription.EMPTY;
    }
    if (this.orderStore.isLoading() && orderId === this.requestedId()) {
      return Subscription.EMPTY;
    }
    if (!options.force && this.orderStore.isSuccess() && orderId === this.requestedId()) {
      return Subscription.EMPTY;
    }
    this.requestedId.set(orderId);
    return loadResourceState(this.orderStore, this.orderSource(orderId, options), {
      signal: options.signal,
    });
  }

  /** Forces a fresh load of the requested id (error-state retry path). */
  retry(): Subscription {
    const orderId = this.requestedId();
    if (orderId === null) {
      return Subscription.EMPTY;
    }
    return this.loadOrder(orderId, { force: true });
  }

  /**
   * Live order source: unwraps `ApiResponse.data` (missing data is a
   * contract breach → normalized failure, never a rendered order).
   */
  private orderSource(orderId: string, options: ApiRequestOptions = {}): Observable<Order> {
    return this.ordersApi.getOrderById(orderId, options).pipe(
      map((envelope: ApiResponseWithData<Order>) => {
        const order = envelope.data ?? null;
        if (order === null) {
          throw new Error('Order details response carried no data.');
        }
        return order;
      }),
    );
  }
}
