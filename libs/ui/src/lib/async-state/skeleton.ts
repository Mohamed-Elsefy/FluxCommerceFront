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
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under the
 * raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'flux-skeleton',
  template: `
    <div class="skeleton" aria-hidden="true" [attr.data-animated]="animate">
      @for (line of linesArray(); track line) {
        <span class="bar"></span>
      }
    </div>
  `,
  styles: `
    .skeleton {
      display: grid;
      gap: 0.5rem;
    }
    .bar {
      display: block;
      block-size: 0.875rem;
      border-radius: 0.25rem;
      background: currentColor;
      opacity: 0.12;
    }
    .bar:last-child {
      inline-size: 60%;
    }
    .skeleton[data-animated='true'] .bar {
      animation: flux-pulse 1.4s ease-in-out infinite;
    }
    @keyframes flux-pulse {
      50% {
        opacity: 0.05;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .skeleton[data-animated='true'] .bar {
        animation: none;
      }
    }
  `,
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
