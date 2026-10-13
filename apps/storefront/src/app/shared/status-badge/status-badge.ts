/**
 * Storefront shared status badge for Refactoring Phase B (step B2c) —
 * Status Badge Unification.
 *
 * Unifies the `OrderStatusBadge` and `PaymentStatusBadge` (both
 * Sub-Phase 10.5, same `features/orders` area): same tone-coded span
 * rendering, same known/verbatim/unknown label logic, same markup,
 * same styling. The order/payment concepts stay independent — each
 * adapter supplies its own tone map, label map, guard, and unknown
 * key; this component performs no status comparisons of its own.
 *
 * Presentation only: renders HOW one backend status reads — a
 * tone-coded badge with a localized label. Dumb by design — the owning
 * view decides WHEN and WHAT: the raw status plus all resolvers arrive
 * as inputs. No API access, no HTTP, no state writes.
 *
 * Backend-authoritative rules (unchanged from the two feature badges):
 * known backend values localize; unknown or future backend strings
 * render VERBATIM with the `neutral` tone (forward compatibility,
 * `ENUM_REFERENCE.md` §8) — never mapped, never dropped.
 *
 * Accessibility: the status ALWAYS renders as text (never color-only),
 * inside a semantic `span`; tone is redundant decoration.
 *
 * SSR/hydration safe: static markup from inputs + culture only, no
 * browser APIs. RTL safe: logical properties only, no direction
 * branching.
 */

import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import { CultureService, type Culture } from '@flux/i18n';

@Component({
  selector: 'storefront-status-badge',
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StorefrontStatusBadge {
  /** Backend status string to present (verbatim source of truth). */
  @Input({ required: true }) status!: string;

  /** Owner-provided status → presentation tone (the single tone map). */
  @Input({ required: true }) toneOf!: (status: string) => string;

  /**
   * Owner-provided status → label key (`null` for values outside the
   * owner's concept — rendered verbatim).
   */
  @Input({ required: true }) labelKeyOf!: (status: string) => string | null;

  /** Unknown-entry key used when the status is blank. */
  @Input({ required: true }) unknownLabelKey!: string;

  /** Owner-provided key resolver for known and unknown labels. */
  @Input({ required: true }) translateKey!: (culture: Culture, key: string) => string;

  private readonly cultures = inject(CultureService);

  /** Presentation tone for the status (`neutral` for unknown values). */
  protected tone(): string {
    return this.toneOf(this.status ?? '');
  }

  /** Localized label, or the raw backend value for unknown statuses. */
  protected label(): string {
    const status = this.status ?? '';
    const labelKey = this.labelKeyOf(status);
    if (labelKey !== null) {
      return this.translateKey(this.cultures.culture(), labelKey);
    }
    return status.trim() !== ''
      ? status
      : this.translateKey(this.cultures.culture(), this.unknownLabelKey);
  }
}
