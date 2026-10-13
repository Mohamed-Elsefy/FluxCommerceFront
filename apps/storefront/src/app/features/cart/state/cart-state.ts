/**
 * Feature-owned Cart state for Sub-Phase 7.3 — Cart Feature State —
 * plus the Sub-Phase 7.5 guest-creation and Sub-Phase 7.6
 * authenticated-establish transitions.
 *
 * Scope: `docs/phases/PHASE_7_SHOPPING_CART.md` §§7.3/7.5/7.6 (state
 * only — no UI, no identity persistence, no merge wiring).
 *
 * State strategy (`ARCHITECTURE.md` §9 — smallest appropriate scope):
 *
 * ```text
 * CartPage (7.4 — orchestration only)
 *     ↓ GuestCartService (7.5 — guest identity lifecycle, no cart data)
 *     ↓ CartState (this file — feature-owned, local Signals)
 *     ↓ CartApiService (../data-access — feature data access, §7.2)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Cart API
 * ```
 *
 * Locality rules enforced here (same convention as `CatalogState`,
 * Phase 5.1, and `ProductDetailsState`, Phase 6.1–6.9):
 * - `@Injectable()` WITHOUT `providedIn` — the state is feature-scoped
 *   and must be provided at the cart route level (7.4 route providers).
 *   It is never a root singleton and never global state (no NgRx, no
 *   SignalStore, no shared library). Each cart route subtree gets its own
 *   instance; providing it twice yields two independent states.
 * - Signals stay local via the Phase 1 `createResourceState` primitive
 *   (idle → loading → success | empty | error, data retained across
 *   reloads, failures normalized to `ApiError`) plus two plain signals
 *   for the §7.1 identity and the active operation. No global store is
 *   touched.
 * - The state never touches `HttpClient`, never builds URLs or query
 *   strings, and never performs DTO→view-model mapping beyond the pure
 *   §7.1 helpers: envelopes unwrap here, wire errors flow into the
 *   `error` state through `loadResourceState`.
 * - The state never touches `localStorage` — the backend response is
 *   the single source of truth after every transition. Persisting the
 *   issued guest `cartId` belongs to `GuestCartStorageService`
 *   (Sub-Phase 7.5, explicitly not here): `createGuestCart` below adopts
 *   the backend-issued identity from the creation echo only, and never
 *   writes it anywhere.
 * - Server state (the cart slot, always a backend echo) and UI state
 *   stay separated: this file owns no selection, form, or presentation
 *   state — derived counts/currency/totals are read-only projections of
 *   the slot, and money slots stay `null` until a backend totals source
 *   provides them (never computed locally).
 * - SSR-safe: no `window`/`document`/`localStorage` anywhere in this
 *   file. No `TransferState` either — the cart is an authenticated
 *   customer area, not an SEO-sensitive page (`ARCHITECTURE.md` §23),
 *   so it loads live on the client (route-provided in 7.4).
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 7.4 — no pages, no components, no routes (and therefore no route
 *   providers yet — tests provide this class directly).
 * - 7.5 — no identity persistence (that lives in
 *   `GuestCartStorageService`) and no expiration-recovery triggering
 *   (that lives in `GuestCartService`); `setIdentity` stays the explicit
 *   seam those flows drive, and `createGuestCart` is the creation
 *   transport they drive.
 * - 7.6 — no auth-state inspection (that lives in `AuthService` and the
 *   `AuthenticatedCartService` driving `setIdentity`/`ensureAuthenticatedCart`
 *   below); this file only routes established identities to their endpoints.
 * - 7.7 — no merge triggering or merge-effect guards (triggering lives
 *   in `AuthenticatedCartService` since 7.7). `mergeCart` transports
 *   only and never adopts identity or triggers follow-ups.
 * - Phase 8 — no checkout, payment, or order logic.
 */

import { computed, inject, Injectable, signal, type Signal } from '@angular/core';
import { catchError, finalize, forkJoin, map, of, Subscription, tap, type Observable } from 'rxjs';
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
import type { AddCartItemRequest, UpdateCartItemQuantityRequest } from '@flux/models';
import { CartApiService } from '../data-access/cart-api.service';
import {
  createGuestCartIdentity,
  getCartItemCount,
  getCartOwner,
  isAuthenticatedCart,
  isEmptyCartData,
  isGuestCart,
  isValidCartQuantity,
  resolveCartCurrency,
  type Cart,
  type CartIdentity,
  type CartOwner,
  type CartTotals,
} from '../models/cart.models';
import type { CartOperation, CartStateShape } from './cart-state-structure';

