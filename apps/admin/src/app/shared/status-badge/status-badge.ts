/**
 * Admin shared status badge for Refactoring Phase B (step B1) — Status
 * Badge Unification.
 *
 * Presentation only: renders HOW one backend status reads — the shared
 * `flux-badge` primitive with a localized label. Dumb by design — the
 * owning feature decides WHEN and WHAT: the raw status, the
 * status → display map, the unknown-entry key, and the key resolver all
 * arrive as inputs. No API access, no HTTP, no state writes.
 *
 * Backend-authoritative rules (unchanged from the four feature badges
 * this replaces — `order-status-badge`, both `payment-status-badge`
 * variants, `user-status-badge`):
 * - Known backend values localize through the owner-provided map;
 *   unknown or future values render VERBATIM with the `neutral` tone
 *   (forward compatibility, `ENUM_REFERENCE.md` §8) — never mapped,
 *   never dropped. Blank statuses resolve through the `unknown` entry
 *   (numbers always stringify non-blank, so numeric badges keep their
 *   `String(status)` behavior).
 * - Status → display mappings stay in exactly one place per feature
 *   (the feature `models/*-admin.models` map fns) — this component
 *   performs no comparisons of its own.
 *
 * Accessibility: the status ALWAYS renders as text (never color-only).
 *
 * SSR/hydration safe: static markup from inputs + culture only, no
 * browser APIs. RTL safe: logical properties only, no direction
 * branching.
 */

import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import { CultureService, type Culture, type TranslationParams } from '@flux/i18n';
import { Badge, type BadgeVariant } from '@flux/ui';

/** Translation key + badge variant behind one backend status value. */
export interface StatusBadgeDisplay {
  /** Key into the owning feature's translation bundle. */
  readonly labelKey: string;
  /** Badge emphasis (maps 1:1 onto the shared `flux-badge` variants). */
  readonly variant: BadgeVariant;
}

/**
 * Feature key resolver (`translateOrdersKey` / `translatePaymentsKey` /
 * `translateUsersKey` shape): culture + key + optional params → string.
 * Never throws.
 */
export type StatusBadgeTranslator = (
  culture: Culture,
  key: string,
  params?: TranslationParams,
) => string;

@Component({
  selector: 'app-status-badge',
  imports: [Badge],
  templateUrl: './status-badge.html',
  styleUrl: './status-badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBadge<TStatus extends string | number> {
  /** Backend status value to present (verbatim source of truth). */
  @Input({ required: true }) status!: TStatus;

  /** Owner-provided status → display map (the single mapping site). */
  @Input({ required: true }) displayOf!: (status: TStatus) => StatusBadgeDisplay;

  /** Label key the map returns for unknown values (verbatim branch). */
  @Input({ required: true }) unknownLabelKey!: string;

  /** Owner-provided key resolver for known labels. */
  @Input({ required: true }) translateKey!: StatusBadgeTranslator;

  private readonly cultures = inject(CultureService);

  /** Presentation variant for the status (`neutral` for unknown values). */
  protected variant(): BadgeVariant {
    return this.displayOf(this.status).variant;
  }

  /** Localized label, or the raw backend value for unknown statuses. */
  protected label(): string {
    const culture = this.cultures.culture();
    const status = this.status;
    const display = this.displayOf(status);
    const raw = String(status ?? '');
    if (display.labelKey === this.unknownLabelKey) {
      return raw.trim() !== '' ? raw : this.translateKey(culture, display.labelKey, { value: raw });
    }
    return this.translateKey(culture, display.labelKey);
  }
}
