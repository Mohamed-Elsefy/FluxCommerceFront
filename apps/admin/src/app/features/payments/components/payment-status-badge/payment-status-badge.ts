/**
 * Admin payment status badge for Supplement S1, Step S1.9 — Payments:
 * Mine + Admin + Stats.
 *
 * Thin feature adapter over the shared `StatusBadge` (Refactoring
 * Phase B): the status → display map stays in exactly one place
 * (`adminPaymentStatusDisplay` in `../../models/payments-admin.models`)
 * and labels resolve through the payments bundle — the rendering logic
 * (variant/label resolution, verbatim unknown fallback) lives in the
 * shared component. Dumb by design — the owning view decides WHEN and
 * WHAT (the status arrives as a plain input, backend string verbatim).
 * No API access, no HTTP, no state writes.
 *
 * Backend-authoritative rules (S1.1 audit — the core constraint):
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
import { adminPaymentStatusDisplay } from '../../models/payments-admin.models';
import { PAYMENTS_TRANSLATION_KEYS, translatePaymentsKey } from '../../i18n/payments-translations';

@Component({
  selector: 'app-admin-payment-status-badge',
  imports: [StatusBadge],
  templateUrl: './payment-status-badge.html',
  styleUrl: './payment-status-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminPaymentStatusBadge {
  /** Backend payment status string to present (verbatim source of truth). */
  @Input({ required: true }) status!: string;

  /** Single mapping site for admin payment status (payments slice). */
  protected readonly displayOf = adminPaymentStatusDisplay;

  /** Unknown-entry key branching to the verbatim fallback. */
  protected readonly unknownLabelKey = PAYMENTS_TRANSLATION_KEYS.statusUnknown;

  /** Payments-bundle key resolver. */
  protected readonly translateKey = translatePaymentsKey;
}