/** Line thumbnail resolved from the product read model (display only). */
export interface CartLineImage {
  readonly imageUrl: string;
  readonly altText: string | null;
}

/** Options for every `CartState` action: cancellation only, never mapping. */
export interface CartActionOptions {
  /** Lifecycle signal — aborts complete silently and leave settled data alone. */
  readonly signal?: AbortSignal;
}

/**
 * Feature-scoped cart state. Provide at the cart route level (7.4) —
 * never at root. All selectors are readonly signals; all transitions are
 * explicit action calls driven by the owning page (7.4+) and identity
 * wiring (7.5/7.7).
 */
@Injectable()
export class CartState {
  private readonly cartApi = inject(CartApiService);

  private readonly cartStore: ResourceStateStore<Cart> = createResourceState<Cart>();
  private readonly identityStore = signal<CartIdentity | null>(null);
  private readonly activeOperationStore = signal<CartOperation | null>(null);

  /** Current cart resource (`GET` results and every mutation echo land here). */
  readonly cart: Signal<ResourceState<Cart>> = this.cartStore.state;
  /** Whether the cart slot is currently loading. */
  readonly isLoading: Signal<boolean> = this.cartStore.isLoading;
  /** Whether the cart slot holds a settled cart with lines. */
  readonly isSuccess: Signal<boolean> = this.cartStore.isSuccess;
  /** Whether the cart slot holds a settled cart with zero lines. */
  readonly isEmpty: Signal<boolean> = this.cartStore.isEmpty;
  /** Whether the cart slot holds a normalized failure. */
  readonly isError: Signal<boolean> = this.cartStore.isError;
  /** Settled cart payload, if any. */
  readonly data: Signal<Cart | null> = this.cartStore.data;
  /** Normalized cart failure, if any. */
  readonly error: Signal<ApiError | null> = this.cartStore.error;

  /** Which cart the slot holds (`null` before any identity is established). */
  readonly identity: Signal<CartIdentity | null> = this.identityStore.asReadonly();

  /** The in-flight operation, if any (`null` when quiescent). */
  readonly activeOperation: Signal<CartOperation | null> = this.activeOperationStore.asReadonly();

  /** Whole feature snapshot in the §7.1 shape (status helpers consume this). */
  readonly state: Signal<CartStateShape> = computed(() => ({
    cart: this.cartStore.state(),
    identity: this.identityStore(),
    activeOperation: this.activeOperationStore(),
  }));

  /** Total unit count across lines (backend quantities only — never money math). */
  readonly itemCount: Signal<number> = computed(() => getCartItemCount(this.cartStore.data()));

  /** Distinct line count (`items.length`). */
  readonly distinctItemCount: Signal<number> = computed(
    () => this.cartStore.data()?.items.length ?? 0,
  );

  /** Backend-issued line currency when single-currency, otherwise `null`. */
  readonly currency: Signal<string | null> = computed(() =>
    resolveCartCurrency(this.cartStore.data()),
  );

  /**
   * Backend-authoritative totals view: counts and currency projected
   * from backend lines; `subtotal`/`total` stay `null` until a backend
   * totals source provides them (mapped in later data access — never
   * derived here).
   */
  readonly totals: Signal<CartTotals> = computed(() => {
    const data = this.cartStore.data();
    return {
      itemCount: getCartItemCount(data),
      distinctItemCount: data?.items.length ?? 0,
      currency: resolveCartCurrency(data),
      subtotal: null,
      total: null,
    };
  });

  /** Cart ownership resolved from backend flags (`null` when unknown). */
  readonly owner: Signal<CartOwner | null> = computed(() => getCartOwner(this.cartStore.data()));

  /**
   * Line thumbnails by product id, resolved from `GET
   * /catalog/products/{id}` (`primaryImage`). Display-only enrichment —
   * cart lines carry no image URL in any readable contract, so missing
   * entries (unknown/failed products) render the placeholder. Never
   * touches the cart slot or the one-at-a-time lock.
   */
  private readonly lineImagesStore = signal<ReadonlyMap<string, CartLineImage>>(new Map());

