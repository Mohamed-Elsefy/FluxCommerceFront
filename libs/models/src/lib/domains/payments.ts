/**
 * Payments contract mirrors for Sub-Phase 1.1.
 *
 * Source of truth: `docs/frontend-contract/API_CONTRACT.md` §6,
 * `docs/frontend-contract/DTO_REFERENCE.md` §6, and
 * `docs/frontend-contract/PAYMENT_INTEGRATION_NOTES.md`.
 *
 * Notes:
 * - The module ships NO `*.Contracts` DTOs: `GET /api/payments/{id}` returns
 *   an anonymous object (typed below as `PaymentResponse`); the webhook is a
 *   raw-body Stripe→API call the SPA must never invoke.
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
