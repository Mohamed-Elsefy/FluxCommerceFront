/**
 * Order status badge component for Sub-Phase 10.5 — Order & Payment
 * Status Experience.
 *
 * Presentation only: renders HOW one backend order status reads — a
 * tone-coded badge with a localized label. The owning view decides WHEN
 * and WHAT — the status arrives as a plain input (backend string,
 * verbatim). No API access, no HTTP, no state writes — presentational
 * components never call backend APIs (`ARCHITECTURE.md` §8).
 *
 * Backend-authoritative rules (§10.5 — the core constraint):
 * - The label localizes the KNOWN backend value (`Pending | Cancelled |
 *   `Confirmed`); unknown or future backend strings render VERBATIM
 *   with the `neutral` tone (forward compatibility,
 *   `ENUM_REFERENCE.md` §8) — never mapped, never dropped.
 * - This badge knows NOTHING about payment status: payment-only values
 *   (e.g. `Succeeded`) fall back to `neutral` with verbatim text. The
 *   two concepts stay independent — nothing infers one status from the
 *   other.
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
import { isOrderStatus } from '../../models/orders.models';
import { orderStatusToneOf, type StatusTone } from '../../models/status.models';
import { ORDERS_TRANSLATION_KEYS, translateOrdersKey } from '../../i18n/orders-translations';

/** Localized labels for the known backend order statuses. */
const ORDER_STATUS_LABEL_KEYS = {
  Pending: ORDERS_TRANSLATION_KEYS.statusOrderPending,
  Cancelled: ORDERS_TRANSLATION_KEYS.statusOrderCancelled,
  Confirmed: ORDERS_TRANSLATION_KEYS.statusOrderConfirmed,
} as const;

@Component({
  selector: 'orders-order-status-badge',
  templateUrl: './order-status-badge.html',
  styleUrl: './order-status-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderStatusBadge {
  /** Backend order status string to present (verbatim source of truth). */
  @Input({ required: true }) status!: string;

  private readonly cultures = inject(CultureService);

  /** Presentation tone for the status (`neutral` for unknown values). */
  protected tone(): StatusTone {
    return orderStatusToneOf(this.status ?? '');
  }

  /** Localized label, or the raw backend value for unknown statuses. */
  protected label(): string {
    const culture = this.cultures.culture();
    const status = this.status ?? '';
    if (isOrderStatus(status)) {
      return translateOrdersKey(culture, ORDER_STATUS_LABEL_KEYS[status]);
    }
    return status.trim() !== ''
      ? status
      : translateOrdersKey(culture, ORDERS_TRANSLATION_KEYS.statusOrderUnknown);
  }
}