  /** Resolved line thumbnails by product id (absent ids render the placeholder). */
  readonly lineImages: Signal<ReadonlyMap<string, CartLineImage>> =
    this.lineImagesStore.asReadonly();

  /**
   * Loads the cart for the current identity: guest identity reads
   * `GET /cart/guest/{cartId}`, authenticated identity reads
   * `GET /cart`. A settled cart with zero lines resolves to `empty`;
   * a dataless envelope resolves to `error` (contract violation);
   * aborts leave settled data alone. With no identity established there
   * is nothing addressable — the call is ignored and state stays idle
   * (identity arrives via `setIdentity`, driven by 7.5/7.7 wiring).
   */
  loadCart(options: CartActionOptions = {}): Subscription {
    const identity = this.identityStore();
    if (identity?.kind === 'guest') {
      return this.runOperation(
        'load',
        () => this.cartApi.getGuestCart(identity.cartId, toApiOptions(options)),
        options,
      );
    }
    if (identity?.kind === 'authenticated') {
      return this.runOperation('load', () => this.cartApi.getCart(toApiOptions(options)), options);
    }
    return Subscription.EMPTY;
  }

  /**
   * Resolves thumbnails for product ids missing from the map (`GET
   * /catalog/products/{id}` → `primaryImage`). Runs outside the
   * one-at-a-time lock (display enrichment, never a cart transition);
   * per-product failures resolve to `null` and leave the placeholder —
   * one unknown product never fails the batch. Blank ids are skipped
   * without fetching. With nothing missing the call is ignored.
   */
  loadLineImages(productIds: readonly string[], options: CartActionOptions = {}): Subscription {
    const missing = [...new Set(productIds)]
      .map((id) => id.trim())
      .filter((id) => id !== '' && !this.lineImagesStore().has(id));
    if (missing.length === 0) {
      return Subscription.EMPTY;
    }
    return forkJoin(
      missing.map((id) =>
        this.cartApi.getProduct(id, toApiOptions(options)).pipe(
          map((envelope) => {
            const image = envelope.data?.primaryImage ?? null;
            const url = image?.imageUrl?.trim() ?? '';
            return url === ''
              ? null
              : { id, image: { imageUrl: url, altText: image?.altText ?? null } as CartLineImage };
          }),
          catchError(() => of(null)),
        ),
      ),
    ).subscribe((resolved) => {
      const next = new Map(this.lineImagesStore());
      for (const entry of resolved) {
        if (entry !== null) {
          next.set(entry.id, entry.image);
        }
      }
      this.lineImagesStore.set(next);
    });
  }

  /**
   * Creates the guest cart (`POST /cart/guest` — anonymous, empty body)
   * and adopts it in one transition: the backend-issued guest identity
   * is taken from the creation echo (no follow-up `GET`), and the
   * created cart lands in the slot (`empty` for the zero-line fresh
   * cart). A dataless envelope, a blank issued id, or a non-guest echo
   * is a contract violation surfacing as `error` — same rule as
   * `requireEnvelopeData`. Persisting the issued id belongs to
   * `GuestCartStorageService` (Sub-Phase 7.5, explicitly not here); the
   * caller reads it back from the settled data. Needs no prior identity
   * (this is how the first identity is established).
   */
  createGuestCart(options: CartActionOptions = {}): Subscription {
    return this.runOperation(
      'load',
      () => this.cartApi.createGuestCart(toApiOptions(options)),
      options,
      (cart) => this.adoptCreatedGuestIdentity(cart),
    );
  }

  /**
   * Establishes the caller's authenticated cart (`POST /cart` —
   * get-or-create: returns the existing cart or creates one; no body,
   * the server resolves the user from the JWT session) and adopts the
   * authenticated identity in one transition (no follow-up `GET`). A
   * dataless envelope or a non-authenticated echo is a contract violation
   * surfacing as `error` — same rule as `requireEnvelopeData`. Needs no
   * prior identity (this is how the authenticated identity is
   * established after login or session restoration). Nothing is persisted
   * locally: the backend owns the authenticated cart across refreshes.
   */
  ensureAuthenticatedCart(options: CartActionOptions = {}): Subscription {
    return this.runOperation(
      'load',
      () => this.cartApi.getOrCreateCart(toApiOptions(options)),
      options,
      (cart) => this.adoptEnsuredAuthenticatedIdentity(cart),
    );
  }

