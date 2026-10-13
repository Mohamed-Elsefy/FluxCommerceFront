/**
 * Feature-owned Product Details state for Sub-Phases 6.1–6.9 — Foundation
 * + Page & Information + Image Gallery + Variant Selection + SKU Binding +
 * Quantity Selection + Add to Cart Integration + SSR & SEO.
 *
 * Scope: `docs/phases/PHASE_6_PRODUCT_DETAILS.md` §§6.1–6.9 (product +
 * specifications + images + variants resource slots, the selected variant
 * and its orderability guard, purchase quantity, and the add-to-cart
 * submission machine — no UI, no cart state).
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
 *   server rendering fetches live (the route is `RenderMode.Server`, never
 *   prerendered, so a backend is reachable at request time) and settled
 *   payloads transfer server → client once per id via `TransferState`
 *   (same convention as `CatalogState`, Phase 5.10), so hydration never
 *   refetches transferred data and never serves stale data. Failures are
 *   never stored — the client always retries live after a server error.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - Phase 7 — no cart pages, cart reads/state, guest persistence, or merge.
 *   This file submits lines; it never stores carts.
 */

import {
  computed,
  inject,
  Injectable,
  makeStateKey,
  PLATFORM_ID,
  signal,
  TransferState,
  type Signal,
  type StateKey,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { map, Subscription, tap, type Observable } from 'rxjs';
import type { CartResponse } from '@flux/models';
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
  INITIAL_QUANTITY,
  MIN_QUANTITY,
  buildAddToCartItem,
  isSelectableVariant,
  isValidAddToCartPricing,
  isValidQuantity,
  resolveVariantSelection,
  toAddToCartStatus,
  type AddToCartPricing,
  type AddToCartStatus,
  type ProductDetails,
  type ProductImage,
  type ProductSpecification,
  type ProductVariant,
  type SimilarProduct,
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
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly transfer = inject(TransferState, { optional: true });

  private readonly productStore: ResourceStateStore<ProductDetails> =
    createResourceState<ProductDetails>();
  private readonly specificationsStore: ResourceStateStore<ProductSpecification[]> =
    createResourceState<ProductSpecification[]>();
  private readonly imagesStore: ResourceStateStore<ProductImage[]> =
    createResourceState<ProductImage[]>();
  private readonly variantsStore: ResourceStateStore<ProductVariant[]> =
    createResourceState<ProductVariant[]>();
  private readonly similarProductsStore: ResourceStateStore<SimilarProduct[]> =
    createResourceState<SimilarProduct[]>();

  /**
   * Add-to-cart submission slot (`POST /cart/items`). Object-shaped payload
   * — the `empty` status is unreachable; the button reads the projected
   * `addToCartStatus` below. This slot tracks the submission only: state
   * never retains cart contents (no items, totals, or cart ids are read
   * out of the envelope anywhere in this feature).
   */
  private readonly addToCartStore: ResourceStateStore<CartResponse> =
    createResourceState<CartResponse>();

  /** Selected variant id (`null` = no explicit selection). Feature-local. */
  private readonly selectedVariantIdStore = signal<string | null>(null);

  /**
   * Purchase quantity (§6.6 state ownership — `ProductDetailsState.quantity`,
   * never cart/global state). Always holds a valid value (starts at
   * `INITIAL_QUANTITY`; every writer validates through `isValidQuantity`).
   */
  private readonly quantityStore = signal<number>(INITIAL_QUANTITY);

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
   * Similar products from the same category
   * (`GET /catalog/products?categoryId=`, current product dropped
   * client-side, rail capped by the caller). An empty list resolves to
   * `empty` (the page hides the rail); failures resolve to `error`
   * without touching the product slot.
   */
  readonly similarProducts: Signal<ResourceState<SimilarProduct[]>> =
    this.similarProductsStore.state;

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
   * Purchase quantity. Readonly — the single source Sub-Phase 6.7 builds
   * upon. Never cart state, never global.
   */
  readonly quantity: Signal<number> = this.quantityStore.asReadonly();

  /**
   * Add-to-cart request lifecycle for the button (`idle → adding →
   * added | error`). Projected from the submission store, so failures
   * arrive already normalized to `ApiError` and the `empty` status can
   * never leak through. Readonly.
   */
  readonly addToCartStatus: Signal<AddToCartStatus> = computed(() =>
    toAddToCartStatus(this.addToCartStore.status()),
  );

  /** Normalized submission failure (`null` unless `addToCartStatus` is `error`). */
  readonly addToCartError: Signal<ApiError | null> = this.addToCartStore.error;

  /**
   * Loads a single product by id into the `product` slot. A dataless
   * envelope resolves to `error` (contract violation); aborts leave state
   * untouched. Blank ids are rejected without fetching (the page validates
   * first via `parseProductIdParam` — this guard only protects direct
   * callers); the slot stays `idle`.
   *
   * Hydration: a server-rendered product for the same id is reused once
   * from `TransferState` (no HTTP); misses and errors always fetch live.
   */
  loadProduct(id: string, options: ProductDetailsLoadOptions = {}): Subscription {
    if (id.trim() === '') {
      return Subscription.EMPTY;
    }
    const key = makeStateKey<ProductDetails>(`product-details.product.${id}`);
    const transferred = this.consumeTransferred(key);
    if (transferred !== null) {
      this.productStore.setSuccess(transferred);
      return Subscription.EMPTY;
    }
    const request: Observable<ProductDetails> = this.detailsApi
      .getProduct(id, toApiOptions(options))
      .pipe(
        map(requireEnvelopeData),
        tap((product) => this.storeTransferred(key, product)),
      );
    return loadResourceState(this.productStore, request, { signal: options.signal });
  }

  /** Resets every slot, the variant selection, the quantity, and the submission to their initials. */
  reset(): void {
    this.productStore.reset();
    this.specificationsStore.reset();
    this.imagesStore.reset();
    this.variantsStore.reset();
    this.similarProductsStore.reset();
    this.selectedVariantIdStore.set(null);
    this.quantityStore.set(INITIAL_QUANTITY);
    this.addToCartStore.reset();
  }

  /**
   * Loads the specification list for `productId` into the `specifications`
   * slot. A dataless envelope resolves to `error` (contract violation); an
   * empty list resolves to `empty`; aborts leave state untouched. Blank ids
   * are rejected without fetching; the slot stays `idle`.
   *
   * Hydration: same single-use `TransferState` reuse as `loadProduct`.
   */
  loadSpecifications(productId: string, options: ProductDetailsLoadOptions = {}): Subscription {
    if (productId.trim() === '') {
      return Subscription.EMPTY;
    }
    const key = makeStateKey<ProductSpecification[]>(`product-details.specifications.${productId}`);
    if (this.consumeTransferredList(key, this.specificationsStore)) {
      return Subscription.EMPTY;
    }
    const request: Observable<ProductSpecification[]> = this.detailsApi
      .listSpecifications(productId, toApiOptions(options))
      .pipe(
        map(requireEnvelopeData),
        tap((specifications) => this.storeTransferred(key, specifications)),
      );
    return loadResourceState(this.specificationsStore, request, { signal: options.signal });
  }

  /**
   * Loads the image list for `productId` into the `images` slot. A dataless
   * envelope resolves to `error` (contract violation); an empty list
   * resolves to `empty` (the gallery shows its missing-image fallback);
   * aborts leave state untouched. Blank ids are rejected without fetching;
   * the slot stays `idle`.
   *
   * Hydration: same single-use `TransferState` reuse as `loadProduct`.
   */
  loadProductImages(productId: string, options: ProductDetailsLoadOptions = {}): Subscription {
    if (productId.trim() === '') {
      return Subscription.EMPTY;
    }
    const key = makeStateKey<ProductImage[]>(`product-details.images.${productId}`);
    if (this.consumeTransferredList(key, this.imagesStore)) {
      return Subscription.EMPTY;
    }
    const request: Observable<ProductImage[]> = this.detailsApi
      .listProductImages(productId, toApiOptions(options))
      .pipe(
        map(requireEnvelopeData),
        tap((images) => this.storeTransferred(key, images)),
      );
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
   *
   * Hydration: same single-use `TransferState` reuse as `loadProduct`.
   */
  loadProductVariants(productId: string, options: ProductDetailsLoadOptions = {}): Subscription {
    if (productId.trim() === '') {
      return Subscription.EMPTY;
    }
    const key = makeStateKey<ProductVariant[]>(`product-details.variants.${productId}`);
    if (this.consumeTransferredList(key, this.variantsStore)) {
      return Subscription.EMPTY;
    }
    const request: Observable<ProductVariant[]> = this.detailsApi
      .listProductVariants(productId, toApiOptions(options))
      .pipe(
        map(requireEnvelopeData),
        tap((variants) => this.storeTransferred(key, variants)),
      );
    return loadResourceState(this.variantsStore, request, { signal: options.signal });
  }

  /**
   * Loads same-category products into the `similarProducts` slot,
   * excluding `excludeProductId` and capping the rail at `limit`
   * client-side (the backend offers no exclusion parameter — 5–6 rail
   * cards need one over-fetched page). A dataless envelope resolves to
   * `error` (contract violation); an empty remainder resolves to `empty`;
   * aborts leave state untouched. Blank ids are rejected without
   * fetching; the slot stays `idle`.
   *
   * Hydration: same single-use `TransferState` reuse as `loadProduct`,
   * keyed by category (the rail is category-scoped, not product-scoped).
   */
  loadSimilarProducts(
    categoryId: string,
    excludeProductId: string,
    limit: number,
    options: ProductDetailsLoadOptions = {},
  ): Subscription {
    if (categoryId.trim() === '') {
      return Subscription.EMPTY;
    }
    const key = makeStateKey<SimilarProduct[]>(`product-details.similar.${categoryId}.${limit}`);
    if (this.consumeTransferredList(key, this.similarProductsStore)) {
      return Subscription.EMPTY;
    }
    const request: Observable<SimilarProduct[]> = this.detailsApi
      .listSimilarProducts(categoryId, limit + 1, toApiOptions(options))
      .pipe(
        map(requireEnvelopeData),
        map((page) =>
          page.items.filter((item) => item.id !== excludeProductId).slice(0, Math.max(limit, 0)),
        ),
        tap((items) => this.storeTransferred(key, items)),
      );
    return loadResourceState(this.similarProductsStore, request, { signal: options.signal });
  }

  /**
   * Reuses a server-rendered payload once: on the browser, a stored payload
   * is consumed (and removed — single use, never stale) instead of
   * fetching; on the server, or on a miss, returns `null` so the caller
   * loads live. Pure lookup — performs no HTTP.
   */
  private consumeTransferred<T>(key: StateKey<T>): T | null {
    if (!this.isBrowser) {
      return null;
    }
    const stored = this.transfer?.get<T | null>(key, null) ?? null;
    if (stored === null) {
      return null;
    }
    this.transfer?.remove(key);
    return stored;
  }

  /**
   * Reuses a server-rendered list once, restoring the matching
   * success/empty status. Returns whether a transfer was consumed.
   */
  private consumeTransferredList<T>(
    key: StateKey<T[] | null>,
    store: ResourceStateStore<T[]>,
  ): boolean {
    const stored = this.consumeTransferred(key);
    if (stored === null) {
      return false;
    }
    if (stored.length === 0) {
      store.setEmpty(stored);
    } else {
      store.setSuccess(stored);
    }
    return true;
  }

  /**
   * Stores a settled payload for hydration: server-only (the browser
   * renders from live data or consumed transfers). Failures are never
   * stored, so the client always retries live after a server error.
   */
  private storeTransferred<T>(key: StateKey<T>, payload: T): void {
    if (!this.isBrowser) {
      this.transfer?.set(key, payload);
    }
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

  /**
   * Sets the purchase quantity. Only valid quantities (integer ≥
   * `MIN_QUANTITY`) are accepted — anything else is ignored and the last
   * valid value is preserved, so invalid quantities can never be submitted
   * (§6.6 acceptance). No maximum clamp: the contract defines none.
   */
  setQuantity(value: number): void {
    if (isValidQuantity(value)) {
      this.quantityStore.set(value);
    }
  }

  /** Increments the purchase quantity by one (always valid from a valid base). */
  incrementQuantity(): void {
    this.quantityStore.update((current) => current + 1);
  }

  /**
   * Decrements the purchase quantity by one, floored at `MIN_QUANTITY` —
   * the quantity can never drop below 1 (§6.6 acceptance).
   */
  decrementQuantity(): void {
    this.quantityStore.update((current) => Math.max(MIN_QUANTITY, current - 1));
  }

  /** Resets the purchase quantity to `INITIAL_QUANTITY` (e.g. on product change). */
  resetQuantity(): void {
    this.quantityStore.set(INITIAL_QUANTITY);
  }

  /**
   * Submits the selected purchasable item and quantity to the authenticated
   * cart (`POST /cart/items`) with an explicit price snapshot.
   *
   * Guards (all silent, all pre-HTTP):
   * - an in-flight submission is running → ignored (duplicate-submission
   *   lock; the button also disables while `adding`);
   * - no selectable variant, an invalid quantity, or a malformed pricing
   *   snapshot → ignored with state untouched (the button disables on the
   *   same conditions — defense in depth, never a doomed request).
   *
   * Otherwise drives `idle → adding → added | error` with failures
   * normalized to `ApiError` by `loadResourceState`. Aborts complete
   * silently and leave state untouched.
   *
   * Pricing note: `pricing` is an explicit argument projected from the
   * selected backend-issued variant snapshot (`toAddToCartPricing`).
   * Nothing here defaults or estimates it. Returns the subscription
   * (`EMPTY` when a guard rejects) so the caller can observe settle.
   * Guest submission runs through `submitGuestAddToCart` below.
   */
  submitAddToCart(
    pricing: AddToCartPricing,
    options: ProductDetailsLoadOptions = {},
  ): Subscription {
    if (this.addToCartStore.isLoading()) {
      return Subscription.EMPTY;
    }
    const item = buildAddToCartItem(this.selectedVariant(), this.quantityStore());
    if (item === null || !isValidAddToCartPricing(pricing)) {
      return Subscription.EMPTY;
    }
    const request: Observable<CartResponse> = this.detailsApi
      .addAuthenticatedCartItem({ ...item, ...pricing }, toApiOptions(options))
      .pipe(map(requireEnvelopeData));
    return loadResourceState(this.addToCartStore, request, { signal: options.signal });
  }

  /**
   * Submits the selected purchasable item and quantity to the GUEST cart
   * (`POST /cart/guest/{cartId}/items`) with the backend-issued price
   * snapshot (see ADR 018 — the priced-variant contract change unblocks
   * production guest submission).
   *
   * Guards (all silent, all pre-HTTP — same contract as
   * `submitAddToCart`, plus identity):
   * - blank `cartId` (no usable guest identity — the page establishes it
   *   through the cart feature's `GuestCartService` first);
   * - an in-flight submission is running → ignored (duplicate-submission
   *   lock; the button also disables while `adding`);
   * - no selectable variant, an invalid quantity, or a malformed pricing
   *   snapshot → ignored with state untouched.
   *
   * Otherwise drives the shared `idle → adding → added | error` machine
   * (one status for the button either way) with failures normalized to
   * `ApiError`. Returns the subscription (`EMPTY` when a guard rejects)
   * so the caller can observe settle — e.g. to heal a dead identity after
   * an identity-invalid failure. Aborts complete silently and leave state
   * untouched. This file submits lines; it never stores carts, persists
   * identities, or merges (Phase 7 owns those).
   */
  submitGuestAddToCart(
    cartId: string,
    pricing: AddToCartPricing,
    options: ProductDetailsLoadOptions = {},
  ): Subscription {
    if (cartId.trim() === '' || this.addToCartStore.isLoading()) {
      return Subscription.EMPTY;
    }
    const item = buildAddToCartItem(this.selectedVariant(), this.quantityStore());
    if (item === null || !isValidAddToCartPricing(pricing)) {
      return Subscription.EMPTY;
    }
    const request: Observable<CartResponse> = this.detailsApi
      .addGuestCartItem(cartId.trim(), { ...item, ...pricing }, toApiOptions(options))
      .pipe(map(requireEnvelopeData));
    return loadResourceState(this.addToCartStore, request, { signal: options.signal });
  }

  /**
   * Returns the submission machine to `idle` (e.g. when the selection,
   * quantity, or product changes, so stale added/error feedback never
   * survives its cause).
   */
  resetAddToCartStatus(): void {
    this.addToCartStore.reset();
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
