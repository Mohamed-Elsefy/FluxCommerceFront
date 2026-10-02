/**
 * Feature-owned inventory counts state for Supplement S1, Step S1.7 —
 * Inventory Lists & Counts (overview slice).
 *
 * Scope: the counts snapshot only (`GET /inventory/counts` with the
 * default `lowStockThreshold` of 5 — inclusive available ceiling for
 * the low-stock bucket). Every bucket echoes verbatim for display
 * (never an input to math, never recomputed client-side).
 *
 * Locality rules (same convention as the catalog states):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, envelopes
 * unwrap here, dataless envelopes resolve to `error`. CSR-safe: no
 * browser APIs anywhere in this file.
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
import type { InventoryCountsResponse } from '@flux/models';
import { InventoryAdminApiService } from '../data-access/inventory-admin-api.service';

/**
 * Feature-scoped inventory counts state. Provide at the inventory route
 * level — never at root.
 */
@Injectable()
export class InventoryCountsState implements OnDestroy {
  private readonly inventoryApi = inject(InventoryAdminApiService);
  private loads = new Subscription();

  private readonly countsStore: ResourceStateStore<InventoryCountsResponse> =
    createResourceState<InventoryCountsResponse>();

  /** Current counts snapshot (idle → loading → success | error). */
  readonly counts: Signal<ResourceState<InventoryCountsResponse>> = this.countsStore.state;

  /**
   * Loads the counts snapshot. A load issued while another is in flight
   * supersedes it. `options.signal` carries cancellation.
   */
  load(options: ApiRequestOptions = {}): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    const request: Observable<InventoryCountsResponse> = this.inventoryApi
      .itemCounts({}, options)
      .pipe(map(requireCounts));
    this.loads.add(loadResourceState(this.countsStore, request));
  }

  /** Reloads the snapshot (error-state retry path). */
  reload(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps a counts envelope; a dataless `200` is a contract violation. */
function requireCounts(
  envelope: ApiResponseWithData<InventoryCountsResponse>,
): InventoryCountsResponse {
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
