/**
 * Feature-owned Checkout state for Sub-Phases 8.3 (Checkout State
 * Management) and 8.7 (Failure Handling & Recovery).
 *
 * Scope: `docs/phases/PHASE_8_CHECKOUT.md` §§8.3/8.7 (state and recovery
 * only — no forms, no UI, no payment).
 *
 * State strategy (`ARCHITECTURE.md` §9 — smallest appropriate scope):
 *
 * ```text
 * CheckoutPage (8.4+ — orchestration only)
 *     ↓ CheckoutState (this file — feature-owned, local Signals)
 *     ↓ CheckoutApiService (../data-access — feature data access, §8.2)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 *
 * Locality rules enforced here (same convention as `CartState`, Phase
 * 7.3):
 * - `@Injectable()` WITHOUT `providedIn` — the state is feature-scoped
 *   and must be provided at the checkout route level (route providers).
 *   It is never a root singleton and never global state (no NgRx, no
 *   SignalStore, no shared library). Each checkout route subtree gets its
 *   own instance.
 * - Signals stay local via the Phase 1 `createResourceState` primitive
 *   (idle → loading → success | error, data retained across reloads,
 *   failures normalized to `ApiError`) for the single order-creation
 *   call, plus plain signals for the form data, the cart snapshot, the
 *   initialization outcome, and the awaiting-cart flag. No global store
 *   is touched.
 * - Form state and submission state are separate signals by
 *   construction: `setFormData` stores customer-entered data only and
 *   triggers nothing; the submission resource is driven only by
 *   `submitOrder`/`retrySubmission`. Failure recovery
 *   (`clearSubmissionError`) and full reset (`reset`) never wipe the
 *   form implicitly — the page decides.
 * - Submit locks (§8.7): the in-flight lock drops concurrent attempts
 *   (factory never invoked — no HTTP), the post-success lock requires
 *   an explicit `reset` for a new order, and the post-failure lock
 *   requires an explicit `clearSubmissionError` (edit path) or
 *   `retrySubmission` (same-key transport retry) before any new
 *   attempt. A failed request never silently re-fires.
 * - Idempotency-key tracking (§8.7): every attempt records its key.
 *   Fresh attempts mint fresh keys; `retrySubmission` reuses the failed
 *   attempt's key for the identical payload (transport failures only —
 *   replay-or-create-once instead of risking a duplicate order with a
 *   new key). Keys clear on `reset` only.
 * - The state never becomes a second Cart store: it holds no lines, no
 *   quantities, no prices, and no totals — only the §8.1 freshness
 *   anchor (`cartId` + backend `version` + line count). Cart data enters
 *   exclusively through the explicit `initialize` seam, driven by the
 *   owning page reading the Cart feature state (8.6 orchestration); this
 *   file never injects `CartState`, never calls cart endpoints, and never
 *   establishes cart identity.
 * - The state never touches `HttpClient`, never builds URLs, and never
 *   performs DTO→view-model mapping beyond the pure §8.1 helpers:
 *   envelopes unwrap here, wire errors flow into the `error` state
 *   through `loadResourceState`.
 * - Money is never derived here: the created order is stored verbatim
 *   for the next frontend step (Phase 9 payment entry).
 * - SSR-safe: no `window`/`document`/`localStorage` anywhere in this
 *   file. No `TransferState` either — checkout is an authenticated
 *   customer area, not an SEO-sensitive page (`ARCHITECTURE.md` §23),
 *   so it initializes live on the client (route-provided).
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 8.4 — no `FormGroup`/`FormControl`, no validators, no pages, no
 *   components (the form arrives as plain `CheckoutFormData` through
 *   `setFormData`, driven by the 8.4 Reactive Form).
 * - 8.6 — no billing-copy (`billingSameAsShipping` is stored verbatim;
 *   materializing billing from shipping belongs to the form layer) and
 *   no client-validation orchestration (the page validates before
 *   calling `submitOrder`).
 * - Phase 9 — no payment state, no redirection, no client-secret logic.
 * - Phase 10 — no order polling (the saga moves `Pending` orders
 *   asynchronously; polling owns the follow-up read, not this state).
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
import type { CartResponse } from '@flux/models';
import { CheckoutApiService, newIdempotencyKey } from '../data-access/checkout-api.service';
import { buildCreateOrderRequest, type CreateOrderResponse } from '../models/checkout.models';
import {
  hasCheckoutCartChanged,
  isCheckoutBlockedForEmptyCart,
  resolveCheckoutInitialization,
  takeCheckoutCartSnapshot,
  type CheckoutCartSnapshot,
  type CheckoutFormData,
  type CheckoutInitialization,
  type CheckoutStateBoundary,
} from './checkout-state-boundaries';

/**
 * Checkout workflow stage for the UI. Derived from the submission
 * resource plus the initialization slots — never set directly, so the
 * UI can reliably represent each stage:
 *
 * - `initial` — never initialized, blocked at entry, or fully reset.
 * - `loading` — initialization awaiting unsettled cart data.
 * - `ready` — initialized against a settled non-empty cart, submission
 *   idle (form may or may not be entered yet).
 * - `submitting` — order creation in flight (submit lock active).
 * - `success` — order created (result stored for Phase 9).
 * - `failure` — submission rejected (form preserved for recovery).
 */
