/**
 * Spinner primitive for Sub-Phase 3.4 — Core UI Primitives.
 *
 * Presentation only: a bare indeterminate progress ring (no label of its
 * own unless given one). Composed standalone for inline progress and by
 * `Button` for its loading state — the single ring implementation in
 * `libs/ui` (`LoadingIndicator` keeps its Phase 1 labeled block-shape API).
 *
 * Accessibility: with a `label` it exposes `role="status"` (announced);
 * with `label === null` it renders `aria-hidden` for decorative use inside
 * already-labeled controls. Visual values come from `libs/theming` tokens;
 * geometry echoes `LoadingIndicator` so both read as one system.
 *
 * SSR/hydration safe: pure markup + CSS (no browser APIs, no random ids).
 * RTL safe: no directional properties. Reduced-motion safe: the rotation
 * is disabled under `prefers-reduced-motion`.
 *
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under the
 * raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { ComponentSize } from '../ui-primitives';

@Component({
  selector: 'flux-spinner',
  templateUrl: './spinner.html',
  styleUrl: './spinner.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Spinner {
  /** Accessible progress text; `null` renders a decorative (hidden) ring. */
  @Input() label: string | null = 'Loading';
  /** Ring scale. */
  @Input() size: ComponentSize = 'md';
}
