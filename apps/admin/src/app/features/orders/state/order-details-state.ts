/**
 * Feature-owned order details state for Sub-Phase 14.5 — Order Details &
 * Customer Information.
 *
 * Scope: the single order slot behind the details page
 * (`GET /admin/orders/{orderId}` — the only order read beyond the list; the
 * payload carries totals, items, addresses, and status verbatim).
 * Payment reads arrive with the payment slice (Sub-Phase 14.6+); no
 * order payload carries payment fields, so this state performs no
 * payment reads and no status inference.
 *
 * Display contract (14.1 audit — only backend-exposed data): the slot
 * carries the backend-issued details verbatim (nested money objects on
 * totals, split flat money fields on line items, shipping/billing
 * address echo). No totals math, no status derivation, no
 * customer-identity resolution (no `userId`/`customerId`/email exists on
 * the payload — addresses are the complete customer information).
 *
 * Locality rules (same convention as the catalog states):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to `error`.
 * CSR-safe: no browser APIs anywhere in this file.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 14.6–14.8 — no payment slots, no payment linkage, no history.
 */

import { inject, Injectable, OnDestroy, type Signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  ApiError,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiResponseWithData,
  type ResourceState,
  type ResourceStateStore,
} from '@flux/api';
import type { OrderDetailsResponse } from '@flux/models';
import { OrdersAdminApiService } from '../data-access/orders-admin-api.service';
import type { AdminOrderDetailsRecord } from '../models/orders-admin.models';

/**
 * Feature-scoped order details state. Provide at the orders route level
 * — never at root. All selectors are readonly signals; loads are
 * explicit calls driven by the owning page from the route id.
 */
@Injectable()
export class OrderDetailsState implements OnDestroy {
  private readonly ordersApi = inject(OrdersAdminApiService);
  private loads = new Subscription();

  private readonly orderStore: ResourceStateStore<AdminOrderDetailsRecord> =
    createResourceState<AdminOrderDetailsRecord>();

  /** Current order details (idle → loading → success | error). */
  readonly order: Signal<ResourceState<AdminOrderDetailsRecord>> = this.orderStore.state;

  /**
   * Loads the details slot for `orderId`. A load issued while another is
   * in flight supersedes it: the previous subscription is torn down
   * first, so navigating between orders can never interleave responses.
   * Blank ids are no-ops (the route always carries an id).
   */
  load(orderId: string | null | undefined): void {
    if (orderId === null || orderId === undefined || orderId.trim() === '') {
      return;
    }
    this.loads.unsubscribe();
    this.loads = new Subscription();
    const request: Observable<AdminOrderDetailsRecord> = this.ordersApi
      .getOrder(orderId)
      .pipe(map(requireOrderDetails));
    this.loads.add(loadResourceState(this.orderStore, request));
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps a details envelope; a dataless `200` is a contract violation. */
function requireOrderDetails(
  envelope: ApiResponseWithData<OrderDetailsResponse>,
): AdminOrderDetailsRecord {
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