export type CheckoutWorkflow =
  'initial' | 'loading' | 'ready' | 'submitting' | 'success' | 'failure';

/** Options for `CheckoutState.submitOrder`: key supply and lifecycle only. */
export interface CheckoutSubmitOptions {
  /**
   * Idempotency key for this attempt. Omit to mint a fresh key for a
   * new attempt (a new payload MUST use a new key, else `409
   * IdempotencyConflict`). Reuse the previous key ONLY when retrying
   * the identical payload after a transport failure — prefer
   * `retrySubmission` for that path (it reuses the recorded key).
   */
  readonly idempotencyKey?: string;
  /** Lifecycle signal — aborts complete silently and leave settled data alone. */
  readonly signal?: AbortSignal;
  /**
   * Live cart for the pre-submit freshness check. When provided and the
   * cart moved since initialization (`cartId`/`version`/line count),
   * the submit is ignored — re-review before submit, never silent
   * submit against stale lines.
   */
  readonly currentCart?: CartResponse | null;
}

/**
 * Options for `CheckoutState.retrySubmission`: lifecycle and freshness
 * only. The key is never supplied here — the failed attempt's recorded
 * key is always reused (same key + same body replays the original
 * order instead of creating a duplicate).
 */
export interface CheckoutRetryOptions {
  /** Lifecycle signal — aborts complete silently and leave settled data alone. */
  readonly signal?: AbortSignal;
  /**
   * Live cart for the pre-retry freshness check (same stale-review
   * rule as `submitOrder`).
   */
  readonly currentCart?: CartResponse | null;
}

/**
 * Feature-scoped checkout state. Provide at the checkout route level —
 * never at root. All selectors are readonly signals; all transitions are
 * explicit action calls driven by the owning page (8.4+).
 */
@Injectable()
export class CheckoutState {
  private readonly checkoutApi = inject(CheckoutApiService);

  private readonly submissionStore: ResourceStateStore<CreateOrderResponse> =
    createResourceState<CreateOrderResponse>();
  private readonly formStore = signal<CheckoutFormData | null>(null);
  private readonly cartSnapshotStore = signal<CheckoutCartSnapshot | null>(null);
  private readonly initializationStore = signal<CheckoutInitialization | null>(null);
  private readonly awaitingCartStore = signal(false);
  private readonly lastIdempotencyKeyStore = signal<string | null>(null);

  /** Order-creation resource (`idle` before the first submit). */
  readonly submission: Signal<ResourceState<CreateOrderResponse>> = this.submissionStore.state;
  /** Whether a submission is in flight (the client-side duplicate-submit guard). */
  readonly isSubmitting: Signal<boolean> = this.submissionStore.isLoading;
  /** Created order, if any (stored only as required by Phase 9). */
  readonly result: Signal<CreateOrderResponse | null> = this.submissionStore.data;
  /** Normalized submission failure, if any. */
  readonly submissionError: Signal<ApiError | null> = this.submissionStore.error;

  /** Customer-entered form data, if any (never backend data, never cart data). */
  readonly formData: Signal<CheckoutFormData | null> = this.formStore.asReadonly();

  /** Read-only cart freshness anchor taken at initialization, if any. */
  readonly cartSnapshot: Signal<CheckoutCartSnapshot | null> = this.cartSnapshotStore.asReadonly();

