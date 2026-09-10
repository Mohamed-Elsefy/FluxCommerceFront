/**
 * Admin header for Sub-Phase 3.7 — Admin Application Shell.
 *
 * Composition only: mobile menu toggle (emitted to the parent shell, which
 * owns drawer state), application context title, and the Phase 2 `AuthNav`
 * for the authenticated admin user area (login/registration links hidden —
 * this portal has no such routes; the account entry points at the
 * dashboard). No auth logic lives here — `AuthService` signals stay inside
 * `AuthNav`.
 *
 * Theme switching is composed here (Sub-Phase 3.10): the shared dumb
 * `ThemeToggle` reflects `ThemeService` state and forwards activations to
 * it — this shell owns no theme logic.
 *
 * SSR/hydration safe: static markup plus an output emission, no browser
 * APIs. RTL safe: logical properties and direction-aware flex flow only.
 */

import { ChangeDetectionStrategy, Component, EventEmitter, Output, inject } from '@angular/core';
import { AuthNav } from '@flux/auth';
import { ThemeService } from '@flux/theming';
import { ThemeToggle } from '@flux/ui';

@Component({
  selector: 'admin-header',
  imports: [AuthNav, ThemeToggle],
  templateUrl: './header.html',
  styleUrl: './header.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminHeader {
  /** Central theme state (read-only here; toggled through the shared control). */
  protected readonly themes = inject(ThemeService);

  /** Emitted when the mobile drawer toggle is activated (parent shell owns the drawer). */
  @Output() readonly menuToggle = new EventEmitter<void>();
}
