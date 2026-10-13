/**
 * Storefront Order details state for Sub-Phases 10.4 (Order Details)
 * and 10.6 (Order History & Post-Payment Synchronization).
 *
 * Scope: `docs/phases/PHASE_10_ORDERS_CUSTOMER_ACCOUNT.md` §§10.4/10.6
 * (single-order resource plus bounded post-payment synchronization —
 * no list state, no cancel orchestration, no status mapping).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §4
 * (`GET /orders/{orderId}` → `ApiResponse<OrderDetailsResponse>`;
 * authenticated + ownership — foreign ids mask as `404`, never probe),
 * `docs/frontend-contract/ERROR_CATALOG.md` §4 (`401` anonymous,
 * `404` unknown-or-foreign id; no `403` is emitted on this route, but
 * the forbidden slot stays handled defensively per §10.4), and
 * `docs/frontend-contract/PAYMENT_INTEGRATION_NOTES.md` §2 (the saga
 * moves orders `Pending` → `Confirmed | Cancelled` asynchronously, so
 * polling the order read is REQUIRED backend behavior — never
 * speculation).
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
 *   (forward/backward navigation between orders) and resets the sync
 *   loop. `retry()` forces a fresh load of the requested id after
 *   errors.
 * - Bounded synchronization (`startSync`/`stopSync`, §10.6.2 — the
 *   `timer` + `take` + `exhaustMap` cadence from the §9.9 payment
 *   readiness poll): first re-read immediate, then one per
 *   `ORDER_SYNC_POLL_INTERVAL_MS`, at most `ORDER_SYNC_MAX_ATTEMPTS`
 *   ticks. Stops early on terminal status; stopping failures
 *   (`401 | 403 | 404`) surface into the error slot at once while
 *   transient failures skip the tick with the last settled order left
 *   untouched. A second `startSync` while a loop is open is a safe
 *   no-op (duplicate-loop prevention); `exhaustMap` keeps a single
 *   request in flight (overlap prevention). Teardown is the owner's:
 *   `stopSync()` (or unsubscribing nothing — the state owns the single
 *   loop subscription) on destroy/navigation.
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
 * - 10.6.1 history — no backend history contract exists (see
 *   `ORDERS_HISTORY_SUPPORTED`), so no timeline state lives here.
 * - 10.7 — no routing or guard changes.
 */

import { Injectable, inject, signal } from '@angular/core';
import {
  EMPTY,
  catchError,
  exhaustMap,
  map,
  take,
  takeWhile,
  tap,
  timer,
  Subscription,
  throwError,
  type Observable,
} from 'rxjs';
import {
  createResourceState,
  loadResourceState,
  type ApiRequestOptions,
  type ApiResponseWithData,
} from '@flux/api';
import { OrdersApiService } from '../data-access/orders-api.service';
import { isTerminalOrder, type Order } from '../models/orders.models';
import {
  ORDER_SYNC_MAX_ATTEMPTS,
  ORDER_SYNC_POLL_INTERVAL_MS,
  isSyncStoppingFailure,
  needsOrderSync,
} from '../models/order-sync.models';

/** Options for `OrderDetailsState.loadOrder`. */
export interface LoadOrderDetailsOptions extends ApiRequestOptions {
  /**
   * Reload even after a settled success on the same id (error retries
   * always reload). Defaults to `false`.
   */
  readonly force?: boolean;
}

/** Options for `OrderDetailsState.startSync`. */
export interface StartOrderSyncOptions {
  /** Tick interval in milliseconds (defaults to `ORDER_SYNC_POLL_INTERVAL_MS`). */
  readonly intervalMs?: number;
  /** Maximum ticks per entry (defaults to `ORDER_SYNC_MAX_ATTEMPTS`). */
  readonly maxAttempts?: number;
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

  /** Open synchronization loop, if any (single loop — see `startSync`). */
  private syncSubscription: Subscription | null = null;

  /** True while a synchronization loop is open. */
  private readonly syncing = signal(false);

  /** True once a loop exhausted its budget on a still non-terminal order. */
  private readonly syncExhaustedStore = signal(false);

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

  /** True while a bounded synchronization loop is open. */
  readonly isSyncing = this.syncing.asReadonly();

  /** True after a loop exhausted its budget on a non-terminal order. */
  readonly syncExhausted = this.syncExhaustedStore.asReadonly();

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
    if (orderId !== this.requestedId()) {
      // New order context: the previous loop (if any) must not settle
      // over the incoming order, and exhaustion belongs to the old id.
      this.stopSync();
      this.syncExhaustedStore.set(false);
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
   * Starts the bounded post-payment synchronization loop for the
   * requested id: first re-read immediate, then one per `intervalMs`,
   * at most `maxAttempts` ticks. Safe no-ops (no HTTP, no timer): an
   * open loop, a missing/terminal order, or a blank id. Every settled
   * tick refreshes the order slot verbatim; the loop completes early on
   * the first terminal status and records exhaustion otherwise (the
   * last settled order stays on screen — exhaustion never fabricates
   * terminality). Stopping failures (`401 | 403 | 404`) surface into
   * the error slot at once; transient failures skip the tick.
   */
  startSync(options: StartOrderSyncOptions = {}): void {
    const intervalMs = options.intervalMs ?? ORDER_SYNC_POLL_INTERVAL_MS;
    const maxAttempts = options.maxAttempts ?? ORDER_SYNC_MAX_ATTEMPTS;
    const orderId = this.requestedId();
    const order = this.order();
    if (
      this.syncSubscription !== null ||
      orderId === null ||
      orderId.trim() === '' ||
      order === null ||
      !this.isSuccess() ||
      !needsOrderSync(order.status)
    ) {
      return;
    }
    this.syncExhaustedStore.set(false);
    this.syncing.set(true);
    this.syncSubscription = timer(0, intervalMs)
      .pipe(
        take(maxAttempts),
        exhaustMap(() =>
          this.ordersApi
            .getOrderById(orderId)
            .pipe(
              catchError((error: unknown) =>
                isSyncStoppingFailure(error) ? throwError(() => error) : EMPTY,
              ),
            ),
        ),
        tap((envelope: ApiResponseWithData<Order>) => {
          const synced = envelope.data ?? null;
          if (synced !== null) {
            this.orderStore.setSuccess(synced);
          }
        }),
        takeWhile((envelope: ApiResponseWithData<Order>) => {
          const synced = envelope.data ?? null;
          return synced === null || !isTerminalOrder(synced.status);
        }, true),
      )
      .subscribe({
        error: (error: unknown) => {
          this.closeSync();
          this.orderStore.setError(error);
        },
        complete: () => {
          const settled = this.order();
          this.closeSync();
          this.syncExhaustedStore.set(
            settled !== null && this.isSuccess() && needsOrderSync(settled.status),
          );
        },
      });
  }

  /**
   * Stops the open synchronization loop, if any (owner teardown:
   * destroy/navigation). Never touches the settled order or the error
   * slot — stopping is not failure.
   */
  stopSync(): void {
    this.closeSync();
  }

  /** Unsubscribes the loop and lowers the syncing flag. */
  private closeSync(): void {
    this.syncSubscription?.unsubscribe();
    this.syncSubscription = null;
    this.syncing.set(false);
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
