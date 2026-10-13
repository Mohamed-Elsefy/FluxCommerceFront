/**
 * Flex primitive for Sub-Phase 3.5 — Layout Primitives.
 *
 * Presentation only: a free-form flex row/column for alignment, wrapping,
 * and distribution that `Stack`'s single-axis opinion does not cover
 * (toolbars, split headers, inline clusters). Direction stays on the
 * document axis (`row`/`column` only — no reversing, so RTL keeps meaning).
 *
 * Visual values come from `libs/theming` tokens — never `ThemeService`.
 * Non-interactive by design.
 *
 * SSR/hydration safe: pure markup + CSS. RTL safe: logical flow and
 * direction-aware alignment values only.
 *
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under the
 * raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import type { FlexAlign, FlexJustify, LayoutGap } from '../ui-primitives';

/** Flex flow, constrained to the document axis (RTL keeps meaning). */
export type FlexDirection = 'row' | 'column';

@Component({
  selector: 'flux-flex',
  templateUrl: './flex.html',
  styleUrl: './flex.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Flex {
  /** Flex flow. */
  @Input() direction: FlexDirection = 'row';
  /** Uniform gap between items (spacing token). */
  @Input() gap: LayoutGap = 'md';
  /** Cross-axis alignment. */
  @Input() align: FlexAlign = 'stretch';
  /** Main-axis distribution. */
  @Input() justify: FlexJustify = 'start';
  /** Whether items wrap onto multiple lines. */
  @Input() wrap = false;
}
