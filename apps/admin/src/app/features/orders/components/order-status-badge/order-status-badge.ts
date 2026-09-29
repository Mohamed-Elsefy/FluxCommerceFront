/**
 * Admin order status badge for Sub-Phase 14.4 — Orders Filtering &
 * Status Presentation.
 *
 * Feature-owned presentational component: renders HOW one backend order
 * status reads — the shared `flux-badge` primitive with a localized
 * label. Dumb by design — the owning view decides WHEN and WHAT (the
 * status arrives as a plain input, backend string verbatim). No API
 * access, no HTTP, no state writes — presentational components never
 * call backend APIs (`ARCHITECTURE.md` §8).
 *
 * Backend-authoritative rules (14.1 audit — the core constraint):
 * - The label localizes the KNOWN backend values (`Pending | Cancelled
 *   | Confirmed`); unknown or future backend strings render VERBATIM
 *   with the `neutral` tone (forward compatibility, `ENUM_REFERENCE.md`
 *   §8) — never mapped, never dropped.
 * - This badge knows NOTHING about payment status: payment-only values
 *   (e.g. `Succeeded`) fall back to `neutral` with verbatim text. The
 *   two concepts stay independent — nothing infers one status from the
 *   other.
 * - Status → display mapping lives in exactly one place
 *   (`orderStatusDisplay` in `../../models/orders-admin.models`) — no
 *   scattered string comparisons anywhere.
 *
 * Accessibility: the status ALWAYS renders as text (never color-only).
 *
 * SSR/hydration safe: static markup from input + culture only, no
 * browser APIs. RTL safe: logical properties only, no direction
 * branching.
 *
 * Explicitly out of scope (later work, must not appear here):
 * - 14.5 — no details orchestration (the badge is reused there).
 * - 14.6–14.8 — no `PaymentStatusBadge` (a separate concept with its
 *   own map, arriving with the payment slice).
 */

import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import { CultureService } from '@flux/i18n';
import { Badge, type BadgeVariant } from '@flux/ui';
import { orderStatusDisplay } from '../../models/orders-admin.models';
import { ORDERS_TRANSLATION_KEYS, translateOrdersKey } from '../../i18n/orders-translations';

@Component({
  selector: 'app-order-status-badge',
  imports: [Badge],
  templateUrl: './order-status-badge.html',
  styleUrl: './order-status-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderStatusBadge {
  /** Backend order status string to present (verbatim source of truth). */
  @Input({ required: true }) status!: string;

  private readonly cultures = inject(CultureService);

  /** Presentation variant for the status (`neutral` for unknown values). */
  protected variant(): BadgeVariant {
    return orderStatusDisplay(this.status ?? '').variant;
  }

  /** Localized label, or the raw backend value for unknown statuses. */
  protected label(): string {
    const culture = this.cultures.culture();
    const status = this.status ?? '';
    const display = orderStatusDisplay(status);
    if (display.labelKey === ORDERS_TRANSLATION_KEYS.statusUnknown) {
      return status.trim() !== ''
        ? status
        : translateOrdersKey(culture, display.labelKey, { value: status });
    }
    return translateOrdersKey(culture, display.labelKey);
  }
}