  /** Initialization outcome, if resolved (`null` before any settled attempt). */
  readonly initialization: Signal<CheckoutInitialization | null> =
    this.initializationStore.asReadonly();

  /**
   * Idempotency key of the latest submit attempt (`null` before the
   * first attempt or after `reset`). `retrySubmission` reuses it for
   * the identical payload; fresh attempts mint and record a new one.
   */
  readonly lastIdempotencyKey: Signal<string | null> = this.lastIdempotencyKeyStore.asReadonly();

  /** Workflow stage derived from submission + initialization (never set directly). */
  readonly workflow: Signal<CheckoutWorkflow> = computed(() => {
    const submission = this.submissionStore.state();
    if (submission.isLoading) {
      return 'submitting';
    }
    if (submission.isSuccess) {
      return 'success';
    }
    if (submission.isError) {
      return 'failure';
    }
    if (this.cartSnapshotStore() !== null) {
      return 'ready';
    }
    if (this.awaitingCartStore()) {
      return 'loading';
    }
    return 'initial';
  });

  /** Whole feature snapshot in the §8.1 boundary shape. */
  readonly state: Signal<CheckoutStateBoundary> = computed(() => ({
    form: this.formStore(),
    submission: this.submissionStore.state(),
    cartSnapshot: this.cartSnapshotStore(),
  }));

  /**
   * Initializes checkout against the current cart (read from the Cart
   * feature state by the owning page — this method stores the
   * read-only snapshot only and triggers no cart loading).
   *
   * - `undefined` cart (data not yet settled): records awaiting-cart
   *   (`loading` workflow), leaves snapshot and submission untouched,
   *   returns `null` (unresolved — call again once settled).
   * - Missing/empty cart: records `blocked-empty-cart`, clears any
   *   previous snapshot (an emptied cart invalidates the review),
   *   returns the outcome. The flow never executes on an empty cart.
   * - Anonymous session: records `blocked-anonymous` (checkout is
   *   `[Authorize]` — guest carts merge via the Cart feature first),
   *   returns the outcome.
   * - Settled non-empty cart + authenticated session: stores the
   *   snapshot, records `ready`, returns it. Submission and form slots
   *   are untouched (re-initializing never wipes entered data or a
   *   settled result).
   */
  initialize(
    cart: CartResponse | null | undefined,
    isAuthenticated: boolean,
  ): CheckoutInitialization | null {
    if (cart === undefined) {
      this.awaitingCartStore.set(true);
      return null;
    }
    this.awaitingCartStore.set(false);
    if (isCheckoutBlockedForEmptyCart(cart)) {
      this.initializationStore.set('blocked-empty-cart');
      this.cartSnapshotStore.set(null);
      return 'blocked-empty-cart';
    }
    const outcome = resolveCheckoutInitialization(cart, isAuthenticated);
    if (outcome !== 'ready') {
      this.initializationStore.set(outcome);
      this.cartSnapshotStore.set(null);
      return outcome;
    }
    this.cartSnapshotStore.set(takeCheckoutCartSnapshot(cart));
    this.initializationStore.set('ready');
    return 'ready';
  }

  /**
   * Stores customer-entered form data. The explicit seam the §8.4
   * Reactive Form drives — this method stores the assignment only and
   * triggers nothing (no validation, no mapping, no HTTP). `null`
   * clears entered data (explicit user action).
   */
  setFormData(form: CheckoutFormData | null): void {
    this.formStore.set(form);
  }

