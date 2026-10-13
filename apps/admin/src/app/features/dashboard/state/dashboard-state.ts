/**
 * Feature-owned dashboard snapshot state for Supplement S1, Step S1.10 —
 * Admin Dashboard (Real API).
 *
 * Scope: the landing-page snapshot only (`GET /admin/dashboard` with
 * the default threshold — no query state, no pagination/filter/sort
 * transitions).
 *
 * Display contract (S1.1 audit — only backend-exposed data): every
 * section echoes verbatim for display (never inputs to math, never
 * recomputed client-side). First failing section's error surfaces
 * through the shared error state.
 *
 * Locality rules (same convention as the orders states):
 * `@Injectable()` WITHOUT `providedIn` (provided on the dashboard page
 * component — one instance per page, never a root singleton), local
 * Signals via `createResourceState`, no `HttpClient`, no query strings,
 * envelopes unwrap here, dataless envelopes resolve to `error`.
 * CSR-safe: no browser APIs anywhere in this file.
 *
 * Explicitly out of scope (must not appear here):
 * - Per-module list/detail slots (the owning features hold those).
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
import type { AdminDashboardResponse } from '@flux/models';
import { DashboardApiService } from '../data-access/dashboard-api.service';
import type { DashboardSnapshot } from '../models/dashboard-admin.models';

/**
 * Feature-scoped dashboard snapshot state. Provide at the dashboard
 * route level — never at root. All selectors are readonly signals; the
 * only transition is the explicit `refresh()` driven by the owning
 * page.
 */
@Injectable()
export class DashboardState implements OnDestroy {
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly loads = new Subscription();

  private readonly snapshotStore: ResourceStateStore<DashboardSnapshot> =
    createResourceState<DashboardSnapshot>();

  /** Current snapshot (idle → loading → success | error). */
  readonly snapshot: Signal<ResourceState<DashboardSnapshot>> = this.snapshotStore.state;

  /**
   * (Re)loads the snapshot with the fixed window (`lowStockThreshold:
   * 5`, `days: 30` — the approved fixed window; no UI control ships).
   * Landing retry re-enters here. A refresh issued while a load is in
   * flight is a no-op (duplicate-submit prevention at the state level
   * — the page holds no request flags).
   */
  refresh(options: ApiRequestOptions = {}): void {
    if (this.snapshotStore.isLoading()) {
      return;
    }
    const request: Observable<DashboardSnapshot> = this.dashboardApi
      .getDashboard({ lowStockThreshold: 5, days: 30 }, options)
      .pipe(map(requireSnapshot));
    this.loads.add(loadResourceState(this.snapshotStore, request));
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps a snapshot envelope; a dataless `200` is a contract violation. */
function requireSnapshot(envelope: ApiResponseWithData<AdminDashboardResponse>): DashboardSnapshot {
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
