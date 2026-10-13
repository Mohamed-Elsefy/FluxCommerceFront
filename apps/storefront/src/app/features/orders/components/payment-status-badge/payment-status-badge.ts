/**
 * Payment status badge component for Sub-Phase 10.5 — Order & Payment
 * Status Experience.
 *
 * Thin feature adapter over the shared `StorefrontStatusBadge`
 * (Refactoring Phase B): the payment tone map (`paymentStatusToneOf`)
 * and label map stay the single mapping sites — the rendering logic
 * lives in the shared component. The owning view decides WHEN and
 * WHAT — the status arrives as a plain input (backend string,
 * verbatim). No API access, no HTTP, no state writes.
 *
 * Backend-authoritative rules (§10.5 — the core constraint):
 * - The label localizes the KNOWN backend value (`Pending | Processing
 *   | Succeeded | Failed | Cancelled | Refunded`); unknown or future
 *   backend strings render VERBATIM with the `neutral` tone (forward
 *   compatibility, `ENUM_REFERENCE.md` §8) — never mapped, never
 *   dropped.
 * - This badge knows NOTHING about order status: order-only values
 *   (e.g. `Confirmed`) fall back to `neutral` with verbatim text. The
 *   two concepts stay independent — nothing infers one status from the
 *   other, and a successful payment is never presented as a completed
 *   order.
 *
 * Data-source note: no order payload carries payment fields (contract
 * gap documented since §10.3), so nothing in the orders area feeds this
 * badge yet — it ships fully tested for any caller that holds backend
 * payment truth. It is intentionally NOT wired into the payments
 * feature: cross-feature internal imports are forbidden by
 * `ARCHITECTURE.md` §7.
 *
 * Accessibility: the status ALWAYS renders as text (never color-only),
 * inside a semantic `span`; tone is redundant decoration.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { StorefrontStatusBadge } from '../../../../shared/status-badge/status-badge';
import { isOrdersPaymentStatus } from '../../models/orders.models';
import { paymentStatusToneOf } from '../../models/status.models';
import { ORDERS_TRANSLATION_KEYS, translateOrdersKey } from '../../i18n/orders-translations';

/** Localized labels for the known backend payment statuses. */
const PAYMENT_STATUS_LABEL_KEYS = {
  Pending: ORDERS_TRANSLATION_KEYS.statusPaymentPending,
  Processing: ORDERS_TRANSLATION_KEYS.statusPaymentProcessing,
  Succeeded: ORDERS_TRANSLATION_KEYS.statusPaymentSucceeded,
  Failed: ORDERS_TRANSLATION_KEYS.statusPaymentFailed,
  Cancelled: ORDERS_TRANSLATION_KEYS.statusPaymentCancelled,
  Refunded: ORDERS_TRANSLATION_KEYS.statusPaymentRefunded,
} as const;

@Component({
  selector: 'orders-payment-status-badge',
  imports: [StorefrontStatusBadge],
  templateUrl: './payment-status-badge.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentStatusBadge {
  /** Backend payment status string to present (verbatim source of truth). */
  @Input({ required: true }) status!: string;

  /** Single tone map for payment status. */
  protected readonly toneOf = paymentStatusToneOf;

  /** Label key for known payment values, `null` outside the concept. */
  protected readonly labelKeyOf = (status: string): string | null =>
    isOrdersPaymentStatus(status) ? PAYMENT_STATUS_LABEL_KEYS[status] : null;

  /** Unknown-entry key used when the status is blank. */
  protected readonly unknownLabelKey = ORDERS_TRANSLATION_KEYS.statusPaymentUnknown;

  /** Orders-bundle key resolver. */
  protected readonly translateKey = translateOrdersKey;
}
