/**
 * Payments contract mirrors for Sub-Phase 1.1.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §6,
 * `docs/frontend-contract/DTO_REFERENCE.md` §6, and
 * `docs/frontend-contract/PAYMENT_INTEGRATION_NOTES.md`.
 *
 * Notes:
 * - `GET /api/payments/{id}` returns an anonymous object (typed below as
 *   `PaymentResponse`); the evolved contract adds the explicit
 *   `PaymentAdminResponse` shape for `GET /api/payments/mine` and the
 *   `[Route admin/payments]` reads (same fields, named record).
 *   The webhook is a raw-body Stripe→API call the SPA must never invoke.
 * - Route prefix is inconsistently `api/payments` (other modules have none).
 * - `status` is a STRING (`PaymentStatus.ToString()`), never the enum.
 * - Ownership mismatch is masked as `404` (warning log server-side).
 * - SPA Stripe rule: the SPA may hold only the publishable key (from app env,
 *   never from the API) and confirms cards via Stripe.js once the backend
 *   exposes a client-secret path. Until then, poll `GET /orders/{id}`
 *   (`Pending → Confirmed|Cancelled`) as the payment proxy.
 * - Intent amounts are backend-authoritative (currently a hardcoded
 *   `19.99 USD` placeholder) — checkout amounts shown in the UI are
 *   informational until the totals wiring lands.
 */

import type { Guid, IsoDateString } from '../common/shared-types';
import type { PageQuery } from '../common/shared-types';
import { isValidPageQuery } from '../common/shared-types';
import type { PaymentStatus } from '../common/enums';

/** `GET /api/payments/{paymentId}` payload (anonymous object server-side). */
export interface PaymentResponse {
  id: Guid;
  orderId: Guid;
  customerId: Guid;
  amount: number;
  currency: string;
  status: PaymentStatus;
  providerPaymentIntentId?: string | null;
  provider?: string | null;
  createdAtUtc: IsoDateString;
  updatedAtUtc?: IsoDateString | null;
  version: number;
}

/**
 * `GET /api/payments/mine` + `GET /admin/payments*` item payload: the
 * explicit `PaymentAdminResponse` contract (same shape as the customer
 * view). Timestamps are `DateTimeOffset`; `version: long`.
 */
export interface PaymentAdminResponse {
  id: Guid;
  orderId: Guid;
  customerId: Guid;
  amount: number;
  currency: string;
  status: PaymentStatus;
  providerPaymentIntentId?: string | null;
  provider?: string | null;
  createdAtUtc: IsoDateString;
  updatedAtUtc?: IsoDateString | null;
  version: number;
}

/** One per-currency rollup inside `GET /admin/payments/stats`. */
export interface PaymentCurrencyTotalResponse {
  currency: string;
  succeededCount: number;
  succeededTotalAmount: number;
}

/** `GET /admin/payments/stats` payload (`payments.stats`). */
export interface PaymentAdminStatsResponse {
  total: number;
  pending: number;
  processing: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  refunded: number;
  totalsByCurrency: PaymentCurrencyTotalResponse[];
}

/** Backend payment statuses accepted as the `status` filter (case-insensitive). */
export const PAYMENT_STATUS_FILTER_VALUES: readonly PaymentStatus[] = [
  'Pending',
  'Processing',
  'Succeeded',
  'Failed',
  'Cancelled',
  'Refunded',
];

/**
 * Whether `value` names a filter-accepted payment status
 * (case-insensitive; unknown → backend `400 Payment.ValidationFailed`).
 * Pure — throws nothing.
 */
export function isPaymentStatusFilter(value: unknown): boolean {
  return (
    typeof value === 'string' &&
    PAYMENT_STATUS_FILTER_VALUES.some((s) => s.toLowerCase() === value.toLowerCase())
  );
}

/**
 * `GET /admin/payments` query (`payments.read`): paging +
 * `status?/orderId?/customerId?/from?/to?` (newest-first). Unknown
 * `status` or `from > to` → backend `400 Payment.ValidationFailed`.
 */
export interface AdminPaymentListQuery extends PageQuery {
  status?: string;
  orderId?: Guid;
  customerId?: Guid;
  from?: string;
  to?: string;
}

/**
 * Structural pre-check for an admin payment-list query. Pure — throws nothing.
 */
export function isValidAdminPaymentListQuery(
  query: AdminPaymentListQuery | null | undefined,
): boolean {
  if (!isValidPageQuery(query)) {
    return false;
  }
  if (query === null || query === undefined) {
    return true;
  }
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    if (!isPaymentStatusFilter(query.status)) {
      return false;
    }
  }
  if (query.orderId !== undefined && query.orderId !== null && query.orderId.trim() === '') {
    return false;
  }
  if (
    query.customerId !== undefined &&
    query.customerId !== null &&
    query.customerId.trim() === ''
  ) {
    return false;
  }
  if (
    query.from !== undefined &&
    query.from !== null &&
    query.from !== '' &&
    query.to !== undefined &&
    query.to !== null &&
    query.to !== '' &&
    query.from > query.to
  ) {
    return false;
  }
  return true;
}

/**
 * `GET /api/payments/mine` query: paging + optional `status`
 * (caller-owned only). Unknown `status` → `400 Payment.ValidationFailed`.
 */
export interface PaymentsMineQuery extends PageQuery {
  status?: string;
}

/**
 * Structural pre-check for a payments-mine query. Pure — throws nothing.
 */
export function isValidPaymentsMineQuery(query: PaymentsMineQuery | null | undefined): boolean {
  if (!isValidPageQuery(query)) {
    return false;
  }
  if (query === null || query === undefined) {
    return true;
  }
  if (query.status !== undefined && query.status !== null && query.status !== '') {
    if (!isPaymentStatusFilter(query.status)) {
      return false;
    }
  }
  return true;
}
