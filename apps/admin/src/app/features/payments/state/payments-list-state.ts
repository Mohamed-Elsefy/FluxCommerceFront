/**
 * Feature-owned payments list state for Supplement S1, Step S1.9 —
 * Payments: Mine + Admin + Stats (admin list slice).
 *
 * Scope: the paged payments table only (`GET /admin/payments` — paging
 * plus `status`/`orderId`/`customerId`/`from`/`to` filters, fixed
 * newest-first ordering; no sorting — see the S1.1 audit). Filter
 * transitions commit through the explicit `setFilters()` (page resets
 * to 1); page moves commit through `setPage()`.
 *
 * Display contract (S1.1 audit — only backend-exposed data): rows carry
 * the backend summaries verbatim (`providerPaymentIntentId`, `provider`,
 * `status`, `amount`/`currency`, timestamps). No totals math, no status
 * derivation, no customer-identity resolution (`customerId` is an opaque
 * filter key only — no user/email exists on any payment payload).
 *
 * Locality rules (same convention as the orders states):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to `error`.
 * Pager values always render from the RESPONSE envelope (effective
 * `pageNumber`/`pageSize`/`totalCount`) — never request values. CSR-safe:
 * no browser APIs anywhere in this file.
 *
 * Explicitly out of scope (must not appear here):
 * - Stats overview, payment details, history (no such endpoint).
 */
import { inject, Injectable, OnDestroy, type Signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  ApiError,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiResponseWithData,
  type PagedApiResponse,
  type ResourceState,
  type ResourceStateStore,
} from '@flux/api';
import type { AdminPaymentListQuery, PaymentAdminResponse } from '@flux/models';
import { PaymentsAdminApiService } from '../data-access/payments-admin-api.service';
import type { AdminPaymentPage } from '../models/payments-admin.models';

/** Default list page size (within the contract `1..100` limits). */
export const PAYMENT_LIST_PAGE_SIZE = 20;

/**
 * Feature-scoped payments list state. Provide at the payments route level —
 * never at root. All selectors are readonly signals; filter and page
 * moves commit through the explicit setters driven by the owning page.
 */
@Injectable()
export class PaymentsListState implements OnDestroy {
  private readonly paymentsApi = inject(PaymentsAdminApiService);
  private loads = new Subscription();

  private readonly pageStore: ResourceStateStore<AdminPaymentPage> =
    createResourceState<AdminPaymentPage>();

  /** Current payment page (idle → loading → success | empty | error). */
  readonly page: Signal<ResourceState<AdminPaymentPage>> = this.pageStore.state;

  /** Currently committed filters (page moves preserve them). */
  private committed: AdminPaymentListQuery = {};

  /**
   * Loads the given page under the committed filters (response-effective
   * values drive the pager, so callers pass committed page numbers
   * only). A load issued while another is in flight supersedes it: the
   * previous subscription is torn down first, so stale pages can never
   * settle over newer ones. Blank filter values travel as omissions
   * (the backend `400`s on empty strings and on `from > to`).
   */
  load(query: AdminPaymentListQuery = {}): void {
    this.loads.unsubscribe();
    this.loads = new Subscription();
    this.committed = { ...this.committed, ...query };
    const { pageNumber, pageSize, ...filters } = this.committed;
    const request: Observable<AdminPaymentPage> = this.paymentsApi
      .listPayments({
        pageNumber: pageNumber ?? 1,
        pageSize: pageSize ?? PAYMENT_LIST_PAGE_SIZE,
        ...omitBlankFilters(filters),
      })
      .pipe(map(requirePaymentPage));
    this.loads.add(
      loadResourceState(this.pageStore, request, {
        isEmpty: (page) => page.items.length === 0,
      }),
    );
  }

  /**
   * Commits new filters (filter-bar apply/clear re-enter here). The page
   * resets to 1: filtered result sets never preserve the old page.
   * Filters replace (never merge): omitted keys are cleared so
   * `clearFilters()` really reloads unfiltered. The page size survives.
   */
  setFilters(filters: Omit<AdminPaymentListQuery, 'pageNumber' | 'pageSize'>): void {
    const { pageSize } = this.committed;
    this.committed = {};
    this.load({ ...filters, pageNumber: 1, ...(pageSize === undefined ? {} : { pageSize }) });
  }

  /**
   * Commits a page move (pager `pageChange` re-enters here). Out-of-range
   * pages arrive as `200` with `items: []` — the page renders its empty
   * state, never an error.
   */
  setPage(pageNumber: number): void {
    this.load({ pageNumber });
  }

  /** Reloads the current effective page (retry path). */
  reload(): void {
    const current = this.pageStore.data();
    this.load(current === null ? {} : { pageNumber: current.pageNumber });
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Drops blank filter values (the backend rejects empty strings). */
function omitBlankFilters(
  filters: Omit<AdminPaymentListQuery, 'pageNumber' | 'pageSize'>,
): Omit<AdminPaymentListQuery, 'pageNumber' | 'pageSize'> {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(filters)) {
    if (typeof value === 'string' && value.trim() !== '') {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/** Unwraps a paged envelope; a dataless `200` is a contract violation. */
function requirePaymentPage(envelope: PagedApiResponse<PaymentAdminResponse>): AdminPaymentPage {
  const data = (envelope as ApiResponseWithData<AdminPaymentPage>).data;
  if (data === undefined || data === null) {
    throw new ApiError({
      status: 200,
      code: UNKNOWN_ERROR_CODE,
      message: 'The server returned an empty response.',
    });
  }
  return data;
}
