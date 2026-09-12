/**
 * Product Details page for Sub-Phase 6.1 — Product Details Foundation.
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
 *   never fetches (no doomed request); the state slot stays `idle`.
 * - A well-formed id loads in the browser after hydration; the server keeps
 *   the idle shell (production prerendering has no backend at build time,
 *   so server-side fetching would hang the render — SSR transfer arrives in
 *   Sub-Phase 6.9).
 *
 * Success rendering is intentionally minimal (product name only — proof of
 * data flow). Full product information, spec sheets, and image galleries
 * arrive in Sub-Phases 6.2–6.3; variants, quantity, and add-to-cart arrive
 * in Sub-Phases 6.4–6.7 — none of that appears here.
 *
 * Copy is static English for the foundation shell; the feature-owned
 * localized bundle arrives in Sub-Phase 6.8. Failures resolve through the
 * shared `resolveApiErrorMessage` (never backend text).
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
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';
import { CultureService, resolveApiErrorMessage } from '@flux/i18n';
import { EmptyState, ErrorState, LoadingIndicator } from '@flux/ui';
import { ProductDetailsState } from '../../state/product-details-state';
import { PRODUCT_DETAILS_ID_PARAM, parseProductIdParam } from '../../models/product-details.models';

@Component({
  selector: 'app-product-details-page',
  imports: [LoadingIndicator, EmptyState, ErrorState],
  templateUrl: './product-details-page.html',
  styleUrl: './product-details-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductDetailsPage {
  private readonly state = inject(ProductDetailsState);
  private readonly route = inject(ActivatedRoute);
  private readonly cultures = inject(CultureService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Tears down the in-flight product request, if any (idempotent). */
  private detailsTeardown: (() => void) | undefined;

  /** Current product resource (`GET /catalog/products/{id}`). */
  readonly product = this.state.product;

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

  /** Localized failure message (never backend text). */
  protected readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.product().error, this.cultures.culture()),
  );

  constructor() {
    // Browser only: drives the product load from the route id (initial
    // value included, param changes followed). Runs after the first render;
    // the server keeps the idle shell (see above).
    //
    // The state call runs `untracked` on purpose: `loadProduct` reads the
    // product signal (`loadResourceState` retains current data across
    // reloads) and writes it on settle, so without `untracked` the product
    // slot would become an effect dependency and every settled response
    // would reschedule the effect — an infinite fetch loop. The effect
    // depends on the route id alone.
    //
    // Stale safety: every run owns an `AbortController` torn down before
    // the next run (and on destroy via effect cleanup), so an older pending
    // request can never settle over a newer one — `cancelOnAbort`
    // (Phase 1.7) completes aborted calls silently without touching state.
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

  /** (Re)loads the product for the current route id; error retry re-enters here. */
  reload(): void {
    const id = this.productId();
    if (id !== null) {
      this.startDetailsLoad(id);
    }
  }

  /** Cancels the in-flight product request, if any (idempotent). */
  private cancelDetailsLoad(): void {
    this.detailsTeardown?.();
    this.detailsTeardown = undefined;
  }

  /**
   * Starts a product request for `id`, superseding any in-flight one —
   * latest request wins by construction. Aborting is sufficient teardown:
   * `cancelOnAbort` (Phase 1.7) completes the aborted call silently (never
   * delivered to state) and tears down the underlying fetch, so no
   * subscription bookkeeping is needed here.
   */
  private startDetailsLoad(id: string): void {
    this.cancelDetailsLoad();
    const controller = new AbortController();
    this.state.loadProduct(id, { signal: controller.signal });
    this.detailsTeardown = () => controller.abort();
  }
}