  /**
   * Adds one line to the cart for the current identity. The body
   * (`variantId` + price snapshot + `quantity`) is sent as given —
   * this state sources no prices and validates nothing beyond
   * addressability (guest needs its `cartId`; authenticated needs the
   * session). With no identity the call is ignored.
   */
  addItem(body: AddCartItemRequest, options: CartActionOptions = {}): Subscription {
    const identity = this.identityStore();
    if (identity?.kind === 'guest') {
      return this.runOperation(
        'addItem',
        () => this.cartApi.addGuestCartItem(identity.cartId, body, toApiOptions(options)),
        options,
      );
    }
    if (identity?.kind === 'authenticated') {
      return this.runOperation(
        'addItem',
        () => this.cartApi.addCartItem(body, toApiOptions(options)),
        options,
      );
    }
    return Subscription.EMPTY;
  }

  /**
   * Updates one line's quantity for the current identity. Blank line
   * ids and invalid quantities (non-integer or below the contract
   * `Range(1, max)` floor) are rejected without fetching — the same
   * doomed-request rule as invalid product ids (§6.2 convention). The
   * update body carries quantity only (no price/currency); the route id
   * wins on disagreement. With no identity the call is ignored.
   */
  updateQuantity(
    variantId: string,
    quantity: number,
    options: CartActionOptions = {},
  ): Subscription {
    const lineId = variantId.trim();
    if (lineId === '' || !isValidCartQuantity(quantity)) {
      return Subscription.EMPTY;
    }
    const body: UpdateCartItemQuantityRequest = { variantId: lineId, quantity };
    const identity = this.identityStore();
    if (identity?.kind === 'guest') {
      return this.runOperation(
        'updateQuantity',
        () =>
          this.cartApi.updateGuestCartItemQuantity(
            identity.cartId,
            lineId,
            body,
            toApiOptions(options),
          ),
        options,
      );
    }
    if (identity?.kind === 'authenticated') {
      return this.runOperation(
        'updateQuantity',
        () => this.cartApi.updateCartItemQuantity(lineId, body, toApiOptions(options)),
        options,
      );
    }
    return Subscription.EMPTY;
  }

  /**
   * Removes one line for the current identity. Blank line ids are
   * rejected without fetching. With no identity the call is ignored.
   */
  removeItem(variantId: string, options: CartActionOptions = {}): Subscription {
    const lineId = variantId.trim();
    if (lineId === '') {
      return Subscription.EMPTY;
    }
    const identity = this.identityStore();
    if (identity?.kind === 'guest') {
      return this.runOperation(
        'removeItem',
        () => this.cartApi.removeGuestCartItem(identity.cartId, lineId, toApiOptions(options)),
        options,
      );
    }
    if (identity?.kind === 'authenticated') {
      return this.runOperation(
        'removeItem',
        () => this.cartApi.removeCartItem(lineId, toApiOptions(options)),
        options,
      );
    }
    return Subscription.EMPTY;
  }

  /**
   * Clears the cart for the current identity (the backend returns the
   * emptied cart, which resolves to `empty`). With no identity the call
   * is ignored.
   */
  clearCart(options: CartActionOptions = {}): Subscription {
    const identity = this.identityStore();
    if (identity?.kind === 'guest') {
      return this.runOperation(
        'clear',
        () => this.cartApi.clearGuestCart(identity.cartId, toApiOptions(options)),
        options,
      );
    }
    if (identity?.kind === 'authenticated') {
      return this.runOperation(
        'clear',
        () => this.cartApi.clearCart(toApiOptions(options)),
        options,
      );
    }
    return Subscription.EMPTY;
  }

  /**
   * Merges the named guest cart into the caller's authenticated cart
   * (`POST /cart/merge` — atomic backend Lua merge; the frontend never
   * implements merge behavior). Blank ids are rejected without
   * fetching. Transport only: on success the slot holds the merged cart
   * but identity is left untouched — post-merge identity adoption and
   * trigger timing belong to Sub-Phase 7.7, never here. Authentication
   * failures surface as `error` for the caller to handle.
   */
  mergeCart(guestCartId: string, options: CartActionOptions = {}): Subscription {
    const sourceId = guestCartId.trim();
    if (sourceId === '') {
      return Subscription.EMPTY;
    }
    return this.runOperation(
      'merge',
      () => this.cartApi.mergeGuestCart({ guestCartId: sourceId }, toApiOptions(options)),
      options,
    );
  }

