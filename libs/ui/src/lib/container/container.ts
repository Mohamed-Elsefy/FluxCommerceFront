/**
 * Container primitive for Sub-Phase 3.5 — Layout Primitives.
 *
 * Presentation only: centers page content within a responsive max-inline-size
 * and applies the system container padding. Full-bleed sections opt out via
 * `size="full"`. The feature decides WHAT goes inside — never layout policy.
 *
 * Responsive by construction (`inline-size: 100%` capped by
 * `max-inline-size`). Visual values come from `libs/theming` tokens — never
 * `ThemeService`. Non-interactive by design.
 *
 * SSR/hydration safe: pure markup + CSS. RTL safe: logical properties only
 * (`margin-inline` centering mirrors automatically).
 *
 * Uses `@Input()` decorators (not signal I/O): `libs/*` specs run under the
 * raw Vitest runner, which lacks the Angular compiler transform that
 * registers signal inputs — decorator metadata stays runtime-readable.
 */

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Content width constraint. `xl` is the system `--container-max-width`. */
export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

@Component({
  selector: 'flux-container',
  templateUrl: './container.html',
  styleUrl: './container.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Container {
  /** Content width constraint. */
  @Input() size: ContainerSize = 'xl';
}
