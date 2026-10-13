/**
 * Feature-owned users counts state for Supplement S1, Step S1.5 —
 * Admin Users & Permissions (landing slice).
 *
 * Scope: the counts snapshot only (`GET /admin/users/counts` — no
 * params). Every bucket echoes verbatim for display (never an input to
 * math).
 *
 * Locality rules (same convention as the orders states):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, envelopes
 * unwrap here, dataless envelopes resolve to `error`. CSR-safe: no
 * browser APIs anywhere in this file.
 *
 * Transport note: reads go through the shared `IdentityApiService`
 * (`@flux/api`, S1.2) directly — no feature façade duplicates a thin
 * typed transport that already exists.
 */

import { inject, Injectable, OnDestroy, type Signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  ApiError,
  IdentityApiService,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiRequestOptions,
  type ApiResponseWithData,
  type ResourceState,
  type ResourceStateStore,
} from '@flux/api';
import type { UserAdminCountsResponse } from '@flux/models';

/**
 * Feature-scoped users counts state. Provide at the users route level —
 * never at root.
 */
@Injectable()
export class UsersCountsState implements OnDestroy {
  private readonly identity = inject(IdentityApiService);
  private loads = new Subscription();

  private readonly countsStore: ResourceStateStore<UserAdminCountsResponse> =
    createResourceState<UserAdminCountsResponse>();

  /** Current counts snapshot (idle → loading → success | error). */
  readonly counts: Signal<ResourceState<UserAdminCountsResponse>> = this.countsStore.state;

  /**
   * Loads the counts snapshot. A load issued while another is in flight
   * supersedes it. `options.signal` carries cancellation.
   */
  load(options: ApiRequestOptions = {}): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    const request: Observable<UserAdminCountsResponse> = this.identity
      .userCounts(options)
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
  envelope: ApiResponseWithData<UserAdminCountsResponse>,
): UserAdminCountsResponse {
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
