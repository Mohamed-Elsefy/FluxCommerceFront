/**
 * Retry button primitive for Sub-Phase 1.10 — Common Async UI States.
 *
 * Presentation only: renders HOW a retry affordance looks and emits `pressed`
 * WHEN clicked. The feature owns what retry DOES (reload the resource,
 * re-emit the query) — this component never triggers requests itself.
 * Composed by `ErrorState`; also usable standalone (e.g. empty-state
 * actions, offline banners).
 *
 * SSR/hydration safe: static button from inputs only.
 *
 * Uses `@Input()`/`@Output()` decorators (not signal I/O): `libs/*` specs
 * run under the raw Vitest runner, which lacks the Angular compiler
 * transform that registers signal inputs — decorator metadata stays
 * runtime-readable.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import type { ComponentSize } from '../ui-primitives';

@Component({
  selector: 'flux-retry-button',
  template: `
    <button
      type="button"
      class="retry"
      [attr.data-size]="size"
      [disabled]="disabled"
      (click)="pressed.emit()"
    >
      {{ label }}
    </button>
  `,
  styles: `
    .retry {
      padding-block: 0.5rem;
      padding-inline: 1rem;
      border: 1px solid currentColor;
      border-radius: 0.375rem;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .retry[data-size='sm'] {
      padding-block: 0.25rem;
      padding-inline: 0.75rem;
    }
    .retry[data-size='lg'] {
      padding-block: 0.75rem;
      padding-inline: 1.5rem;
    }
    .retry:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RetryButton {
  /** Button text (feature-localized). */
  @Input() label = 'Retry';
  /** Disabled state (feature-owned, e.g. retry already in flight). */
  @Input() disabled = false;
  /** Button scale. */
  @Input() size: ComponentSize = 'md';
  /** Emitted on click — the feature performs the retry. */
  @Output() readonly pressed = new EventEmitter<void>();
}
