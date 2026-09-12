/**
 * Product Details page for Sub-Phases 6.1–6.2 — Foundation + Page &
 * Information.
 *
 * Smart page (route-level composition): reads the `:id` route parameter,
 * validates it through the pure `parseProductIdParam` helper, and drives
 * the feature-scoped `ProductDetailsState` (provided by the parent
 * `productDetailsRoutes` entry — never a global store).
 *
 * Data flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * ProductDetailsPage (this file — orchestration only)
 *     ↓ route paramMap → parseProductIdParam (models/, pure)
 *     ↓ ProductDetailsState (state/, feature-owned local Signals)
 *     ↓ ProductDetailsApiService (feature data access)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Catalog API
 * ```
 *
 * Route contract:
 * - This page owns `/catalog/products/:id` (lazy boundary in
 *   `product-details.routes.ts`, mounted in `app.routes.ts`).
 * - A missing, blank, or malformed id renders the invalid-id state and
 *   never fetches (no doomed request); both state slots stay `idle`.
 * - A well-formed id loads the product and its specifications in the
 *   browser after hydration; the server keeps the idle shell (production
 *   prerendering has no backend at build time, so server-side fetching
 *   would hang the render — SSR transfer arrives in Sub-Phase 6.9).
 *
 * Information contract (§6.2 rule — only backend-provided fields):
 * - Name + description from `ProductResponse`; specifications (`name` /
 *   `value`) from the specifications endpoint in wire order.
 * - Pricing, availability, and SKU are rendered nowhere: no read contract
 *   exposes them (`VariantResponse` carries SKU but no price; variant
 *   presentation arrives with selection in Sub-Phase 6.4). Nothing is
 *   fabricated.
 *
 * Resource states (§6.2): invalid-id → loading → success | not-found
 * (`404`, with a back-to-catalog link and no retry) | error (shared
 * `ErrorState` + retry over both slots). The specifications section renders
 * on success only — while it loads, fails, or is empty the product still
 * shows (the section hides; the product is the primary resource and a specs
 * `404` coincides with a product `404` anyway).
 *
 * Copy is localized per the active `CultureService.culture()` through the
 * feature-owned bundle; retry through `common.actions.retry` and failures
 * through `resolveApiErrorMessage` (never backend text).
 *
 * Explicitly out of scope (later sub-phases, must not appear here):
 * - 6.3 — no image gallery.
 * - 6.4–6.5 — no variant selection, SKU/pricing/availability presentation.
 * - 6.6–6.7 — no quantity or add-to-cart.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { ProductDetailsState } from '../../state/product-details-state';
import {
  PRODUCT_DETAILS_ID_PARAM,
  isNotFoundError,
  parseProductIdParam,
} from '../../models/product-details.models';
import {
  PRODUCT_DETAILS_TRANSLATION_KEYS,
  translateProductDetailsKey,
} from '../../i18n/product-details-translations';

@Component({
  selector: 'app-product-details-page',
  imports: [RouterLink, LoadingIndicator, EmptyState, ErrorState],
  templateUrl: './product-details-page.html',
  styleUrl: './product-details-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailsPage {
  private readonly state = inject(ProductDetailsState);
  private readonly route = inject(ActivatedRoute);
  private readonly cultures = inject(CultureService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Tears down the in-flight details requests, if any (idempotent). */
  private detailsTeardown: (() => void) | undefined;

  /** Current product resource (`GET /catalog/products/{id}`). */
  readonly product = this.state.product;

  /** Specifications resource (`GET .../specifications`, wire order). */
  readonly specifications = this.state.specifications;

  /**
   * Validated product id from the `:id` route parameter (`null` when
   * missing, blank, or malformed — see `parseProductIdParam`). The page
   * never fetches for `null`.
   */
  readonly productId = toSignal(
    this.route.paramMap.pipe(
      map((params) => parseProductIdParam(params.get(PRODUCT_DETAILS_ID_PARAM))),
    ),
    { initialValue: parseProductIdParam(null) },
  );

  /** Whether the product fetch settled as not-found (`404`). */
  protected readonly isNotFound = computed(
    () => this.product().isError && isNotFoundError(this.product().error),
  );

  /** Localized page copy for the active culture. */
  protected readonly copy = computed(() => {
    const culture = this.cultures.culture();
    return {
      title: translateProductDetailsKey(culture, PRODUCT_DETAILS_TRANSLATION_KEYS.pageTitle),
      loading: translateProductDetailsKey(culture, PRODUCT_DETAILS_TRANSLATION_KEYS.pageLoading),
      errorTitle: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.pageErrorTitle,
      ),
      invalidIdTitle: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.invalidIdTitle,
      ),
      invalidIdMessage: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.invalidIdMessage,
      ),
      notFoundTitle: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.notFoundTitle,
      ),
      notFoundMessage: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.notFoundMessage,
      ),
      backToCatalog: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.notFoundBackToCatalog,
      ),
      descriptionTitle: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.descriptionTitle,
      ),
      noDescription: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.noDescription,
      ),
      specsTitle: translateProductDetailsKey(culture, PRODUCT_DETAILS_TRANSLATION_KEYS.specsTitle),
      retry: translateKey(culture, 'common.actions.retry'),
    };
  });

  /** Heading: the real product name on success, the localized title otherwise. */
  protected readonly heading = computed(() =>
    this.product().isSuccess ? (this.product().data?.name ?? this.copy().title) : this.copy().title,
  );

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.product().error, this.cultures.culture()),
  );

  constructor() {
    // Browser only: drives both details loads from the route id (initial
    // value included, param changes followed). Runs after the first render;
    // the server keeps the idle shell (see above).
    //
    // The state calls run `untracked` on purpose: each `load*` reads its
    // slot (`loadResourceState` retains current data across reloads) and
    // writes it on settle, so without `untracked` the slots would become
    // effect dependencies and every settled response would reschedule the
    // effect — an infinite fetch loop. The effect depends on the route id
    // alone.
    //
    // Stale safety: every run owns an `AbortController` torn down before
    // the next run (and on destroy via effect cleanup), so older pending
    // requests can never settle over newer ones — `cancelOnAbort`
    // (Phase 1.7) completes aborted calls silently without touching state.
    // The same tracked teardown covers retries, so a retried request
    // supersedes (rather than races) any in-flight one.
    effect((onCleanup) => {
      if (!this.isBrowser) {
        return;
      }
      const id = this.productId();
      untracked(() => {
        if (id === null) {
          this.cancelDetailsLoad();
          this.state.reset();
        } else {
          this.startDetailsLoad(id);
        }
      });
      onCleanup(() => this.cancelDetailsLoad());
    });
  }

  /** (Re)loads the product and specifications for the current route id; error retry re-enters here. */
  reload(): void {
    const id = this.productId();
    if (id !== null) {
      this.startDetailsLoad(id);
    }
  }

  /** Cancels the in-flight details requests, if any (idempotent). */
  private cancelDetailsLoad(): void {
    this.detailsTeardown?.();
    this.detailsTeardown = undefined;
  }

  /**
   * Starts both details requests for `id` under one controller,
   * superseding any in-flight ones — latest request wins by construction.
   * Aborting is sufficient teardown: `cancelOnAbort` (Phase 1.7) completes
   * aborted calls silently (never delivered to state) and tears down the
   * underlying fetches, so no subscription bookkeeping is needed here.
   */
  private startDetailsLoad(id: string): void {
    this.cancelDetailsLoad();
    const controller = new AbortController();
    this.state.loadProduct(id, { signal: controller.signal });
    this.state.loadSpecifications(id, { signal: controller.signal });
    this.detailsTeardown = () => controller.abort();
  }
}
