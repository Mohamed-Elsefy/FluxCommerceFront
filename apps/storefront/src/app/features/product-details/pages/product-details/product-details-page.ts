/**
 * Product Details page for Sub-Phases 6.1–6.9 — Foundation + Page &
 * Information + Image Gallery + Variant Selection + SKU Binding + Quantity
 * Selection + Add to Cart Integration + SSR & SEO.
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
 *   never fetches (no doomed request); all state slots stay `idle`.
 * - A well-formed id loads the product, specifications, images, and
 *   variants on BOTH server and client: the route is `RenderMode.Server`
 *   (never prerendered), so the server fetches live at request time and
 *   settled payloads transfer to the browser once per id via
 *   `TransferState` — hydration never refetches transferred data.
 *
 * SSR/SEO (§6.9 — same convention as the catalog listing, Phase 5.10):
 * - `Title`/`Meta` apply in `ngOnInit` (server + client) and refresh in an
 *   effect on product/culture changes: document title, standard
 *   description, and OpenGraph tags follow the loaded product (name +
 *   description), with localized fallbacks per resource state (not-found,
 *   error, invalid-id, loading shell). `Title`/`Meta` are SSR-safe Angular
 *   services — on the server they render into the SSR `<head>`.
 * - A server-side `404` settles into the error slot like any other
 *   failure: the not-found UX (and its title) renders without throwing,
 *   and the transfer layer never stores failures, so the client retries
 *   live after a server error.
 *
 * Information contract (§6.2 rule — only backend-provided fields):
 * - Name + description from `ProductResponse`; specifications (`name` /
 *   `value`) from the specifications endpoint in wire order.
 * - Pricing, availability, and SKU are rendered nowhere: no read contract
 *   exposes them (`VariantResponse` carries SKU but no price; variant
 *   presentation arrives with selection in Sub-Phase 6.4). Nothing is
 *   fabricated.
 *
 * Resource states (§§6.2–6.4): invalid-id → loading → success | not-found
 * (`404`, with a back-to-catalog link and no retry) | error (shared
 * `ErrorState` + retry over all four slots). The specifications section
 * renders on success only — while it loads, fails, or is empty the product
 * still shows (the section hides; the product is the primary resource and
 * a specs `404` coincides with a product `404` anyway). The gallery
 * section follows the same rule, except an empty image list shows the
 * gallery's missing-image fallback instead of hiding. The variant selector
 * renders once variants succeed with at least one option — an empty,
 * loading, or failed variants slot hides it (the product still shows);
 * selection starts empty (the contract defines no default) and the page
 * clears it whenever the route product changes, while error retry
 * preserves it. The commercial section binds the selected variant's SKU
 * (§6.5 — the only customer-visible commercial field the contract
 * provides; price and availability exist in no readable contract and are
 * not fabricated): no selection → prompt, stale-unselectable selection →
 * unavailable notice, never stale SKU. The quantity section (§6.6) rides
 * the same variants gate and echoes feature-local quantity (minimum 1, no
 * contract maximum); a new route product resets it while error retry
 * preserves it. The add-to-cart submission machine (§6.7 — status, guards,
 * endpoint façades, button component) is fully implemented and tested,
 * but the button is deliberately NOT mounted yet: submission needs a
 * contract price source that does not exist (see the integration note in
 * `../models`), and mounting a control that can never succeed would
 * mislead customers. The page already runs the machine's lifecycle
 * (resets below), so mounting later is a template-only change beside the
 * quantity section — see the mount snippet on `AddToCart`.
 *
 * Copy is localized per the active `CultureService.culture()` through the
 * feature-owned bundle; retry through `common.actions.retry` and failures
 * through `resolveApiErrorMessage` (never backend text).
 *
 * Explicitly out of scope (later work, must not appear here):
 * - Phase 7 — no cart pages, cart state, guest persistence, or merge.
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { map } from 'rxjs';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { ProductGallery } from '../../components/product-gallery/product-gallery';
import { QuantitySelector } from '../../components/quantity-selector/quantity-selector';
import { VariantCommercial } from '../../components/variant-commercial/variant-commercial';
import { VariantSelector } from '../../components/variant-selector/variant-selector';
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
  imports: [
    RouterLink,
    LoadingIndicator,
    EmptyState,
    ErrorState,
    ProductGallery,
    VariantSelector,
    VariantCommercial,
    QuantitySelector,
  ],
  templateUrl: './product-details-page.html',
  styleUrl: './product-details-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailsPage implements OnInit {
  private readonly state = inject(ProductDetailsState);
  private readonly route = inject(ActivatedRoute);
  private readonly cultures = inject(CultureService);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  /** Tears down the in-flight details requests, if any (idempotent). */
  private detailsTeardown: (() => void) | undefined;

  /** Current product resource (`GET /catalog/products/{id}`). */
  readonly product = this.state.product;

  /** Specifications resource (`GET .../specifications`, wire order). */
  readonly specifications = this.state.specifications;

  /** Images resource (`GET .../images`, `displayOrder` server-side). */
  readonly images = this.state.images;

  /** Variants resource (`GET .../variants`, flat backend list). */
  readonly variants = this.state.variants;

  /** Selected variant id (`null` = no explicit selection). */
  readonly selectedVariantId = this.state.selectedVariantId;

  /** Selected variant object — the commercial section's source of truth. */
  readonly selectedVariant = this.state.selectedVariant;

  /** Purchase quantity — the quantity section's source of truth. */
  readonly quantity = this.state.quantity;

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
      galleryLoading: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.galleryLoading,
      ),
      selectorTitle: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.selectorTitle,
      ),
      selectorUnavailable: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.selectorUnavailable,
      ),
      commercialTitle: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.commercialTitle,
      ),
      commercialSkuLabel: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.commercialSkuLabel,
      ),
      commercialSelectPrompt: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.commercialSelectPrompt,
      ),
      commercialUnavailable: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.commercialUnavailable,
      ),
      quantityTitle: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.quantityTitle,
      ),
      quantityDecrease: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.quantityDecrease,
      ),
      quantityIncrease: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.quantityIncrease,
      ),
      quantityInvalid: translateProductDetailsKey(
        culture,
        PRODUCT_DETAILS_TRANSLATION_KEYS.quantityInvalid,
      ),
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
    // Drives all details loads from the route id on BOTH server and
    // client (initial value included, param changes followed). The server
    // pass settles live requests at request time (`RenderMode.Server` —
    // never prerendered) and stores them for `TransferState`; the browser
    // reuses transferred payloads instead of refetching.
    //
    // The state calls run `untracked` on purpose: each `load*` reads its
    // slot (`loadResourceState` retains current data across reloads) and
    // writes it on settle, so without `untracked` the slots would become
    // effect dependencies and every settled response would reschedule the
    // effect — an infinite fetch loop. The effect depends on the route id
    // alone.
    //
    // A new route product never inherits the previous selection,
    // quantity, or submission feedback (`clearVariantSelection` +
    // `resetQuantity` + `resetAddToCartStatus` on this id-driven path
    // only — error retry goes through `reload()` and preserves the
    // customer's choices).
    //
    // Stale safety: every run owns an `AbortController` torn down before
    // the next run (and on destroy via effect cleanup), so older pending
    // requests can never settle over newer ones — `cancelOnAbort`
    // (Phase 1.7) completes aborted calls silently without touching state.
    // The same tracked teardown covers retries, so a retried request
    // supersedes (rather than races) any in-flight one.
    effect((onCleanup) => {
      const id = this.productId();
      untracked(() => {
        if (id === null) {
          this.cancelDetailsLoad();
          this.state.reset();
        } else {
          this.state.clearVariantSelection();
          this.state.resetQuantity();
          this.state.resetAddToCartStatus();
          this.startDetailsLoad(id);
        }
      });
      onCleanup(() => this.cancelDetailsLoad());
    });

    // Dynamic metadata (§6.9): tracks the product, its resource state,
    // and the culture; `Title`/`Meta` write the document only (no signals
    // touched inside, so no dependency besides the tracked reads above).
    // Runs wherever effects run (server included) — `ngOnInit` covers the
    // first SSR pass.
    effect(() => {
      this.applyMetadata();
    });
  }

  ngOnInit(): void {
    // Runs on server and client alike: metadata applies during SSR (an
    // SSR-safe write into the server `<head>`), while data loads flow
    // through the effect above on both platforms.
    this.applyMetadata();
  }

  /**
   * Applies dynamic page metadata for the current resource state (§6.9):
   * document title, standard description, and OpenGraph tags. Success
   * uses the real product name + description (localized fallback when the
   * backend provides none); not-found, error, invalid-id, and loading
   * states each map to their localized UX copy. `Title`/`Meta` are
   * SSR-safe Angular services.
   */
  private applyMetadata(): void {
    const copy = this.copy();
    const snapshot = this.product();
    let pageLabel = copy.title;
    let description = copy.title;
    if (snapshot.isSuccess && snapshot.data !== null) {
      pageLabel = snapshot.data.name;
      description = snapshot.data.description ?? copy.noDescription;
    } else if (this.isNotFound()) {
      pageLabel = copy.notFoundTitle;
      description = copy.notFoundMessage;
    } else if (this.product().isError) {
      pageLabel = copy.errorTitle;
      description = this.errorMessage();
    } else if (this.productId() === null) {
      pageLabel = copy.title;
      description = copy.invalidIdMessage;
    }
    const title = `${pageLabel} | FluxCommerce`;
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
  }

  /** (Re)loads every details slot for the current route id; error retry re-enters here. */
  reload(): void {
    const id = this.productId();
    if (id !== null) {
      this.startDetailsLoad(id);
    }
  }

  /** Forwards a selector choice to feature state (validated there — invalid ids are ignored). */
  onVariantSelect(id: string): void {
    this.state.selectVariant(id);
    this.state.resetAddToCartStatus();
  }

  /** Forwards a quantity change to feature state (validated there — invalid values are ignored). */
  onQuantityChange(value: number): void {
    this.state.setQuantity(value);
    this.state.resetAddToCartStatus();
  }

  /** Cancels the in-flight details requests, if any (idempotent). */
  private cancelDetailsLoad(): void {
    this.detailsTeardown?.();
    this.detailsTeardown = undefined;
  }

  /**
   * Starts all details requests for `id` under one controller,
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
    this.state.loadProductImages(id, { signal: controller.signal });
    this.state.loadProductVariants(id, { signal: controller.signal });
    this.detailsTeardown = () => controller.abort();
  }
}
