/**
 * Feature-owned Orders overview state for Sub-Phase 14.2 — Admin Orders
 * Feature Foundation — plus Supplement S1, Step S1.8 (counts snapshot).
 *
 * Scope: the landing-page overview only (the backend-issued counters
 * snapshot — no list slot, no query state, no pagination/filter/sort
 * transitions).
 *
 * Display contract (S1.1 audit — only backend-exposed data): every
 * bucket echoes verbatim for display (`total/pending/confirmed/
 * cancelled` — never inputs to math, never recomputed client-side).
 *
 * Locality rules (same convention as the catalog states):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to
 * `error`. CSR-safe: no browser APIs anywhere in this file.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 14.3–14.4 — no list slot, no query state, no pagination/filter/sort
 *   transitions.
 * - 14.5 — no details slot, no address rendering.
 * - 14.6–14.8 — no payment slots.
 */

import { inject, Injectable, OnDestroy, type Signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  ApiError,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiRequestOptions,
  type ApiResponseWithData,
  type ResourceState,
  type ResourceStateStore,
} from '@flux/api';
import type { AdminOrderCountsResponse } from '@flux/models';
import { OrdersAdminApiService } from '../data-access/orders-admin-api.service';

/**
 * Feature-scoped orders overview state. Provide at the orders route
 * level — never at root. All selectors are readonly signals; the only
 * transition is the explicit `refresh()` driven by the owning page.
 */
@Injectable()
export class OrdersOverviewState implements OnDestroy {
  private readonly ordersApi = inject(OrdersAdminApiService);
  private readonly loads = new Subscription();

  private readonly countsStore: ResourceStateStore<AdminOrderCountsResponse> =
    createResourceState<AdminOrderCountsResponse>();

  /** Current counts snapshot (idle → loading → success | error). */
  readonly counts: Signal<ResourceState<AdminOrderCountsResponse>> = this.countsStore.state;

  /**
   * (Re)loads the counts snapshot; landing retry re-enters here. A
   * refresh issued while a load is in flight is a no-op
   * (duplicate-submit prevention at the state level — the page holds no
   * request flags).
   */
  refresh(options: ApiRequestOptions = {}): void {
    if (this.countsStore.isLoading()) {
      return;
    }
    const request: Observable<AdminOrderCountsResponse> = this.ordersApi
      .orderCounts(options)
      .pipe(map(requireCounts));
    this.loads.add(loadResourceState(this.countsStore, request));
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps a counts envelope; a dataless `200` is a contract violation. */
function requireCounts(
  envelope: ApiResponseWithData<AdminOrderCountsResponse>,
): AdminOrderCountsResponse {
  const data = envelope.data ?? null;
  if (data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}
