/**
 * Feature-owned reservation lookup state for Sub-Phase 13.10 —
 * Reservations & Inventory Adjustments.
 *
 * Scope: the single-reservation slot behind the reservations page
 * (`GET /inventory/reservations/{id}` — the only reservation read the
 * backend exposes: ids are never enumerable, so there is no list, no
 * pagination, no filtering). The reservation lifecycle (commit,
 * release, expiry) stays entirely backend-owned: this state names the
 * settled status for display and performs no transitions.
 *
 * Locality rules (same convention as `stock-state`, 13.9):
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
import type { InventoryReservationResponse } from '@flux/models';
import { InventoryAdminApiService } from '../data-access/inventory-admin-api.service';
import type { AdminReservationRow } from '../models/inventory-admin.models';

/**
 * Feature-scoped reservation lookup state. Provide at the inventory
 * route level — never at root. All selectors are readonly signals;
 * lookups are explicit calls driven by the owning page.
 */
@Injectable()
export class ReservationState implements OnDestroy {
  private readonly inventoryApi = inject(InventoryAdminApiService);
  private loads = new Subscription();

  private readonly reservationStore: ResourceStateStore<AdminReservationRow> =
    createResourceState<AdminReservationRow>();

  /** Current reservation record (idle → loading → success | error). */
  readonly reservation: Signal<ResourceState<AdminReservationRow>> = this.reservationStore.state;

  /**
   * Looks up one reservation id (trimmed for transport determinism;
   * shape rules stay backend-owned). Re-entrant calls while a lookup
   * is in flight are no-ops (duplicate-submit prevention at the state
   * level); settled lookups always refetch. Blank input is a no-op
   * (the form owns presence validation).
   */
  lookup(rawId: string | null | undefined): void {
    const id = (rawId ?? '').trim();
    if (id === '' || this.reservationStore.isLoading()) {
      return;
    }
    this.loads.unsubscribe();
    this.loads = new Subscription();
    const request: Observable<InventoryReservationResponse> = this.inventoryApi
      .getReservation(id)
      .pipe(map(requireReservation));
    this.loads.add(loadResourceState(this.reservationStore, request));
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps a reservation envelope; a dataless `200` is a contract violation. */
function requireReservation(
  envelope: ApiResponseWithData<InventoryReservationResponse>,
): InventoryReservationResponse {
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
