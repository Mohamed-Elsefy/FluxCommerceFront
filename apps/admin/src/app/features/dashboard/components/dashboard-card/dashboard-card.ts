/**
 * Dashboard card for Sub-Phase 12.4 — Dashboard Foundation.
 *
 * Feature-owned presentational component: a titled `flux-card` surface
 * with a description and an optional status badge. Dumb by design — the
 * page decides WHAT each card says (localized copy, live session facts,
 * or upcoming-module placeholders); this component only renders. Cards
 * are non-interactive: upcoming modules render no links, so no dead
 * functionality ships with the foundation.
 *
 * SSR/hydration safe: pure markup + CSS, no browser APIs. RTL safe:
 * logical properties only.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Badge, type BadgeVariant, Card } from '@flux/ui';

@Component({
  selector: 'app-dashboard-card',
  imports: [Card, Badge],
  templateUrl: './dashboard-card.html',
  styleUrl: './dashboard-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardCard {
  /** Card heading. */
  @Input() title = '';
  /** Card body copy. */
  @Input() description = '';
  /** Optional status badge text (`null` hides the badge). */
  @Input() badge: string | null = null;
  /** Badge emphasis. */
  @Input() badgeVariant: BadgeVariant = 'neutral';
}
