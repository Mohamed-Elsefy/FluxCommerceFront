/**
 * Loading indicator primitive for Sub-Phase 1.10 — Common Async UI States.
 *
 * Presentation only: renders HOW loading looks (spinner + label). The feature
 * decides WHEN (from `ResourceState.isLoading`, Sub-Phase 1.9) and passes an
 * already-localized `label` (copy ownership stays with features until the
 * Phase 4 localization layer). No API, domain, or state logic lives here.
 *
 * SSR/hydration safe: pure markup + CSS (no browser APIs, no random ids);
 * identical render on server and client. RTL safe: logical properties only.
 *
 * Visual values come from `libs/theming` tokens (Sub-Phase 3.2); no raw
 * palette, spacing, or easing values are defined here.
 *
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under the
 * raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { ComponentSize } from '../ui-primitives';

@Component({
  selector: 'flux-loading-indicator',
  template: `
    <div class="loading" role="status" [attr.aria-label]="label" [attr.data-size]="size">
      <span class="spinner" aria-hidden="true"></span>
      <span class="label">{{ label }}</span>
    </div>
  `,
  styles: `
    .loading {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }
    .spinner {
      inline-size: 1.25rem;
      block-size: 1.25rem;
      border-radius: 50%;
      border: 2px solid currentColor;
      border-block-start-color: transparent;
      animation: flux-spin 0.9s var(--ease-linear) infinite;
    }
    .loading[data-size='sm'] .spinner {
      inline-size: 1rem;
      block-size: 1rem;
    }
    .loading[data-size='lg'] .spinner {
      inline-size: 1.75rem;
      block-size: 1.75rem;
    }
    @keyframes flux-spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation: none;
        border-block-start-color: currentColor;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingIndicator {
  /** Accessible loading text (feature-localized). */
  @Input() label = 'Loading';
  /** Spinner scale. */
  @Input() size: ComponentSize = 'md';
}
