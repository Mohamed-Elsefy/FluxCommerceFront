/**
 * Feature-owned variant details state for Sub-Phase 13.4 — Product
 * Variants Management.
 *
 * Scope: the single-variant slot behind the variant details and edit
 * pages (`GET /catalog/products/{productId}/variants/{variantId}`).
 * Variant writes (create/update/delete) run in the owning pages over
 * the data-access service with their own submit locks; this state only
 * loads the settled truth.
 *
 * Locality rules (same convention as `catalog-overview-state`, 13.2):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to `error`.
 * CSR-safe: no browser APIs anywhere in this file.
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
import type { VariantResponse } from '@flux/models';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';
import type { AdminVariantRow } from '../models/catalog-admin.models';

/**
 * Feature-scoped variant details state. Provide at the catalog route
 * level — never at root. All selectors are readonly signals; loads are
 * explicit calls driven by owning pages (initial load, retry).
 */
@Injectable()
export class VariantDetailsState implements OnDestroy {
  private readonly catalogApi = inject(CatalogAdminApiService);
  private loads = new Subscription();

  private readonly variantStore: ResourceStateStore<AdminVariantRow> =
    createResourceState<AdminVariantRow>();

  /** Current variant (idle → loading → success | empty | error). */
  readonly variant: Signal<ResourceState<AdminVariantRow>> = this.variantStore.state;

  /**
   * Loads the variant for its product scope. Previous loads tear down
   * first, so navigating between variants can never interleave records.
   */
  load(productId: string, variantId: string): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    const request: Observable<VariantResponse> = this.catalogApi
      .getVariant(productId, variantId)
      .pipe(map(requireVariant));
    this.loads.add(loadResourceState(this.variantStore, request));
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps a single-variant envelope; a dataless `200` is a violation. */
function requireVariant(envelope: ApiResponseWithData<VariantResponse>): VariantResponse {
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
