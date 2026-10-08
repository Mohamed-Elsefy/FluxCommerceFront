/**
 * Badge primitive for Sub-Phase 3.4 — Core UI Primitives.
 *
 * Presentation only: a small non-interactive status/count label (projected
 * text, variant tint). The feature decides WHAT the badge says and WHEN it
 * shows — this component never derives status from domain state.
 *
 * Variant tints are derived from `libs/theming` status tokens via
 * `color-mix`, so Light/Dark themes follow automatically with no per-theme
 * values here and no `ThemeService` dependency.
 *
 * SSR/hydration safe: pure markup + CSS. RTL safe: logical properties only.
 * Non-interactive by design (no focus, no keyboard handling).
 *
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under the
 * raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Status emphasis (DESIGN §6.7). `drop|verified|rarity|count` are Kinetic stickers. */
export type BadgeVariant =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'drop'
  | 'verified'
  | 'rarity'
  | 'count';

@Component({
  selector: 'flux-badge',
  templateUrl: './badge.html',
  styleUrl: './badge.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Badge {
  /** Status emphasis. */
  @Input() variant: BadgeVariant = 'neutral';
}
