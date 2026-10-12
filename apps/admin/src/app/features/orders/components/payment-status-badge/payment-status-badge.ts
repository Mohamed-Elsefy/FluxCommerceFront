/**
 * Admin payment status badge for Sub-Phase 14.7 — Payment Details,
 * Status & Failed Payments.
 *
 * Thin feature adapter over the shared `StatusBadge` (Refactoring
 * Phase B): the status → display map stays in exactly one place
 * (`paymentStatusDisplay` in `../../models/orders-admin.models`) and
 * labels resolve through the orders bundle — the rendering logic
 * (variant/label resolution, verbatim unknown fallback) lives in the
 * shared component. Dumb by design — the owning view decides WHEN and
 * WHAT (the status arrives as a plain input, backend string verbatim).
 * No API access, no HTTP, no state writes.
 *
 * Backend-authoritative rules (14.1 audit — the core constraint):
 * - The label localizes the KNOWN backend values (`Pending |
 *   Processing | Succeeded | Failed | Cancelled | Refunded`); unknown or
 *   future backend strings render VERBATIM with the `neutral` tone
 *   (forward compatibility, `ENUM_REFERENCE.md` §8) — never mapped,
 *   never dropped.
 * - This badge knows NOTHING about order status: order-only values
 *   (e.g. `Confirmed`) fall back to `neutral` with verbatim text.
 * - Failure presentation: the backend exposes no failure reason,
 *   message, or code on the payment payload — the `Failed` status itself
 *   is the complete backend-supplied failure information.
 *
 * Accessibility: the status ALWAYS renders as text (never color-only).
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { StatusBadge } from '../../../../shared/status-badge/status-badge';
import { paymentStatusDisplay } from '../../models/orders-admin.models';
import { ORDERS_TRANSLATION_KEYS, translateOrdersKey } from '../../i18n/orders-translations';

@Component({
  selector: 'app-payment-status-badge',
  imports: [StatusBadge],
  templateUrl: './payment-status-badge.html',
  styleUrl: './payment-status-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentStatusBadge {
  /** Backend payment status string to present (verbatim source of truth). */
  @Input({ required: true }) status!: string;

  /** Single mapping site for admin payment status (orders slice). */
  protected readonly displayOf = paymentStatusDisplay;

  /** Unknown-entry key branching to the verbatim fallback. */
  protected readonly unknownLabelKey = ORDERS_TRANSLATION_KEYS.paymentStatusUnknown;

  /** Orders-bundle key resolver. */
  protected readonly translateKey = translateOrdersKey;
}
