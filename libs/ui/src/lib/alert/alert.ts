/**
 * Alert primitive for Sub-Phase 3.4 — Core UI Primitives.
 *
 * Presentation only: renders HOW a status message looks (variant accent,
 * optional title, projected body). The feature decides WHAT the message
 * says and WHEN it shows — this component never derives status from domain
 * state and is never dismissible (no actions, no outputs).
 *
 * Live-region semantics follow the variant: `warning`/`danger` interrupt
 * (`role="alert"`); `info`/`success` announce politely (`role="status"`).
 * Non-interactive by design (no focus, no keyboard handling). Variant
 * accents come from `libs/theming` status tokens — never `ThemeService`.
 *
 * SSR/hydration safe: pure markup + CSS. RTL safe: the accent uses
 * `border-inline-start`, so it mirrors automatically.
 *
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under the
 * raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Message severity. Drives accent color and live-region role. */
export type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'flux-alert',
  templateUrl: './alert.html',
  styleUrl: './alert.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Alert {
  /** Message severity. */
  @Input() variant: AlertVariant = 'info';
  /** Optional heading (feature-localized). */
  @Input() title: string | null = null;
}
