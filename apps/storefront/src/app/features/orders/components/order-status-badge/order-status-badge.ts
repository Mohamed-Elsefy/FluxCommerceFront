/**
 * Order status badge component for Sub-Phase 10.5 — Order & Payment
 * Status Experience.
 *
 * Thin feature adapter over the shared `StorefrontStatusBadge`
 * (Refactoring Phase B): the order tone map (`orderStatusToneOf`) and
 * label map stay the single mapping sites — the rendering logic lives
 * in the shared component. The owning view decides WHEN and WHAT —
 * the status arrives as a plain input (backend string, verbatim). No
 * API access, no HTTP, no state writes.
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
 * inside a semantic `span`; tone is redundant decoration.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { StorefrontStatusBadge } from '../../../../shared/status-badge/status-badge';
import { isOrderStatus } from '../../models/orders.models';
import { orderStatusToneOf } from '../../models/status.models';
import { ORDERS_TRANSLATION_KEYS, translateOrdersKey } from '../../i18n/orders-translations';

/** Localized labels for the known backend order statuses. */
const ORDER_STATUS_LABEL_KEYS = {
  Pending: ORDERS_TRANSLATION_KEYS.statusOrderPending,
  Cancelled: ORDERS_TRANSLATION_KEYS.statusOrderCancelled,
  Confirmed: ORDERS_TRANSLATION_KEYS.statusOrderConfirmed,
} as const;

@Component({
  selector: 'orders-order-status-badge',
  imports: [StorefrontStatusBadge],
  templateUrl: './order-status-badge.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderStatusBadge {
  /** Backend order status string to present (verbatim source of truth). */
  @Input({ required: true }) status!: string;

  /** Single tone map for order status. */
  protected readonly toneOf = orderStatusToneOf;

  /** Label key for known order values, `null` outside the concept. */
  protected readonly labelKeyOf = (status: string): string | null =>
    isOrderStatus(status) ? ORDER_STATUS_LABEL_KEYS[status] : null;

  /** Unknown-entry key used when the status is blank. */
  protected readonly unknownLabelKey = ORDERS_TRANSLATION_KEYS.statusOrderUnknown;

  /** Orders-bundle key resolver. */
  protected readonly translateKey = translateOrdersKey;
}
