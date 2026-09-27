/**
 * Catalog section card for Sub-Phase 13.2 — Admin Catalog Feature
 * Foundation.
 *
 * Feature-owned presentational component: a titled `flux-card` surface
 * with a description and a backend-issued fact line (e.g. a localized
 * total). Dumb by design — the page decides WHAT each card says
 * (localized copy plus live overview facts); this component only renders.
 * Cards are non-interactive: product/category management routes do not
 * exist yet (Sub-Phases 13.3/13.5), so no links ship with the foundation
 * and no dead functionality is possible.
 *
 * SSR/hydration safe: pure markup + CSS, no browser APIs. RTL safe:
 * logical properties only.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { Card } from '@flux/ui';

@Component({
  selector: 'app-catalog-section-card',
  imports: [Card],
  templateUrl: './section-card.html',
  styleUrl: './section-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogSectionCard {
  /** Card heading. */
  @Input() title = '';
  /** Card body copy. */
  @Input() description = '';
  /** Fact line (owner-localized, e.g. a formatted total). */
  @Input() fact = '';
}
