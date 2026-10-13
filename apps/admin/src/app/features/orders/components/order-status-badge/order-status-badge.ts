/**
 * Admin order status badge for Sub-Phase 14.4 — Orders Filtering &
 * Status Presentation.
 *
 * Thin feature adapter over the shared `StatusBadge` (Refactoring
 * Phase B): the status → display map stays in exactly one place
 * (`orderStatusDisplay` in `../../models/orders-admin.models`) and
 * labels resolve through the orders bundle — the rendering logic
 * (variant/label resolution, verbatim unknown fallback) lives in the
 * shared component. Dumb by design — the owning view decides WHEN and
 * WHAT (the status arrives as a plain input, backend string verbatim).
 * No API access, no HTTP, no state writes.
 *
 * Backend-authoritative rules (14.1 audit — the core constraint):
 * - The label localizes the KNOWN backend values (`Pending | Cancelled
 *   | Confirmed`); unknown or future backend strings render VERBATIM
 *   with the `neutral` tone (forward compatibility, `ENUM_REFERENCE.md`
 *   §8) — never mapped, never dropped.
 * - This badge knows NOTHING about payment status: payment-only values
 *   (e.g. `Succeeded`) fall back to `neutral` with verbatim text.
 *
 * Accessibility: the status ALWAYS renders as text (never color-only).
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { StatusBadge } from '../../../../shared/status-badge/status-badge';
import { orderStatusDisplay } from '../../models/orders-admin.models';
import { ORDERS_TRANSLATION_KEYS, translateOrdersKey } from '../../i18n/orders-translations';

@Component({
  selector: 'app-order-status-badge',
  imports: [StatusBadge],
  templateUrl: './order-status-badge.html',
  styleUrl: './order-status-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderStatusBadge {
  /** Backend order status string to present (verbatim source of truth). */
  @Input({ required: true }) status!: string;

  /** Single mapping site for admin order status. */
  protected readonly displayOf = orderStatusDisplay;

  /** Unknown-entry key branching to the verbatim fallback. */
  protected readonly unknownLabelKey = ORDERS_TRANSLATION_KEYS.statusUnknown;

  /** Orders-bundle key resolver. */
  protected readonly translateKey = translateOrdersKey;
}
