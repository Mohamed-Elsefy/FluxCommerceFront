/**
 * Admin payment status badge for Sub-Phase 14.7 — Payment Details,
 * Status & Failed Payments.
 *
 * Feature-owned presentational component: renders HOW one backend
 * payment status reads — the shared `flux-badge` primitive with a
 * localized label. Dumb by design — the owning view decides WHEN and
 * WHAT (the status arrives as a plain input, backend string verbatim).
 * No API access, no HTTP, no state writes — presentational components
 * never call backend APIs (`ARCHITECTURE.md` §8).
 *
 * Backend-authoritative rules (14.1 audit — the core constraint):
 * - The label localizes the KNOWN backend values (`Pending |
 *   Processing | Succeeded | Failed | Cancelled | Refunded`); unknown or
 *   future backend strings render VERBATIM with the `neutral` tone
 *   (forward compatibility, `ENUM_REFERENCE.md` §8) — never mapped,
 *   never dropped.
 * - This badge knows NOTHING about order status: order-only values
 *   (e.g. `Confirmed`) fall back to `neutral` with verbatim text. The
 *   two concepts stay independent — nothing infers one status from the
 *   other.
 * - Status → display mapping lives in exactly one place
 *   (`paymentStatusDisplay` in `../../models/orders-admin.models`) — no
 *   scattered string comparisons anywhere.
 * - Failure presentation: the backend exposes no failure reason,
 *   message, or code on the payment payload — the `Failed` status itself
 *   is the complete backend-supplied failure information. This badge
 *   renders `Failed` with the `danger` tone and never invents a reason.
 *
 * Accessibility: the status ALWAYS renders as text (never color-only).
 *
 * SSR/hydration safe: static markup from input + culture only, no
 * browser APIs. RTL safe: logical properties only, no direction
 * branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 14.8 — no payment history (no such endpoint).
 */

import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import { CultureService } from '@flux/i18n';
import { Badge, type BadgeVariant } from '@flux/ui';
import { paymentStatusDisplay } from '../../models/orders-admin.models';
import { ORDERS_TRANSLATION_KEYS, translateOrdersKey } from '../../i18n/orders-translations';

@Component({
  selector: 'app-payment-status-badge',
  imports: [Badge],
  templateUrl: './payment-status-badge.html',
  styleUrl: './payment-status-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentStatusBadge {
  /** Backend payment status string to present (verbatim source of truth). */
  @Input({ required: true }) status!: string;

  private readonly cultures = inject(CultureService);

  /** Presentation variant for the status (`neutral` for unknown values). */
  protected variant(): BadgeVariant {
    return paymentStatusDisplay(this.status ?? '').variant;
  }

  /** Localized label, or the raw backend value for unknown statuses. */
  protected label(): string {
    const culture = this.cultures.culture();
    const status = this.status ?? '';
    const display = paymentStatusDisplay(status);
    if (display.labelKey === ORDERS_TRANSLATION_KEYS.paymentStatusUnknown) {
      return status.trim() !== ''
        ? status
        : translateOrdersKey(culture, display.labelKey, { value: status });
    }
    return translateOrdersKey(culture, display.labelKey);
  }
}
