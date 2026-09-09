/**
 * Empty state primitive for Sub-Phase 1.10 — Common Async UI States.
 *
 * Presentation only: renders HOW "no results" looks (optional icon, title,
 * message). The feature decides WHEN (from `ResourceState.isEmpty`,
 * Sub-Phase 1.9) and owns all copy. No API, domain, state, or retry logic —
 * actions belong to `RetryButton` consumers or feature templates.
 *
 * SSR/hydration safe: static markup from inputs only.
 *
 * Visual values come from `libs/theming` tokens (Sub-Phase 3.2); no raw
 * spacing or typography values are defined here.
 *
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under the
 * raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'flux-empty-state',
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyState {
  /** Optional decorative glyph (feature-chosen, never an emoji contract). */
  @Input() icon: string | null = null;
  /** Heading (feature-localized, required). */
  @Input({ required: true }) title!: string;
  /** Supporting text (feature-localized). */
  @Input() message: string | null = null;
}
