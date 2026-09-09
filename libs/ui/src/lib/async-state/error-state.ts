/**
 * Error state primitive for Sub-Phase 1.10 — Common Async UI States.
 *
 * Presentation only: renders HOW a failure looks (title, message, optional
 * retry) and emits `retry` WHEN the button is pressed. The feature decides
 * WHEN (from `ResourceState.isError`, Sub-Phase 1.9), WHAT message to show
 * (from normalized `ApiError.code` via localization, never raw backend text
 * parsing here), and WHAT retry does. No API, domain, or state logic.
 *
 * SSR/hydration safe: static markup from inputs only (`role="alert"`
 * announces on hydration without client-only APIs).
 *
 * Visual values come from `libs/theming` tokens (Sub-Phase 3.2); no raw
 * spacing or typography values are defined here.
 *
 * Uses `@Input()`/`@Output()` decorators (not signal I/O): `libs/*` specs
 * run under the raw Vitest runner, which lacks the Angular compiler
 * transform that registers signal inputs — decorator metadata stays
 * runtime-readable.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RetryButton } from './retry-button';

@Component({
  selector: 'flux-error-state',
  imports: [RetryButton],
  template: `
    <div class="error" role="alert">
      <h2 class="title">{{ title }}</h2>
      @if (message !== null) {
        <p class="message">{{ message }}</p>
      }
      @if (showRetry) {
        <flux-retry-button [label]="retryLabel" (pressed)="retry.emit()" />
      }
    </div>
  `,
  styles: `
    .error {
      display: grid;
      justify-items: center;
      gap: var(--spacing-sm);
      text-align: center;
      padding-block: var(--spacing-2xl);
      padding-inline: var(--spacing-lg);
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
export class ErrorState {
  /** Heading (feature-localized). */
  @Input() title = 'Something went wrong';
  /** Display message (feature-localized from `ApiError.code`, never parsed here). */
  @Input() message: string | null = null;
  /** Whether the retry affordance renders (feature-owned). */
  @Input() showRetry = true;
  /** Retry button text (feature-localized). */
  @Input() retryLabel = 'Retry';
  /** Emitted on retry click — the feature performs the retry. */
  @Output() readonly retry = new EventEmitter<void>();
}
