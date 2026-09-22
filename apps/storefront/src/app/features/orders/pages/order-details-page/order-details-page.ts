/**
 * Customer order details page for Sub-Phase 10.4 — Order Details.
 *
 * Smart page (route-level composition): reads `:orderId` from the
 * route, drives the feature-scoped `OrderDetailsState` (provided by
 * the `:orderId` route entry — never a global store), and projects the
 * settled backend order into preformatted views for the presentational
 * tree. No totals math, no status derivation, no HTTP here.
 *
 * Data flow (`ARCHITECTURE.md` §10):
 *
 * ```text
 * OrderDetailsPage (this file — orchestration only)
 *     ↓ OrderDetailsState (state/ — single-order resource)
 *     ↓ OrdersApiService (data-access/ — §10.1 thin typed façade)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Orders API
 * ```
 *
 * Page contract:
 * - The route `:orderId` is the only order context (the list → details
 *   seam): `paramMap` drives `loadOrder` on init and on in-place param
 *   changes (forward/backward navigation reuses the page), plus an
 *   `idle`-only browser `afterNextRender` trigger for the post-hydration
 *   path. Blank ids fail locally without an HTTP call.
 * - Untouched (`idle`) renders as loading — server and client start
 *   idle, so SSR and hydration emit identical markup.
 * - Failures classify status-first (§10.1 classifiers — the wire carries
 *   no codes): `404` unknown-or-foreign id → not-found view (ownership
 *   is backend-masked, never probed); `403` → forbidden view
 *   (defensive — the contract emits none on this route today);
 *   `401` → unauthorized view with a sign-in link; anything else →
 *   generic error view with retry (`OrderDetailsState.retry()`).
 * - Success renders backend data verbatim (dates and money formatted
 *   for the active culture — display only): header facts, both address
 *   echoes, backend line items, and backend totals rows. Status is plain
 *   text, not a badge (§10.5); no payment status, tax row, thumbnails,
 *   or contact details render anywhere (no such contract fields —
 *   §10.4 gaps, documented not approximated).
 *
 * Copy is localized per the active `CultureService.culture()` through
 * the feature-owned orders bundle; retry through
 * `common.actions.retry`. Document title follows the page heading
 * (customer area — no SEO metadata beyond the title).
 *
 * SSR-safe: signals, `Title`, and router templating only — the initial
 * load trigger is browser-guarded via `afterNextRender`. RTL safe:
 * logical properties only, no direction branching.
 *
 * Accessibility: labelled section heading; loading/error states expose
 * the shared primitives' live semantics; facts and totals render as
 * definition lists; items render as a scoped-column data table;
 * addresses use native `address` elements.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.5 — no status badges or localized status labels.
 * - 10.6 — no history timeline or post-payment polling.
 */

import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CultureService, resolveApiErrorMessage, translateKey } from '@flux/i18n';
import { ErrorState, LoadingIndicator } from '@flux/ui';
import {
  isOrdersAccessDeniedFailure,
  isOrdersAuthFailure,
  isOrdersNotFoundFailure,
  ordersPath,
  readOrdersRouteParams,
} from '../../models/orders.models';
import { toOrderDetailsView } from '../../models/order-details.models';
import { ORDERS_TRANSLATION_KEYS, translateOrdersKey } from '../../i18n/orders-translations';
import { OrderDetailsState } from '../../state/order-details-state';
import { OrderAddressBlock } from '../../components/order-address-block/order-address-block';
import {
  OrderItemsList,
  type OrderItemsLabels,
} from '../../components/order-items-list/order-items-list';

/** Sign-in destination (matches the `authGuard` redirect target). */
const LOGIN_PATH = '/login';

