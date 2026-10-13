/**
 * Storefront Payments-Mine list state for Supplement S1, Step S1.9 —
 * Payments: Mine + Admin + Stats (storefront slice).
 *
 * Scope: the caller-owned `GET /api/payments/mine` paged list resource
 * only (paging plus an optional `status` filter, fixed newest-first —
 * no sorting, no history, no polling).
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §6
 * (`GET /api/payments/mine` → `ApiResponse<PagedResult<PaymentAdminResponse>>`;
 * authenticated; defaults `1/20`, max `100`; fixed newest-first, no
 * sort params; caller-owned only).
 *
 * Layering (`ARCHITECTURE.md` §10 — reused, never duplicated):
 *
 * ```text
 * PaymentsMinePage (pages/ — orchestration only)
 *     ↓ PaymentsMineState (this file — route-provided local Signals)
 *     ↓ PaymentApiService (data-access/ — thin typed façade)
 *     ↓ ApiClient (@flux/api — the ONLY HttpClient user)
 *     ↓ Backend Payments API
 * ```
 *
 * State rules (the Orders §10.3 pattern — route-provided via
 * `paymentsRoutes`, never `providedIn`, never a global store):
 * - One paged resource slot (`idle → loading → success | empty |
 *   error`, shared Phase 1 `createResourceState`/`loadResourceState`).
 *   Empty means `items: []` — including out-of-range pages, which the
 *   backend answers with `200` (never an error). A `200` without `data`
 *   is a contract breach → error, never a rendered list.
 * - Page moves commit through the canonical `normalizePagination`
 *   (1-based, clamped) with the fixed default page size; the pager
 *   renders from RESPONSE-effective `pageNumber/pageSize/totalCount`,
 *   never request values.
 * - Loads dedupe: a concurrent same-page load, or a repeat after
 *   success without `force`, is a safe no-op. `retry()` forces a fresh
 *   load of the requested page after errors.
 * - Cancellation travels through `options.signal` (Phase 1
 *   `cancelOnAbort` completes pre-aborted/in-flight aborts silently —
 *   never as errors; state stays untouched).
 * - No business logic in state: no totals math, no status derivation
 *   (order and payment statuses stay independent and verbatim), no
 *   transitions — backend values render as received.
 *
 * Explicitly out of scope (must not appear here):
 * - Payment history/timeline (no backend contract).
 * - Payment confirmation (provider-side, owned by the payment flow).
 * - Admin reads (`GET /admin/payments*` — admin app only).
 */

import { Injectable, inject, signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  createResourceState,
  loadResourceState,
  normalizePagination,
  type ApiRequestOptions,
  type PagedApiResponse,
  type PagedResult,
} from '@flux/api';
import { PaymentApiService } from '../data-access/payment-api.service';
import {
  PAYMENTS_MINE_DEFAULT_PAGE_NUMBER,
  PAYMENTS_MINE_DEFAULT_PAGE_SIZE,
  type PaymentMineRow,
  type PaymentsMineListQuery,
} from '../models/payments-mine.models';

/** Settled payments-mine page (`GET /api/payments/mine` payload). */
export type PaymentsMinePage = PagedResult<PaymentMineRow>;

/** Options for `PaymentsMineState.loadPage`. */
export interface LoadPaymentsMinePageOptions extends ApiRequestOptions {
  /**
   * Reload even after a settled success on the same page (error retries
   * always reload). Defaults to `false`.
   */
  readonly force?: boolean;
}

/**
 * Feature-scoped payments-mine list state: the paged customer-payments
 * resource plus the requested page. Provided on the `mine` entry (one
 * instance per entry — never a global store, no `providedIn`).
 */
@Injectable()
export class PaymentsMineState {
  private readonly paymentsApi = inject(PaymentApiService);
  private readonly pageStore = createResourceState<PaymentsMinePage>();

