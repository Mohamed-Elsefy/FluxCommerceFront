/**
 * Icon primitive for Sub-Phase 3.4 — Core UI Primitives.
 *
 * Presentation only: a consistently sized and aligned inline slot for a
 * glyph — either a text `glyph` (character mark) or projected content such
 * as an inline SVG (size it with `width="1em" height="1em"` so it follows
 * the icon scale). No icon set lives here: features choose their marks.
 *
 * Always decorative (`aria-hidden`): icons never carry meaning alone — the
 * adjacent label or control name does. Non-interactive by design.
 *
 * SSR/hydration safe: pure markup + CSS. RTL safe: logical properties only;
 * symmetric sizing, so mirroring-sensitive marks stay the feature's choice.
 *
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under the
 * raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { ComponentSize } from '../ui-primitives';

@Component({
  selector: 'flux-icon',
  templateUrl: './icon.html',
  styleUrl: './icon.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Icon {
  /** Text mark rendered after any projected content (feature-chosen). */
  @Input() glyph: string | null = null;
  /** Icon scale. */
  @Input() size: ComponentSize = 'md';
}
