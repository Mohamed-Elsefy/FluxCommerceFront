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
  template: `
    <section class="empty">
      @if (icon !== null) {
        <span class="icon" aria-hidden="true">{{ icon }}</span>
      }
      <h2 class="title">{{ title }}</h2>
      @if (message !== null) {
        <p class="message">{{ message }}</p>
      }
    </section>
  `,
  styles: `
    .empty {
      display: grid;
      justify-items: center;
      gap: var(--spacing-sm);
      text-align: center;
      padding-block: var(--spacing-2xl);
      padding-inline: var(--spacing-lg);
    }
    .icon {
      font-size: 2rem;
      line-height: 1;
    }
    .title {
      margin: 0;
      font-size: var(--font-size-lg);
    }
    .message {
      margin: 0;
      opacity: 0.75;
    }
  `,
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