  /**
   * Establishes which cart this state holds. The explicit seam
   * Sub-Phases 7.5/7.7 drive (guest `cartId` issued by `POST
   * /cart/guest`, or the authenticated session after login) — this
   * method stores the assignment only and triggers nothing. The slot
   * resets to `idle` so data belonging to the previous identity is
   * never shown under the new one. Switch while quiescent (all
   * 7.5/7.7 flows do).
   */
  setIdentity(identity: CartIdentity | null): void {
    this.identityStore.set(identity);
    this.cartStore.reset();
    this.activeOperationStore.set(null);
  }

  /** Restores the §7.1 initial shape: idle slot, no identity, no operation. */
  reset(): void {
    this.cartStore.reset();
    this.identityStore.set(null);
    this.activeOperationStore.set(null);
  }

  /**
   * Drives the cart slot through `Loading → Success | Empty | Error`
   * for one operation under the pessimistic one-at-a-time contract
   * declared by the §7.1 shape: while an operation is in flight, new
   * action calls are ignored — the request factory is never invoked,
   * so data access is untouched and no HTTP is constructed — instead of
   * racing the backend's OCC versioning. The factory must stay a
   * side-effect-free cold-observable construction (true for the
   * data-access layer); `onResponseData` is the single narrow exception,
   * running only after a real response arrived (used by `createGuestCart`
   * to adopt the backend-issued guest identity — never storage, never
   * HTTP). The lock always clears on settle, failure, or abort (aborts
   * additionally leave settled data alone).
   */
  private runOperation(
    operation: CartOperation,
    buildRequest: () => Observable<ApiResponseWithData<Cart>>,
    options: CartActionOptions = {},
    onResponseData: (cart: Cart) => void = () => undefined,
  ): Subscription {
    if (this.activeOperationStore() !== null) {
      return Subscription.EMPTY;
    }
    this.activeOperationStore.set(operation);
    const tracked: Observable<Cart> = buildRequest().pipe(
      map(requireEnvelopeData),
      tap(onResponseData),
      finalize(() => {
        if (this.activeOperationStore() === operation) {
          this.activeOperationStore.set(null);
        }
      }),
    );
    return loadResourceState(this.cartStore, tracked, {
      signal: options.signal,
      isEmpty: isEmptyCartData,
    });
  }

  /**
   * Adopts the backend-issued guest identity from a creation echo
   * (`createGuestCart` only). Throws (→ normalized slot `error`) when
   * the echo carries no usable guest identity — the caller must never
   * operate under a fabricated id. Pure backend echo handling: performs
   * no HTTP and writes no storage.
   */
  private adoptCreatedGuestIdentity(cart: Cart): void {
    const identity = createGuestCartIdentity(cart.cartId);
    if (identity === null || !isGuestCart(cart)) {
      throw new ApiError({
        status: 200,
        code: UNKNOWN_ERROR_CODE,
        message: 'The server returned a cart without a usable guest identity.',
      });
    }
    this.identityStore.set(identity);
  }

  /**
   * Adopts the authenticated identity from a get-or-create echo
   * (`ensureAuthenticatedCart` only). Throws (→ normalized slot `error`)
   * when the echo is not an authenticated cart — the caller must never
   * show another identity's cart. Pure backend echo handling: performs
   * no HTTP and writes no storage (backend persistence owns refreshes).
   */
  private adoptEnsuredAuthenticatedIdentity(cart: Cart): void {
    if (!isAuthenticatedCart(cart)) {
      throw new ApiError({
        status: 200,
        code: UNKNOWN_ERROR_CODE,
        message: 'The server returned a cart without an authenticated identity.',
      });
    }
    this.identityStore.set({ kind: 'authenticated' });
  }
}

function toApiOptions(options: CartActionOptions): ApiRequestOptions {
  return options.signal === undefined ? {} : { signal: options.signal };
}

/** Unwraps a cart envelope; a dataless `200` is a contract violation. */
function requireEnvelopeData(envelope: ApiResponseWithData<Cart>): Cart {
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
