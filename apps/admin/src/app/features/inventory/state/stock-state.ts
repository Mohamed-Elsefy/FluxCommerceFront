/**
 * Feature-owned stock lookup state for Sub-Phase 13.9 — Stock &
 * Inventory Status.
 *
 * Scope: the single-SKU stock slot behind the stock page
 * (`GET /inventory/{sku}` — the only stock read the backend exposes:
 * no list, no pagination, no filtering, no sorting, no search). Stock
 * creation and adjustments run in the slices that own their forms
 * (13.10); this state only loads the settled truth.
 *
 * Display contract (13.1 audit — only backend-exposed data): the slot
 * carries the backend-issued quantities verbatim (`onHandQuantity`,
 * `reservedQuantity`, `availableQuantity`) plus the update timestamp.
 * `availableQuantity` is never derived client-side, no status or
 * threshold is invented (a "low stock" badge would be an undelegated
 * business rule), and no product/variant name resolves (the payload
 * carries the SKU alone and no lookup-by-SKU endpoint exists).
 *
 * Locality rules (same convention as the catalog states):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to
 * `error`. CSR-safe: no browser APIs anywhere in this file.
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
import type { InventoryItemResponse } from '@flux/models';
import { InventoryAdminApiService } from '../data-access/inventory-admin-api.service';
import { normalizeSkuInput, type AdminStockRow } from '../models/inventory-admin.models';

/**
 * Feature-scoped stock lookup state. Provide at the inventory route
 * level — never at root. All selectors are readonly signals; lookups
 * are explicit calls driven by the owning page.
 */
@Injectable()
export class StockState implements OnDestroy {
  private readonly inventoryApi = inject(InventoryAdminApiService);
  private loads = new Subscription();

  private readonly stockStore: ResourceStateStore<AdminStockRow> =
    createResourceState<AdminStockRow>();

  /** Current stock record (idle → loading → success | error). */
  readonly stock: Signal<ResourceState<AdminStockRow>> = this.stockStore.state;

  /**
   * Looks up one SKU (normalized for transport determinism — see
   * `normalizeSkuInput`). Re-entrant calls while a lookup is in flight
   * are no-ops (duplicate-submit prevention at the state level);
   * settled lookups always refetch. Blank input is a no-op (the form
   * owns presence validation).
   */
  lookup(rawSku: string | null | undefined): void {
    const sku = normalizeSkuInput(rawSku);
    if (sku === '' || this.stockStore.isLoading()) {
      return;
    }
    const request: Observable<InventoryItemResponse> = this.inventoryApi
      .getItem(sku)
      .pipe(map(requireStock));
    this.loads.add(loadResourceState(this.stockStore, request));
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps a stock envelope; a dataless `200` is a contract violation. */
function requireStock(envelope: ApiResponseWithData<InventoryItemResponse>): InventoryItemResponse {
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
