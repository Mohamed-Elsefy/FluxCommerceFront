/**
 * Payment status badge component for Sub-Phase 10.5 — Order & Payment
 * Status Experience.
 *
 * Presentation only: renders HOW one backend payment status reads — a
 * tone-coded badge with a localized label. The owning view decides WHEN
 * and WHAT — the status arrives as a plain input (backend string,
 * verbatim). No API access, no HTTP, no state writes — presentational
 * components never call backend APIs (`ARCHITECTURE.md` §8).
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
 * payment truth (e.g. a future §10.6 synchronization read). It is
 * intentionally NOT wired into the payments feature: cross-feature
 * internal imports are forbidden by `ARCHITECTURE.md` §7.
 *
 * Accessibility: the status ALWAYS renders as text (never color-only),
 * inside a semantic `span`; tone is redundant decoration. Colors pair
 * audited theme tokens (text on surface, WCAG AA per the architecture
 * audit) with a matching border — no new tokens, no contrast risk.
 *
 * SSR/hydration safe: static markup from input + culture only, no
 * browser APIs. RTL safe: logical properties only, no direction
 * branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 10.6 — no history timeline or post-payment polling state.
 */

import { ChangeDetectionStrategy, Component, Input, inject } from '@angular/core';
import { CultureService } from '@flux/i18n';
import { isOrdersPaymentStatus } from '../../models/orders.models';
import { paymentStatusToneOf, type StatusTone } from '../../models/status.models';
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
  templateUrl: './payment-status-badge.html',
  styleUrl: './payment-status-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentStatusBadge {
  /** Backend payment status string to present (verbatim source of truth). */
  @Input({ required: true }) status!: string;

  private readonly cultures = inject(CultureService);

  /** Presentation tone for the status (`neutral` for unknown values). */
  protected tone(): StatusTone {
    return paymentStatusToneOf(this.status ?? '');
  }

  /** Localized label, or the raw backend value for unknown statuses. */
  protected label(): string {
    const culture = this.cultures.culture();
    const status = this.status ?? '';
    if (isOrdersPaymentStatus(status)) {
      return translateOrdersKey(culture, PAYMENT_STATUS_LABEL_KEYS[status]);
    }
    return status.trim() !== ''
      ? status
      : translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.statusPaymentUnknown);
  }
}
