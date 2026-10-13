/**
 * ThemeToggle primitive for Sub-Phase 3.10 — Navigation & Shared Shell
 * Components.
 *
 * The single shared shell control that met all three ownership criteria
 * (actually reusable — both shells deferred it; business-agnostic; stable —
 * the Light/Dark binary is the theme model). Breadcrumb, PageHeader,
 * MobileMenu, and UserMenu were evaluated and deliberately not built: no
 * consumer exists for any of them yet (the user area already has the shared
 * `AuthNav`; navigation already composes `StorefrontNav`), and shared
 * libraries must not host speculative abstractions.
 *
 * Dumb by design: renders the switch affordance for a caller-owned `mode`
 * and emits `toggled` — state lives in `libs/theming` `ThemeService`,
 * wired by the composing shell (`[mode]="themes.theme()"`
 * `(toggled)="themes.toggleTheme()"`). This keeps `libs/ui` free of
 * `@flux/*` dependencies (Sub-Phase 3.1 boundary) while giving both shells
 * one shared affordance. The glyph composes the shared `Icon`.
 *
 * SSR/hydration safe: pure markup + CSS. RTL safe: symmetric control, no
 * directional properties. Keyboard behavior comes from the native button.
 *
 * Uses `@Input()`/`@Output()` decorators (not signal I/O): `libs/*` specs
 * run under the raw Vitest runner, which lacks the Angular compiler
 * transform that registers signal inputs — decorator metadata stays
 * runtime-readable.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { Icon } from '../icon/icon';

/**
 * Theme mode as seen by the toggle. Mirrors the `Theme` union from
 * `libs/theming`; redeclared locally so `libs/ui` never imports `@flux/*`.
 */
export type ThemeToggleMode = 'light' | 'dark';

@Component({
  selector: 'flux-theme-toggle',
  imports: [Icon],
  templateUrl: './theme-toggle.html',
  styleUrl: './theme-toggle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ThemeToggle {
  /** Current mode (caller-owned, e.g. the `ThemeService` signal). */
  @Input() mode: ThemeToggleMode = 'light';
  /** Emitted when the switch is activated — the caller performs the switch. */
  @Output() readonly toggled = new EventEmitter<void>();
}
