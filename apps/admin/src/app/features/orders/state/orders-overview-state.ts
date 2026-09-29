/**
 * Feature-owned Orders overview state for Sub-Phase 14.2 — Admin Orders
 * Feature Foundation.
 *
 * Scope: the landing-page overview only (one first-page read whose
 * backend-issued `totalCount` proves the API connection and feeds the
 * overview fact). List/detail/payment slots arrive with the business
 * slices that own their pages (Sub-Phases 14.3–14.8).
 *
 * Display contract (14.1 audit — only backend-exposed data): the slot
 * carries the paged caller-owned result verbatim; the overview projects
 * its `totalCount` for display only (there is no platform-wide admin
 * list — an admin JWT sees its own orders). No totals math, no status
 * derivation, no customer-identity resolution.
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

import { computed, inject, Injectable, OnDestroy, type Signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  ApiError,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiResponseWithData,
  type PagedApiResponse,
  type PagedResult,
  type ResourceState,
  type ResourceStateStore,
  type ResourceStatus,
} from '@flux/api';
import type { OrderSummaryResponse } from '@flux/models';
import { OrdersAdminApiService } from '../data-access/orders-admin-api.service';
import {
  toOrdersOverview,
  type AdminOrderPage,
  type OrdersOverview,
} from '../models/orders-admin.models';

/**
 * Overview fetch size: the landing page needs the backend-issued
 * `totalCount` only, so one row minimizes payload while keeping the
 * envelope (and its effective paging values) intact.
 */
export const ORDERS_OVERVIEW_PAGE_SIZE = 1;

/**
 * Feature-scoped orders overview state. Provide at the orders route
 * level — never at root. All selectors are readonly signals; the only
 * transition is the explicit `refresh()` driven by the owning page.
 */
@Injectable()
export class OrdersOverviewState implements OnDestroy {
  private readonly ordersApi = inject(OrdersAdminApiService);
  private readonly loads = new Subscription();

  private readonly ordersStore: ResourceStateStore<AdminOrderPage> =
    createResourceState<AdminOrderPage>();

  /** Current first-page order result (idle → loading → success | empty | error). */
  readonly orders: Signal<ResourceState<AdminOrderPage>> = this.ordersStore.state;

  /**
   * Landing status derived from the single slot: `loading` while the
   * slot loads, `error` when it fails, `empty` when it settles with no
   * rows (zero `totalCount`), `success` once it carries data, `idle`
   * before the first refresh.
   */
  readonly status: Signal<ResourceStatus> = computed(() => {
    const orders = this.ordersStore.state();
    if (orders.isLoading) {
      return 'loading';
    }
    if (orders.isError) {
      return 'error';
    }
    if (orders.isEmpty) {
      return 'empty';
    }
    if (orders.isSuccess) {
      return 'success';
    }
    return 'idle';
  });

  /**
   * Projected overview once the slot settles with data (an `empty` page
   * still carries its zero `totalCount`, so the projection stays
   * available); `null` while loading, failed, or untouched.
   */
  readonly overview: Signal<OrdersOverview | null> = computed(() => {
    const orders = this.ordersStore.data();
    if (orders === null) {
      return null;
    }
    return toOrdersOverview(orders);
  });

  /** First normalized failure (the single slot). */
  readonly error = computed(() => this.ordersStore.error());

  /**
   * (Re)loads the overview slot; landing retry re-enters here. A refresh
   * issued while a load is in flight is a no-op (duplicate-submit
   * prevention at the state level — the page holds no request flags).
   */
  refresh(): void {
    if (this.status() === 'loading') {
      return;
    }
    const ordersRequest: Observable<AdminOrderPage> = this.ordersApi
      .listOrders({ pageNumber: 1, pageSize: ORDERS_OVERVIEW_PAGE_SIZE })
      .pipe(map(requirePage));
    this.loads.add(
      loadResourceState(this.ordersStore, ordersRequest, {
        isEmpty: (page) => page.items.length === 0,
      }),
    );
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps a paged envelope; a dataless `200` is a contract violation. */
function requirePage(
  envelope: PagedApiResponse<OrderSummaryResponse>,
): PagedResult<OrderSummaryResponse> {
  const data = (envelope as ApiResponseWithData<PagedResult<OrderSummaryResponse>>).data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}
