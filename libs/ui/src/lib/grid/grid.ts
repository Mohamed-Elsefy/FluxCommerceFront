/**
 * Grid primitive for Sub-Phase 3.5 — Layout Primitives.
 *
 * Presentation only: equal-column CSS grid with a uniform token gap
 * (card listings, nav groups, dashboard tiles). Column count is a plain
 * number clamped to at least one; the gap maps to spacing tokens. Tracks
 * use `minmax(0, 1fr)` so content never forces horizontal overflow.
 *
 * Visual values come from `libs/theming` tokens — never `ThemeService`.
 * Non-interactive by design.
 *
 * SSR/hydration safe: pure markup + CSS. RTL safe: grid auto-placement
 * follows the document direction; no physical properties.
 *
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under the
 * raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { LayoutGap } from '../ui-primitives';

@Component({
  selector: 'flux-grid',
  templateUrl: './grid.html',
  styleUrl: './grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Grid {
  /** Equal column count (clamped to at least one). */
  @Input() columns = 1;
  /** Uniform gap between tracks (spacing token). */
  @Input() gap: LayoutGap = 'md';

  /** `repeat()` expression for the track list; never fewer than one column. */
  protected trackList(): string {
    const count = Math.max(1, Math.floor(this.columns));
    return `repeat(${count}, minmax(0, 1fr))`;
  }
}
