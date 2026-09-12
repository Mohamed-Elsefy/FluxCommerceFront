/**
 * Feature-owned Product Details state for Sub-Phase 6.1 — Product Details
 * Foundation.
 *
 * Scope: `docs/phases/PHASE_6_PRODUCT_DETAILS.md` §6.1 (foundation only —
 * single-product resource slot, no UI).
 *
 * State strategy (`ARCHITECTURE.md` §9 — smallest appropriate scope):
 *
 * ```text
 * ProductDetailsPage (pages/ — orchestration only, Sub-Phase 6.1 shell)
 *     ↓ ProductDetailsState (this file — feature-owned, local Signals)
 *     ↓ ProductDetailsApiService (../data-access — feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Catalog API
 * ```
 *
 * Locality rules enforced here (same convention as `CatalogState`, Phase
 * 5.1):
 * - `@Injectable()` WITHOUT `providedIn` — the state is feature-scoped and
 *   must be provided at the product-details route level
 *   (`productDetailsRoutes` providers). It is never a root singleton and
 *   never global state (no NgRx, no SignalStore, no shared library). Each
 *   product-details route subtree gets its own instance.
 * - Signals stay local via the Phase 1 `createResourceState` primitive
 *   (idle → loading → success | error, data retained across reloads,
 *   failures normalized to `ApiError`). No global store is touched.
 * - The state never touches `HttpClient`, never builds query strings, and
 *   never performs DTO→view-model mapping: envelopes unwrap here, wire
 *   errors flow into the `error` state through `loadResourceState`.
 * - SSR-safe: no `window`/`document`/`localStorage` anywhere in this file —
 *   server rendering only exercises the initial `idle` snapshot (the page
 *   fetches in the browser; SSR transfer arrives in Sub-Phase 6.9).
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 6.2 — no info/spec presentation state.
 * - 6.3 — no selected-image state.
 * - 6.4–6.6 — no selected-variant or quantity state.
 * - 6.7 / Phase 7 — no cart integration or cart state.
 */

import { inject, Injectable, type Signal } from '@angular/core';
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
import { ProductDetailsApiService } from '../data-access/product-details-api.service';
import type { ProductDetails } from '../models/product-details.models';

/** Options for every `ProductDetailsState` load: cancellation only, never mapping. */
export interface ProductDetailsLoadOptions {
  /** Lifecycle signal — aborts complete silently and leave state untouched. */
  readonly signal?: AbortSignal;
}

/**
 * Feature-scoped product-details state. Provide at the product-details route
 * level — never at root. All selectors are readonly signals; all transitions
 * are explicit `load*` calls driven by the owning page.
 */
@Injectable()
export class ProductDetailsState {
  private readonly detailsApi = inject(ProductDetailsApiService);

  private readonly productStore: ResourceStateStore<ProductDetails> =
    createResourceState<ProductDetails>();

  /** Currently selected product (`GET /catalog/products/{id}`). */
  readonly product: Signal<ResourceState<ProductDetails>> = this.productStore.state;

  /** Whether the product is currently loading. */
  readonly productLoading: Signal<boolean> = this.productStore.isLoading;

  /**
   * Loads a single product by id into the `product` slot. A dataless
   * envelope resolves to `error` (contract violation); aborts leave state
   * untouched. Blank ids are rejected without fetching (the page validates
   * first via `parseProductIdParam` — this guard only protects direct
   * callers); the slot stays `idle`.
   */
  loadProduct(id: string, options: ProductDetailsLoadOptions = {}): Subscription {
    if (id.trim() === '') {
      return Subscription.EMPTY;
    }
    const request: Observable<ProductDetails> = this.detailsApi
      .getProduct(id, toApiOptions(options))
      .pipe(map(requireEnvelopeData));
    return loadResourceState(this.productStore, request, { signal: options.signal });
  }

  /** Resets the product slot to `idle` (e.g. when the route id is cleared). */
  reset(): void {
    this.productStore.reset();
  }
}

function toApiOptions(options: ProductDetailsLoadOptions): ApiRequestOptions {
  return options.signal === undefined ? {} : { signal: options.signal };
}

/** Unwraps a single-resource envelope; a dataless `200` is a contract violation. */
function requireEnvelopeData<T>(envelope: ApiResponseWithData<T>): T {
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
