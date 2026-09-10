/**
 * Skeleton loader primitive for Sub-Phase 1.10 — Common Async UI States.
 *
 * Presentation only: placeholder bars shown while content loads (typically
 * beside or instead of `LoadingIndicator`, at the feature's discretion).
 * Decorative by design (`aria-hidden`) — screen readers hear the feature's
 * loading announcement, not bar counts. No API, domain, or state logic.
 *
 * SSR/hydration safe: deterministic bar count from `lines` (no random ids or
 * measurements); identical render on server and client.
 *
 * Visual values come from `libs/theming` tokens (Sub-Phase 3.2); no raw
 * palette, spacing, radius, or easing values are defined here.
 *
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under the
 * raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'flux-skeleton',
  templateUrl: './skeleton.html',
  styleUrl: './skeleton.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
  /** Number of placeholder bars (never negative). */
  @Input() lines = 3;
  /** Pulse animation toggle. */
  @Input() animate = true;

  linesArray(): number[] {
    return Array.from({ length: Math.max(0, this.lines) }, (_, index) => index);
  }
}
