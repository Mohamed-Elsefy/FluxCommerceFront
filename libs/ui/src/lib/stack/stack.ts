/**
 * Stack primitive for Sub-Phase 3.5 — Layout Primitives.
 *
 * Presentation only: distributes children along one axis with a uniform
 * token gap (form fields, card sections, action rows). Direction, gap,
 * alignment, and distribution are data attributes — no per-instance CSS.
 *
 * `direction="horizontal"` follows the document direction automatically
 * (flex `row` starts inline-start in both LTR and RTL). Visual values come
 * from `libs/theming` tokens — never `ThemeService`. Non-interactive.
 *
 * SSR/hydration safe: pure markup + CSS. RTL safe: logical properties and
 * direction-aware flex flow only.
 *
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under the
 * raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { FlexAlign, FlexJustify, LayoutGap } from '../ui-primitives';

/** Stack flow. Horizontal stacks follow the document direction (RTL-safe). */
export type StackDirection = 'vertical' | 'horizontal';

@Component({
  selector: 'flux-stack',
  templateUrl: './stack.html',
  styleUrl: './stack.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Stack {
  /** Stack flow. */
  @Input() direction: StackDirection = 'vertical';
  /** Uniform gap between children (spacing token). */
  @Input() gap: LayoutGap = 'md';
  /** Cross-axis alignment. */
  @Input() align: FlexAlign = 'stretch';
  /** Main-axis distribution. */
  @Input() justify: FlexJustify = 'start';
}
