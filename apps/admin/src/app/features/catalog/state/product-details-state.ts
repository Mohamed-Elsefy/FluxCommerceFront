/**
 * Feature-owned product details state for Sub-Phase 13.3 — Product
 * Management.
 *
 * Scope: the details page only — the product slot, the three read-only
 * display sections (variants, images, specifications), and lifecycle
 * transitions with duplicate-submit prevention. Variant/image/
 * specification management (create/edit/delete) arrives with the slices
 * that own their forms (Sub-Phases 13.4–13.6); availability/stock display
 * belongs to the Inventory feature (13.9+) — this state performs no
 * inventory reads.
 *
 * Each slot owns its lifecycle: the product slot drives the page header
 * (loading/error/empty), while every display section renders its own
 * slot states independently — a failed images read never hides settled
 * metadata. Lifecycle transitions re-enter through `transition()`:
 * concurrent transitions lock (the in-flight flag), success reloads the
 * product slot (status moves backend-side), and the backend owns
 * transition validity (`409` surfaces for the page to display, never for
 * the SPA to predict).
 *
 * Locality rules (same convention as `catalog-overview-state`, 13.2):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to `error`.
 * CSR-safe: no browser APIs anywhere in this file.
 */

import { computed, inject, Injectable, OnDestroy, signal, type Signal } from '@angular/core';
import { finalize, map, Subscription, tap, type Observable } from 'rxjs';
import {
  ApiError,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiResponseWithData,
  type ResourceState,
  type ResourceStateStore,
} from '@flux/api';
import type {
  ProductImageResponse,
  ProductLifecycleAction,
  ProductResponse,
  ProductSpecificationResponse,
  VariantResponse,
} from '@flux/models';
import { CatalogAdminApiService } from '../data-access/catalog-admin-api.service';

/**
 * Feature-scoped product details state. Provide at the catalog route
 * level — never at root. All selectors are readonly signals; loads and
 * transitions are explicit calls driven by the owning page.
 */
@Injectable()
export class ProductDetailsState implements OnDestroy {
  private readonly catalogApi = inject(CatalogAdminApiService);
  private loads = new Subscription();

  private readonly productStore: ResourceStateStore<ProductResponse> =
    createResourceState<ProductResponse>();
  private readonly variantsStore: ResourceStateStore<readonly VariantResponse[]> =
    createResourceState<readonly VariantResponse[]>();
  private readonly imagesStore: ResourceStateStore<readonly ProductImageResponse[]> =
    createResourceState<readonly ProductImageResponse[]>();
  private readonly specsStore: ResourceStateStore<readonly ProductSpecificationResponse[]> =
    createResourceState<readonly ProductSpecificationResponse[]>();
  private readonly transitionLock = signal(false);

  /** Current product (idle → loading → success | empty | error). */
  readonly product: Signal<ResourceState<ProductResponse>> = this.productStore.state;
  /** Variant display list (independent lifecycle — never gates metadata). */
  readonly variants: Signal<ResourceState<readonly VariantResponse[]>> = this.variantsStore.state;
  /** Image display list (server-ordered by `displayOrder`). */
  readonly images: Signal<ResourceState<readonly ProductImageResponse[]>> = this.imagesStore.state;
  /** Specification display list. */
  readonly specifications: Signal<ResourceState<readonly ProductSpecificationResponse[]>> =
    this.specsStore.state;

  /** Whether a lifecycle transition is in flight (dialog actions lock). */
  readonly transitionInFlight: Signal<boolean> = computed(() => this.transitionLock());

  /**
   * Loads every details slot for `id`; section retries re-enter the
   * matching loader. Previous loads tear down first, so navigating
   * between products can never interleave slots.
   */
  load(id: string): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    this.loads.add(
      loadResourceState(this.productStore, this.catalogApi.getProduct(id).pipe(map(requireData))),
    );
    this.loads.add(
      loadResourceState(
        this.variantsStore,
        this.catalogApi.listVariants(id).pipe(map(requireData)),
      ),
    );
    this.loads.add(
      loadResourceState(
        this.imagesStore,
        this.catalogApi.listProductImages(id).pipe(map(requireData)),
      ),
    );
    this.loads.add(
      loadResourceState(
        this.specsStore,
        this.catalogApi.listSpecifications(id).pipe(map(requireData)),
      ),
    );
  }

  /**
   * Loads the product slot only (edit population — the display sections
   * stay untouched until the details page loads them).
   */
  loadProduct(id: string): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    this.loads.add(
      loadResourceState(this.productStore, this.catalogApi.getProduct(id).pipe(map(requireData))),
    );
  }

  /**
   * Runs one lifecycle transition for the loaded product. Concurrent
   * calls return `null` (duplicate-submit prevention at the state level);
   * otherwise the backend call runs with the lock held and the product
   * slot reloads on success (the new status arrives backend-side).
   * Failures — including `409` illegal transitions — propagate untouched
   * for the page to notify.
   */
  transition(id: string, action: ProductLifecycleAction): Observable<unknown> | null {
    if (this.transitionLock()) {
      return null;
    }
    this.transitionLock.set(true);
    return this.catalogApi.transitionProduct(id, action).pipe(
      tap({ next: () => this.reloadProduct(id), error: () => undefined }),
      finalize(() => this.transitionLock.set(false)),
    );
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }

  private reloadProduct(id: string): void {
    this.loads.add(
      loadResourceState(this.productStore, this.catalogApi.getProduct(id).pipe(map(requireData))),
    );
  }
}

/** Unwraps a single-resource or collection envelope; dataless is a violation. */
function requireData<T>(envelope: ApiResponseWithData<T>): T {
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
