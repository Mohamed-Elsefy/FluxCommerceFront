/**
 * Button primitive for Sub-Phase 3.4 — Core UI Primitives.
 *
 * Presentation only: renders HOW an action looks (variant, size, disabled,
 * loading) and projects the label. The feature decides WHAT the action does
 * via the native `click` event bubbling from the inner `<button>` — no
 * custom output, no handlers, no state. Keyboard behavior (Enter/Space),
 * focus, and disabled semantics come from the native button element.
 *
 * Loading composes the shared `Spinner` (decorative mode: the visible label
 * already names the action, so the ring stays `aria-hidden`); the control
 * is disabled while loading and exposes `aria-busy`. Visual values come
 * from `libs/theming` tokens — never `ThemeService`.
 *
 * SSR/hydration safe: pure markup + CSS. RTL safe: logical properties only.
 * Reduced-motion safe: transitions are disabled under
 * `prefers-reduced-motion`.
 *
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under the
 * raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { ComponentSize } from '../ui-primitives';
import { Spinner } from '../spinner/spinner';

/** Visual emphasis (DESIGN §6.1). `primary` for the single main action per view. */
export type ButtonVariant = 'primary' | 'secondary' | 'glass' | 'ghost' | 'quick' | 'fab';

@Component({
  selector: 'flux-button',
  imports: [Spinner],
  templateUrl: './button.html',
  styleUrl: './button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Button {
  /** Visual emphasis. */
  @Input() variant: ButtonVariant = 'primary';
  /** Control scale. */
  @Input() size: ComponentSize = 'md';
  /** Native button type. */
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  /** Non-interactive state (feature-owned). */
  @Input() disabled = false;
  /** Progress state: ring shown, control disabled and marked busy. */
  @Input() loading = false;
}