  /**
   * Submits the stored form against the snapshotted cart
   * (`POST /orders/checkout`). The body is built from the snapshot
   * `cartId` plus the stored addresses verbatim (billing materializes
   * in the form layer — see the file header, not here).
   *
   * Guard rejections (call ignored, factory never invoked, no HTTP):
   * - a submission is already in flight (duplicate-submit lock);
   * - an order was already created (explicit `reset` required for a
   *   new order — a created order must never be re-ordered silently);
   * - a submission already failed (explicit `clearSubmissionError` for
   *   the edit path or `retrySubmission` for the same-key retry path —
   *   a failed request never silently re-fires);
   * - no snapshot (not initialized);
   * - no form data (nothing validated to send);
   * - `currentCart` provided and changed since initialization (stale
   *   review — re-initialize before submit).
   *
   * The idempotency key defaults to a fresh mint per attempt and is
   * recorded for `retrySubmission`. A dataless envelope is a contract
   * violation surfacing as `error`.
   */
  submitOrder(options: CheckoutSubmitOptions = {}): Subscription {
    if (
      this.submissionStore.isLoading() ||
      this.submissionStore.data() !== null ||
      this.submissionStore.isError()
    ) {
      return Subscription.EMPTY;
    }
    const snapshot = this.cartSnapshotStore();
    const form = this.formStore();
    if (snapshot === null || form === null) {
      return Subscription.EMPTY;
    }
    if (
      options.currentCart !== undefined &&
      hasCheckoutCartChanged(snapshot, options.currentCart)
    ) {
      return Subscription.EMPTY;
    }
    const idempotencyKey = options.idempotencyKey ?? newIdempotencyKey();
    this.lastIdempotencyKeyStore.set(idempotencyKey);
    const tracked: Observable<CreateOrderResponse> = this.checkoutApi
      .createOrder(
        buildCreateOrderRequest(snapshot.cartId, form.shippingAddress, form.billingAddress),
        idempotencyKey,
        toApiOptions(options),
      )
      .pipe(map(requireEnvelopeData));
    return loadResourceState(this.submissionStore, tracked, { signal: options.signal });
  }

  /**
   * Retries the failed submission with the failed attempt's recorded
   * idempotency key and the identical payload (same key + same body
   * replays the original order when the first attempt actually landed,
   * or creates it once when the attempt never arrived — never a
   * duplicate). Intended for transport failures (`status 0`,
   * `checkoutRecoveryFor` → `retry`); validation and business
   * rejections need corrected input first (use `clearSubmissionError`
   * and resubmit as a fresh attempt instead — replaying them only
   * reproduces the rejection).
   *
   * Guard rejections (call ignored, factory never invoked, no HTTP):
   * the submission is not in the error state (nothing to retry),
   * in-flight/succeeded rules from `submitOrder`, missing snapshot or
   * form, or a stale `currentCart`. The recorded key survives the retry
   * for further attempts; `reset` clears it.
   */
  retrySubmission(options: CheckoutRetryOptions = {}): Subscription {
    if (!this.submissionStore.isError()) {
      return Subscription.EMPTY;
    }
    if (this.submissionStore.isLoading() || this.submissionStore.data() !== null) {
      return Subscription.EMPTY;
    }
    const snapshot = this.cartSnapshotStore();
    const form = this.formStore();
    if (snapshot === null || form === null) {
      return Subscription.EMPTY;
    }
    if (
      options.currentCart !== undefined &&
      hasCheckoutCartChanged(snapshot, options.currentCart)
    ) {
      return Subscription.EMPTY;
    }
    const idempotencyKey = this.lastIdempotencyKeyStore() ?? newIdempotencyKey();
    this.lastIdempotencyKeyStore.set(idempotencyKey);
    const tracked: Observable<CreateOrderResponse> = this.checkoutApi
      .createOrder(
        buildCreateOrderRequest(snapshot.cartId, form.shippingAddress, form.billingAddress),
        idempotencyKey,
        toApiOptions(options),
      )
      .pipe(map(requireEnvelopeData));
    return loadResourceState(this.submissionStore, tracked, { signal: options.signal });
  }

  /**
   * Failure recovery: clears the submission error back to `idle`,
   * preserving the form and the snapshot (recoverable rejections never
   * wipe entered data — see `isFormPreservingCheckoutFailure`, §8.1).
   * The workflow returns to `ready` (snapshot present) or `initial`.
   */
  clearSubmissionError(): void {
    this.submissionStore.reset();
  }

  /** Restores the §8.1 initial shape: idle submission, no form, no snapshot, no key. */
  reset(): void {
    this.submissionStore.reset();
    this.formStore.set(null);
    this.cartSnapshotStore.set(null);
    this.initializationStore.set(null);
    this.awaitingCartStore.set(false);
    this.lastIdempotencyKeyStore.set(null);
  }
}

function toApiOptions(options: CheckoutSubmitOptions | CheckoutRetryOptions): ApiRequestOptions {
  return options.signal === undefined ? {} : { signal: options.signal };
}

/** Unwraps an order envelope; a dataless `200` is a contract violation. */
function requireEnvelopeData(
  envelope: ApiResponseWithData<CreateOrderResponse>,
): CreateOrderResponse {
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