@Component({
  selector: 'order-details-page',
  imports: [RouterLink, LoadingIndicator, ErrorState, OrderAddressBlock, OrderItemsList],
  templateUrl: './order-details-page.html',
  styleUrl: './order-details-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderDetailsPage {
  private readonly state = inject(OrderDetailsState);
  private readonly route = inject(ActivatedRoute);
  private readonly cultures = inject(CultureService);
  private readonly title = inject(Title);

  constructor() {
    // The route `:orderId` is the single funnel: initial value included,
    // in-place param changes followed (forward/backward navigation
    // between orders reuses this page). The state dedupes repeat loads
    // of a settled id to one request. Subscribing here (injection
    // context) owns teardown with the page.
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.state.loadOrder(readOrdersRouteParams(params)?.orderId ?? '');
    });
    // Post-hydration entry: the subscription above ran on the server
    // there, so the client state is still untouched (`idle`) and the
    // browser schedules its own trigger for the snapshot id. Fires only
    // from `idle` — settled outcomes stay stable. Never fires on the
    // server — SSR/hydration safe.
    afterNextRender(() => {
      if (this.state.status() === 'idle') {
        this.state.loadOrder(this.snapshotOrderId());
      }
    });
    effect(() => {
      this.title.setTitle(this.heading());
    });
  }

  /** Localized page copy for the active culture. */
  readonly copy = computed(() => {
    const culture = this.cultures.culture();
    const itemLabels: OrderItemsLabels = {
      product: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFieldProduct),
      sku: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFieldSku),
      quantity: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFieldQuantity),
      unitPrice: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFieldUnitPrice),
      lineTotal: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFieldLineTotal),
    };
    return {
      loading: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsLoading),
      loadErrorTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsLoadErrorTitle),
      retry: translateKey(culture, 'common.actions.retry'),
      notFoundTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsNotFoundTitle),
      notFoundMessage: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsNotFoundMessage),
      forbiddenTitle: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsForbiddenTitle),
      forbiddenMessage: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.detailsForbiddenMessage,
      ),
      unauthorizedTitle: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.detailsUnauthorizedTitle,
      ),
      unauthorizedMessage: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.detailsUnauthorizedMessage,
      ),
      backToOrders: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsBackToOrders),
      signIn: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsSignIn),
      sectionItems: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsSectionItems),
      sectionShipping: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsSectionShipping),
      sectionBilling: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsSectionBilling),
      sectionTotals: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsSectionTotals),
      fieldOrderNumber: translateOrdersKey(
        culture,
        ORDERS_TRANSLATION_KEYS.detailsFieldOrderNumber,
      ),
      fieldOrderId: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFieldOrderId),
      fieldDate: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFieldDate),
      fieldStatus: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFieldStatus),
      fieldCustomer: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFieldCustomer),
      itemLabels,
      fieldSubtotal: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFieldSubtotal),
      fieldDiscount: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFieldDiscount),
      fieldShipping: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFieldShipping),
      fieldGrandTotal: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsFieldGrandTotal),
      itemsEmpty: translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsItemsEmpty),
    };
  });

  /** Read-only details view, or `null` until the backend order settles. */
  readonly view = computed(() => {
    const order = this.state.order();
    return order === null ? null : toOrderDetailsView(order, this.cultures.culture());
  });

  /** Page heading: settled order title, state title, or loading text. */
  readonly heading = computed(() => {
    const culture = this.cultures.culture();
    const view = this.view();
    if (view !== null) {
      return translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsTitle, {
        orderNumber: view.orderNumber,
      });
    }
    if (this.showNotFound()) {
      return translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsNotFoundTitle);
    }
    if (this.showForbidden()) {
      return translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsForbiddenTitle);
    }
    if (this.showUnauthorized()) {
      return translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsUnauthorizedTitle);
    }
    if (this.showError()) {
      return translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsLoadErrorTitle);
    }
    return translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.detailsLoading);
  });

  /** Loading shell covers both untouched (`idle`) and in-flight states. */
  readonly showLoading = computed(() => {
    const status = this.state.status();
    return status === 'idle' || status === 'loading';
  });

  /** Whether the order is missing (unknown id or foreign id, masked). */
  readonly showNotFound = computed(() => isOrdersNotFoundFailure(this.state.error()));

  /** Whether the order read was denied (`403`, defensive slot). */
  readonly showForbidden = computed(
    () => !this.showNotFound() && isOrdersAccessDeniedFailure(this.state.error()),
  );

  /** Whether the session is missing or expired (`401`). */
  readonly showUnauthorized = computed(
    () => !this.showNotFound() && !this.showForbidden() && isOrdersAuthFailure(this.state.error()),
  );

  /** Whether the load failed generically (retryable). */
  readonly showError = computed(
    () =>
      this.state.isError() &&
      !this.showNotFound() &&
      !this.showForbidden() &&
      !this.showUnauthorized(),
  );

  /** Whether the settled backend order is on screen. */
  readonly showDetails = computed(() => this.state.isSuccess() && this.view() !== null);

  /** Localized failure message (status-first, never backend text). */
  readonly errorMessage = computed(() =>
    resolveApiErrorMessage(this.state.error(), this.cultures.culture()),
  );

  /** Back-to-list destination (`/account/orders`). */
  readonly ordersRoute = ordersPath();

  /** Sign-in destination for expired sessions. */
  readonly loginRoute = LOGIN_PATH;

  /** Retries the failed order load (forced fresh request). */
  onRetry(): void {
    this.state.retry();
  }

  /** Snapshot `:orderId` for the post-hydration trigger. */
  private snapshotOrderId(): string {
    return readOrdersRouteParams(this.route.snapshot.paramMap)?.orderId ?? '';
  }
}
