/**
 * Card primitive for Sub-Phase 3.4 — Core UI Primitives.
 *
 * Presentation only: a generic surface container (projected content on a
 * raised surface with border, radius, and elevation tokens). Deliberately
 * content-free — business meaning (product, order, summary) stays in
 * feature-owned components that may compose this container.
 *
 * Non-interactive by design (no focus, no keyboard handling). Visual values
 * come from `libs/theming` tokens — never `ThemeService`.
 *
 * SSR/hydration safe: pure markup + CSS. RTL safe: logical properties only.
 *
 * Standalone (no inputs) by design: padding, surface, and elevation are
 * system constants, not per-instance choices.
 */

import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'flux-card',
  templateUrl: './card.html',
  styleUrl: './card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Card {}
