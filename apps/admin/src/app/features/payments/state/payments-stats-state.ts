/**
 * Feature-owned payments stats state for Supplement S1, Step S1.9 —
 * Payments: Mine + Admin + Stats (admin stats slice).
 *
 * Scope: the landing-page stats only (the backend-issued snapshot —
 * no list slot, no query state, no pagination/filter/sort transitions).
 *
 * Display contract (S1.1 audit — only backend-exposed data): every
 * bucket echoes verbatim for display (`total/pending/processing/
 * succeeded/failed/cancelled/refunded` plus `totalsByCurrency` — never
 * inputs to math, never recomputed client-side).
 *
 * Locality rules (same convention as the orders states):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to
 * `error`. CSR-safe: no browser APIs anywhere in this file.
 *
 * Explicitly out of scope (must not appear here):
 * - List slot, details slot, history (no such endpoint).
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
import type { PaymentAdminStatsResponse } from '@flux/models';
import { PaymentsAdminApiService } from '../data-access/payments-admin-api.service';

/**
 * Feature-scoped payments stats state. Provide at the payments route
 * level — never at root. All selectors are readonly signals; the only
 * transition is the explicit `refresh()` driven by the owning page.
 */
@Injectable()
export class PaymentsStatsState implements OnDestroy {
  private readonly paymentsApi = inject(PaymentsAdminApiService);
  private readonly loads = new Subscription();

  private readonly statsStore: ResourceStateStore<PaymentAdminStatsResponse> =
    createResourceState<PaymentAdminStatsResponse>();

  /** Current stats snapshot (idle → loading → success | error). */
  readonly stats: Signal<ResourceState<PaymentAdminStatsResponse>> = this.statsStore.state;

  /**
   * (Re)loads the stats snapshot; landing retry re-enters here. A
   * refresh issued while a load is in flight is a no-op
   * (duplicate-submit prevention at the state level — the page holds no
   * request flags).
   */
  refresh(options: ApiRequestOptions = {}): void {
    if (this.statsStore.isLoading()) {
      return;
    }
    const request: Observable<PaymentAdminStatsResponse> = this.paymentsApi
      .paymentStats(options)
      .pipe(map(requireStats));
    this.loads.add(loadResourceState(this.statsStore, request));
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps a stats envelope; a dataless `200` is a contract violation. */
function requireStats(
  envelope: ApiResponseWithData<PaymentAdminStatsResponse>,
): PaymentAdminStatsResponse {
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