  /** Requested page number (committed moves; 1-based). */
  private readonly requestedPage = signal(PAYMENTS_MINE_DEFAULT_PAGE_NUMBER);

  /** Committed status filter (`null` = unfiltered; moves reset the page). */
  private readonly statusFilter = signal<string | null>(null);

  /** Paged payments resource lifecycle (`idle | loading | success | empty | error`). */
  readonly status = this.pageStore.status;

  /** Settled page, or `null` until the first success. */
  readonly page = this.pageStore.data;

  /** Normalized page failure (`ApiError | null`). */
  readonly error = this.pageStore.error;

  /** True while the page request is in flight. */
  readonly isLoading = this.pageStore.isLoading;

  /** True once a page has settled with items. */
  readonly isSuccess = this.pageStore.isSuccess;

  /** True when the last load settled with zero items. */
  readonly isEmpty = this.pageStore.isEmpty;

  /** True when the last page load failed. */
  readonly isError = this.pageStore.isError;

  /** Currently requested page number. */
  readonly currentPage = this.requestedPage.asReadonly();

  /**
   * Loads a page of customer payments into the resource slot. The page
   * number commits through `normalizePagination` (clamped to valid
   * pages); failures — including a `200` without `data` — land in the
   * error slot untouched for the page to render via
   * `resolveApiErrorMessage`. Returns the subscription for
   * owner-managed teardown.
   */
  loadPage(
    pageNumber: number = this.requestedPage(),
    options: LoadPaymentsMinePageOptions = {},
  ): Subscription {
    const { pageNumber: page } = normalizePagination({
      pageNumber,
      pageSize: PAYMENTS_MINE_DEFAULT_PAGE_SIZE,
    });
    if (this.pageStore.isLoading() && page === this.requestedPage()) {
      return Subscription.EMPTY;
    }
    if (!options.force && this.pageStore.isSuccess() && page === this.requestedPage()) {
      return Subscription.EMPTY;
    }
    this.requestedPage.set(page);
    const status = this.statusFilter();
    const query: PaymentsMineListQuery = {
      pageNumber: page,
      pageSize: PAYMENTS_MINE_DEFAULT_PAGE_SIZE,
      ...(status === null ? {} : { status }),
    };
    return loadResourceState(this.pageStore, this.pageSource(query, options), {
      signal: options.signal,
      isEmpty: (settled) => settled.items.length === 0,
    });
  }

  /**
   * Commits a status filter (`null` clears). The page resets to 1:
   * filtered result sets never preserve the old page.
   */
  setStatusFilter(status: string | null): void {
    const normalized = status === null || status.trim() === '' ? null : status;
    if (normalized === this.statusFilter()) {
      return;
    }
    this.statusFilter.set(normalized);
    this.requestedPage.set(PAYMENTS_MINE_DEFAULT_PAGE_NUMBER);
    this.loadPage(PAYMENTS_MINE_DEFAULT_PAGE_NUMBER, { force: true });
  }

  /** Forces a fresh load of the requested page (error-state retry path). */
  retry(): Subscription {
    return this.loadPage(this.requestedPage(), { force: true });
  }

  /**
   * Live page source: unwraps `ApiResponse.data` (missing data is a
   * contract breach → normalized failure, never a rendered list).
   */
  private pageSource(
    query: PaymentsMineListQuery,
    options: ApiRequestOptions = {},
  ): Observable<PaymentsMinePage> {
    return this.paymentsApi
      .listMine(query, options)
      .pipe(map((envelope: PagedApiResponse<PaymentMineRow>) => requirePaymentsMinePage(envelope)));
  }
}

/** Unwraps the paged envelope or fails on a dataless `200`. */
function requirePaymentsMinePage(envelope: PagedApiResponse<PaymentMineRow>): PaymentsMinePage {
  const page = envelope.data ?? null;
  if (page === null) {
    throw new Error('Payments response carried no data.');
  }
  return page;
}
