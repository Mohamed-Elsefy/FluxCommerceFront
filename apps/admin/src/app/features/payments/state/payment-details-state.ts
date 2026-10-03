/**
 * Feature-owned payment details state for Supplement S1, Step S1.9 —
 * Payments: Mine + Admin + Stats (admin details slice).
 *
 * Scope: the single payment slot behind the details page
 * (`GET /admin/payments/{paymentId}` — the only payment read beyond
 * the list and stats; the payload carries amount, currency, provider,
 * intent reference, and status verbatim).
 *
 * Display contract (S1.1 audit — only backend-exposed data): the slot
 * carries the backend-issued details verbatim. No totals math, no status
 * derivation, no customer-identity resolution. Read-only: the admin
 * never confirms cards.
 *
 * Locality rules (same convention as the orders states):
 * `@Injectable()` WITHOUT `providedIn` (route-level providers only),
 * local Signals via `createResourceState`, no `HttpClient`, no query
 * strings, envelopes unwrap here, dataless envelopes resolve to `error`.
 * CSR-safe: no browser APIs anywhere in this file.
 *
 * Explicitly out of scope (must not appear here):
 * - History (no such endpoint), mutations (none exist).
 */
import { inject, Injectable, OnDestroy, type Signal } from '@angular/core';
import { map, Subscription, type Observable } from 'rxjs';
import {
  ApiError,
  createResourceState,
  loadResourceState,
  UNKNOWN_ERROR_CODE,
  type ApiResponseWithData,
  type ResourceState,
  type ResourceStateStore,
} from '@flux/api';
import type { PaymentAdminResponse } from '@flux/models';
import { PaymentsAdminApiService } from '../data-access/payments-admin-api.service';
import type { AdminPaymentDetailsRecord } from '../models/payments-admin.models';

/**
 * Feature-scoped payment details state. Provide at the payments route level
 * — never at root. All selectors are readonly signals; loads are
 * explicit calls driven by the owning page from the route id.
 */
@Injectable()
export class PaymentDetailsState implements OnDestroy {
  private readonly paymentsApi = inject(PaymentsAdminApiService);
  private loads = new Subscription();

  private readonly paymentStore: ResourceStateStore<AdminPaymentDetailsRecord> =
    createResourceState<AdminPaymentDetailsRecord>();

  /** Current payment details (idle → loading → success | error). */
  readonly payment: Signal<ResourceState<AdminPaymentDetailsRecord>> = this.paymentStore.state;

  /**
   * Loads the details slot for `paymentId`. A load issued while another
   * is in flight supersedes it: the previous subscription is torn down
   * first, so navigating between payments can never interleave responses.
   * Blank ids are no-ops (the route always carries an id).
   */
  load(paymentId: string | null | undefined): void {
    if (paymentId === null || paymentId === undefined || paymentId.trim() === '') {
      return;
    }
    this.loads.unsubscribe();
    this.loads = new Subscription();
    const request: Observable<AdminPaymentDetailsRecord> = this.paymentsApi
      .getPayment(paymentId)
      .pipe(map(requirePaymentDetails));
    this.loads.add(loadResourceState(this.paymentStore, request));
  }

  ngOnDestroy(): void {
    this.loads.unsubscribe();
  }
}

/** Unwraps a details envelope; a dataless `200` is a contract violation. */
function requirePaymentDetails(
  envelope: ApiResponseWithData<PaymentAdminResponse>,
): AdminPaymentDetailsRecord {
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
