/**
 * Feature-owned variant list state for Sub-Phase 13.4 — Product Variants
 * Management.
 *
 * Scope: the full variant collection behind one product
 * (`GET /catalog/products/{productId}/variants` — the endpoint exposes
 * no pagination, so the state owns no query transitions and no pager).
 * Variant create/edit/delete transport lives in the owning pages over
 * the data-access service; this state only reloads the settled truth
 * afterwards.
 *
 * Locality rules (same convention as `catalog-overview-state`, 13.2):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to `error`.
 * CSR-safe: no browser APIs anywhere in this file.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 13.5–13.6 — no category/image/specification slots or writes.
 * - Stock/availability reads (Inventory feature, 13.9+).
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
 * Feature-scoped variant list state. Provide at the catalog route level —
 * never at root. All selectors are readonly signals; loads are explicit
 * calls driven by owning pages (list initial load, post-mutation
 * refresh, section retry).
 */
@Injectable()
export class VariantListState implements OnDestroy {
  private readonly catalogApi = inject(CatalogAdminApiService);
  private loads = new Subscription();

  private readonly listStore: ResourceStateStore<readonly AdminVariantRow[]> =
    createResourceState<readonly AdminVariantRow[]>();

  /** Current variant collection (idle → loading → success | empty | error). */
  readonly variants: Signal<ResourceState<readonly AdminVariantRow[]>> = this.listStore.state;

  /**
   * Loads the full collection for `productId`. Previous loads tear down
   * first, so navigating between products can never interleave lists.
   */
  load(productId: string): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    const request: Observable<readonly VariantResponse[]> = this.catalogApi
      .listVariants(productId)
      .pipe(map(requireVariantItems));
    this.loads.add(loadResourceState(this.listStore, request));
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps the variant items; a dataless `200` is a contract violation. */
function requireVariantItems(
  envelope: ApiResponseWithData<readonly VariantResponse[]>,
): readonly VariantResponse[] {
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
