/**
 * Feature-owned Product Details state for Sub-Phases 6.1–6.5 — Foundation
 * + Page & Information + Image Gallery + Variant Selection + SKU Binding.
 *
 * Scope: `docs/phases/PHASE_6_PRODUCT_DETAILS.md` §§6.1–6.5 (product +
 * specifications + images + variants resource slots, the selected variant,
 * and its orderability guard — no UI).
 *
 * State strategy (`ARCHITECTURE.md` §9 — smallest appropriate scope):
 *
 * ```text
 * ProductDetailsPage (pages/ — orchestration only)
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
 *   (idle → loading → success | empty | error, data retained across reloads,
 *   failures normalized to `ApiError`). No global store is touched.
 * - The state never touches `HttpClient`, never builds query strings, and
 *   never performs DTO→view-model mapping: envelopes unwrap here, wire
 *   errors flow into the `error` state through `loadResourceState`.
 * - SSR-safe: no `window`/`document`/`localStorage` anywhere in this file —
 *   server rendering only exercises the initial `idle` snapshots (the page
 *   fetches in the browser; SSR transfer arrives in Sub-Phase 6.9).
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 6.6–6.7 / Phase 7 — no quantity, cart integration, or cart state.
 */

import { computed, inject, Injectable, signal, type Signal } from '@angular/core';
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
import {
  isSelectableVariant,
  resolveVariantSelection,
  type ProductDetails,
  type ProductImage,
  type ProductSpecification,
  type ProductVariant,
} from '../models/product-details.models';

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
  private readonly specificationsStore: ResourceStateStore<ProductSpecification[]> =
    createResourceState<ProductSpecification[]>();
  private readonly imagesStore: ResourceStateStore<ProductImage[]> =
    createResourceState<ProductImage[]>();
  private readonly variantsStore: ResourceStateStore<ProductVariant[]> =
    createResourceState<ProductVariant[]>();

  /** Selected variant id (`null` = no explicit selection). Feature-local. */
  private readonly selectedVariantIdStore = signal<string | null>(null);

  /** Currently selected product (`GET /catalog/products/{id}`). */
  readonly product: Signal<ResourceState<ProductDetails>> = this.productStore.state;

  /** Whether the product is currently loading. */
  readonly productLoading: Signal<boolean> = this.productStore.isLoading;

  /**
   * Specifications for the selected product
   * (`GET /catalog/products/{productId}/specifications`, wire order — the
   * backend defines no sorting). An empty list resolves to `empty` (the page
   * hides the section); failures resolve to `error` without touching the
   * product slot.
   */
  readonly specifications: Signal<ResourceState<ProductSpecification[]>> =
    this.specificationsStore.state;

  /**
   * Images for the selected product
   * (`GET /catalog/products/{productId}/images`, ordered by `displayOrder`
   * server-side). An empty list resolves to `empty` (the gallery shows its
   * missing-image fallback); failures resolve to `error` without touching
   * the product slot. Selection state is gallery-local UI state
   * (`ARCHITECTURE.md` §9) — never stored here.
   */
  readonly images: Signal<ResourceState<ProductImage[]>> = this.imagesStore.state;

  /**
   * Variants for the selected product
   * (`GET /catalog/products/{productId}/variants`, flat backend list — no
   * option dimensions). An empty list resolves to `empty` (the page hides
   * the selector); failures resolve to `error` without touching the
   * product slot.
   */
  readonly variants: Signal<ResourceState<ProductVariant[]>> = this.variantsStore.state;

  /**
   * Selected variant id. Set only through `selectVariant` (validated
   * against the loaded list — invalid selections are impossible) and
   * cleared by `clearVariantSelection`/`reset`. Readonly — the single
   * source of truth Sub-Phase 6.5 builds upon.
   */
  readonly selectedVariantId: Signal<string | null> = this.selectedVariantIdStore.asReadonly();

  /**
   * Selected variant object (`null` when nothing valid is selected, e.g.
   * before any choice or while a new product loads). Derived — never set
   * directly, so it can never disagree with `selectedVariantId`.
   */
  readonly selectedVariant: Signal<ProductVariant | null> = computed(
    () =>
      this.variantsStore.data()?.find((variant) => variant.id === this.selectedVariantIdStore()) ??
      null,
  );

  /**
   * Orderability guard for the selected variant (`§6.5` acceptance —
   * invalid/unavailable selections can never reach ordering): `true` only
   * while a loaded variant is both selected and still selectable. Derived
   * from `selectedVariant`, so a status flip on refetch disables ordering
   * without any stale intermediate. No quantity/cart UI exists in this
   * sub-phase — Sub-Phases 6.6–6.7 consume this signal to disable their
   * controls.
   */
  readonly selectedVariantSelectable: Signal<boolean> = computed(() => {
    const selected = this.selectedVariant();
    return selected !== null && isSelectableVariant(selected);
  });

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

  /** Resets every slot and the variant selection to `idle`/`null`. */
  reset(): void {
    this.productStore.reset();
    this.specificationsStore.reset();
    this.imagesStore.reset();
    this.variantsStore.reset();
    this.selectedVariantIdStore.set(null);
  }

  /**
   * Loads the specification list for `productId` into the `specifications`
   * slot. A dataless envelope resolves to `error` (contract violation); an
   * empty list resolves to `empty`; aborts leave state untouched. Blank ids
   * are rejected without fetching; the slot stays `idle`.
   */
  loadSpecifications(productId: string, options: ProductDetailsLoadOptions = {}): Subscription {
    if (productId.trim() === '') {
      return Subscription.EMPTY;
    }
    const request: Observable<ProductSpecification[]> = this.detailsApi
      .listSpecifications(productId, toApiOptions(options))
      .pipe(map(requireEnvelopeData));
    return loadResourceState(this.specificationsStore, request, { signal: options.signal });
  }

  /**
   * Loads the image list for `productId` into the `images` slot. A dataless
   * envelope resolves to `error` (contract violation); an empty list
   * resolves to `empty` (the gallery shows its missing-image fallback);
   * aborts leave state untouched. Blank ids are rejected without fetching;
   * the slot stays `idle`.
   */
  loadProductImages(productId: string, options: ProductDetailsLoadOptions = {}): Subscription {
    if (productId.trim() === '') {
      return Subscription.EMPTY;
    }
    const request: Observable<ProductImage[]> = this.detailsApi
      .listProductImages(productId, toApiOptions(options))
      .pipe(map(requireEnvelopeData));
    return loadResourceState(this.imagesStore, request, { signal: options.signal });
  }

  /**
   * Loads the variant list for `productId` into the `variants` slot. A
   * dataless envelope resolves to `error` (contract violation); an empty
   * list resolves to `empty`; aborts leave state untouched. Blank ids are
   * rejected without fetching; the slot stays `idle`. Never touches the
   * selection: a reload of the same product (e.g. error retry) preserves
   * the customer's choice, while the owning page clears it on product
   * change — and `selectedVariant` self-heals to `null` if the id is gone
   * from the fresh list.
   */
  loadProductVariants(productId: string, options: ProductDetailsLoadOptions = {}): Subscription {
    if (productId.trim() === '') {
      return Subscription.EMPTY;
    }
    const request: Observable<ProductVariant[]> = this.detailsApi
      .listProductVariants(productId, toApiOptions(options))
      .pipe(map(requireEnvelopeData));
    return loadResourceState(this.variantsStore, request, { signal: options.signal });
  }

  /**
   * Selects a variant by id. Only a loaded, selectable variant (active,
   * non-deleted) is accepted — unknown, inactive, or deleted ids are
   * ignored and the current selection is preserved. No default is ever
   * applied here: the contract defines none, so selection starts empty and
   * stays empty until the customer chooses (§6.4 default-selection rule).
   */
  selectVariant(id: string): void {
    const resolved = resolveVariantSelection(this.variantsStore.data(), id);
    if (resolved !== null) {
      this.selectedVariantIdStore.set(resolved);
    }
  }

  /** Clears the variant selection (e.g. when the route product changes). */
  clearVariantSelection(): void {
    this.selectedVariantIdStore.set(null);
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
