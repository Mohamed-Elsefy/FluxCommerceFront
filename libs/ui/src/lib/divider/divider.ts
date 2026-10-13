/**
 * Divider primitive for Sub-Phase 3.4 — Core UI Primitives.
 *
 * Presentation only: a thematic break between content (`<hr>` by default;
 * a vertical `separator` when `orientation` is `'vertical'`). No content,
 * no interaction, no inputs beyond orientation.
 *
 * SSR/hydration safe: pure markup + CSS. RTL safe: the vertical rule uses
 * `border-inline-start`, so it stays on the correct side in both
 * directions.
 *
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under the
 * raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Rule direction. Vertical rules are `separator`s for flex/grid siblings. */
export type DividerOrientation = 'horizontal' | 'vertical';

@Component({
  selector: 'flux-divider',
  templateUrl: './divider.html',
  styleUrl: './divider.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Divider {
  /** Rule direction. */
  @Input() orientation: DividerOrientation = 'horizontal';
}
